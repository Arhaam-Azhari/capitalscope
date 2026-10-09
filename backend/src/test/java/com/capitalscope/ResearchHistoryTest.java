package com.capitalscope;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class ResearchHistoryTest {
    @Autowired WatchlistStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @BeforeEach @AfterEach void iClearMyHistoryFixtures() {
        jdbc.update("DELETE FROM research_watchlist WHERE ticker = 'AMD'");
        jdbc.update("DELETE FROM research_revisions WHERE ticker = 'AMD'");
    }
    private WatchlistStore.Draft draft(String thesis, WatchlistStore.Entry previous) {
        return new WatchlistStore.Draft("researching", thesis, "My risk", null, previous == null ? 0L : previous.version(), previous == null ? null : previous.entryId(), List.of("filings"));
    }
    @Test void iKeepImmutableSavedAndRemovedSnapshotsAcrossRecreation() throws Exception {
        var first = store.save("AMD", draft("My first thesis", null));
        var second = store.save("AMD", new WatchlistStore.Draft("archived", "My revised thesis", "My new risk", null, first.version(), first.entryId()));
        assertThrows(WatchlistStore.Conflict.class, () -> store.save("AMD", draft("My stale thesis", first)));
        assertThrows(WatchlistStore.Conflict.class, () -> store.remove("AMD", first.version(), first.entryId()));
        assertEquals(2, store.history("AMD", null).items().size());
        store.remove("AMD", second.version(), second.entryId());
        var replacement = store.save("AMD", draft("My replacement thesis", null));
        var history = store.history("amd", null);
        assertEquals(List.of("saved", "removed", "saved", "saved"), history.items().stream().map(WatchlistStore.Revision::action).toList());
        assertEquals(replacement, history.items().get(0).entry());
        assertEquals(second, history.items().get(1).entry());
        assertEquals(first, history.items().get(3).entry());
        assertEquals(List.of("filings"), second.checks());
        assertNotEquals(first.entryId(), replacement.entryId()); assertEquals(1, replacement.version());
        mvc.perform(get("/api/watchlist/AMD/history")).andExpect(status().isOk()).andExpect(jsonPath("$.items[1].action").value("removed"));
        mvc.perform(get("/api/watchlist/AMD/history?before=0")).andExpect(status().isBadRequest());
        assertThrows(IllegalArgumentException.class, () -> store.history("UNKNOWN", null));
    }
    @Test void iCaptureOnlyTheSurvivingLegacyBaselineAndKeepItsOriginalSaveDate() {
        jdbc.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, version, created_at, updated_at, research_checks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "AMD", "legacy-history-entry", "watching", "My surviving legacy thesis", "My older risk", 7, "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z", "risks");
        assertTrue(store.history("AMD", null).items().isEmpty());
        var legacy = store.list().stream().filter(e -> e.ticker().equals("AMD")).findFirst().orElseThrow();
        var started = java.time.Instant.now();
        store.save("AMD", draft("My first tracked edit", legacy));
        var history = store.history("AMD", null).items();
        assertEquals(2, history.size()); assertEquals("baseline", history.get(1).action());
        assertEquals(legacy, history.get(1).entry());
        assertFalse(history.get(1).recordedAt().isBefore(started));
    }
    @Test void iPageOlderRevisionsWithoutDuplicates() {
        WatchlistStore.Entry saved = null;
        for (int i = 1; i <= 25; i++) saved = store.save("AMD", draft("My thesis " + i, saved));
        var first = store.history("AMD", null); var second = store.history("AMD", first.nextBefore());
        assertEquals(20, first.items().size()); assertEquals(5, second.items().size()); assertNull(second.nextBefore());
        assertEquals(25, first.items().get(0).entry().version()); assertEquals(1, second.items().get(4).entry().version());
        var ids = new java.util.HashSet<Long>();
        first.items().forEach(item -> assertTrue(ids.add(item.id()))); second.items().forEach(item -> assertTrue(ids.add(item.id())));
    }
    @Test void iRollBackTheSavedRecordWhenItsHistoryCannotBeWritten() {
        var first = store.save("AMD", draft("My durable thesis", null));
        jdbc.execute("ALTER TABLE research_revisions ADD CONSTRAINT history_test_guard CHECK (thesis <> 'My rejected history')");
        try {
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> store.save("AMD", draft("My rejected history", first)));
            assertEquals(first, store.list().stream().filter(e -> e.ticker().equals("AMD")).findFirst().orElseThrow());
            assertEquals(1, store.history("AMD", null).items().size());
        } finally { jdbc.execute("ALTER TABLE research_revisions DROP CONSTRAINT history_test_guard"); }
    }
    @Test void iRecordOnlyOneWinnerWhenTwoSessionsSaveTheSameVersion() throws Exception {
        var first = store.save("AMD", draft("My initial thesis", null));
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var saves = executor.invokeAll(List.of(
                () -> { try { store.save("AMD", draft("My concurrent thesis A", first)); return true; } catch (WatchlistStore.Conflict e) { return false; } },
                () -> { try { store.save("AMD", draft("My concurrent thesis B", first)); return true; } catch (WatchlistStore.Conflict e) { return false; } }
            ));
            assertEquals(1, saves.stream().filter(future -> { try { return Boolean.TRUE.equals(future.get()); } catch (Exception e) { throw new RuntimeException(e); } }).count());
            assertEquals(2, store.history("AMD", null).items().size());
        } finally { executor.shutdownNow(); }
    }
    @Test void iUpgradeExistingResearchWithoutInventingPastRevisions() {
        String url = "jdbc:h2:mem:history-migration;DB_CLOSE_DELAY=-1";
        org.flywaydb.core.Flyway.configure().dataSource(url, "sa", "").target("7").load().migrate();
        var legacy = new JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource(url, "sa", ""));
        legacy.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, version, created_at, updated_at, research_checks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "AMD", "my-migrated-entry", "watching", "My existing thesis", "My existing risk", 4, "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z", "filings");
        var before = new WatchlistStore(legacy).list().get(0);
        org.flywaydb.core.Flyway.configure().dataSource(url, "sa", "").load().migrate();
        var migrated = new WatchlistStore(legacy);
        assertEquals(before, migrated.list().get(0));
        assertTrue(migrated.history("AMD", null).items().isEmpty());
    }

    @Test void iExportEveryRecordedRevisionWithSafeTextAndSeparateCaptureDates() throws Exception {
        mvc.perform(get("/api/watchlist/AMD/history/export.csv")).andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", "attachment; filename=research-history.csv"))
            .andExpect(content().contentTypeCompatibleWith("text/csv"));
        jdbc.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, version, created_at, updated_at, research_checks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "AMD", "my-export-baseline", "watching", "=My \"first\", thesis\r\nSecond line", "@My risk", 7, "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z", "risks");
        var saved = store.list().stream().filter(e -> e.ticker().equals("AMD")).findFirst().orElseThrow();
        for (int n = 0; n < 25; n++) saved = store.save("AMD", draft("My export revision " + n, saved));
        store.remove("AMD", saved.version(), saved.entryId());
        var revisions = store.historyForExport("amd");
        assertEquals(27, revisions.size());
        var result = mvc.perform(get("/api/watchlist/AMD/history/export.csv")).andExpect(status().isOk()).andReturn();
        String csv = result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\"revision_id\",\"action\",\"recorded_at\""));
        assertTrue(csv.contains("\"'=My \"\"first\"\", thesis\r\nSecond line\""));
        assertTrue(csv.contains("\"'@My risk\""));
        assertTrue(csv.contains("\"2026-10-02T00:00:00Z\""));
        assertTrue(csv.contains("Recorded snapshots only; legacy baselines do not reconstruct earlier edits"));
        assertTrue(csv.contains("\"user_reviewed_filings\""));
        var matcher = java.util.regex.Pattern.compile("^(\\d+),\"(?:baseline|saved|removed)\",", java.util.regex.Pattern.MULTILINE).matcher(csv);
        var ids = new java.util.ArrayList<Long>();
        while (matcher.find()) ids.add(Long.parseLong(matcher.group(1)));
        assertEquals(revisions.stream().map(WatchlistStore.Revision::id).toList(), ids);
        assertEquals("baseline", revisions.get(0).action()); assertEquals("removed", revisions.get(26).action());
        mvc.perform(get("/api/watchlist/UNKNOWN/history/export.csv")).andExpect(status().isBadRequest());
    }

}

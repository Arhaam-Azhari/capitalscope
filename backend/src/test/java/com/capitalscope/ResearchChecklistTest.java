package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Arrays;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class ResearchChecklistTest {
    @Autowired WatchlistStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Test void iKeepSavedChecksWhenOlderClientsOmitThemAndRejectStaleChanges() throws Exception {
        jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "META");
        try {
            mvc.perform(put("/api/watchlist/META").contentType("application/json").content("{\"status\":\"researching\",\"thesis\":\"My checklist thesis\",\"version\":0,\"checks\":[\"risks\",\"filings\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.checks[0]").value("filings")).andExpect(jsonPath("$.checks[1]").value("risks"));
            var saved = store.list().stream().filter(e -> e.ticker().equals("META")).findFirst().orElseThrow();
            var older = store.save("META", new WatchlistStore.Draft("watching", "My older-client note", "", null, saved.version(), saved.entryId()));
            assertEquals(List.of("filings", "risks"), older.checks());
            assertThrows(WatchlistStore.Conflict.class, () -> store.save("META", new WatchlistStore.Draft("watching", "My stale checklist", "", null, saved.version(), saved.entryId(), List.of("cash_flow"))));
            assertEquals(older, store.list().stream().filter(e -> e.ticker().equals("META")).findFirst().orElseThrow());
            var cleared = store.save("META", new WatchlistStore.Draft("watching", "My cleared checks", "", null, older.version(), older.entryId(), List.of()));
            assertEquals(List.of(), cleared.checks());
            assertEquals(older.version() + 1, cleared.version());
        } finally { jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "META"); }
    }
    @Test void iRejectUnknownDuplicateAndNullChecksBeforeSaving() throws Exception {
        for (var checks : List.of(List.of("buy"), List.of("filings", "filings"), Arrays.asList((String) null))) {
            assertThrows(IllegalArgumentException.class, () -> store.save("DEMO", new WatchlistStore.Draft("watching", "", "", null, 0L, null, checks)));
        }
        mvc.perform(put("/api/watchlist/DEMO").contentType("application/json").content("{\"status\":\"watching\",\"version\":0,\"checks\":[\"unknown\"]}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Choose each supported research check at most once."));
    }
    @Test void iMigrateExistingWatchlistNotesWithoutInventingCompletedResearch() {
        String url = "jdbc:h2:mem:checklist-migration;DB_CLOSE_DELAY=-1";
        org.flywaydb.core.Flyway.configure().dataSource(url, "sa", "").target("6").load().migrate();
        var legacy = new JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource(url, "sa", ""));
        legacy.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            "AAPL", "my-legacy-entry", "watching", "My existing thesis", "My existing risk", 4, "2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z");
        org.flywaydb.core.Flyway.configure().dataSource(url, "sa", "").load().migrate();
        var entry = new WatchlistStore(legacy).list().get(0);
        assertEquals("My existing thesis", entry.thesis()); assertEquals("My existing risk", entry.risks());
        assertEquals(4, entry.version()); assertEquals("my-legacy-entry", entry.entryId()); assertTrue(entry.checks().isEmpty());
    }
}

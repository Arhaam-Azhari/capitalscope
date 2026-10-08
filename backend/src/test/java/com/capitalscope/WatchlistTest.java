package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import java.time.LocalDate;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class WatchlistTest {
    @Autowired WatchlistStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Test void iDownloadResearchFromStorageWithoutChangingItsVersion() throws Exception {
        jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "NVDA");
        try {
            var saved = store.save("NVDA", new WatchlistStore.Draft("archived", "=My saved export", "My risks", null, 0L, null));
            mvc.perform(get("/api/watchlist/export.csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=watchlist-research.csv"))
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"NVDA\",\"NVIDIA\",\"Technology\",\"market\",\"archived\",\"'=My saved export\"")));
            assertEquals(saved, store.list().stream().filter(e -> e.ticker().equals("NVDA")).findFirst().orElseThrow());
        } finally { jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "NVDA"); }
    }
    @Test void iSaveCanonicalTickersAndPreventStaleEditsOrDeletes() throws Exception {
        jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "AAPL");
        try {
            mvc.perform(put("/api/watchlist/aapl").contentType("application/json").content("{\"status\":\"watching\",\"thesis\":\" My first thesis \",\"risks\":\"Margins\",\"reviewDate\":\"2026-12-01\",\"version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ticker").value("AAPL"))
                .andExpect(jsonPath("$.thesis").value("My first thesis")).andExpect(jsonPath("$.version").value(1));
            var initial = store.list().stream().filter(e -> e.ticker().equals("AAPL")).findFirst().orElseThrow();
            var revised = store.save("AAPL", new WatchlistStore.Draft("researching", "My revised thesis", "Margins", LocalDate.of(2026, 12, 2), 1L, initial.entryId()));
            assertEquals(2, revised.version()); assertEquals(initial.createdAt(), revised.createdAt());
            mvc.perform(put("/api/watchlist/AAPL").contentType("application/json").content("{\"status\":\"watching\",\"thesis\":\"My stale overwrite\",\"version\":1}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("another session")));
            mvc.perform(delete("/api/watchlist/AAPL").param("version", "1").param("entryId", initial.entryId())).andExpect(status().isConflict());
            mvc.perform(put("/api/watchlist/AAPL").contentType("application/json").content("{\"status\":\"watching\",\"version\":0}"))
                .andExpect(status().isConflict());
            assertEquals("My revised thesis", store.list().stream().filter(e -> e.ticker().equals("AAPL")).findFirst().orElseThrow().thesis());
            mvc.perform(delete("/api/watchlist/AAPL").param("version", "2").param("entryId", initial.entryId())).andExpect(status().isNoContent());
            var replacement = store.save("AAPL", new WatchlistStore.Draft("watching", "My replacement thesis", "", null, 0L, null));
            assertNotEquals(initial.entryId(), replacement.entryId());
            assertThrows(WatchlistStore.Conflict.class, () -> store.save("AAPL", new WatchlistStore.Draft("watching", "My stale draft", "", null, 1L, initial.entryId())));
            assertThrows(WatchlistStore.Conflict.class, () -> store.remove("AAPL", 1L, initial.entryId()));
            store.remove("AAPL", replacement.version(), replacement.entryId());
            assertFalse(store.list().stream().anyMatch(e -> e.ticker().equals("AAPL")));
        } finally { jdbc.update("DELETE FROM research_watchlist WHERE ticker = ?", "AAPL"); }
    }
    @Test void iRejectUnknownTickersInvalidDatesAndOversizedResearch() throws Exception {
        mvc.perform(put("/api/watchlist/UNKNOWN").contentType("application/json").content("{\"status\":\"watching\",\"version\":0}"))
            .andExpect(status().isBadRequest());
        for (String json : new String[]{"{\"status\":\"buy\",\"version\":0}", "{\"status\":\"watching\",\"version\":-1}",
            "{\"status\":\"watching\",\"reviewDate\":\"2026-02-30\",\"version\":0}"})
            mvc.perform(put("/api/watchlist/DEMO").contentType("application/json").content(json)).andExpect(status().isBadRequest());
        assertThrows(IllegalArgumentException.class, () -> store.save("DEMO", new WatchlistStore.Draft("watching", "x".repeat(2001), "", null, 0L, null)));
        assertThrows(IllegalArgumentException.class, () -> store.save("DEMO", new WatchlistStore.Draft("watching", "", "x".repeat(1001), null, 0L, null)));
    }
}

package com.capitalscope;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class ValuationPriceContextApiTest {
    @Autowired MockMvc mvc;
    @Autowired ResearchStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Test void iUseStoredEvidenceWithoutAnApiKeyAndLeaveSavedModelsUnchanged() throws Exception {
        var scenario = store.saveScenario("AAPL", "My price context", new DcfCalculator.Assumptions(1000000, 0.05, 0.1, 0.02, 5, 0, 100000));
        var fetched = Instant.now().minusSeconds(172800);
        var quote = new PriceHistory("AAPL", "USD", false, "market", "My expired test quote", "https://example.com/prices", fetched,
            List.of(new PriceHistory.Day("2026-10-01", BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, new BigDecimal("100"), 1)));
        jdbc.update("DELETE FROM daily_prices WHERE ticker = ?", "AAPL");
        jdbc.update("INSERT INTO daily_prices(ticker, fetched_at, payload) VALUES (?, ?, ?)", "AAPL", fetched.toString(), mapper.writeValueAsString(quote));
        try {
            mvc.perform(get("/api/companies/AAPL/scenarios/price-context")).andExpect(status().isOk())
                .andExpect(jsonPath("$.quote.close").value(100)).andExpect(jsonPath("$.quote.retrievedAt").value(fetched.toString()))
                .andExpect(jsonPath("$.shareBasisConfirmed").value(false)).andExpect(jsonPath("$.scenarios[0].relativeGap").isEmpty());
            var body = mvc.perform(get("/api/companies/aapl/scenarios/price-context").param("shareBasisConfirmed", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ticker").value("AAPL"))
                .andExpect(jsonPath("$.quote.priceDate").value("2026-10-01")).andReturn().getResponse().getContentAsString();
            var result = mapper.readValue(body, ValuationPriceContext.Result.class);
            var saved = result.scenarios().stream().filter(item -> item.id().equals(scenario.id())).findFirst().orElseThrow();
            assertEquals(0, BigDecimal.valueOf(scenario.result().valuePerShare()).subtract(new BigDecimal("100")).compareTo(saved.valueMinusClose()));
            assertEquals(scenario, store.scenarios("AAPL").stream().filter(item -> item.id().equals(scenario.id())).findFirst().orElseThrow());
        } finally { jdbc.update("DELETE FROM daily_prices WHERE ticker = ?", "AAPL"); store.deleteScenario("AAPL", scenario.id()); }
        mvc.perform(get("/api/companies/AAPL/scenarios/price-context").param("shareBasisConfirmed", "true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.quote").isEmpty()).andExpect(jsonPath("$.quoteError").isNotEmpty());
        mvc.perform(get("/api/companies/DEMO/scenarios/price-context"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.dataMode").value("example")).andExpect(jsonPath("$.quote.close").value(21.6));
        mvc.perform(get("/api/companies/UNKNOWN/scenarios/price-context")).andExpect(status().isBadRequest());
    }
}

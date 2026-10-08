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
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class PortfolioValuationApiTest {
    @Autowired PortfolioService portfolios;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Test void iUseAnExpiredStoredSnapshotWithoutNeedingAnApiKey() throws Exception {
        var id = portfolios.create(new PortfolioService.NewPortfolio("My marked portfolio", "market", new BigDecimal("1000"))).portfolio().id();
        portfolios.trade(id, new PortfolioService.Fill(UUID.randomUUID().toString(), "AAPL", "BUY", new BigDecimal("2"), new BigDecimal("100"), BigDecimal.ONE));
        Instant fetched = Instant.now().minusSeconds(172800);
        var history = new PriceHistory("AAPL", "USD", false, "market", "My cached test prices", null, fetched,
            List.of(new PriceHistory.Day("2026-10-01", BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, new BigDecimal("120"), 1)));
        jdbc.update("DELETE FROM daily_prices WHERE ticker = ?", "AAPL");
        jdbc.update("INSERT INTO daily_prices(ticker, fetched_at, payload) VALUES (?, ?, ?)", "AAPL", fetched.toString(), mapper.writeValueAsString(history));
        try {
            mvc.perform(get("/api/portfolios/" + id + "/valuation")).andExpect(status().isOk())
                .andExpect(jsonPath("$.complete").value(true)).andExpect(jsonPath("$.cash").value(799))
                .andExpect(jsonPath("$.totalValue").value(1039)).andExpect(jsonPath("$.unrealizedPnl").value(39))
                .andExpect(jsonPath("$.holdings[0].priceDate").value("2026-10-01"))
                .andExpect(jsonPath("$.holdings[0].retrievedAt").value(fetched.toString()));
            mvc.perform(get("/api/portfolios/missing/valuation")).andExpect(status().isNotFound());
        } finally { jdbc.update("DELETE FROM daily_prices WHERE ticker = ?", "AAPL"); }
    }
    @Test void iStressCurrentServerHoldingsWithoutWritingLedgerEvents() throws Exception {
        var id = portfolios.create(new PortfolioService.NewPortfolio("My stress test", "example", new BigDecimal("1000"))).portfolio().id();
        portfolios.trade(id, new PortfolioService.Fill(UUID.randomUUID().toString(), "DEMO", "BUY", new BigDecimal("10"), new BigDecimal("20"), BigDecimal.ONE));
        var before = mapper.writeValueAsString(portfolios.summary(id));
        mvc.perform(post("/api/portfolios/" + id + "/stress").contentType("application/json")
            .content("{\"defaultShock\":-0.2,\"sectorShocks\":{}}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.baseline.cash").value(799))
            .andExpect(jsonPath("$.baseline.totalValue").value(1015)).andExpect(jsonPath("$.stressedTotalValue").value(971.8))
            .andExpect(jsonPath("$.change").value(-43.2)).andExpect(jsonPath("$.holdings[0].baseline.priceDate").value("2026-09-19"));
        org.junit.jupiter.api.Assertions.assertEquals(before, mapper.writeValueAsString(portfolios.summary(id)));
        mvc.perform(post("/api/portfolios/" + id + "/stress").contentType("application/json").content("{\"defaultShock\":-2}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/portfolios/missing/stress").contentType("application/json").content("{\"defaultShock\":0}"))
            .andExpect(status().isNotFound());
    }

}

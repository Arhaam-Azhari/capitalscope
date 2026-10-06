package com.capitalscope;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.Path;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class PersistenceTest {
    @TempDir Path directory;
    @Test void dataSurvivesClosingAndReopeningTheDatabase() throws Exception {
        String url = "jdbc:h2:file:" + directory.resolve("research");
        var mapper = new ObjectMapper().findAndRegisterModules();
        var first = new DriverManagerDataSource(url, "sa", "");
        Flyway.configure().dataSource(first).load().migrate();
        var store = new ResearchStore(new JdbcTemplate(first), mapper);
        var assumptions = new DcfCalculator.Assumptions(100, 0, .1, 0, 5, 100, 10);
        var scenario = store.saveScenario("AAPL", "My base case", assumptions);
        Instant fetched = Instant.parse("2026-10-01T12:00:00Z");
        store.saveSnapshot("https://example.test/facts", new SecClient.Snapshot(mapper.readTree("{\"old\":true}"), fetched));
        store.saveSnapshot("https://example.test/facts", new SecClient.Snapshot(mapper.readTree("{\"value\":42}"), fetched));
        var portfolios = new PortfolioService(new JdbcTemplate(first));
        var portfolio = portfolios.create(new PortfolioService.NewPortfolio("My reopened portfolio", "example", new java.math.BigDecimal("1000")));
        portfolios.trade(portfolio.portfolio().id(), new PortfolioService.Fill(java.util.UUID.randomUUID().toString(), "DEMO", "BUY", java.math.BigDecimal.ONE, new java.math.BigDecimal("20"), java.math.BigDecimal.ZERO));
        new JdbcTemplate(first).execute("SHUTDOWN");
        var reopened = new ResearchStore(new JdbcTemplate(new DriverManagerDataSource(url, "sa", "")), mapper);
        var reopenedPortfolio = new PortfolioService(new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""))).summary(portfolio.portfolio().id());
        assertEquals(1, reopenedPortfolio.trades().size());
        assertEquals(0, new java.math.BigDecimal("980").compareTo(reopenedPortfolio.cash()));
        var saved = reopened.scenarios("AAPL").get(0);
        assertEquals(scenario.id(), saved.id());
        assertEquals(assumptions, saved.assumptions());
        assertEquals(90, saved.result().valuePerShare(), 1e-8);
        assertEquals("fcff-v1", saved.modelVersion());
        assertTrue(reopened.scenarios("MSFT").isEmpty());
        assertFalse(reopened.deleteScenario("MSFT", saved.id()));
        assertEquals(fetched, reopened.snapshot("https://example.test/facts").fetchedAt());
        assertEquals(42, reopened.snapshot("https://example.test/facts").data().path("value").asInt());
        assertTrue(reopened.deleteScenario("AAPL", saved.id()));
        assertTrue(reopened.scenarios("AAPL").isEmpty());
    }
}

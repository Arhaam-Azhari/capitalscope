package com.capitalscope;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Repository
public class PortfolioStressStore {
    public record SaveRequest(String name, PortfolioStress.Assumptions assumptions) {}
    public record Scenario(String id, String portfolioId, String name, Instant createdAt,
                           String modelVersion, PortfolioStress.Result result) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PortfolioService portfolios;
    private final PriceClient prices;
    public PortfolioStressStore(JdbcTemplate jdbc, ObjectMapper mapper, PortfolioService portfolios, PriceClient prices) {
        this.jdbc = jdbc; this.mapper = mapper; this.portfolios = portfolios; this.prices = prices;
    }
    public List<Scenario> list(String portfolioId) {
        portfolios.summary(portfolioId);
        return jdbc.query("SELECT * FROM portfolio_stress_scenarios WHERE portfolio_id = ? ORDER BY created_at DESC, id DESC",
            (rs, row) -> new Scenario(rs.getString("id"), portfolioId, rs.getString("name"), Instant.parse(rs.getString("created_at")),
                rs.getString("model_version"), read(rs.getString("result"))), portfolioId);
    }
    public Scenario find(String portfolioId, String id) {
        return jdbc.query("SELECT * FROM portfolio_stress_scenarios WHERE portfolio_id = ? AND id = ?",
            (rs, row) -> new Scenario(rs.getString("id"), portfolioId, rs.getString("name"), Instant.parse(rs.getString("created_at")),
                rs.getString("model_version"), read(rs.getString("result"))), portfolioId, id).stream().findFirst()
            .orElseThrow(() -> new NoSuchElementException("This saved stress scenario was not found in this portfolio."));
    }
    @Transactional
    public Scenario save(String portfolioId, SaveRequest request) {
        if (request.name() == null || request.name().isBlank() || request.name().strip().length() > 80)
            throw new IllegalArgumentException("Give this stress scenario a name between 1 and 80 characters.");
        // I calculate the saved snapshot myself instead of accepting client-supplied holdings or results.
        var baseline = PortfolioValuation.calculate(portfolios.summary(portfolioId), Instant.now(), prices::storedHistory);
        var result = PortfolioStress.calculate(baseline, request.assumptions());
        var scenario = new Scenario(UUID.randomUUID().toString(), portfolioId, request.name().strip(), Instant.now(), "price-shock-v1", result);
        jdbc.update("INSERT INTO portfolio_stress_scenarios(id, portfolio_id, name, created_at, model_version, result) VALUES (?, ?, ?, ?, ?, ?)",
            scenario.id(), portfolioId, scenario.name(), scenario.createdAt().toString(), scenario.modelVersion(), json(result));
        return scenario;
    }
    public boolean delete(String portfolioId, String id) {
        portfolios.summary(portfolioId);
        return jdbc.update("DELETE FROM portfolio_stress_scenarios WHERE portfolio_id = ? AND id = ?", portfolioId, id) > 0;
    }
    private String json(PortfolioStress.Result value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not save this stress scenario.", e); }
    }
    private PortfolioStress.Result read(String value) {
        try { return mapper.readValue(value, PortfolioStress.Result.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not read this stress scenario.", e); }
    }
}

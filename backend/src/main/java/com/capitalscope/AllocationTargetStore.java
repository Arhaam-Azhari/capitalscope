package com.capitalscope;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Repository
public class AllocationTargetStore {
    public record SaveRequest(String name, Map<String, BigDecimal> targets) {}
    public record Preset(String id, String portfolioId, String name, Instant createdAt, String dataMode,
                         String modelVersion, Map<String, BigDecimal> targets) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PortfolioService portfolios;
    public AllocationTargetStore(JdbcTemplate jdbc, ObjectMapper mapper, PortfolioService portfolios) {
        this.jdbc = jdbc; this.mapper = mapper; this.portfolios = portfolios;
    }
    public List<Preset> list(String portfolioId) {
        portfolios.summary(portfolioId);
        return jdbc.query("SELECT * FROM portfolio_allocation_targets WHERE portfolio_id = ? ORDER BY created_at DESC, id DESC",
            (rs, row) -> new Preset(rs.getString("id"), portfolioId, rs.getString("name"), Instant.parse(rs.getString("created_at")),
                rs.getString("data_mode"), rs.getString("model_version"), read(rs.getString("targets"))), portfolioId);
    }
    @Transactional
    public Preset save(String portfolioId, SaveRequest request) {
        // I use the trade lock while checking ticker membership so a concurrent fill cannot change the saved target set.
        jdbc.query("SELECT id FROM practice_portfolios WHERE id = ? FOR UPDATE", (rs, row) -> rs.getString("id"), portfolioId)
            .stream().findFirst().orElseThrow(() -> new NoSuchElementException("This portfolio was not found."));
        var summary = portfolios.summary(portfolioId);
        if (request.name() == null || request.name().isBlank() || request.name().strip().length() > 80)
            throw new IllegalArgumentException("Name these allocation targets using 1–80 characters.");
        Set<String> assets = new HashSet<>(); assets.add("Cash");
        summary.positions().forEach(position -> assets.add(position.ticker()));
        if (request.targets() == null || !request.targets().keySet().equals(assets))
            throw new IllegalArgumentException("Targets must include Cash and exactly the portfolio's current holdings.");
        BigDecimal total = BigDecimal.ZERO;
        Map<String, BigDecimal> targets = new TreeMap<>();
        for (var entry : request.targets().entrySet()) {
            var value = entry.getValue();
            if (value == null || value.signum() < 0 || value.compareTo(new BigDecimal("100")) > 0 || value.stripTrailingZeros().scale() > 2)
                throw new IllegalArgumentException("Targets must be from 0 to 100, using up to two decimal places.");
            targets.put(entry.getKey(), value); total = total.add(value);
        }
        if (total.compareTo(new BigDecimal("100")) != 0) throw new IllegalArgumentException("Targets must total exactly 100%.");
        var preset = new Preset(UUID.randomUUID().toString(), portfolioId, request.name().strip(), Instant.now(),
            summary.portfolio().mode(), "allocation-targets-v1", Collections.unmodifiableMap(targets));
        jdbc.update("INSERT INTO portfolio_allocation_targets(id, portfolio_id, name, created_at, data_mode, model_version, targets) VALUES (?, ?, ?, ?, ?, ?, ?)",
            preset.id(), portfolioId, preset.name(), preset.createdAt().toString(), preset.dataMode(), preset.modelVersion(), json(targets));
        return preset;
    }
    public boolean delete(String portfolioId, String id) {
        portfolios.summary(portfolioId);
        return jdbc.update("DELETE FROM portfolio_allocation_targets WHERE portfolio_id = ? AND id = ?", portfolioId, id) > 0;
    }
    private String json(Map<String, BigDecimal> targets) {
        try { return mapper.writeValueAsString(targets); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not save allocation targets.", e); }
    }
    private Map<String, BigDecimal> read(String value) {
        try { return mapper.readValue(value, new TypeReference<Map<String, BigDecimal>>() {}); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not read allocation targets.", e); }
    }
}

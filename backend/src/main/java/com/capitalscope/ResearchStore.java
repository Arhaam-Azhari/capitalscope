package com.capitalscope;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class ResearchStore {
    public record Scenario(String id, String ticker, String name, Instant createdAt,
        DcfCalculator.Assumptions assumptions, DcfCalculator.Valuation result, String modelVersion) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public ResearchStore(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    public SecClient.Snapshot snapshot(String url) {
        return jdbc.query("SELECT payload, fetched_at FROM sec_snapshots WHERE source_url = ?",
            (rs, row) -> new SecClient.Snapshot(read(rs.getString(1), com.fasterxml.jackson.databind.JsonNode.class),
                Instant.parse(rs.getString(2))), url).stream().findFirst().orElse(null);
    }

    @Transactional
    public void saveSnapshot(String url, SecClient.Snapshot snapshot) {
        // I replace the cache entry only after a successful import.
        jdbc.update("DELETE FROM sec_snapshots WHERE source_url = ?", url);
        jdbc.update("INSERT INTO sec_snapshots(source_url, fetched_at, payload) VALUES (?, ?, ?)",
            url, snapshot.fetchedAt().toString(), json(snapshot.data()));
    }

    public List<Scenario> scenarios(String ticker) {
        return jdbc.query("SELECT * FROM valuation_scenarios WHERE ticker = ? ORDER BY created_at DESC, id DESC",
            (rs, row) -> new Scenario(rs.getString("id"), rs.getString("ticker"), rs.getString("name"),
                Instant.parse(rs.getString("created_at")), read(rs.getString("assumptions"), DcfCalculator.Assumptions.class),
                read(rs.getString("result"), DcfCalculator.Valuation.class), rs.getString("model_version")), ticker);
    }

    public Scenario saveScenario(String ticker, String name, DcfCalculator.Assumptions assumptions) {
        if (name == null || name.isBlank() || name.strip().length() > 80)
            throw new IllegalArgumentException("Give this scenario a name between 1 and 80 characters.");
        if (assumptions == null) throw new IllegalArgumentException("Provide valuation assumptions.");
        var result = DcfCalculator.calculate(assumptions);
        var scenario = new Scenario(UUID.randomUUID().toString(), ticker, name.strip(), Instant.now(), assumptions, result, "fcff-v1");
        jdbc.update("INSERT INTO valuation_scenarios(id, ticker, name, created_at, assumptions, result, model_version) VALUES (?, ?, ?, ?, ?, ?, ?)",
            scenario.id(), ticker, scenario.name(), scenario.createdAt().toString(), json(assumptions), json(result), scenario.modelVersion());
        return scenario;
    }

    public boolean deleteScenario(String ticker, String id) {
        return jdbc.update("DELETE FROM valuation_scenarios WHERE ticker = ? AND id = ?", ticker, id) > 0;
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not save research data.", e); }
    }
    private <T> T read(String json, Class<T> type) {
        try { return mapper.readValue(json, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not read saved research data.", e); }
    }
}

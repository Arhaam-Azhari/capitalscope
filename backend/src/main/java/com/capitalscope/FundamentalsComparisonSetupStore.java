package com.capitalscope;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public class FundamentalsComparisonSetupStore {
    public record SaveRequest(String name, List<String> tickers, String measure) {}
    public record Setup(String id, String name, List<String> tickers, String measure, Instant createdAt, String modelVersion) {}
    private static final Set<String> MEASURES = Set.of("revenue", "growth", "net-margin", "ocf-margin", "cash-after-capex", "cash-margin");
    private final JdbcTemplate jdbc;
    public FundamentalsComparisonSetupStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public List<Setup> list() {
        return jdbc.query("SELECT * FROM fundamentals_comparison_setups ORDER BY created_at DESC, id DESC", (rs, row) ->
            new Setup(rs.getString("id"), rs.getString("name"),
                Arrays.asList(rs.getString("ticker_1"), rs.getString("ticker_2"), rs.getString("ticker_3"), rs.getString("ticker_4")).stream().filter(value -> value != null).toList(),
                rs.getString("measure"), Instant.parse(rs.getString("created_at")), rs.getString("model_version")));
    }
    public Setup save(SaveRequest request) {
        if (request.name() == null || request.name().isBlank() || request.name().strip().length() > 80)
            throw new IllegalArgumentException("Name this comparison setup using 1–80 characters.");
        if (request.tickers() == null || request.tickers().size() < 2 || request.tickers().size() > 4)
            throw new IllegalArgumentException("Choose two to four distinct catalog companies.");
        List<String> tickers = request.tickers().stream().map(CompanyCatalog::find).map(CompanyCatalog.Company::ticker).toList();
        if (new HashSet<>(tickers).size() != tickers.size()) throw new IllegalArgumentException("Choose distinct catalog companies.");
        if (request.measure() == null || !MEASURES.contains(request.measure())) throw new IllegalArgumentException("Choose a supported fundamentals measure.");
        // I save the selection only; reopening it retrieves current reports rather than stored results.
        var setup = new Setup(UUID.randomUUID().toString(), request.name().strip(), tickers, request.measure(), Instant.now(), "fundamentals-comparison-v1");
        jdbc.update("INSERT INTO fundamentals_comparison_setups(id, name, ticker_1, ticker_2, ticker_3, ticker_4, measure, created_at, model_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            setup.id(), setup.name(), tickers.get(0), tickers.get(1), tickers.size() > 2 ? tickers.get(2) : null,
            tickers.size() > 3 ? tickers.get(3) : null, setup.measure(), setup.createdAt().toString(), setup.modelVersion());
        return setup;
    }
    public boolean delete(String id) { return jdbc.update("DELETE FROM fundamentals_comparison_setups WHERE id = ?", id) > 0; }
}

package com.capitalscope;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class PriceComparisonSetupStore {
    public record SaveRequest(String name, String referenceTicker, LocalDate startDate, LocalDate endDate) {}
    public record Setup(String id, String currentTicker, String referenceTicker, String name, LocalDate startDate,
                        LocalDate endDate, Instant createdAt, String modelVersion) {}
    private final JdbcTemplate jdbc;
    public PriceComparisonSetupStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public List<Setup> list(String ticker) {
        String current = CompanyCatalog.find(ticker).ticker();
        return jdbc.query("SELECT * FROM price_comparison_setups WHERE current_ticker = ? ORDER BY created_at DESC, id DESC",
            (rs, row) -> new Setup(rs.getString("id"), current, rs.getString("reference_ticker"), rs.getString("name"),
                LocalDate.parse(rs.getString("start_date")), LocalDate.parse(rs.getString("end_date")),
                Instant.parse(rs.getString("created_at")), rs.getString("model_version")), current);
    }
    public Setup save(String ticker, SaveRequest request) {
        String current = CompanyCatalog.find(ticker).ticker();
        String reference = CompanyCatalog.find(request.referenceTicker()).ticker();
        if (current.equals(reference)) throw new IllegalArgumentException("Choose two distinct market companies.");
        if (request.name() == null || request.name().isBlank() || request.name().strip().length() > 80)
            throw new IllegalArgumentException("Name this comparison setup using 1–80 characters.");
        var start = request.startDate(); var end = request.endDate();
        if (start == null || end == null || start.isAfter(end) || start.getYear() < 1 || end.getYear() > 9999)
            throw new IllegalArgumentException("Choose ordered start and end dates with years from 0001 through 9999.");
        var setup = new Setup(UUID.randomUUID().toString(), current, reference, request.name().strip(), start, end,
            Instant.now(), "price-comparison-setup-v1");
        jdbc.update("INSERT INTO price_comparison_setups(id, current_ticker, reference_ticker, name, start_date, end_date, created_at, model_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            setup.id(), current, reference, setup.name(), start.toString(), end.toString(), setup.createdAt().toString(), setup.modelVersion());
        return setup;
    }
    public boolean delete(String ticker, String id) {
        String current = CompanyCatalog.find(ticker).ticker();
        return jdbc.update("DELETE FROM price_comparison_setups WHERE current_ticker = ? AND id = ?", current, id) > 0;
    }
}

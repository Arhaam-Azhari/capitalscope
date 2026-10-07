package com.capitalscope;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Repository
public class WatchlistStore {
    public record Entry(String entryId, String ticker, String status, String thesis, String risks, LocalDate reviewDate,
                        long version, Instant createdAt, Instant updatedAt) {}
    public record Draft(String status, String thesis, String risks, LocalDate reviewDate, Long version, String entryId) {}
    public static class Conflict extends RuntimeException {
        public Conflict() { super("This watchlist entry changed in another session. Reload the watchlist before saving or removing it."); }
    }
    private final JdbcTemplate jdbc;
    public WatchlistStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    private String ticker(String value) { return "DEMO".equalsIgnoreCase(value) ? "DEMO" : CompanyCatalog.find(value).ticker(); }
    public List<Entry> list() {
        return jdbc.query("SELECT * FROM research_watchlist ORDER BY updated_at DESC, ticker", (rs, i) -> new Entry(
            rs.getString("entry_id"), rs.getString("ticker"), rs.getString("status"), rs.getString("thesis"), rs.getString("risks"),
            rs.getString("review_date") == null ? null : LocalDate.parse(rs.getString("review_date")), rs.getLong("version"),
            Instant.parse(rs.getString("created_at")), Instant.parse(rs.getString("updated_at"))));
    }
    @Transactional
    public Entry save(String symbol, Draft draft) {
        String ticker = ticker(symbol);
        if (!Set.of("watching", "researching", "archived").contains(draft.status() == null ? "" : draft.status()))
            throw new IllegalArgumentException("Choose watching, researching, or archived.");
        if (draft.version() == null || draft.version() < 0 || draft.version() == Long.MAX_VALUE)
            throw new IllegalArgumentException("Provide the saved version, or zero for a new entry.");
        String thesis = draft.thesis() == null ? "" : draft.thesis().strip();
        String risks = draft.risks() == null ? "" : draft.risks().strip();
        if (thesis.length() > 2000 || risks.length() > 1000) throw new IllegalArgumentException("Keep the thesis within 2,000 characters and risks within 1,000.");
        if (draft.reviewDate() != null && (draft.reviewDate().getYear() < 1900 || draft.reviewDate().getYear() > 2100))
            throw new IllegalArgumentException("Choose a review date between 1900 and 2100.");
        String now = Instant.now().toString(), review = draft.reviewDate() == null ? null : draft.reviewDate().toString();
        if (draft.version() == 0) {
            try { jdbc.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, review_date, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
                ticker, java.util.UUID.randomUUID().toString(), draft.status(), thesis, risks, review, now, now); }
            catch (DuplicateKeyException e) { throw new Conflict(); }
        } else {
            // I require the version I opened so I cannot silently overwrite someone else's research.
            int changed = jdbc.update("UPDATE research_watchlist SET status = ?, thesis = ?, risks = ?, review_date = ?, version = version + 1, updated_at = ? WHERE ticker = ? AND version = ? AND entry_id = ?",
                draft.status(), thesis, risks, review, now, ticker, draft.version(), draft.entryId());
            if (changed == 0) throw new Conflict();
        }
        return list().stream().filter(entry -> entry.ticker().equals(ticker)).findFirst().orElseThrow();
    }
    @Transactional
    public void remove(String symbol, long version, String entryId) {
        if (version <= 0) throw new IllegalArgumentException("Provide the saved version to remove this entry.");
        if (jdbc.update("DELETE FROM research_watchlist WHERE ticker = ? AND version = ? AND entry_id = ?", ticker(symbol), version, entryId) == 0) throw new Conflict();
    }
}

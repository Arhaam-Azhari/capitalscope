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
                        long version, Instant createdAt, Instant updatedAt, List<String> checks) {
        public Entry(String entryId, String ticker, String status, String thesis, String risks, LocalDate reviewDate,
                     long version, Instant createdAt, Instant updatedAt) {
            this(entryId, ticker, status, thesis, risks, reviewDate, version, createdAt, updatedAt, List.of());
        }
    }
    public record Draft(String status, String thesis, String risks, LocalDate reviewDate, Long version, String entryId, List<String> checks) {
        public Draft(String status, String thesis, String risks, LocalDate reviewDate, Long version, String entryId) {
            this(status, thesis, risks, reviewDate, version, entryId, null);
        }
    }
    public static final List<String> CHECKS = List.of("filings", "cash_flow", "leverage", "share_basis", "risks");
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
            Instant.parse(rs.getString("created_at")), Instant.parse(rs.getString("updated_at")),
            rs.getString("research_checks").isEmpty() ? List.of() : List.of(rs.getString("research_checks").split(","))));
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
        String checks = null;
        if (draft.checks() != null) {
            if (draft.checks().size() > CHECKS.size() || new java.util.HashSet<>(draft.checks()).size() != draft.checks().size()
                || draft.checks().stream().anyMatch(check -> check == null || !CHECKS.contains(check)))
                throw new IllegalArgumentException("Choose each supported research check at most once.");
            checks = String.join(",", CHECKS.stream().filter(draft.checks()::contains).toList());
        }
        String now = Instant.now().toString(), review = draft.reviewDate() == null ? null : draft.reviewDate().toString();
        if (draft.version() == 0) {
            try { jdbc.update("INSERT INTO research_watchlist(ticker, entry_id, status, thesis, risks, review_date, version, created_at, updated_at, research_checks) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
                ticker, java.util.UUID.randomUUID().toString(), draft.status(), thesis, risks, review, now, now, checks == null ? "" : checks); }
            catch (DuplicateKeyException e) { throw new Conflict(); }
        } else {
            // I require the version I opened so I cannot silently overwrite someone else's research.
            // I preserve checks when an older client omits them; an explicit empty list clears them.
            int changed = jdbc.update("UPDATE research_watchlist SET status = ?, thesis = ?, risks = ?, review_date = ?, research_checks = COALESCE(?, research_checks), version = version + 1, updated_at = ? WHERE ticker = ? AND version = ? AND entry_id = ?",
                draft.status(), thesis, risks, review, checks, now, ticker, draft.version(), draft.entryId());
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

package com.capitalscope;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class PortfolioService {
    public record NewPortfolio(String name, String mode, BigDecimal initialCash) {}
    public record Fill(String requestId, String ticker, String side, BigDecimal quantity, BigDecimal price, BigDecimal fee) {}
    private final JdbcTemplate jdbc;
    public PortfolioService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public List<PaperPortfolio.Portfolio> list() {
        return jdbc.query("SELECT * FROM practice_portfolios ORDER BY created_at DESC, id DESC", (rs, i) ->
            new PaperPortfolio.Portfolio(rs.getString("id"), rs.getString("name"), rs.getString("mode"),
                rs.getBigDecimal("initial_cash"), Instant.parse(rs.getString("created_at"))));
    }
    public PaperPortfolio.Summary create(NewPortfolio request) {
        if (request.name() == null || request.name().isBlank() || request.name().strip().length() > 80)
            throw new IllegalArgumentException("Name the portfolio using 1–80 characters.");
        if (!Set.of("example", "market").contains(request.mode() == null ? "" : request.mode()))
            throw new IllegalArgumentException("Choose example or market mode.");
        PaperPortfolio.number(request.initialCash(), 2, false, "Starting cash");
        var portfolio = new PaperPortfolio.Portfolio(UUID.randomUUID().toString(), request.name().strip(), request.mode(), request.initialCash(), Instant.now());
        jdbc.update("INSERT INTO practice_portfolios(id, name, mode, initial_cash, created_at) VALUES (?, ?, ?, ?, ?)",
            portfolio.id(), portfolio.name(), portfolio.mode(), portfolio.initialCash(), portfolio.createdAt().toString());
        return PaperPortfolio.calculate(portfolio, List.of());
    }
    private PaperPortfolio.Portfolio portfolio(String id, boolean lock) {
        return jdbc.query("SELECT * FROM practice_portfolios WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
            (rs, i) -> new PaperPortfolio.Portfolio(rs.getString("id"), rs.getString("name"), rs.getString("mode"),
                rs.getBigDecimal("initial_cash"), Instant.parse(rs.getString("created_at"))), id)
            .stream().findFirst().orElseThrow(() -> new NoSuchElementException("This portfolio was not found."));
    }
    private List<PaperPortfolio.Trade> trades(String id) {
        return jdbc.query("SELECT * FROM paper_trades WHERE portfolio_id = ? ORDER BY sequence_id", (rs, i) ->
            new PaperPortfolio.Trade(rs.getString("request_id"), rs.getString("ticker"), rs.getString("side"),
                rs.getBigDecimal("quantity"), rs.getBigDecimal("price"), rs.getBigDecimal("fee"), Instant.parse(rs.getString("recorded_at"))), id);
    }
    @Transactional(readOnly = true)
    public PaperPortfolio.Summary summary(String id) { return PaperPortfolio.calculate(portfolio(id, false), trades(id)); }
    @Transactional
    public PaperPortfolio.Summary trade(String id, Fill fill) {
        // I lock the portfolio row so concurrent fills cannot spend the same cash twice.
        var portfolio = portfolio(id, true);
        String ticker = portfolio.mode().equals("example") ? "DEMO" : CompanyCatalog.find(fill.ticker() == null ? "" : fill.ticker()).ticker();
        if (portfolio.mode().equals("example") && !"DEMO".equals(fill.ticker()))
            throw new IllegalArgumentException("Example portfolios only accept the fictional DEMO ticker.");
        var trade = new PaperPortfolio.Trade(fill.requestId(), ticker, fill.side(), fill.quantity(), fill.price(), fill.fee(), Instant.now());
        PaperPortfolio.validate(trade);
        var current = new ArrayList<>(trades(id));
        var previous = current.stream().filter(t -> t.requestId().equals(trade.requestId())).findFirst().orElse(null);
        if (previous != null) {
            if (!previous.ticker().equals(ticker) || !previous.side().equals(trade.side()) || previous.quantity().compareTo(trade.quantity()) != 0
                || previous.price().compareTo(trade.price()) != 0 || previous.fee().compareTo(trade.fee()) != 0)
                throw new IllegalArgumentException("This request ID already belongs to a different fill.");
            return PaperPortfolio.calculate(portfolio, current);
        }
        current.add(trade);
        var result = PaperPortfolio.calculate(portfolio, current);
        jdbc.update("INSERT INTO paper_trades(portfolio_id, request_id, ticker, side, quantity, price, fee, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            id, trade.requestId(), ticker, trade.side(), trade.quantity(), trade.price(), trade.fee(), trade.recordedAt().toString());
        return result;
    }
}

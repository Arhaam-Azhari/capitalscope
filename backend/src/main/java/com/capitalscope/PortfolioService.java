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
    public record Action(String requestId, String ticker, String kind, BigDecimal value, BigDecimal denominator) {}
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
    private List<PaperPortfolio.Event> events(String id) {
        return jdbc.query("SELECT e.*, t.side, t.quantity, t.price, t.fee FROM portfolio_events e LEFT JOIN paper_trades t ON t.portfolio_id = e.portfolio_id AND t.request_id = e.request_id WHERE e.portfolio_id = ? ORDER BY e.sequence_id", (rs, i) -> {
            var date = Instant.parse(rs.getString("recorded_at"));
            PaperPortfolio.Trade trade = rs.getString("kind").equals("TRADE") ? new PaperPortfolio.Trade(
                rs.getString("request_id"), rs.getString("ticker"), rs.getString("side"), rs.getBigDecimal("quantity"),
                rs.getBigDecimal("price"), rs.getBigDecimal("fee"), date) : null;
            return new PaperPortfolio.Event(rs.getString("request_id"), rs.getString("kind"), rs.getString("ticker"),
                rs.getBigDecimal("event_value"), rs.getBigDecimal("denominator"), date, trade);
        }, id);
    }
    private String ticker(PaperPortfolio.Portfolio portfolio, String ticker) {
        if (portfolio.mode().equals("example")) {
            if (!"DEMO".equals(ticker)) throw new IllegalArgumentException("Example portfolios only accept the fictional DEMO ticker.");
            return "DEMO";
        }
        return CompanyCatalog.find(ticker == null ? "" : ticker).ticker();
    }
    private void append(String id, PaperPortfolio.Event event) {
        jdbc.update("INSERT INTO portfolio_events(portfolio_id, request_id, kind, ticker, event_value, denominator, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, event.requestId(), event.kind(), event.ticker(), event.value(), event.denominator(), event.recordedAt().toString());
    }
    @Transactional(readOnly = true)
    public PaperPortfolio.Summary summary(String id) { return PaperPortfolio.calculateEvents(portfolio(id, false), events(id)); }
    @Transactional
    public PaperPortfolio.Summary trade(String id, Fill fill) {
        // I lock the portfolio row so concurrent fills cannot spend the same cash twice.
        var portfolio = portfolio(id, true);
        String ticker = ticker(portfolio, fill.ticker());
        var trade = new PaperPortfolio.Trade(fill.requestId(), ticker, fill.side(), fill.quantity(), fill.price(), fill.fee(), Instant.now());
        PaperPortfolio.validate(trade);
        var current = new ArrayList<>(events(id));
        var priorEvent = current.stream().filter(t -> t.requestId().equals(trade.requestId())).findFirst().orElse(null);
        if (priorEvent != null && !priorEvent.kind().equals("TRADE")) throw new IllegalArgumentException("This request ID already belongs to another event.");
        var previous = priorEvent == null ? null : priorEvent.trade();
        if (previous != null) {
            if (!previous.ticker().equals(ticker) || !previous.side().equals(trade.side()) || previous.quantity().compareTo(trade.quantity()) != 0
                || previous.price().compareTo(trade.price()) != 0 || previous.fee().compareTo(trade.fee()) != 0)
                throw new IllegalArgumentException("This request ID already belongs to a different fill.");
            return PaperPortfolio.calculateEvents(portfolio, current);
        }
        current.add(PaperPortfolio.Event.fill(trade));
        var result = PaperPortfolio.calculateEvents(portfolio, current);
        jdbc.update("INSERT INTO paper_trades(portfolio_id, request_id, ticker, side, quantity, price, fee, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            id, trade.requestId(), ticker, trade.side(), trade.quantity(), trade.price(), trade.fee(), trade.recordedAt().toString());
        append(id, PaperPortfolio.Event.fill(trade));
        return result;
    }
    @Transactional
    public PaperPortfolio.Summary action(String id, Action request) {
        var portfolio = portfolio(id, true);
        var action = new PaperPortfolio.Event(request.requestId(), request.kind(), ticker(portfolio, request.ticker()),
            request.value(), request.denominator(), Instant.now(), null);
        PaperPortfolio.validateAction(action);
        var current = new ArrayList<>(events(id));
        var prior = current.stream().filter(e -> e.requestId().equals(action.requestId())).findFirst().orElse(null);
        if (prior != null) {
            if (!prior.kind().equals(action.kind()) || !prior.ticker().equals(action.ticker()) || prior.value() == null
                || prior.value().compareTo(action.value()) != 0 || !sameNumber(prior.denominator(), action.denominator()))
                throw new IllegalArgumentException("This request ID already belongs to a different event.");
            return PaperPortfolio.calculateEvents(portfolio, current);
        }
        current.add(action);
        var result = PaperPortfolio.calculateEvents(portfolio, current);
        append(id, action);
        return result;
    }
    private boolean sameNumber(BigDecimal first, BigDecimal second) {
        return first == null ? second == null : second != null && first.compareTo(second) == 0;
    }
}

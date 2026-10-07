package com.capitalscope;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

public final class PortfolioValuation {
    public record Mark(String ticker, BigDecimal quantity, BigDecimal costBasis, BigDecimal close,
                       String priceDate, Long priceAgeDays, String source, String sourceUrl,
                       Instant retrievedAt, BigDecimal value, BigDecimal unrealizedPnl, String error) {}
    public record Result(String portfolioId, String dataMode, Instant evaluatedAt, BigDecimal cash,
                         int pricedPositions, int totalPositions, boolean complete, BigDecimal pricedHoldingsValue,
                         BigDecimal totalValue, BigDecimal unrealizedPnl, List<Mark> holdings, PortfolioAllocation.Result allocation) {}
    private PortfolioValuation() {}

    public static Result calculate(PaperPortfolio.Summary summary, Instant now, Function<String, PriceHistory> storedPrices) {
        var today = now.atZone(ZoneOffset.UTC).toLocalDate();
        List<Mark> marks = new ArrayList<>();
        BigDecimal pricedValue = BigDecimal.ZERO, pnl = BigDecimal.ZERO;
        int priced = 0;
        for (var position : summary.positions()) {
            Mark mark;
            try {
                // I value the current ledger from local snapshots without making provider requests here.
                var history = summary.portfolio().mode().equals("example") ? PriceClient.example() : storedPrices.apply(position.ticker());
                if (history == null) throw new IllegalArgumentException("No stored prices. Open this company in Prices to import a daily snapshot.");
                if (!position.ticker().equals(history.ticker()) || !summary.portfolio().mode().equals(history.dataMode())
                        || !"USD".equals(history.currency()) || history.adjusted())
                    throw new IllegalArgumentException("This snapshot does not match the ticker, data mode, or raw USD price convention.");
                var day = history.days().stream().filter(d -> !LocalDate.parse(d.date()).isAfter(today))
                    .max(Comparator.comparing(PriceHistory.Day::date))
                    .orElseThrow(() -> new IllegalArgumentException("No daily close on or before the evaluation date."));
                if (day.close() == null || day.close().signum() <= 0) throw new IllegalArgumentException("The stored close is invalid.");
                boolean newerSplit = summary.events().stream().anyMatch(e -> e.ticker().equals(position.ticker()) && e.kind().equals("SPLIT")
                    && e.recordedAt().atZone(ZoneOffset.UTC).toLocalDate().isAfter(LocalDate.parse(day.date())));
                if (newerSplit) throw new IllegalArgumentException("A recorded split is newer than this close. Import prices that match the post-split share basis.");
                BigDecimal value = position.quantity().multiply(day.close());
                mark = new Mark(position.ticker(), position.quantity(), position.costBasis(), day.close(), day.date(),
                    ChronoUnit.DAYS.between(LocalDate.parse(day.date()), today), history.source(), history.sourceUrl(), history.retrievedAt(),
                    value, value.subtract(position.costBasis()), null);
                priced++; pricedValue = pricedValue.add(value); pnl = pnl.add(mark.unrealizedPnl());
            } catch (RuntimeException e) {
                mark = new Mark(position.ticker(), position.quantity(), position.costBasis(), null, null, null, null, null, null, null, null,
                    e instanceof IllegalArgumentException ? e.getMessage() : "The stored snapshot could not be valued. Re-import this company's prices.");
            }
            marks.add(mark);
        }
        boolean complete = priced == marks.size();
        // I withhold portfolio-wide totals when any open holding lacks a usable close.
        return new Result(summary.portfolio().id(), summary.portfolio().mode(), now, summary.cash(), priced, marks.size(), complete,
            pricedValue, complete ? summary.cash().add(pricedValue) : null, complete ? pnl : null, List.copyOf(marks), PortfolioAllocation.calculate(summary.cash(), marks, complete));
    }
}

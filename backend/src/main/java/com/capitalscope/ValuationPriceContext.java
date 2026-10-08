package com.capitalscope;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

public final class ValuationPriceContext {
    public record Quote(BigDecimal close, String priceDate, long priceAgeDays, String source, String sourceUrl, Instant retrievedAt) {}
    public record Case(String id, String name, Instant createdAt, String modelVersion, BigDecimal modeledShares,
                       BigDecimal valuePerShare, BigDecimal valueMinusClose, BigDecimal relativeGap, String unavailableReason) {}
    public record Result(String ticker, String dataMode, Instant evaluatedAt, boolean shareBasisConfirmed,
                         Quote quote, String quoteError, List<Case> scenarios) {}
    private ValuationPriceContext() {}
    public static Result calculate(String ticker, List<ResearchStore.Scenario> scenarios, Instant now,
                                   PriceHistory history, boolean confirmed) {
        String mode = ticker.equals("DEMO") ? "example" : "market";
        Quote quote = null; String error = null;
        try {
            if (history == null) throw new IllegalArgumentException("No stored close. Import this company's daily prices in Prices, then recheck here.");
            if (!ticker.equals(history.ticker()) || !mode.equals(history.dataMode()) || !"USD".equals(history.currency()) || history.adjusted())
                throw new IllegalArgumentException("The stored snapshot must match this ticker and use raw USD closes in the correct data mode.");
            var today = now.atZone(ZoneOffset.UTC).toLocalDate();
            var day = history.days().stream().filter(value -> !LocalDate.parse(value.date()).isAfter(today))
                .max(Comparator.comparing(PriceHistory.Day::date)).orElseThrow(() -> new IllegalArgumentException("No stored daily close on or before the evaluation date."));
            if (day.close() == null || day.close().signum() <= 0) throw new IllegalArgumentException("The stored close must be positive.");
            quote = new Quote(day.close(), day.date(), ChronoUnit.DAYS.between(LocalDate.parse(day.date()), today), history.source(), history.sourceUrl(), history.retrievedAt());
        } catch (RuntimeException e) {
            error = e instanceof IllegalArgumentException ? e.getMessage() : "The stored snapshot could not be read. Re-import this company's prices.";
        }
        List<Case> cases = new ArrayList<>();
        for (var scenario : scenarios) {
            var value = Double.isFinite(scenario.result().valuePerShare()) ? BigDecimal.valueOf(scenario.result().valuePerShare()) : null;
            var shares = Double.isFinite(scenario.assumptions().sharesOutstanding()) ? BigDecimal.valueOf(scenario.assumptions().sharesOutstanding()) : null;
            String reason = !ticker.equals(scenario.ticker()) ? "This saved case belongs to another company." :
                !"fcff-v1".equals(scenario.modelVersion()) ? "This saved model version is unsupported for a price comparison." :
                value == null || shares == null || shares.signum() <= 0 ? "The saved per-share inputs are invalid." :
                quote == null ? error : !confirmed ? "Confirm that each modeled share count and the dated close use the same share basis." : null;
            // I preserve negative model values and never relabel this gap as an expected investment return.
            BigDecimal difference = reason == null ? value.subtract(quote.close()) : null;
            BigDecimal gap = difference == null ? null : difference.divide(quote.close(), 10, RoundingMode.HALF_EVEN);
            cases.add(new Case(scenario.id(), scenario.name(), scenario.createdAt(), scenario.modelVersion(), shares, value, difference, gap, reason));
        }
        return new Result(ticker, mode, now, confirmed, quote, error, List.copyOf(cases));
    }
}

package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ValuationPriceContextTest {
    private final Instant now = Instant.parse("2026-10-08T00:00:00Z");
    private ResearchStore.Scenario scenario(String ticker, String version, double value) {
        return new ResearchStore.Scenario("case", ticker, "My case", now.minusSeconds(100000),
            new DcfCalculator.Assumptions(100, 0.05, 0.1, 0.02, 5, 0, 100),
            new DcfCalculator.Valuation(List.of(), 1, 1, 1, value * 100, value, 0.5), version);
    }
    private PriceHistory history(String ticker, String currency, boolean adjusted, String mode, String date, String close) {
        return new PriceHistory(ticker, currency, adjusted, mode, "My stored snapshot", "https://example.com/prices", now.minusSeconds(172800),
            List.of(new PriceHistory.Day(date, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, new BigDecimal(close), 1)));
    }
    @Test void iCompareSavedValuesWithExpiredDatedClosesOnlyAfterShareBasisConfirmation() {
        var quote = history("AAPL", "USD", false, "market", "2026-10-01", "100");
        var cases = List.of(scenario("AAPL", "fcff-v1", 120), scenario("AAPL", "fcff-v1", -10));
        var unconfirmed = ValuationPriceContext.calculate("AAPL", cases, now, quote, false);
        assertNotNull(unconfirmed.quote()); assertEquals(7, unconfirmed.quote().priceAgeDays());
        assertEquals(quote.retrievedAt(), unconfirmed.quote().retrievedAt());
        assertNull(unconfirmed.scenarios().get(0).relativeGap());
        var result = ValuationPriceContext.calculate("AAPL", cases, now, quote, true);
        assertEquals(0, new BigDecimal("20").compareTo(result.scenarios().get(0).valueMinusClose()));
        assertEquals(0, new BigDecimal("0.2").compareTo(result.scenarios().get(0).relativeGap()));
        assertEquals(0, new BigDecimal("-1.1").compareTo(result.scenarios().get(1).relativeGap()));
        assertEquals(cases.get(0).createdAt(), result.scenarios().get(0).createdAt());
    }
    @Test void iRejectMissingFutureMismatchedOrInvalidQuotesWithoutFictionalFallback() {
        var cases = List.of(scenario("AAPL", "fcff-v1", 120));
        var invalid = List.of(history("MSFT", "USD", false, "market", "2026-10-01", "100"),
            history("AAPL", "EUR", false, "market", "2026-10-01", "100"), history("AAPL", "USD", true, "market", "2026-10-01", "100"),
            history("AAPL", "USD", false, "example", "2026-10-01", "100"), history("AAPL", "USD", false, "market", "2026-10-09", "100"),
            history("AAPL", "USD", false, "market", "2026-10-01", "0"));
        for (var quote : invalid) {
            var result = ValuationPriceContext.calculate("AAPL", cases, now, quote, true);
            assertNull(result.quote()); assertNotNull(result.quoteError()); assertNull(result.scenarios().get(0).valueMinusClose());
        }
        assertNull(ValuationPriceContext.calculate("AAPL", cases, now, null, true).quote());
        var mixed = history("AAPL", "USD", false, "market", "2026-10-01", "100");
        var withFuture = new PriceHistory(mixed.ticker(), mixed.currency(), false, mixed.dataMode(), mixed.source(), mixed.sourceUrl(), mixed.retrievedAt(),
            List.of(new PriceHistory.Day("2026-10-09", BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, new BigDecimal("500"), 1), mixed.days().get(0)));
        assertEquals("2026-10-01", ValuationPriceContext.calculate("AAPL", cases, now, withFuture, true).quote().priceDate());
    }
    @Test void iWithholdUnsupportedModelsAndWrongCompaniesAndKeepExamplesSeparate() {
        var cases = List.of(scenario("AAPL", "fcff-v2", 120), scenario("MSFT", "fcff-v1", 120), scenario("AAPL", "fcff-v1", Double.NaN));
        var result = ValuationPriceContext.calculate("AAPL", cases, now, history("AAPL", "USD", false, "market", "2026-10-01", "100"), true);
        assertTrue(result.scenarios().stream().allMatch(value -> value.relativeGap() == null && value.unavailableReason() != null));
        var example = ValuationPriceContext.calculate("DEMO", List.of(scenario("DEMO", "fcff-v1", 25)), now, PriceClient.example(), true);
        assertEquals("example", example.dataMode()); assertEquals("2026-09-19", example.quote().priceDate());
    }
}

package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioValuationTest {
    private final Instant now = Instant.parse("2026-10-07T12:00:00Z");
    private BigDecimal n(String value) { return new BigDecimal(value); }
    private PaperPortfolio.Summary summary(String mode, List<PaperPortfolio.Position> positions, List<PaperPortfolio.Event> events) {
        return new PaperPortfolio.Summary(new PaperPortfolio.Portfolio("test", "My marks", mode, n("1000"), now), n("700"),
            n("20"), positions, List.of(), n("5"), events);
    }
    private PriceHistory prices(String ticker, String mode) {
        return new PriceHistory(ticker, "USD", false, mode, "My fixture", null, now.minusSeconds(90000), List.of(
            new PriceHistory.Day("2026-10-08", n("999"), n("999"), n("999"), n("999"), 0),
            new PriceHistory.Day("2026-10-06", n("100.1234"), n("100.1234"), n("100.1234"), n("100.1234"), 0)));
    }
    @Test void iValueFractionalSharesWithoutRoundingAwayTheirBasisOrDoubleCountingIncome() {
        var result = PortfolioValuation.calculate(summary("market", List.of(new PaperPortfolio.Position("AAPL", n("1.500001"), n("200"), n("133"))), List.of()), now,
            ticker -> prices(ticker, "market"));
        assertTrue(result.complete()); assertEquals(0, n("150.1852001234").compareTo(result.pricedHoldingsValue()));
        assertEquals(0, n("850.1852001234").compareTo(result.totalValue()));
        assertEquals(0, n("-49.8147998766").compareTo(result.unrealizedPnl()));
        assertEquals("2026-10-06", result.holdings().get(0).priceDate()); assertEquals(1L, result.holdings().get(0).priceAgeDays());
        assertEquals(now.minusSeconds(90000), result.holdings().get(0).retrievedAt());
    }
    @Test void iKeepPartialCoverageAndWithholdTotalsInsteadOfAssigningZeroToMissingPrices() {
        var result = PortfolioValuation.calculate(summary("market", List.of(
            new PaperPortfolio.Position("AAPL", n("2"), n("180"), n("90")),
            new PaperPortfolio.Position("MSFT", n("1"), n("100"), n("100"))), List.of()), now,
            ticker -> ticker.equals("AAPL") ? prices(ticker, "market") : null);
        assertFalse(result.complete()); assertEquals(1, result.pricedPositions()); assertEquals(2, result.totalPositions());
        assertEquals(0, n("200.2468").compareTo(result.pricedHoldingsValue()));
        assertNull(result.totalValue()); assertNull(result.unrealizedPnl()); assertNull(result.holdings().get(1).value());
        assertTrue(result.holdings().get(1).error().contains("No stored prices"));
    }
    @Test void iRejectForeignDataModesAndSplitsNewerThanThePrice() {
        var held = List.of(new PaperPortfolio.Position("AAPL", n("2"), n("100"), n("50")));
        var wrong = PortfolioValuation.calculate(summary("market", held, List.of()), now, ticker -> prices(ticker, "example"));
        assertFalse(wrong.complete());
        var split = new PaperPortfolio.Event("split", "SPLIT", "AAPL", n("2"), n("1"), now, null);
        var newer = PortfolioValuation.calculate(summary("market", held, List.of(split)), now, ticker -> prices(ticker, "market"));
        assertFalse(newer.complete()); assertTrue(newer.holdings().get(0).error().contains("split is newer"));
    }
    @Test void iValueCashOnlyAndNeverCallTheMarketProviderForExamples() {
        var empty = PortfolioValuation.calculate(summary("market", List.of(), List.of()), now, ticker -> { throw new AssertionError(); });
        assertTrue(empty.complete()); assertEquals(0, n("700").compareTo(empty.totalValue()));
        var example = PortfolioValuation.calculate(summary("example", List.of(new PaperPortfolio.Position("DEMO", n("10"), n("200"), n("20"))), List.of()), now,
            ticker -> { throw new AssertionError(); });
        assertTrue(example.complete()); assertEquals("Invented example prices", example.holdings().get(0).source());
    }
    @Test void iRejectFutureOnlyQuotesAndKeepFailuresLocalToTheHolding() {
        var result = PortfolioValuation.calculate(summary("market", List.of(new PaperPortfolio.Position("AAPL", n("1"), n("1"), n("1"))), List.of()), now,
            ticker -> new PriceHistory(ticker, "USD", false, "market", "My future fixture", null, now,
                List.of(new PriceHistory.Day("2026-10-08", n("1"), n("1"), n("1"), n("1"), 0))));
        assertFalse(result.complete()); assertTrue(result.holdings().get(0).error().contains("evaluation date"));
        var failed = PortfolioValuation.calculate(summary("market", List.of(new PaperPortfolio.Position("AAPL", n("1"), n("1"), n("1"))), List.of()), now,
            ticker -> { throw new IllegalStateException("Private storage details"); });
        assertFalse(failed.complete()); assertFalse(failed.holdings().get(0).error().contains("Private"));
    }
}

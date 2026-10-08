package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioStressTest {
    private BigDecimal n(String value) { return new BigDecimal(value); }
    private PortfolioValuation.Mark mark(String ticker, String value) {
        return new PortfolioValuation.Mark(ticker, BigDecimal.ONE, BigDecimal.ONE, null, "2026-10-01", 7L,
            "My test snapshot", null, null, value == null ? null : n(value), null, value == null ? "Missing" : null);
    }
    private PortfolioValuation.Result baseline(String cash, PortfolioValuation.Mark... marks) {
        var list = List.of(marks);
        int priced = (int) list.stream().filter(m -> m.value() != null).count();
        var subtotal = list.stream().map(PortfolioValuation.Mark::value).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new PortfolioValuation.Result("test", "market", Instant.parse("2026-10-08T00:00:00Z"), n(cash), priced, list.size(), priced == list.size(),
            subtotal, priced == list.size() ? n(cash).add(subtotal) : null, null, list, PortfolioAllocation.calculate(n(cash), list, priced == list.size()));
    }
    private void equal(String expected, BigDecimal actual) { assertEquals(0, n(expected).compareTo(actual)); }
    @Test void iReplaceGlobalShocksWithSectorOverridesAndKeepCashFixed() {
        var base = baseline("100", mark("AAPL", "300"), mark("MSFT", "200"), mark("XOM", "400"));
        var result = PortfolioStress.calculate(base, new PortfolioStress.Assumptions(n("-0.2"), Map.of("Technology", BigDecimal.ZERO)));
        equal("920", result.stressedTotalValue()); equal("-80", result.change()); equal("-0.08", result.relativeChange());
        equal("300", result.holdings().get(0).stressedValue()); equal("320", result.holdings().get(2).stressedValue());
        assertSame(base, result.baseline()); equal("100", result.baseline().cash());
        var gain = PortfolioStress.calculate(base, new PortfolioStress.Assumptions(BigDecimal.ONE, Map.of()));
        equal("1900", gain.stressedTotalValue());
        var wipeout = PortfolioStress.calculate(base, new PortfolioStress.Assumptions(n("-1"), Map.of()));
        equal("100", wipeout.stressedTotalValue()); equal("-900", wipeout.change());
    }
    @Test void iWithholdPartialTotalsAndHandleCashOnlyOrZeroBaselines() {
        var partial = PortfolioStress.calculate(baseline("100", mark("AAPL", "300"), mark("MSFT", null)), new PortfolioStress.Assumptions(n("-0.5"), null));
        equal("150", partial.stressedPricedHoldingsValue()); assertNull(partial.stressedTotalValue()); assertNull(partial.change()); assertNull(partial.relativeChange()); assertNull(partial.holdings().get(1).stressedValue());
        var cash = PortfolioStress.calculate(baseline("100"), new PortfolioStress.Assumptions(n("-1"), Map.of()));
        equal("100", cash.stressedTotalValue()); equal("0", cash.change()); equal("0", cash.relativeChange());
        var zero = PortfolioStress.calculate(baseline("0"), new PortfolioStress.Assumptions(BigDecimal.ZERO, Map.of()));
        equal("0", zero.stressedTotalValue()); assertNull(zero.relativeChange());
        assertEquals("Fictional Industrials", PortfolioStress.calculate(baseline("0", mark("DEMO", "100")), new PortfolioStress.Assumptions(BigDecimal.ZERO, null)).holdings().get(0).sector());
    }
    @Test void iRejectInvalidShocksAndUnheldSectorOverrides() {
        var base = baseline("100", mark("AAPL", "300"));
        for (var shock : List.of("-1.0001", "1.01", "0.00001"))
            assertThrows(IllegalArgumentException.class, () -> PortfolioStress.calculate(base, new PortfolioStress.Assumptions(n(shock), Map.of())));
        assertThrows(IllegalArgumentException.class, () -> PortfolioStress.calculate(base, new PortfolioStress.Assumptions(null, null)));
        assertThrows(IllegalArgumentException.class, () -> PortfolioStress.calculate(base, new PortfolioStress.Assumptions(BigDecimal.ZERO, Map.of("Energy", BigDecimal.ZERO))));
        Map<String, BigDecimal> invalid = new HashMap<>(); invalid.put("Technology", null);
        assertThrows(IllegalArgumentException.class, () -> PortfolioStress.calculate(base, new PortfolioStress.Assumptions(BigDecimal.ZERO, invalid)));
    }
}

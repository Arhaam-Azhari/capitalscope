package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioAllocationTest {
    private BigDecimal n(String value) { return new BigDecimal(value); }
    private PortfolioValuation.Mark mark(String ticker, String value) {
        return new PortfolioValuation.Mark(ticker, BigDecimal.ONE, BigDecimal.ONE, null, null, null, null, null, null,
            value == null ? null : n(value), null, value == null ? "Missing" : null);
    }
    @Test void iRankCompaniesAndAggregateSectorsAgainstTheSameCashInclusiveTotal() {
        var result = PortfolioAllocation.calculate(n("100"), List.of(mark("AAPL", "300"), mark("MSFT", "200"), mark("XOM", "250"), mark("JPM", "150")), true);
        assertTrue(result.available()); assertEquals(0, n("0.1").compareTo(result.cashWeight()));
        assertEquals("AAPL", result.largestHolding().label()); assertEquals(0, n("0.3").compareTo(result.largestHolding().weight()));
        assertEquals("Technology", result.largestSector().label()); assertEquals(0, n("500").compareTo(result.largestSector().value()));
        assertEquals(0, n("0.5").compareTo(result.largestSector().weight())); assertEquals(0, n("0.75").compareTo(result.topThreeHoldingsWeight()));
        assertEquals(0, BigDecimal.ONE.compareTo(result.cashWeight().add(result.companies().stream().map(PortfolioAllocation.Exposure::weight).reduce(BigDecimal.ZERO, BigDecimal::add))));
    }
    @Test void iNeverNormalizePartialPricesAndSuppressIncompleteSectorValues() {
        var result = PortfolioAllocation.calculate(n("100"), List.of(mark("AAPL", "300"), mark("MSFT", null), mark("XOM", "200")), false);
        assertFalse(result.available()); assertNull(result.cashWeight()); assertNull(result.largestHolding()); assertNull(result.largestSector()); assertNull(result.topThreeHoldingsWeight());
        assertTrue(result.companies().stream().allMatch(e -> e.weight() == null));
        assertNull(result.sectors().stream().filter(e -> e.label().equals("Technology")).findFirst().orElseThrow().value());
        assertEquals(0, n("200").compareTo(result.sectors().stream().filter(e -> e.label().equals("Energy")).findFirst().orElseThrow().value()));
    }
    @Test void iHandleCashOnlyZeroValueFictionalHoldingsAndTies() {
        var cashOnly = PortfolioAllocation.calculate(n("100"), List.of(), true);
        assertTrue(cashOnly.available()); assertEquals(0, BigDecimal.ONE.compareTo(cashOnly.cashWeight())); assertNull(cashOnly.largestHolding());
        assertFalse(PortfolioAllocation.calculate(BigDecimal.ZERO, List.of(), true).available());
        var example = PortfolioAllocation.calculate(n("100"), List.of(mark("DEMO", "100")), true);
        assertEquals("Fictional Industrials", example.largestSector().label());
        var ties = PortfolioAllocation.calculate(BigDecimal.ZERO, List.of(mark("MSFT", "100"), mark("AAPL", "100")), true);
        assertEquals("AAPL", ties.largestHolding().label());
    }
}

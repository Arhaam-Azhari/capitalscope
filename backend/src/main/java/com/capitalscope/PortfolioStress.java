package com.capitalscope;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

public final class PortfolioStress {
    public record Assumptions(BigDecimal defaultShock, Map<String, BigDecimal> sectorShocks) {}
    public record Holding(PortfolioValuation.Mark baseline, String sector, BigDecimal shock,
                          BigDecimal stressedValue, BigDecimal change) {}
    public record Result(PortfolioValuation.Result baseline, Assumptions assumptions, List<Holding> holdings,
                         BigDecimal stressedPricedHoldingsValue, BigDecimal stressedTotalValue,
                         BigDecimal change, BigDecimal relativeChange) {}
    private PortfolioStress() {}

    public static Result calculate(PortfolioValuation.Result baseline, Assumptions assumptions) {
        if (assumptions == null) throw new IllegalArgumentException("Provide price shock assumptions.");
        validate(assumptions.defaultShock());
        var overrides = assumptions.sectorShocks() == null ? Map.<String, BigDecimal>of() : assumptions.sectorShocks();
        Set<String> sectors = new HashSet<>();
        baseline.holdings().forEach(mark -> sectors.add(PortfolioAllocation.sector(mark.ticker())));
        overrides.forEach((sector, shock) -> {
            if (!sectors.contains(sector)) throw new IllegalArgumentException("Override only sectors held in this portfolio.");
            validate(shock);
        });
        List<Holding> holdings = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var mark : baseline.holdings()) {
            String sector = PortfolioAllocation.sector(mark.ticker());
            // I replace the default with a sector override, including an explicit zero shock.
            BigDecimal shock = overrides.getOrDefault(sector, assumptions.defaultShock());
            BigDecimal value = mark.value() == null ? null : mark.value().multiply(BigDecimal.ONE.add(shock));
            if (value != null) subtotal = subtotal.add(value);
            holdings.add(new Holding(mark, sector, shock, value, value == null ? null : value.subtract(mark.value())));
        }
        // I keep cash fixed and withhold full totals whenever the baseline has an unpriced holding.
        BigDecimal total = baseline.complete() ? baseline.cash().add(subtotal) : null;
        BigDecimal change = total == null ? null : total.subtract(baseline.totalValue());
        BigDecimal relative = change == null || baseline.totalValue().signum() <= 0 ? null
            : change.divide(baseline.totalValue(), 10, RoundingMode.HALF_EVEN);
        return new Result(baseline, new Assumptions(assumptions.defaultShock(), Map.copyOf(overrides)),
            List.copyOf(holdings), subtotal, total, change, relative);
    }
    private static void validate(BigDecimal shock) {
        if (shock == null || shock.compareTo(BigDecimal.ONE.negate()) < 0 || shock.compareTo(BigDecimal.ONE) > 0
                || shock.stripTrailingZeros().scale() > 4)
            throw new IllegalArgumentException("Price changes must be between -100% and +100%, with at most two percentage decimals.");
    }
}

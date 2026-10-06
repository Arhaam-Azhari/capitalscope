package com.capitalscope;

import java.util.Arrays;
import java.util.List;

public final class DcfSensitivity {
    public record Cell(double terminalGrowthRate, Double valuePerShare, String error, boolean baseCase) {}
    public record Row(double discountRate, List<Cell> cells) {}
    public record Grid(List<Double> terminalGrowthRates, List<Row> rows) {}
    private DcfSensitivity() {}
    public static Grid calculate(DcfCalculator.Assumptions base) {
        DcfCalculator.calculate(base);
        var growths = Arrays.stream(new double[]{-.01, -.005, 0, .005, .01})
            .map(offset -> base.terminalGrowthRate() + offset).boxed().toList();
        var rows = Arrays.stream(new double[]{-.02, -.01, 0, .01, .02}).mapToObj(offset -> {
            double discount = base.discountRate() + offset;
            var cells = growths.stream().map(growth -> {
                // I run each cell through the same calculator instead of approximating the result.
                var inputs = new DcfCalculator.Assumptions(base.baseFreeCashFlow(), base.growthRate(),
                    discount, growth, base.years(), base.netDebt(), base.sharesOutstanding());
                try {
                    return new Cell(growth, DcfCalculator.calculate(inputs).valuePerShare(), null,
                        offset == 0 && growth == base.terminalGrowthRate());
                } catch (IllegalArgumentException e) {
                    return new Cell(growth, null, e.getMessage(), false);
                }
            }).toList();
            return new Row(discount, cells);
        }).toList();
        return new Grid(growths, rows);
    }
}

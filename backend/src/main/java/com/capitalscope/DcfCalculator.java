package com.capitalscope;

import java.util.ArrayList;
import java.util.List;

public final class DcfCalculator {
    public record Assumptions(double baseFreeCashFlow, double growthRate, double discountRate,
                              double terminalGrowthRate, int years, double netDebt, double sharesOutstanding) {}
    public record Projection(int year, double freeCashFlow, double presentValue) {}
    public record Valuation(List<Projection> projections, double terminalValue,
                            double presentValueOfTerminalValue, double enterpriseValue,
                            double equityValue, double valuePerShare, double terminalValueShare) {}

    private DcfCalculator() {}

    public static Valuation calculate(Assumptions a) {
        if (a == null) throw new IllegalArgumentException("Provide valuation assumptions.");
        for (double n : new double[]{a.baseFreeCashFlow(), a.growthRate(), a.discountRate(),
                a.terminalGrowthRate(), a.netDebt(), a.sharesOutstanding()}) {
            if (!Double.isFinite(n)) throw new IllegalArgumentException("All inputs must be finite numbers.");
        }
        if (a.baseFreeCashFlow() <= 0 || a.sharesOutstanding() <= 0)
            throw new IllegalArgumentException("This model needs positive free cash flow and shares outstanding.");
        if (a.years() < 1 || a.years() > 20)
            throw new IllegalArgumentException("Choose a forecast between 1 and 20 years.");
        if (a.growthRate() <= -1 || a.growthRate() > 1 || a.discountRate() <= 0 || a.discountRate() > 1
                || a.terminalGrowthRate() <= -1 || a.terminalGrowthRate() >= a.discountRate())
            throw new IllegalArgumentException("Use valid decimal rates; terminal growth must be below the discount rate.");

        List<Projection> projections = new ArrayList<>();
        double cashFlow = a.baseFreeCashFlow();
        double operatingValue = 0;
        for (int year = 1; year <= a.years(); year++) {
            cashFlow *= 1 + a.growthRate();
            double presentValue = cashFlow / Math.pow(1 + a.discountRate(), year);
            projections.add(new Projection(year, cashFlow, presentValue));
            operatingValue += presentValue;
        }
        // I expose the terminal contribution because it can dominate a valuation.
        double terminalValue = cashFlow * (1 + a.terminalGrowthRate())
            / (a.discountRate() - a.terminalGrowthRate());
        double terminalPresentValue = terminalValue / Math.pow(1 + a.discountRate(), a.years());
        double enterpriseValue = operatingValue + terminalPresentValue;
        double equityValue = enterpriseValue - a.netDebt();
        double perShare = equityValue / a.sharesOutstanding();
        for (double n : new double[]{terminalValue, terminalPresentValue, enterpriseValue, equityValue, perShare}) {
            if (!Double.isFinite(n)) throw new IllegalArgumentException("These assumptions exceed the model's numeric range.");
        }
        return new Valuation(List.copyOf(projections), terminalValue, terminalPresentValue,
            enterpriseValue, equityValue, perShare, terminalPresentValue / enterpriseValue);
    }
}

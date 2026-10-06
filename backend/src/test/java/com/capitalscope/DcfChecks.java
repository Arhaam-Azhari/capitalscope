package com.capitalscope;

public final class DcfChecks {
    private static int checks;
    public static void main(String[] args) {
        var constant = DcfCalculator.calculate(new DcfCalculator.Assumptions(100, 0, .10, 0, 5, 100, 10));
        near(constant.enterpriseValue(), 1000);
        near(constant.equityValue(), 900);
        near(constant.valuePerShare(), 90);
        near(constant.projections().get(0).presentValue(), 100 / 1.10);
        near(constant.terminalValueShare(), 1 / Math.pow(1.10, 5));
        var netCash = DcfCalculator.calculate(new DcfCalculator.Assumptions(100, 0, .10, 0, 5, -100, 10));
        near(netCash.valuePerShare(), 110);
        var shortForecast = DcfCalculator.calculate(new DcfCalculator.Assumptions(100, 0, .10, 0, 1, 0, 10));
        near(shortForecast.enterpriseValue(), constant.enterpriseValue());
        var expensiveCapital = DcfCalculator.calculate(new DcfCalculator.Assumptions(100, 0, .20, 0, 5, 100, 10));
        near(expensiveCapital.valuePerShare(), 40);
        rejects(new DcfCalculator.Assumptions(100, 0, .10, .10, 5, 0, 10));
        rejects(new DcfCalculator.Assumptions(100, 0, .10, .12, 5, 0, 10));
        rejects(new DcfCalculator.Assumptions(100, 0, .10, 0, 5, 0, 0));
        rejects(new DcfCalculator.Assumptions(100, 0, .10, 0, 0, 0, 10));
        rejects(new DcfCalculator.Assumptions(-100, 0, .10, 0, 5, 0, 10));
        rejects(new DcfCalculator.Assumptions(100, Double.NaN, .10, 0, 5, 0, 10));
        rejects(new DcfCalculator.Assumptions(Double.MAX_VALUE, 1, .10, 0, 20, 0, 10));
        System.out.println(checks + " valuation checks passed.");
    }

    private static void near(double actual, double expected) {
        if (Math.abs(actual - expected) > 1e-8)
            throw new AssertionError("Expected " + expected + ", received " + actual);
        checks++;
    }

    private static void rejects(DcfCalculator.Assumptions input) {
        try { DcfCalculator.calculate(input); }
        catch (IllegalArgumentException expected) { checks++; return; }
        throw new AssertionError("Invalid assumptions were accepted: " + input);
    }
}

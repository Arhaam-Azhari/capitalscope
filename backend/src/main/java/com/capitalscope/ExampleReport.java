package com.capitalscope;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;

public final class ExampleReport {
    private ExampleReport() {}

    public static FinancialReport create() {
        // I keep example figures separate from the real company catalog and SEC cache.
        return new FinancialReport(new CompanyCatalog.Company("DEMO", "Example Manufacturing", "Industrials"),
            null, null, Instant.now(), "Invented example figures", "example", List.of(
                metric("Revenue", 840, 930, 1050, 1160, 1280),
                metric("Net income", 78, 91, 108, 122, 145),
                metric("Operating cash flow", 115, 130, 144, 165, 184),
                metric("Capital expenditure", 35, 39, 45, 50, 59),
                metric("Cash and equivalents", 170, 192, 210, 235, 260)
            ), List.of("These figures are invented for exploring the interface.",
                "They do not represent a listed company and have no SEC filing sources."));
    }

    private static FinancialFacts.Metric metric(String name, long... values) {
        boolean instant = name.equals("Cash and equivalents");
        var points = IntStream.range(0, values.length).mapToObj(i -> {
            int index = values.length - 1 - i;
            int year = 2021 + index;
            return new FinancialFacts.Point(instant ? null : year + "-01-01", year + "-12-31",
                BigDecimal.valueOf(values[index]).multiply(BigDecimal.valueOf(1_000_000)),
                null, null, null, "example");
        }).toList();
        return new FinancialFacts.Metric(name, "USD", points);
    }
}

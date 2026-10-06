package com.capitalscope;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class FinancialFacts {
    public record Point(String periodStart, String periodEnd, BigDecimal value, String filed,
                        String accession, String sourceUrl, String tag) {}
    public record Metric(String name, String unit, List<Point> annualValues) {}
    private FinancialFacts() {}

    public static List<Metric> extract(JsonNode root, String cik) {
        return List.of(
            metric(root, cik, "Revenue", "USD", false,
                "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"),
            metric(root, cik, "Net income", "USD", false, "NetIncomeLoss"),
            metric(root, cik, "Operating cash flow", "USD", false, "NetCashProvidedByUsedInOperatingActivities"),
            metric(root, cik, "Capital expenditure", "USD", false, "PaymentsToAcquirePropertyPlantAndEquipment"),
            metric(root, cik, "Cash and equivalents", "USD", true, "CashAndCashEquivalentsAtCarryingValue")
        );
    }

    private static Metric metric(JsonNode root, String cik, String name, String unit,
                                 boolean instant, String... tags) {
        Map<String, Point> periods = new TreeMap<>(Comparator.reverseOrder());
        for (String tag : tags) {
            Map<String, Point> candidates = new TreeMap<>();
            for (JsonNode fact : root.path("facts").path("us-gaap").path(tag).path("units").path(unit)) {
                if (!fact.path("form").asText().matches("10-K(/A)?") || !fact.path("val").isNumber()) continue;
                String end = fact.path("end").asText();
                String start = fact.path("start").asText();
                try {
                    LocalDate.parse(end);
                    if (!instant) {
                        long days = ChronoUnit.DAYS.between(LocalDate.parse(start), LocalDate.parse(end));
                        if (days < 300 || days > 400) continue;
                    } else if (!fact.path("fp").asText().equals("FY")) continue;
                } catch (RuntimeException e) { continue; }
                String accession = fact.path("accn").asText();
                Point point = new Point(instant ? null : start, end, fact.path("val").decimalValue(),
                    fact.path("filed").asText(), accession,
                    "https://www.sec.gov/Archives/edgar/data/" + Long.parseLong(cik) + "/"
                        + accession.replace("-", "") + "/", tag);
                Point prior = candidates.get(end);
                if (prior == null || point.filed().compareTo(prior.filed()) > 0) candidates.put(end, point);
            }
            // I prefer the first supported tag, then fill missing years from older tags.
            candidates.forEach(periods::putIfAbsent);
        }
        return new Metric(name, unit, new ArrayList<>(periods.values()).stream().limit(5).toList());
    }
}

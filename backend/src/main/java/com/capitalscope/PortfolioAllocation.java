package com.capitalscope;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

public final class PortfolioAllocation {
    public record Exposure(String label, BigDecimal value, BigDecimal weight) {}
    public record Result(boolean available, String unavailableReason, BigDecimal cashWeight,
                         Exposure largestHolding, Exposure largestSector, BigDecimal topThreeHoldingsWeight,
                         List<Exposure> companies, List<Exposure> sectors) {}
    private PortfolioAllocation() {}
    public static Result calculate(BigDecimal cash, List<PortfolioValuation.Mark> marks, boolean complete) {
        BigDecimal total = cash.add(marks.stream().map(PortfolioValuation.Mark::value).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add));
        boolean available = complete && total.signum() > 0;
        String reason = !complete ? "Allocation weights need a usable close for every open holding." :
            total.signum() <= 0 ? "Allocation weights need a positive total portfolio value." : null;
        List<Exposure> companies = new ArrayList<>();
        Map<String, BigDecimal> sectorValues = new TreeMap<>();
        Set<String> missingSectors = new HashSet<>();
        for (var mark : marks) {
            String sector = sector(mark.ticker());
            companies.add(new Exposure(mark.ticker(), mark.value(), available ? weight(mark.value(), total) : null));
            if (mark.value() == null) missingSectors.add(sector);
            else sectorValues.merge(sector, mark.value(), BigDecimal::add);
            sectorValues.putIfAbsent(sector, BigDecimal.ZERO);
        }
        List<Exposure> sectors = new ArrayList<>();
        sectorValues.forEach((sector, value) -> sectors.add(new Exposure(sector, missingSectors.contains(sector) ? null : value,
            available ? weight(value, total) : null)));
        Comparator<Exposure> ranked = Comparator.comparing(Exposure::value, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(Exposure::label);
        companies.sort(ranked); sectors.sort(ranked);
        // I use cash plus every holding as the denominator and never normalize a partial subset to 100%.
        BigDecimal topThree = available ? weight(companies.stream().limit(3).map(Exposure::value).reduce(BigDecimal.ZERO, BigDecimal::add), total) : null;
        return new Result(available, reason, available ? weight(cash, total) : null,
            available && !companies.isEmpty() ? companies.get(0) : null, available && !sectors.isEmpty() ? sectors.get(0) : null,
            topThree, List.copyOf(companies), List.copyOf(sectors));
    }
    public static String sector(String ticker) { return ticker.equals("DEMO") ? "Fictional Industrials" : CompanyCatalog.find(ticker).sector(); }
    private static BigDecimal weight(BigDecimal value, BigDecimal total) { return value.divide(total, 10, RoundingMode.HALF_EVEN); }
}

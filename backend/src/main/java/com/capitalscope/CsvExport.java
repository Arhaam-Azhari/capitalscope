package com.capitalscope;

import java.math.BigDecimal;
import java.util.stream.Collectors;

public final class CsvExport {
    private CsvExport() {}
    public static String row(Object... values) {
        return java.util.Arrays.stream(values).map(CsvExport::cell).collect(Collectors.joining(",")) + "\r\n";
    }
    private static String cell(Object value) {
        if (value == null) return "";
        if (value instanceof BigDecimal number) return number.toPlainString();
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        String text = value.toString();
        // I keep user-entered names from becoming spreadsheet formulas when exported.
        String trimmed = text.stripLeading();
        if ((!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0)) >= 0) || text.startsWith("\t") || text.startsWith("\r") || text.startsWith("\n")) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
    public static String financials(FinancialReport report) {
        StringBuilder csv = new StringBuilder(row("ticker", "company", "data_mode", "metric", "unit", "period_start", "period_end", "value", "filed", "accession", "source_url", "tag", "retrieved_at"));
        for (var metric : report.metrics()) {
            if (metric.annualValues().isEmpty()) csv.append(row(report.company().ticker(), report.company().name(), report.dataMode(), metric.name(), metric.unit(), null, null, null, null, null, null, null, report.retrievedAt()));
            for (var point : metric.annualValues()) csv.append(row(report.company().ticker(), report.company().name(), report.dataMode(), metric.name(), metric.unit(), point.periodStart(), point.periodEnd(), point.value(), point.filed(), point.accession(), point.sourceUrl(), point.tag(), report.retrievedAt()));
        }
        return csv.toString();
    }
    public static String watchlist(java.util.List<WatchlistStore.Entry> entries, java.time.Instant exportedAt) {
        StringBuilder csv = new StringBuilder(row("entry_id", "ticker", "company", "sector", "instrument_mode", "research_status",
            "thesis", "risks", "review_date", "version", "created_at", "updated_at", "exported_at", "notes_origin"));
        // I export saved notes, including archived entries, rather than the browser's draft or filtered list.
        entries.stream().sorted(java.util.Comparator.comparing(WatchlistStore.Entry::ticker)).forEach(entry -> {
            boolean example = entry.ticker().equals("DEMO");
            var company = example ? new CompanyCatalog.Company("DEMO", "Example Manufacturing", "Fictional") : CompanyCatalog.find(entry.ticker());
            csv.append(row(entry.entryId(), entry.ticker(), company.name(), company.sector(), example ? "example" : "market", entry.status(),
                entry.thesis(), entry.risks(), entry.reviewDate(), entry.version(), entry.createdAt(), entry.updatedAt(), exportedAt, "User-entered research"));
        });
        return csv.toString();
    }
    public static String portfolio(PaperPortfolio.Summary summary) {
        StringBuilder csv = new StringBuilder(row("portfolio_id", "portfolio_name", "instrument_mode", "simulated", "event_index", "recorded_at", "type", "ticker", "side", "shares", "manual_price", "fee", "new_shares", "old_shares", "dividend_per_share", "initial_cash", "currency"));
        var portfolio = summary.portfolio();
        csv.append(row(portfolio.id(), portfolio.name(), portfolio.mode(), true, 0, portfolio.createdAt(), "INITIAL_CASH", null, null, null, null, null, null, null, null, portfolio.initialCash(), "USD"));
        int index = 0;
        for (var event : summary.events()) {
            var trade = event.trade(); boolean split = event.kind().equals("SPLIT"), dividend = event.kind().equals("DIVIDEND");
            csv.append(row(portfolio.id(), portfolio.name(), portfolio.mode(), true, ++index, event.recordedAt(), event.kind(), event.ticker(),
                trade == null ? null : trade.side(), trade == null ? null : trade.quantity(), trade == null ? null : trade.price(), trade == null ? null : trade.fee(),
                split ? event.value() : null, split ? event.denominator() : null, dividend ? event.value() : null, null, "USD"));
        }
        return csv.toString();
    }
    public static String stress(PortfolioStressStore.Scenario scenario) {
        var result = scenario.result();
        StringBuilder csv = new StringBuilder(row("scenario_id", "portfolio_id", "scenario_name", "saved_at", "model_version", "data_mode",
            "evaluated_at", "currency", "hypothetical", "simulated_holdings", "complete", "priced_positions", "total_positions",
            "record_type", "ticker", "sector", "metric", "unit", "value", "shares", "raw_close", "price_date", "price_age_days",
            "source", "source_url", "retrieved_at", "price_error"));
        csv.append(stressRow(scenario, "ASSUMPTION", null, null, "default_price_change", "decimal_rate", result.assumptions().defaultShock()));
        // I keep the original overrides, even if the portfolio's sectors have since changed.
        new java.util.TreeMap<>(result.assumptions().sectorShocks()).forEach((sector, shock) ->
            csv.append(stressRow(scenario, "ASSUMPTION", null, sector, "sector_price_change", "decimal_rate", shock)));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "cash_held_fixed", "USD", result.baseline().cash()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "baseline_priced_holdings_subtotal", "USD", result.baseline().pricedHoldingsValue()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "stressed_priced_holdings_subtotal", "USD", result.stressedPricedHoldingsValue()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "baseline_total_value", "USD", result.baseline().totalValue()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "stressed_total_value", "USD", result.stressedTotalValue()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "value_change", "USD", result.change()));
        csv.append(stressRow(scenario, "PORTFOLIO", null, null, "relative_value_change", "decimal_rate", result.relativeChange()));
        for (var holding : result.holdings()) {
            csv.append(stressRow(scenario, "HOLDING", holding, holding.sector(), "applied_price_change", "decimal_rate", holding.shock()));
            csv.append(stressRow(scenario, "HOLDING", holding, holding.sector(), "remaining_cost_basis", "USD", holding.baseline().costBasis()));
            csv.append(stressRow(scenario, "HOLDING", holding, holding.sector(), "baseline_value", "USD", holding.baseline().value()));
            csv.append(stressRow(scenario, "HOLDING", holding, holding.sector(), "stressed_value", "USD", holding.stressedValue()));
            csv.append(stressRow(scenario, "HOLDING", holding, holding.sector(), "value_change", "USD", holding.change()));
        }
        csv.append(stressRow(scenario, "METHOD", null, null, "interpretation", "text",
            "I apply each user-entered price change once to saved holding values and keep cash and shares fixed. Rates are decimal fractions; -0.20 means -20%. This is a saved hypothetical snapshot, not a forecast or historical event replay. I exclude trading costs, taxes, liquidity, correlations, and currency changes. Blank values are unavailable, not zero; priced subtotals exclude unpriced holdings."));
        return csv.toString();
    }
    private static String stressRow(PortfolioStressStore.Scenario scenario, String kind, PortfolioStress.Holding holding,
                                    String sector, String metric, String unit, Object value) {
        var baseline = scenario.result().baseline();
        var mark = holding == null ? null : holding.baseline();
        // I export frozen evidence without reading current holdings or requesting new quotes.
        return row(scenario.id(), scenario.portfolioId(), scenario.name(), scenario.createdAt(), scenario.modelVersion(), baseline.dataMode(),
            baseline.evaluatedAt(), "USD", true, true, baseline.complete(), baseline.pricedPositions(), baseline.totalPositions(), kind,
            mark == null ? null : mark.ticker(), sector, metric, unit, value,
            mark == null ? null : mark.quantity(), mark == null ? null : mark.close(), mark == null ? null : mark.priceDate(),
            mark == null ? null : mark.priceAgeDays(), mark == null ? null : mark.source(), mark == null ? null : mark.sourceUrl(),
            mark == null ? null : mark.retrievedAt(), mark == null ? null : mark.error());
    }

}

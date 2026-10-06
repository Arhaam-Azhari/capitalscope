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
}

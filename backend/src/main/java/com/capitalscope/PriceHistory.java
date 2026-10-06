package com.capitalscope;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PriceHistory(String ticker, String currency, boolean adjusted, String dataMode,
                           String source, String sourceUrl, Instant retrievedAt, List<Day> days) {
    public record Day(String date, BigDecimal open, BigDecimal high, BigDecimal low,
                      BigDecimal close, long volume) {}
}

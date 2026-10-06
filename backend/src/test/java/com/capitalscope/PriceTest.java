package com.capitalscope;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class PriceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private String payload(String symbol, String close) {
        return "{\"Meta Data\":{\"2. Symbol\":\"" + symbol + "\"},\"Time Series (Daily)\":{\"2026-10-02\":{\"1. open\":\"100\",\"2. high\":\"105\",\"3. low\":\"95\",\"4. close\":\"" + close + "\",\"5. volume\":\"200\"}}}";
    }
    @Test void iKeepRawPricesAndTheirRetrievalTime() throws Exception {
        Instant date = Instant.parse("2026-10-06T00:00:00Z");
        var result = PriceClient.parse("AAPL", mapper.readTree(payload("AAPL", "102.25")), date);
        assertEquals("102.25", result.days().get(0).close().toPlainString());
        assertEquals(date, result.retrievedAt()); assertFalse(result.adjusted());
        assertEquals("market", result.dataMode()); assertFalse(result.sourceUrl().contains("apikey"));
    }
    @Test void iRejectBadPricesWrongSymbolsAndProviderLimits() throws Exception {
        for (String json : new String[]{payload("MSFT", "100"), payload("AAPL", "-1"), payload("AAPL", "999"),
                "{\"Note\":\"limit\"}", "{\"Information\":\"premium\"}", "{}"}) {
            var data = mapper.readTree(json);
            assertThrows(IllegalStateException.class, () -> PriceClient.parse("AAPL", data, Instant.now()));
        }
    }
    @Test void iLabelTheFictionalPriceSeries() {
        var result = PriceClient.example();
        assertEquals("DEMO", result.ticker()); assertEquals("example", result.dataMode());
        assertNull(result.retrievedAt()); assertNull(result.sourceUrl()); assertEquals(50, result.days().size());
    }
}

package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class StressCsvExportTest {
    private BigDecimal n(String value) { return new BigDecimal(value); }
    private PortfolioStressStore.Scenario scenario(boolean priced, String name) {
        var imported = Instant.parse("2026-10-01T12:00:00Z");
        var mark = new PortfolioValuation.Mark("AAPL", n("1.234567"), n("100.000001"), priced ? n("100.1234") : null,
            priced ? "2026-10-01" : null, priced ? 7L : null, priced ? "My stored prices" : null,
            priced ? "https://example.com/prices" : null, priced ? imported : null,
            priced ? n("123.6090418678") : null, priced ? n("23.6090408678") : null, priced ? null : "No stored prices.");
        var baseline = new PortfolioValuation.Result("portfolio", "market", Instant.parse("2026-10-08T00:00:00Z"), n("799"), priced ? 1 : 0, 1, priced,
            priced ? mark.value() : BigDecimal.ZERO, priced ? n("922.6090418678") : null, priced ? mark.unrealizedPnl() : null,
            List.of(mark), PortfolioAllocation.calculate(n("799"), List.of(mark), priced));
        var result = PortfolioStress.calculate(baseline, new PortfolioStress.Assumptions(n("-0.2"), Map.of("Technology", n("-0.0057"))));
        return new PortfolioStressStore.Scenario("scenario", "portfolio", name, Instant.parse("2026-10-08T01:00:00Z"), "price-shock-v1", result);
    }
    @Test void iKeepSavedEvidenceDecimalPrecisionAndOriginalOverrides() {
        var saved = scenario(true, "My report");
        String csv = CsvExport.stress(saved);
        assertTrue(csv.contains("\"scenario_id\"")); assertTrue(csv.contains("\"price_error\""));
        assertTrue(csv.contains("\"price-shock-v1\",\"market\",\"2026-10-08T00:00:00Z\",\"USD\",true,true,true,1,1"));
        assertTrue(csv.contains("\"default_price_change\",\"decimal_rate\",-0.2"));
        assertTrue(csv.contains("\"sector_price_change\",\"decimal_rate\",-0.0057"));
        assertTrue(csv.contains("\"baseline_value\",\"USD\",123.6090418678,1.234567,100.1234,\"2026-10-01\",7,\"My stored prices\",\"https://example.com/prices\",\"2026-10-01T12:00:00Z\""));
        String total = csv.lines().filter(line -> line.contains("\"stressed_total_value\"")).findFirst().orElseThrow();
        assertEquals(0, saved.result().stressedTotalValue().compareTo(new BigDecimal(total.split(",", -1)[18])));
        assertFalse(total.split(",", -1)[18].contains("E"));
        assertTrue(csv.contains("Blank values are unavailable, not zero"));
        assertEquals(csv, CsvExport.stress(saved));
    }
    @Test void iLeaveIncompleteValuesBlankAndKeepFormulaLikeNamesAsText() {
        String partial = CsvExport.stress(scenario(false, "My partial report"));
        for (String metric : List.of("baseline_total_value", "stressed_total_value", "relative_value_change")) {
            String line = partial.lines().filter(value -> value.contains("\"" + metric + "\"")).findFirst().orElseThrow();
            assertEquals("", line.split(",", -1)[18]);
            assertTrue(line.contains(",false,0,1,"));
        }
        assertTrue(partial.contains("\"No stored prices.\""));
        assertTrue(partial.contains("\"cash_held_fixed\",\"USD\",799"));
        var escaped = CsvExport.stress(scenario(true, "=My, \"stress\"\nreport"));
        assertTrue(escaped.contains("\"'=My, \"\"stress\"\"\nreport\""));
        assertFalse(escaped.contains("\"=My,"));
    }
}

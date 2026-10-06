package com.capitalscope;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BackendTest {
    @Test void valuationRegressionChecks() { DcfChecks.main(new String[0]); }

    @Test void catalogIsUniqueAndCaseInsensitive() {
        assertEquals(50, CompanyCatalog.COMPANIES.size());
        assertEquals(50, CompanyCatalog.COMPANIES.stream().map(CompanyCatalog.Company::ticker).distinct().count());
        assertEquals("AAPL", CompanyCatalog.find("aapl").ticker());
        assertThrows(IllegalArgumentException.class, () -> CompanyCatalog.find("unknown"));
    }

    @Test void annualExtractionExcludesQuarterlyFactsAndKeepsLatestRestatement() throws Exception {
        // I use invented values here so the test doesn't depend on a live filing.
        var facts = new ObjectMapper().readTree("""
            {"facts":{"us-gaap":{"Revenues":{"units":{"USD":[
              {"form":"10-K","start":"2023-01-01","end":"2023-12-31","val":100,"filed":"2024-02-01","accn":"0000000001-24-000001"},
              {"form":"10-K","start":"2023-01-01","end":"2023-12-31","val":110,"filed":"2025-02-01","accn":"0000000001-25-000001"},
              {"form":"10-K","start":"2023-10-01","end":"2023-12-31","val":30,"filed":"2025-02-01","accn":"0000000001-25-000001"},
              {"form":"10-Q","start":"2024-01-01","end":"2024-03-31","val":40,"filed":"2024-05-01","accn":"0000000001-24-000002"}
            ]}}}}}
            """);
        var metrics = FinancialFacts.extract(facts, "0000000001");
        var revenue = metrics.get(0).annualValues();
        assertEquals(1, revenue.size());
        assertEquals(110, revenue.get(0).value().intValueExact());
        assertEquals("2025-02-01", revenue.get(0).filed());
        assertEquals("Revenues", revenue.get(0).tag());
        assertTrue(revenue.get(0).sourceUrl().contains("000000000125000001"));
        assertTrue(metrics.get(1).annualValues().isEmpty());
    }
}

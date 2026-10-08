package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class CsvExportTest {
    @Test void iExportSavedResearchWithArchivedEntriesAndExplicitNoteOrigins() {
        var now = Instant.parse("2026-10-08T06:00:00Z");
        var example = new WatchlistStore.Entry("my-example", "DEMO", "archived", "=My, \"thesis\"\nsecond line", "@My risks", null, 3, now, now);
        var market = new WatchlistStore.Entry("my-market", "AAPL", "researching", "My saved thesis", "", java.time.LocalDate.of(2026, 11, 1), 2, now, now, List.of("filings", "leverage"));
        String csv = CsvExport.watchlist(List.of(example, market), now);
        assertTrue(csv.startsWith("\"entry_id\",\"ticker\",\"company\""));
        assertTrue(csv.indexOf("\"AAPL\"") < csv.indexOf("\"DEMO\""));
        assertTrue(csv.contains("\"Apple\",\"Technology\",\"market\",\"researching\""));
        assertTrue(csv.contains("\"Example Manufacturing\",\"Fictional\",\"example\",\"archived\""));
        assertTrue(csv.contains("\"'=My, \"\"thesis\"\"\nsecond line\",\"'@My risks\",,3,"));
        assertTrue(csv.contains("\"2026-11-01\",2,"));
        assertTrue(csv.endsWith("\"2026-10-08T06:00:00Z\",\"User-entered research\",false,false,false,false,false\r\n"));
        assertTrue(csv.contains("\"User-entered research\",true,false,true,false,false\r\n"));
        assertEquals(1, CsvExport.watchlist(List.of(), now).split("\r\n").length);
    }
    @Test void iEscapeTextAndKeepDecimalNumbersExact() {
        assertEquals("\"a,b\",\"a\"\"b\",\"line\nnext\",-12.3400001,\"'=SUM(A1)\",\"'  @name\",\"'\tname\"\r\n",
            CsvExport.row("a,b", "a\"b", "line\nnext", new BigDecimal("-12.3400001"), "=SUM(A1)", "  @name", "\tname"));
    }
    @Test void iIncludeDataModeAndKeepMissingMetricsBlank() {
        var csv = CsvExport.financials(ExampleReport.create());
        assertTrue(csv.contains("\"DEMO\",\"Example Manufacturing\",\"example\""));
        assertTrue(csv.contains("1280000000")); assertTrue(csv.contains("\"period_start\""));
        var report = new FinancialReport(ExampleReport.create().company(), null, null, Instant.now(), "Example", "example",
            List.of(new FinancialFacts.Metric("Missing", "USD", List.of())), List.of());
        assertTrue(CsvExport.financials(report).contains("\"Missing\",\"USD\",,,,,,,,\r\n"));
    }
    @Test void iExportTheInitialDepositAndEventsInTheirRecordedOrder() {
        var portfolio = new PaperPortfolio.Portfolio("id", "=My export", "example", new BigDecimal("1000"), Instant.parse("2026-10-06T00:00:00Z"));
        var trade = new PaperPortfolio.Trade(UUID.randomUUID().toString(), "DEMO", "BUY", new BigDecimal("1.500001"), new BigDecimal("100.1234"), new BigDecimal("0.01"), Instant.now());
        var split = new PaperPortfolio.Event(UUID.randomUUID().toString(), "SPLIT", "DEMO", new BigDecimal("2"), BigDecimal.ONE, Instant.now(), null);
        var csv = CsvExport.portfolio(PaperPortfolio.calculateEvents(portfolio, List.of(PaperPortfolio.Event.fill(trade), split)));
        assertTrue(csv.contains("\"'=My export\"")); assertTrue(csv.contains(",true,0,"));
        assertTrue(csv.indexOf("\"INITIAL_CASH\"") < csv.indexOf("\"TRADE\""));
        assertTrue(csv.indexOf("\"TRADE\"") < csv.indexOf("\"SPLIT\""));
        assertTrue(csv.contains("1.500001,100.1234,0.01"));
    }
}

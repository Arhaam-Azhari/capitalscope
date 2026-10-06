package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioTest {
    private PaperPortfolio.Portfolio portfolio(String cash) {
        return new PaperPortfolio.Portfolio("test", "My test portfolio", "example", new BigDecimal(cash), Instant.now());
    }
    private PaperPortfolio.Trade fill(String side, String quantity, String price, String fee) {
        return new PaperPortfolio.Trade(UUID.randomUUID().toString(), "DEMO", side, new BigDecimal(quantity), new BigDecimal(price), new BigDecimal(fee), Instant.now());
    }
    private void equal(String expected, BigDecimal actual) { assertEquals(0, new BigDecimal(expected).compareTo(actual)); }
    @Test void iIncludeFeesAndRecoverTheRemainingBasisWhenClosing() {
        var trades = new ArrayList<PaperPortfolio.Trade>();
        trades.add(fill("BUY", "10", "10", "1")); trades.add(fill("BUY", "10", "20", "1"));
        var bought = PaperPortfolio.calculate(portfolio("1000"), trades);
        equal("698", bought.cash()); equal("302", bought.positions().get(0).costBasis()); equal("15.1", bought.positions().get(0).averageCost());
        trades.add(fill("SELL", "5", "30", "2"));
        var partial = PaperPortfolio.calculate(portfolio("1000"), trades);
        equal("846", partial.cash()); equal("72.5", partial.realizedPnl()); equal("226.5", partial.positions().get(0).costBasis());
        trades.add(fill("SELL", "15", "10", "1"));
        var closed = PaperPortfolio.calculate(portfolio("1000"), trades);
        equal("995", closed.cash()); equal("-5", closed.realizedPnl()); assertTrue(closed.positions().isEmpty());
    }
    @Test void iKeepFractionalTradesExact() {
        var result = PaperPortfolio.calculate(portfolio("1"), List.of(fill("BUY", "0.1", "0.2", "0"), fill("SELL", "0.1", "0.3", "0")));
        equal("1.01", result.cash()); equal("0.01", result.realizedPnl());
    }
    @Test void iRejectOverspendingOversellingAndUnsupportedPrecision() {
        for (var trade : List.of(fill("BUY", "20", "10", "0"), fill("SELL", "1", "10", "0"),
            fill("BUY", "0.0000001", "10", "0"), fill("BUY", "1", "10", "-1")))
            assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.calculate(portfolio("100"), List.of(trade)));
        assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.calculate(portfolio("100"),
            List.of(fill("BUY", "1", "1", "0"), fill("SELL", "1", "1", "2"))));
    }
}

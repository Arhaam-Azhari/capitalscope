package com.capitalscope;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioActionTest {
    private PaperPortfolio.Portfolio portfolio() {
        return new PaperPortfolio.Portfolio("test", "My event portfolio", "example", new BigDecimal("1000"), Instant.now());
    }
    private PaperPortfolio.Event fill(String side, String quantity, String price) {
        return PaperPortfolio.Event.fill(new PaperPortfolio.Trade(UUID.randomUUID().toString(), "DEMO", side,
            new BigDecimal(quantity), new BigDecimal(price), BigDecimal.ZERO, Instant.now()));
    }
    private PaperPortfolio.Event action(String kind, String value, String denominator) {
        return new PaperPortfolio.Event(UUID.randomUUID().toString(), kind, "DEMO", new BigDecimal(value),
            denominator == null ? null : new BigDecimal(denominator), Instant.now(), null);
    }
    private void equal(String expected, BigDecimal actual) { assertEquals(0, new BigDecimal(expected).compareTo(actual)); }
    @Test void iPreserveBasisAcrossSplitsAndTrackDividendCashSeparately() {
        var events = new ArrayList<>(List.of(fill("BUY", "10", "20"), action("SPLIT", "2", "1"), action("DIVIDEND", "0.5", null)));
        var split = PaperPortfolio.calculateEvents(portfolio(), events);
        equal("20", split.positions().get(0).quantity()); equal("200", split.positions().get(0).costBasis());
        equal("10", split.positions().get(0).averageCost()); equal("810", split.cash()); equal("10", split.dividendIncome());
        events.add(fill("SELL", "5", "15")); events.add(action("SPLIT", "1", "5"));
        var reverse = PaperPortfolio.calculateEvents(portfolio(), events);
        equal("3", reverse.positions().get(0).quantity()); equal("150", reverse.positions().get(0).costBasis());
        equal("50", reverse.positions().get(0).averageCost()); equal("25", reverse.realizedPnl());
        events.add(fill("SELL", "3", "100"));
        var closed = PaperPortfolio.calculateEvents(portfolio(), events);
        equal("1185", closed.cash()); equal("175", closed.realizedPnl()); equal("10", closed.dividendIncome());
        assertTrue(closed.positions().isEmpty());
    }
    @Test void iApplyDividendsAtTheirPlaceInTheEventHistory() {
        var before = PaperPortfolio.calculateEvents(portfolio(), List.of(fill("BUY", "10", "20"), action("DIVIDEND", "0.5", null), action("SPLIT", "2", "1")));
        equal("5", before.dividendIncome()); equal("805", before.cash());
    }
    @Test void iRejectMissingHoldingsAndUnmodeledFractionalResidue() {
        assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.calculateEvents(portfolio(), List.of(action("DIVIDEND", "1", null))));
        assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.calculateEvents(portfolio(), List.of(fill("BUY", "1", "20"), action("SPLIT", "1", "3"))));
        assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.validateAction(action("SPLIT", "2", "0")));
        assertThrows(IllegalArgumentException.class, () -> PaperPortfolio.validateAction(action("DIVIDEND", "1", "2")));
    }
}

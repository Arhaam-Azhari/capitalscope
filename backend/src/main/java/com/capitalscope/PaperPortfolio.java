package com.capitalscope;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

public final class PaperPortfolio {
    public record Portfolio(String id, String name, String mode, BigDecimal initialCash, Instant createdAt) {}
    public record Trade(String requestId, String ticker, String side, BigDecimal quantity,
                        BigDecimal price, BigDecimal fee, Instant recordedAt) {}
    public record Position(String ticker, BigDecimal quantity, BigDecimal costBasis, BigDecimal averageCost) {}
    public record Summary(Portfolio portfolio, BigDecimal cash, BigDecimal realizedPnl,
                          List<Position> positions, List<Trade> trades) {}
    private PaperPortfolio() {}
    private static BigDecimal amount(BigDecimal value) { return value.setScale(10, RoundingMode.HALF_EVEN); }
    public static Summary calculate(Portfolio portfolio, List<Trade> trades) {
        BigDecimal cash = portfolio.initialCash(), realized = BigDecimal.ZERO;
        Map<String, Position> positions = new TreeMap<>();
        for (Trade trade : trades) {
            validate(trade);
            Position position = positions.getOrDefault(trade.ticker(), new Position(trade.ticker(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
            BigDecimal gross = trade.quantity().multiply(trade.price());
            BigDecimal quantity, basis;
            if (trade.side().equals("BUY")) {
                BigDecimal spend = gross.add(trade.fee());
                if (cash.compareTo(spend) < 0) throw new IllegalArgumentException("This trade exceeds the available cash.");
                cash = cash.subtract(spend);
                quantity = position.quantity().add(trade.quantity());
                basis = position.costBasis().add(spend);
            } else {
                if (position.quantity().compareTo(trade.quantity()) < 0)
                    throw new IllegalArgumentException("This trade exceeds the shares held. Short selling is unavailable.");
                BigDecimal proceeds = gross.subtract(trade.fee());
                if (proceeds.signum() < 0) throw new IllegalArgumentException("The sell fee cannot exceed the proceeds.");
                BigDecimal removed = trade.quantity().compareTo(position.quantity()) == 0 ? position.costBasis() :
                    position.costBasis().multiply(trade.quantity()).divide(position.quantity(), 10, RoundingMode.HALF_EVEN);
                cash = cash.add(proceeds); realized = realized.add(proceeds.subtract(removed));
                quantity = position.quantity().subtract(trade.quantity()); basis = position.costBasis().subtract(removed);
            }
            if (quantity.signum() == 0) positions.remove(trade.ticker());
            else positions.put(trade.ticker(), new Position(trade.ticker(), quantity, amount(basis), basis.divide(quantity, 10, RoundingMode.HALF_EVEN)));
        }
        return new Summary(portfolio, amount(cash), amount(realized), List.copyOf(positions.values()), List.copyOf(trades));
    }
    public static void validate(Trade trade) {
        if (trade == null || !Set.of("BUY", "SELL").contains(trade.side() == null ? "" : trade.side()))
            throw new IllegalArgumentException("Choose BUY or SELL.");
        number(trade.quantity(), 6, false, "Quantity"); number(trade.price(), 4, false, "Price"); number(trade.fee(), 2, true, "Fee");
        try { if (!UUID.fromString(trade.requestId()).toString().equalsIgnoreCase(trade.requestId())) throw new IllegalArgumentException(); }
        catch (RuntimeException e) { throw new IllegalArgumentException("Provide a valid request ID."); }
    }
    public static void number(BigDecimal value, int scale, boolean zero, String label) {
        if (value == null || value.signum() < (zero ? 0 : 1) || value.compareTo(new BigDecimal("1000000000")) > 0 || value.stripTrailingZeros().scale() > scale)
            throw new IllegalArgumentException(label + " must be " + (zero ? "nonnegative" : "positive") + ", at most one billion, with up to " + scale + " decimal places.");
    }
}

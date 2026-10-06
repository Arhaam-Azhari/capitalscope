package com.capitalscope;

import java.util.List;

public final class CompanyCatalog {
    public record Company(String ticker, String name, String sector) {}

    private CompanyCatalog() {}

    public static final String UNIVERSE_AS_OF = "2026-10-06";

    public static final List<Company> COMPANIES = List.of(
        new Company("NVDA", "NVIDIA", "Technology"),
        new Company("AAPL", "Apple", "Technology"),
        new Company("GOOG", "Alphabet", "Communication services"),
        new Company("MSFT", "Microsoft", "Technology"),
        new Company("AMZN", "Amazon", "Consumer discretionary"),
        new Company("SPCX", "SpaceX", "Industrials"),
        new Company("META", "Meta Platforms", "Communication services"),
        new Company("AVGO", "Broadcom", "Technology"),
        new Company("TSLA", "Tesla", "Consumer discretionary"),
        new Company("MU", "Micron Technology", "Technology"),
        new Company("BRK-B", "Berkshire Hathaway", "Financials"),
        new Company("AMD", "Advanced Micro Devices", "Technology"),
        new Company("LLY", "Eli Lilly", "Healthcare"),
        new Company("JPM", "JPMorgan Chase", "Financials"),
        new Company("WMT", "Walmart", "Consumer staples"),
        new Company("V", "Visa", "Financials"),
        new Company("XOM", "Exxon Mobil", "Energy"),
        new Company("JNJ", "Johnson & Johnson", "Healthcare"),
        new Company("INTC", "Intel", "Technology"),
        new Company("MA", "Mastercard", "Financials"),
        new Company("ABBV", "AbbVie", "Healthcare"),
        new Company("CSCO", "Cisco", "Technology"),
        new Company("PLTR", "Palantir", "Technology"),
        new Company("ORCL", "Oracle", "Technology"),
        new Company("AMAT", "Applied Materials", "Technology"),
        new Company("LRCX", "Lam Research", "Technology"),
        new Company("COST", "Costco", "Consumer staples"),
        new Company("CVX", "Chevron", "Energy"),
        new Company("CAT", "Caterpillar", "Industrials"),
        new Company("BAC", "Bank of America", "Financials"),
        new Company("KO", "Coca-Cola", "Consumer staples"),
        new Company("DELL", "Dell Technologies", "Technology"),
        new Company("MRK", "Merck", "Healthcare"),
        new Company("PG", "Procter & Gamble", "Consumer staples"),
        new Company("PANW", "Palo Alto Networks", "Technology"),
        new Company("UNH", "UnitedHealth Group", "Healthcare"),
        new Company("GE", "GE Aerospace", "Industrials"),
        new Company("MS", "Morgan Stanley", "Financials"),
        new Company("PM", "Philip Morris International", "Consumer staples"),
        new Company("HD", "Home Depot", "Consumer discretionary"),
        new Company("NFLX", "Netflix", "Communication services"),
        new Company("CRWD", "CrowdStrike", "Technology"),
        new Company("GEV", "GE Vernova", "Industrials"),
        new Company("ANET", "Arista Networks", "Technology"),
        new Company("TXN", "Texas Instruments", "Technology"),
        new Company("GS", "Goldman Sachs", "Financials"),
        new Company("MRVL", "Marvell Technology", "Technology"),
        new Company("KLAC", "KLA", "Technology"),
        new Company("RTX", "RTX", "Industrials"),
        new Company("WFC", "Wells Fargo", "Financials")
    );

    public static Company find(String ticker) {
        return COMPANIES.stream().filter(c -> c.ticker().equalsIgnoreCase(ticker))
            .findFirst().orElseThrow(() -> new IllegalArgumentException("Choose a ticker from /api/companies."));
    }
}

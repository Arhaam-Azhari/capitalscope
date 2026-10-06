package com.capitalscope;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.stream.IntStream;

@Service
public class PriceClient {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final String key;
    private final TransactionTemplate transaction;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private long nextRequestAt;
    public PriceClient(JdbcTemplate jdbc, ObjectMapper mapper, PlatformTransactionManager manager,
                       @Value("${prices.api-key:}") String key) {
        this.jdbc = jdbc; this.mapper = mapper; this.key = key; this.transaction = new TransactionTemplate(manager);
    }
    public synchronized PriceHistory history(String ticker) {
        String canonical = CompanyCatalog.find(ticker).ticker();
        var cached = jdbc.query("SELECT payload FROM daily_prices WHERE ticker = ?", (rs, i) -> {
            try { return mapper.readValue(rs.getString(1), PriceHistory.class); }
            catch (Exception e) { throw new IllegalStateException("Could not read stored prices."); }
        }, canonical).stream().findFirst().orElse(null);
        if (cached != null && cached.retrievedAt().plus(Duration.ofHours(24)).isAfter(Instant.now())) return cached;
        if (key.isBlank()) throw new IllegalStateException("Set ALPHA_VANTAGE_API_KEY before importing market prices.");
        try {
            // I keep the credential out of stored URLs, API responses, and error messages.
            long wait = nextRequestAt - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            nextRequestAt = System.currentTimeMillis() + 13000;
            URI uri = URI.create("https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol="
                + URLEncoder.encode(canonical, StandardCharsets.UTF_8) + "&apikey=" + URLEncoder.encode(key, StandardCharsets.UTF_8));
            var response = http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("The price provider returned HTTP " + response.statusCode() + ".");
            var history = parse(canonical, mapper.readTree(response.body()), Instant.now());
            String payload = mapper.writeValueAsString(history);
            transaction.executeWithoutResult(status -> {
                jdbc.update("DELETE FROM daily_prices WHERE ticker = ?", canonical);
                jdbc.update("INSERT INTO daily_prices(ticker, fetched_at, payload) VALUES (?, ?, ?)", canonical, history.retrievedAt().toString(), payload);
            });
            return history;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("The price request was interrupted.");
        } catch (java.io.IOException e) { throw new IllegalStateException("Could not retrieve market prices. Try again later."); }
    }

    public static PriceHistory parse(String ticker, JsonNode root, Instant fetched) {
        if (root.has("Note") || root.has("Information"))
            throw new IllegalStateException("The price provider reported a rate limit or subscription restriction. Try again later or check the API plan.");
        if (root.has("Error Message")) throw new IllegalStateException("The price provider could not resolve this ticker.");
        if (!ticker.equalsIgnoreCase(root.path("Meta Data").path("2. Symbol").asText()))
            throw new IllegalStateException("The price provider returned a different or missing ticker.");
        JsonNode data = root.path("Time Series (Daily)");
        if (!data.isObject() || data.isEmpty()) throw new IllegalStateException("No daily prices were returned.");
        List<PriceHistory.Day> days = new ArrayList<>();
        try {
            var iterator = data.fields();
            while (iterator.hasNext()) {
                var entry = iterator.next(); LocalDate.parse(entry.getKey()); var day = entry.getValue();
                BigDecimal open = new BigDecimal(day.path("1. open").asText());
                BigDecimal high = new BigDecimal(day.path("2. high").asText());
                BigDecimal low = new BigDecimal(day.path("3. low").asText());
                BigDecimal close = new BigDecimal(day.path("4. close").asText());
                long volume = new BigDecimal(day.path("5. volume").asText()).longValueExact();
                if (low.signum() <= 0 || high.compareTo(open.max(close)) < 0 || low.compareTo(open.min(close)) > 0 || volume < 0)
                    throw new IllegalArgumentException();
                days.add(new PriceHistory.Day(entry.getKey(), open, high, low, close, volume));
            }
        } catch (RuntimeException e) { throw new IllegalStateException("The provider returned invalid daily price data."); }
        days.sort(Comparator.comparing(PriceHistory.Day::date).reversed());
        return new PriceHistory(ticker, "USD", false, "market", "Alpha Vantage daily prices",
            "https://www.alphavantage.co/documentation/#daily", fetched, days.stream().limit(100).toList());
    }

    public static PriceHistory example() {
        var days = IntStream.range(0, 50).mapToObj(i -> {
            LocalDate date = LocalDate.of(2026, 8, 1).plusDays(i);
            BigDecimal close = BigDecimal.valueOf(2000 + i * 4 + (i % 7 - 3) * 12, 2);
            return new PriceHistory.Day(date.toString(), close.subtract(new BigDecimal("0.10")),
                close.add(new BigDecimal("0.30")), close.subtract(new BigDecimal("0.40")), close, 100000 + i * 500);
        }).sorted(Comparator.comparing(PriceHistory.Day::date).reversed()).toList();
        return new PriceHistory("DEMO", "USD", false, "example", "Invented example prices", null, null, days);
    }
}

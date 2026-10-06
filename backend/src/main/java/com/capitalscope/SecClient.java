package com.capitalscope;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

@Service
public class SecClient {
    public record Snapshot(JsonNode data, Instant fetchedAt) {}
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NORMAL).build();
    private final ResearchStore store;
    private final ObjectMapper mapper;
    private final String userAgent;
    private long nextRequestAt;

    public SecClient(ResearchStore store, ObjectMapper mapper, @Value("${sec.user-agent:}") String userAgent) {
        this.store = store;
        this.mapper = mapper;
        this.userAgent = userAgent;
    }

    public String resolveCik(String ticker) {
        JsonNode tickers = fetch("https://www.sec.gov/files/company_tickers.json").data();
        for (JsonNode company : tickers) {
            if (company.path("ticker").asText().equalsIgnoreCase(ticker))
                return String.format("%010d", company.path("cik_str").asLong());
        }
        throw new IllegalStateException("The SEC ticker mapping does not contain this company.");
    }

    public Snapshot companyFacts(String cik) {
        return fetch("https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json");
    }

    private synchronized Snapshot fetch(String url) {
        if (userAgent.isBlank())
            throw new IllegalStateException("Set SEC_USER_AGENT to an app name and contact email before fetching SEC data.");
        Snapshot existing = store.snapshot(url);
        if (existing != null && existing.fetchedAt().plus(Duration.ofHours(6)).isAfter(Instant.now()))
            return existing;
        try {
            // I keep requests one second apart, including requests for different companies.
            long wait = nextRequestAt - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            nextRequestAt = System.currentTimeMillis() + 1000;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                .header("User-Agent", userAgent).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200)
                throw new IllegalStateException("SEC returned HTTP " + response.statusCode() + ". Try again later.");
            JsonNode data = mapper.readTree(response.body());
            Snapshot snapshot = new Snapshot(data, Instant.now());
            store.saveSnapshot(url, snapshot);
            return snapshot;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("SEC request interrupted.", e);
        } catch (IOException e) {
            throw new IllegalStateException("Could not retrieve SEC data. Try again later.", e);
        }
    }
}

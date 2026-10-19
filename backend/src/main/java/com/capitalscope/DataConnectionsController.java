package com.capitalscope;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DataConnectionsController {
    public record Status(boolean secConfigured, boolean marketPricesConfigured, Instant checkedAt) {}
    private final boolean secConfigured;
    private final boolean marketPricesConfigured;

    public DataConnectionsController(@Value("${sec.user-agent:}") String userAgent,
                                     @Value("${prices.api-key:}") String priceKey) {
        // I expose presence only; I do not return contact details or credentials.
        this.secConfigured = !userAgent.isBlank();
        this.marketPricesConfigured = !priceKey.isBlank();
    }

    @GetMapping("/api/data-connections")
    public ResponseEntity<Status> status() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(new Status(secConfigured, marketPricesConfigured, Instant.now()));
    }
}

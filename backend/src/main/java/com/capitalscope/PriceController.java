package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PriceController {
    private final PriceClient client;
    public PriceController(PriceClient client) { this.client = client; }
    @GetMapping("/companies/{ticker}/prices")
    public PriceHistory prices(@PathVariable String ticker) { return client.history(ticker); }
    @GetMapping("/examples/prices")
    public PriceHistory example() { return PriceClient.example(); }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> unavailable(IllegalStateException e) {
        return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
    }
}

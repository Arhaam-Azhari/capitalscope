package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {
    private final WatchlistStore store;
    public WatchlistController(WatchlistStore store) { this.store = store; }
    @GetMapping public List<WatchlistStore.Entry> list() { return store.list(); }
    @PutMapping("/{ticker}") public WatchlistStore.Entry save(@PathVariable String ticker, @RequestBody WatchlistStore.Draft draft) { return store.save(ticker, draft); }
    @DeleteMapping("/{ticker}") public ResponseEntity<Void> remove(@PathVariable String ticker, @RequestParam long version, @RequestParam String entryId) {
        store.remove(ticker, version, entryId); return ResponseEntity.noContent().build();
    }
    @ExceptionHandler(WatchlistStore.Conflict.class)
    public ResponseEntity<Map<String, String>> conflict(WatchlistStore.Conflict e) { return ResponseEntity.status(409).body(Map.of("error", e.getMessage())); }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide valid watchlist fields and a YYYY-MM-DD review date."));
    }
}

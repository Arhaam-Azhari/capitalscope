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
    @GetMapping("/export.csv") public ResponseEntity<String> export() {
        var entries = store.list();
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=watchlist-research.csv")
            .contentType(org.springframework.http.MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(CsvExport.watchlist(entries, java.time.Instant.now()));
    }
    @GetMapping("/{ticker}/history") public WatchlistStore.History history(@PathVariable String ticker, @RequestParam(required = false) Long before) { return store.history(ticker, before); }
    @GetMapping("/{ticker}/history/export.csv") public ResponseEntity<String> exportHistory(@PathVariable String ticker) {
        var revisions = store.historyForExport(ticker);
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=research-history.csv")
            .contentType(org.springframework.http.MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(CsvExport.researchHistory(revisions, java.time.Instant.now()));
    }
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

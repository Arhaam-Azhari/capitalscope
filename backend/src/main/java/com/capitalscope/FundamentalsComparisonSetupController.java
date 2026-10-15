package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/research/comparison-setups")
public class FundamentalsComparisonSetupController {
    private final FundamentalsComparisonSetupStore store;
    public FundamentalsComparisonSetupController(FundamentalsComparisonSetupStore store) { this.store = store; }
    @GetMapping public List<FundamentalsComparisonSetupStore.Setup> list() { return store.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public FundamentalsComparisonSetupStore.Setup save(@RequestBody FundamentalsComparisonSetupStore.SaveRequest request) { return store.save(request); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        return store.delete(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide a name, two to four catalog tickers, and a supported measure."));
    }
}

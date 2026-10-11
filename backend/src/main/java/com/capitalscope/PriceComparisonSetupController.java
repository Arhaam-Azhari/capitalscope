package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/companies/{ticker}/price-comparison-setups")
public class PriceComparisonSetupController {
    private final PriceComparisonSetupStore store;
    public PriceComparisonSetupController(PriceComparisonSetupStore store) { this.store = store; }
    @GetMapping public List<PriceComparisonSetupStore.Setup> list(@PathVariable String ticker) { return store.list(ticker); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public PriceComparisonSetupStore.Setup save(@PathVariable String ticker, @RequestBody PriceComparisonSetupStore.SaveRequest request) { return store.save(ticker, request); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String ticker, @PathVariable String id) {
        return store.delete(ticker, id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide a name, market reference ticker, and valid ISO dates."));
    }
}

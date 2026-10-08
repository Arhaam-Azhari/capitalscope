package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.*;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/stress-scenarios")
public class PortfolioStressScenarioController {
    private final PortfolioStressStore store;
    public PortfolioStressScenarioController(PortfolioStressStore store) { this.store = store; }
    @GetMapping
    public List<PortfolioStressStore.Scenario> list(@PathVariable String portfolioId) { return store.list(portfolioId); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PortfolioStressStore.Scenario save(@PathVariable String portfolioId, @RequestBody PortfolioStressStore.SaveRequest request) {
        return store.save(portfolioId, request);
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String portfolioId, @PathVariable String id) {
        return store.delete(portfolioId, id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> missing(NoSuchElementException e) {
        return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide a scenario name and price change assumptions."));
    }
}

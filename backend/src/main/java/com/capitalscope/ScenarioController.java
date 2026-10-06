package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestController
@RequestMapping("/api/companies/{ticker}/scenarios")
public class ScenarioController {
    public record SaveRequest(String name, DcfCalculator.Assumptions assumptions) {}
    private final ResearchStore store;
    private static final Set<String> SPECIALIZED = Set.of("BRK-B", "JPM", "BAC", "MS", "GS", "WFC", "UNH");
    public ScenarioController(ResearchStore store) { this.store = store; }
    private String company(String ticker) {
        if (ticker.equalsIgnoreCase("DEMO")) return "DEMO";
        return CompanyCatalog.find(ticker).ticker();
    }
    @GetMapping
    public List<ResearchStore.Scenario> list(@PathVariable String ticker) { return store.scenarios(company(ticker)); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResearchStore.Scenario save(@PathVariable String ticker, @RequestBody SaveRequest request) {
        String canonical = company(ticker);
        if (SPECIALIZED.contains(canonical)) throw new IllegalArgumentException("This company needs a sector-specific valuation model.");
        return store.saveScenario(canonical, request.name(), request.assumptions());
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String ticker, @PathVariable String id) {
        return store.deleteScenario(company(ticker), id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide a scenario name and numeric assumptions."));
    }
}

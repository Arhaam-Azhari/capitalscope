package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestController
@RequestMapping("/api")
public class ResearchController {
    private final SecClient sec;
    public ResearchController(SecClient sec) { this.sec = sec; }

    @GetMapping("/companies")
    public List<CompanyCatalog.Company> companies() { return CompanyCatalog.COMPANIES; }

    @GetMapping("/companies/{ticker}/financials")
    public FinancialReport financials(@PathVariable String ticker) {
        var company = CompanyCatalog.find(ticker);
        String cik = sec.resolveCik(company.ticker());
        var snapshot = sec.companyFacts(cik);
        return new FinancialReport(company, cik, snapshot.fetchedAt(), Instant.now(),
            "SEC EDGAR companyfacts", "sec", FinancialFacts.extract(snapshot.data(), cik),
            List.of("Latest-filed annual facts; these are not point-in-time backtesting data.",
                "Missing metrics remain empty. Filing dates are shown for each value."));
    }

    @GetMapping("/examples/financials")
    public FinancialReport example() { return ExampleReport.create(); }

    @GetMapping("/universe")
    public Map<String, Object> universe() {
        return Map.of("asOf", CompanyCatalog.UNIVERSE_AS_OF, "count", CompanyCatalog.COMPANIES.size(),
            "basis", "U.S. public companies ranked by market capitalization", "dynamic", false);
    }

    @PostMapping("/valuations/dcf")
    public DcfCalculator.Valuation valuation(@RequestBody DcfCalculator.Assumptions assumptions) {
        return DcfCalculator.calculate(assumptions);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> unavailable(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> malformed(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Provide valid JSON with numeric valuation inputs."));
    }
}

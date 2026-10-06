package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ResearchController {
    private final SecClient sec;
    public ResearchController(SecClient sec) { this.sec = sec; }

    @GetMapping("/companies")
    public List<CompanyCatalog.Company> companies() { return CompanyCatalog.COMPANIES; }

    @GetMapping("/companies/{ticker}/financials")
    public Map<String, Object> financials(@PathVariable String ticker) {
        var company = CompanyCatalog.find(ticker);
        String cik = sec.resolveCik(company.ticker());
        return Map.of("company", company, "cik", cik, "servedAt", Instant.now(),
            "source", "SEC EDGAR companyfacts", "metrics", FinancialFacts.extract(sec.companyFacts(cik), cik),
            "notes", List.of("Latest-filed annual facts; these are not point-in-time backtesting data.",
                "Missing metrics remain empty. Filing dates are shown for each value."));
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
}

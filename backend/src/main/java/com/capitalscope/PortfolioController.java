package com.capitalscope;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioController {
    private final PortfolioService service;
    public PortfolioController(PortfolioService service) { this.service = service; }
    @GetMapping
    public List<PaperPortfolio.Portfolio> list() { return service.list(); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaperPortfolio.Summary create(@RequestBody PortfolioService.NewPortfolio request) { return service.create(request); }
    @GetMapping("/{id}")
    public PaperPortfolio.Summary get(@PathVariable String id) { return service.summary(id); }
    @PostMapping("/{id}/trades")
    public PaperPortfolio.Summary trade(@PathVariable String id, @RequestBody PortfolioService.Fill fill) { return service.trade(id, fill); }
    @PostMapping("/{id}/actions")
    public PaperPortfolio.Summary action(@PathVariable String id, @RequestBody PortfolioService.Action request) {
        return service.action(id, request);
    }
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> missing(NoSuchElementException e) { return ResponseEntity.status(404).body(Map.of("error", e.getMessage())); }
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e instanceof IllegalArgumentException ? e.getMessage() : "Provide valid portfolio or trade inputs."));
    }
}

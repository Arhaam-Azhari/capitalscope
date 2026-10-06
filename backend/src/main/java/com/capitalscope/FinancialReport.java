package com.capitalscope;

import java.time.Instant;
import java.util.List;

public record FinancialReport(CompanyCatalog.Company company, String cik, Instant retrievedAt,
                              Instant servedAt, String source, String dataMode,
                              List<FinancialFacts.Metric> metrics, List<String> notes) {}

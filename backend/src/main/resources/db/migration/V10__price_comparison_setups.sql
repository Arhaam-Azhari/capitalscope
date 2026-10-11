CREATE TABLE price_comparison_setups (
    id VARCHAR(36) PRIMARY KEY,
    current_ticker VARCHAR(16) NOT NULL,
    reference_ticker VARCHAR(16) NOT NULL,
    name VARCHAR(80) NOT NULL,
    start_date VARCHAR(10) NOT NULL,
    end_date VARCHAR(10) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    model_version VARCHAR(40) NOT NULL
);
CREATE INDEX price_setup_company_date ON price_comparison_setups(current_ticker, created_at);

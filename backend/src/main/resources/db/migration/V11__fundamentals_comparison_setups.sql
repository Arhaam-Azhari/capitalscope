CREATE TABLE fundamentals_comparison_setups (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    ticker_1 VARCHAR(16) NOT NULL,
    ticker_2 VARCHAR(16) NOT NULL,
    ticker_3 VARCHAR(16),
    ticker_4 VARCHAR(16),
    measure VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    model_version VARCHAR(40) NOT NULL
);
CREATE INDEX fundamentals_setup_date ON fundamentals_comparison_setups(created_at);

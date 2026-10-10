CREATE TABLE portfolio_allocation_targets (
    id VARCHAR(36) PRIMARY KEY,
    portfolio_id VARCHAR(36) NOT NULL REFERENCES practice_portfolios(id),
    name VARCHAR(80) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    data_mode VARCHAR(16) NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    targets TEXT NOT NULL
);
CREATE INDEX allocation_targets_by_portfolio ON portfolio_allocation_targets(portfolio_id, created_at);

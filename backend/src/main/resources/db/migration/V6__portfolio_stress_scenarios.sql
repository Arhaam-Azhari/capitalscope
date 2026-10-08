CREATE TABLE portfolio_stress_scenarios (
    id VARCHAR(36) PRIMARY KEY,
    portfolio_id VARCHAR(36) NOT NULL REFERENCES practice_portfolios(id),
    name VARCHAR(80) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    model_version VARCHAR(32) NOT NULL,
    result TEXT NOT NULL
);
CREATE INDEX stress_scenarios_by_portfolio ON portfolio_stress_scenarios(portfolio_id, created_at);

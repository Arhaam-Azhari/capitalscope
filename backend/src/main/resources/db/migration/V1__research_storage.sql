CREATE TABLE sec_snapshots (
    source_url VARCHAR(512) PRIMARY KEY,
    fetched_at VARCHAR(40) NOT NULL,
    payload TEXT NOT NULL
);
CREATE TABLE valuation_scenarios (
    id VARCHAR(36) PRIMARY KEY,
    ticker VARCHAR(16) NOT NULL,
    name VARCHAR(80) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    assumptions TEXT NOT NULL,
    result TEXT NOT NULL,
    model_version VARCHAR(32) NOT NULL
);
CREATE INDEX scenarios_by_company ON valuation_scenarios(ticker, created_at);

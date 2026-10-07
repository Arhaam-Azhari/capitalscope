CREATE TABLE research_watchlist (
    ticker VARCHAR(16) PRIMARY KEY,
    entry_id VARCHAR(36) NOT NULL,
    status VARCHAR(16) NOT NULL,
    thesis VARCHAR(2000) NOT NULL,
    risks VARCHAR(1000) NOT NULL,
    review_date VARCHAR(10),
    version BIGINT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
);

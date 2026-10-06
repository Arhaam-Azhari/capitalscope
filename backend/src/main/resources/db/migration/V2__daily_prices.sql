CREATE TABLE daily_prices (
    ticker VARCHAR(16) PRIMARY KEY,
    fetched_at VARCHAR(40) NOT NULL,
    payload TEXT NOT NULL
);

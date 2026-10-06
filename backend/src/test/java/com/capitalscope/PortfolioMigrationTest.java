package com.capitalscope;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioMigrationTest {
    @TempDir Path directory;
    @Test void iKeepExistingTradesInOrderWhenAddingTheEventHistory() {
        var source = new DriverManagerDataSource("jdbc:h2:file:" + directory.resolve("upgrade"), "sa", "");
        Flyway.configure().dataSource(source).target("3").load().migrate();
        var jdbc = new JdbcTemplate(source); String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO practice_portfolios(id,name,mode,initial_cash,created_at) VALUES (?,?,?,?,?)", id, "My older portfolio", "example", 1000, "2026-10-06T00:00:00Z");
        for (String side : new String[]{"BUY", "SELL"}) jdbc.update("INSERT INTO paper_trades(portfolio_id,request_id,ticker,side,quantity,price,fee,recorded_at) VALUES (?,?,?,?,?,?,?,?)",
            id, UUID.randomUUID().toString(), "DEMO", side, 5, side.equals("BUY") ? 20 : 30, 0, "2026-10-06T00:00:00Z");
        Flyway.configure().dataSource(source).load().migrate();
        var upgraded = new PortfolioService(jdbc).summary(id);
        assertEquals(2, upgraded.events().size()); assertTrue(upgraded.positions().isEmpty());
        assertEquals(0, new BigDecimal("1050").compareTo(upgraded.cash()));
        assertEquals("BUY", upgraded.trades().get(0).side()); assertEquals("SELL", upgraded.trades().get(1).side());
        jdbc.execute("SHUTDOWN");
        var reopened = new PortfolioService(new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:file:" + directory.resolve("upgrade"), "sa", ""))).summary(id);
        assertEquals(2, reopened.events().size()); assertEquals(0, upgraded.cash().compareTo(reopened.cash()));
    }
}

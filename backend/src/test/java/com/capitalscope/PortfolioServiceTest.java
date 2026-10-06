package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class PortfolioServiceTest {
    @Autowired PortfolioService service;
    private PortfolioService.Fill fill(String id, String quantity) {
        return new PortfolioService.Fill(id, "DEMO", "BUY", new BigDecimal(quantity), new BigDecimal("10"), BigDecimal.ZERO);
    }
    private String create() {
        return service.create(new PortfolioService.NewPortfolio("My test portfolio", "example", new BigDecimal("1000"))).portfolio().id();
    }
    @Test void iRetryAFillWithoutRecordingItTwice() {
        String id = create(), key = UUID.randomUUID().toString();
        service.trade(id, fill(key, "10")); var retry = service.trade(id, fill(key, "10"));
        assertEquals(1, retry.trades().size()); assertEquals(0, new BigDecimal("900").compareTo(retry.cash()));
        assertThrows(IllegalArgumentException.class, () -> service.trade(id, fill(key, "11")));
        assertThrows(IllegalArgumentException.class, () -> service.trade(id,
            new PortfolioService.Fill(UUID.randomUUID().toString(), "AAPL", "BUY", BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO)));
        assertEquals(1, service.summary(id).trades().size());
    }
    @Test void iPreventConcurrentFillsFromSpendingTheSameCash() throws Exception {
        String id = create(); var executor = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            Callable<Boolean> task = () -> { start.await(); try {
                service.trade(id, fill(UUID.randomUUID().toString(), "75")); return true;
            } catch (IllegalArgumentException e) { return false; } };
            var first = executor.submit(task); var second = executor.submit(task); start.countDown();
            int successes = (first.get(10, TimeUnit.SECONDS) ? 1 : 0) + (second.get(10, TimeUnit.SECONDS) ? 1 : 0);
            assertEquals(1, successes); assertEquals(1, service.summary(id).trades().size());
            assertEquals(0, new BigDecimal("250").compareTo(service.summary(id).cash()));
        } finally { executor.shutdownNow(); }
    }
}

package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class DataConnectionsTest {
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;

    @Test void iDescribeMissingConfigurationWithoutCallingProviders() throws Exception {
        mvc.perform(get("/api/data-connections"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.secConfigured").value(false))
            .andExpect(jsonPath("$.marketPricesConfigured").value(false))
            .andExpect(jsonPath("$.checkedAt").isString())
            .andExpect(jsonPath("$.length()").value(3));
    }

    @Test void iReportOnlyPresenceForEachIndependentConnection() throws Exception {
        var sec = new DataConnectionsController("My synthetic contact", " \t ").status().getBody();
        assertNotNull(sec); assertTrue(sec.secConfigured()); assertFalse(sec.marketPricesConfigured());
        var prices = new DataConnectionsController(" \n ", "my-synthetic-key").status().getBody();
        assertNotNull(prices); assertFalse(prices.secConfigured()); assertTrue(prices.marketPricesConfigured());
        var both = new DataConnectionsController("My synthetic contact", "my-synthetic-key").status().getBody();
        assertNotNull(both); assertTrue(both.secConfigured()); assertTrue(both.marketPricesConfigured());
        assertNotNull(both.checkedAt());
        String response = mapper.writeValueAsString(both);
        assertEquals(3, mapper.readTree(response).size());
        assertFalse(response.contains("My synthetic contact"));
        assertFalse(response.contains("my-synthetic-key"));
    }
}

package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class PriceComparisonSetupTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired PriceComparisonSetupStore store;
    @Test void iSaveReloadAndDeleteSetupWithoutRequiringMarketData() throws Exception {
        String path = "/api/companies/aapl/price-comparison-setups";
        String body = "{\"name\":\"  My tech window  \",\"referenceTicker\":\"msft\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-09\"}";
        String saved = mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("My tech window")).andExpect(jsonPath("$.currentTicker").value("AAPL"))
            .andExpect(jsonPath("$.referenceTicker").value("MSFT")).andExpect(jsonPath("$.modelVersion").value("price-comparison-setup-v1"))
            .andReturn().getResponse().getContentAsString();
        var setup = mapper.readValue(saved, PriceComparisonSetupStore.Setup.class);
        assertTrue(store.list("AAPL").contains(setup));
        assertFalse(saved.contains("close"));
        mvc.perform(delete("/api/companies/MSFT/price-comparison-setups/" + setup.id())).andExpect(status().isNotFound());
        mvc.perform(delete(path + "/" + setup.id())).andExpect(status().isNoContent());
        mvc.perform(delete(path + "/" + setup.id())).andExpect(status().isNotFound());
        assertFalse(store.list("AAPL").contains(setup));
    }
    @Test void iRejectInvalidCompaniesNamesAndDates() throws Exception {
        String path = "/api/companies/AAPL/price-comparison-setups";
        for (String ref : new String[]{"AAPL", "DEMO", "MISSING"})
            mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My invalid setup\",\"referenceTicker\":\"" + ref + "\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-09\"}")).andExpect(status().isBadRequest());
        for (String dates : new String[]{"\"startDate\":null,\"endDate\":null", "\"startDate\":\"2026-02-30\",\"endDate\":\"2026-10-09\"", "\"startDate\":\"2026-10-09\",\"endDate\":\"2026-10-01\""})
            mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My invalid setup\",\"referenceTicker\":\"MSFT\"," + dates + "}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\" \",\"referenceTicker\":\"MSFT\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-09\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/companies/DEMO/price-comparison-setups")).andExpect(status().isBadRequest());
    }
}

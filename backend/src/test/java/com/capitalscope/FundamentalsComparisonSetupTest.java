package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class FundamentalsComparisonSetupTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FundamentalsComparisonSetupStore store;
    private final String path = "/api/research/comparison-setups";
    @Test void iSaveOrderedPeersAndMeasureWithoutRequiringFinancialReports() throws Exception {
        var body = mapper.writeValueAsString(Map.of("name", "  My cross-sector peers  ", "tickers", List.of("msft", "aapl", "NVDA", "AMZN"), "measure", "ocf-margin"));
        String json = mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("My cross-sector peers")).andExpect(jsonPath("$.tickers[0]").value("MSFT"))
            .andExpect(jsonPath("$.tickers[3]").value("AMZN")).andExpect(jsonPath("$.measure").value("ocf-margin"))
            .andReturn().getResponse().getContentAsString();
        var setup = mapper.readValue(json, FundamentalsComparisonSetupStore.Setup.class);
        assertTrue(store.list().contains(setup));
        assertEquals("fundamentals-comparison-v1", setup.modelVersion());
        assertFalse(json.contains("revenue"));
        mvc.perform(get(path)).andExpect(status().isOk());
        mvc.perform(delete(path + "/" + setup.id())).andExpect(status().isNoContent());
        mvc.perform(delete(path + "/" + setup.id())).andExpect(status().isNotFound());
        assertFalse(store.list().contains(setup));
    }
    @Test void iRejectInvalidPeerSelectionsAndMeasures() throws Exception {
        for (List<String> tickers : List.of(List.of("AAPL"), List.of("AAPL", "aapl"), List.of("DEMO", "MSFT"), List.of("MISSING", "AAPL"), List.of("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL")))
            mvc.perform(post(path).contentType("application/json").content(mapper.writeValueAsString(Map.of("name", "My invalid setup", "tickers", tickers, "measure", "net-margin")))).andExpect(status().isBadRequest());
        for (String name : List.of(" ", "x".repeat(81)))
            mvc.perform(post(path).contentType("application/json").content(mapper.writeValueAsString(Map.of("name", name, "tickers", List.of("AAPL", "MSFT"), "measure", "revenue")))).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My invalid setup\",\"tickers\":[\"AAPL\",null],\"measure\":\"growth\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My invalid setup\",\"tickers\":[\"AAPL\",\"MSFT\"],\"measure\":\"unknown\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":null,\"tickers\":null,\"measure\":null}")).andExpect(status().isBadRequest());
    }
}

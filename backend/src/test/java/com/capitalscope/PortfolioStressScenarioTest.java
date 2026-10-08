package com.capitalscope;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"sec.user-agent=", "prices.api-key="})
@AutoConfigureMockMvc
class PortfolioStressScenarioTest {
    @Autowired PortfolioService portfolios;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired PortfolioStressStore store;
    private String portfolio(String mode) {
        return portfolios.create(new PortfolioService.NewPortfolio("My saved stress portfolio", mode, new BigDecimal("1000"))).portfolio().id();
    }
    private void trade(String id, String ticker, String side) {
        portfolios.trade(id, new PortfolioService.Fill(UUID.randomUUID().toString(), ticker, side, new BigDecimal("10"), new BigDecimal("20"), BigDecimal.ONE));
    }
    @Test void iPersistServerCalculatedEvidenceAndKeepItAfterTheLedgerChanges() throws Exception {
        var id = portfolio("example"); trade(id, "DEMO", "BUY");
        var before = mapper.writeValueAsString(portfolios.summary(id));
        var path = "/api/portfolios/" + id + "/stress-scenarios";
        var response = mvc.perform(post(path).contentType("application/json")
            .content("{\"name\":\"  My downside  \",\"assumptions\":{\"defaultShock\":-0.2,\"sectorShocks\":{}},\"result\":{\"stressedTotalValue\":999999}}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("My downside"))
            .andExpect(jsonPath("$.modelVersion").value("price-shock-v1"))
            .andExpect(jsonPath("$.result.stressedTotalValue").value(971.8))
            .andExpect(jsonPath("$.result.baseline.holdings[0].priceDate").value("2026-09-19"))
            .andReturn().getResponse().getContentAsString();
        assertEquals(before, mapper.writeValueAsString(portfolios.summary(id)));
        String savedId = mapper.readTree(response).get("id").asText();
        trade(id, "DEMO", "SELL");
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$[0].result.baseline.cash").value(799))
            .andExpect(jsonPath("$[0].result.baseline.holdings[0].quantity").value(10))
            .andExpect(jsonPath("$[0].result.stressedTotalValue").value(971.8));
        assertEquals(mapper.readValue(response, PortfolioStressStore.Scenario.class), store.list(id).get(0));
        var second = mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My cash case\",\"assumptions\":{\"defaultShock\":-0.2}}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.result.baseline.cash").value(998))
            .andExpect(jsonPath("$.result.stressedTotalValue").value(998)).andReturn().getResponse().getContentAsString();
        assertNotEquals(savedId, mapper.readTree(second).get("id").asText());
        String other = portfolio("example");
        mvc.perform(delete("/api/portfolios/" + other + "/stress-scenarios/" + savedId)).andExpect(status().isNotFound());
        assertEquals(2, store.list(id).size());
        mvc.perform(delete(path + "/" + savedId)).andExpect(status().isNoContent());
        mvc.perform(delete(path + "/" + savedId)).andExpect(status().isNotFound());
        assertEquals(1, store.list(id).size());
    }
    @Test void iPreserveIncompleteCoverageAndRejectInvalidInputsOrUnknownPortfolios() throws Exception {
        String id = portfolio("market"); trade(id, "AAPL", "BUY");
        String path = "/api/portfolios/" + id + "/stress-scenarios";
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My unpriced case\",\"assumptions\":{\"defaultShock\":-0.5}}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.result.baseline.complete").value(false))
            .andExpect(jsonPath("$.result.stressedTotalValue").isEmpty()).andExpect(jsonPath("$.result.holdings[0].baseline.error").isNotEmpty());
        for (String body : new String[]{"{\"name\":\" \"}", "{\"name\":\"Missing assumptions\"}",
                "{\"name\":\"Bad shock\",\"assumptions\":{\"defaultShock\":2}}", "{\"name\":\"" + "x".repeat(81) + "\",\"assumptions\":{\"defaultShock\":0}}"})
            mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        assertEquals(1, store.list(id).size());
        mvc.perform(get("/api/portfolios/missing/stress-scenarios")).andExpect(status().isNotFound());
        mvc.perform(post("/api/portfolios/missing/stress-scenarios").contentType("application/json").content("{\"name\":\"My missing case\",\"assumptions\":{\"defaultShock\":0}}"))
            .andExpect(status().isNotFound());
    }
}

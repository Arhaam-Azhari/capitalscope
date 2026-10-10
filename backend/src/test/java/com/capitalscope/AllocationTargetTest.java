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
class AllocationTargetTest {
    @Autowired PortfolioService portfolios;
    @Autowired AllocationTargetStore store;
    @Autowired ObjectMapper mapper;
    @Autowired MockMvc mvc;
    private String portfolio() {
        return portfolios.create(new PortfolioService.NewPortfolio("My target portfolio", "example", new BigDecimal("1000"))).portfolio().id();
    }
    private void trade(String id, String side) {
        portfolios.trade(id, new PortfolioService.Fill(UUID.randomUUID().toString(), "DEMO", side, BigDecimal.TEN, new BigDecimal("20"), BigDecimal.ZERO));
    }
    @Test void iSavePercentagesWithoutChangingTradesAndKeepThemAfterHoldingsChange() throws Exception {
        String id = portfolio(); trade(id, "BUY");
        String path = "/api/portfolios/" + id + "/allocation-targets";
        String before = mapper.writeValueAsString(portfolios.summary(id));
        String body = "{\"name\":\"  My reserve mix  \",\"targets\":{\"Cash\":33.33,\"DEMO\":66.67}}";
        String saved = mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("My reserve mix")).andExpect(jsonPath("$.dataMode").value("example"))
            .andExpect(jsonPath("$.modelVersion").value("allocation-targets-v1")).andExpect(jsonPath("$.targets.Cash").value(33.33))
            .andReturn().getResponse().getContentAsString();
        assertEquals(before, mapper.writeValueAsString(portfolios.summary(id)));
        String savedId = mapper.readTree(saved).get("id").asText();
        assertEquals(mapper.readValue(saved, AllocationTargetStore.Preset.class), store.list(id).get(0));
        String second = mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        assertNotEquals(savedId, mapper.readTree(second).get("id").asText());
        trade(id, "SELL");
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$[0].targets.DEMO").value(66.67));
        mvc.perform(post(path).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My cash mix\",\"targets\":{\"Cash\":100}}"))
            .andExpect(status().isCreated());
        String other = portfolio();
        mvc.perform(delete("/api/portfolios/" + other + "/allocation-targets/" + savedId)).andExpect(status().isNotFound());
        assertEquals(3, store.list(id).size());
        mvc.perform(delete(path + "/" + savedId)).andExpect(status().isNoContent());
        mvc.perform(delete(path + "/" + savedId)).andExpect(status().isNotFound());
        assertEquals(2, store.list(id).size());
    }
    @Test void iRejectWrongAssetsInvalidPercentagesAndMissingPortfolios() throws Exception {
        String id = portfolio(); trade(id, "BUY");
        String path = "/api/portfolios/" + id + "/allocation-targets";
        for (String targets : new String[]{"null", "{}", "{\"Cash\":100}", "{\"Cash\":50,\"DEMO\":40}",
            "{\"Cash\":-1,\"DEMO\":101}", "{\"Cash\":33.333,\"DEMO\":66.667}", "{\"Cash\":null,\"DEMO\":100}",
            "{\"Cash\":0,\"DEMO\":100,\"AAPL\":0}"})
            mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My invalid mix\",\"targets\":" + targets + "}"))
                .andExpect(status().isBadRequest());
        for (String name : new String[]{" ", "x".repeat(81)})
            mvc.perform(post(path).contentType("application/json").content("{\"name\":\"" + name + "\",\"targets\":{\"Cash\":0,\"DEMO\":100}}"))
                .andExpect(status().isBadRequest());
        assertTrue(store.list(id).isEmpty());
        mvc.perform(post(path).contentType("application/json").content("{\"name\":\"My full position\",\"targets\":{\"Cash\":0,\"DEMO\":100}}"))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/portfolios/missing/allocation-targets")).andExpect(status().isNotFound());
        mvc.perform(post("/api/portfolios/missing/allocation-targets").contentType("application/json").content("{\"name\":\"My missing mix\",\"targets\":{\"Cash\":100}}"))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/portfolios/missing/allocation-targets/missing")).andExpect(status().isNotFound());
    }
}

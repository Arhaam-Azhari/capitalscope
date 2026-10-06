package com.capitalscope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "sec.user-agent=")
@AutoConfigureMockMvc
class ApiTest {
    @Autowired MockMvc api;

    @Test void applicationStartsAndServesTheUniverse() throws Exception {
        api.perform(get("/api/companies")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(50)).andExpect(jsonPath("$[0].ticker").value("NVDA"));
        api.perform(get("/api/universe")).andExpect(status().isOk())
            .andExpect(jsonPath("$.asOf").value("2026-10-06")).andExpect(jsonPath("$.dynamic").value(false));
    }

    @Test void exampleCannotBeMistakenForSecData() throws Exception {
        api.perform(get("/api/examples/financials")).andExpect(status().isOk())
            .andExpect(jsonPath("$.dataMode").value("example"))
            .andExpect(jsonPath("$.company.ticker").value("DEMO"))
            .andExpect(jsonPath("$.metrics[0].annualValues[0].value").value(1280000000))
            .andExpect(jsonPath("$.metrics[0].annualValues[0].sourceUrl").isEmpty())
            .andExpect(jsonPath("$.retrievedAt").isEmpty());
    }

    @Test void unavailableSecDataIsNotReplacedWithExamples() throws Exception {
        api.perform(get("/api/companies/AAPL/financials")).andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("SEC_USER_AGENT")));
        api.perform(get("/api/companies/UNKNOWN/financials")).andExpect(status().isBadRequest());
    }

    @Test void httpValuationMatchesTheIndependentPerpetuityCheck() throws Exception {
        api.perform(post("/api/valuations/dcf").contentType(MediaType.APPLICATION_JSON).content("""
            {"baseFreeCashFlow":100,"growthRate":0,"discountRate":0.10,
             "terminalGrowthRate":0,"years":5,"netDebt":100,"sharesOutstanding":10}
            """)).andExpect(status().isOk()).andExpect(jsonPath("$.valuePerShare").value(org.hamcrest.Matchers.closeTo(90.0, 1e-8)))
            .andExpect(jsonPath("$.projections.length()").value(5));
    }

    @Test void invalidInputsReturnReadableErrors() throws Exception {
        api.perform(post("/api/valuations/dcf").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isString());
        api.perform(post("/api/valuations/dcf").contentType(MediaType.APPLICATION_JSON).content("not json"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value(
                "Provide valid JSON with numeric valuation inputs."));
    }
    @Test void savedScenariosKeepVersionsAndValidateCompanyAndInputs() throws Exception {
        String payload = """
            {"name":"My test case","assumptions":{"baseFreeCashFlow":100,"growthRate":0,
             "discountRate":0.1,"terminalGrowthRate":0,"years":5,"netDebt":100,"sharesOutstanding":10}}
            """;
        String body = api.perform(post("/api/companies/aapl/scenarios").contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.ticker").value("AAPL"))
            .andExpect(jsonPath("$.result.valuePerShare").value(org.hamcrest.Matchers.closeTo(90.0, 1e-8)))
            .andReturn().getResponse().getContentAsString();
        String id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).path("id").asText();
        api.perform(get("/api/companies/AAPL/scenarios")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("My test case"));
        api.perform(delete("/api/companies/MSFT/scenarios/" + id)).andExpect(status().isNotFound());
        api.perform(delete("/api/companies/AAPL/scenarios/" + id)).andExpect(status().isNoContent());
        for (String ticker : new String[]{"UNKNOWN", "JPM"})
            api.perform(post("/api/companies/" + ticker + "/scenarios").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());
        api.perform(post("/api/companies/DEMO/scenarios").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"assumptions\":{}}"))
            .andExpect(status().isBadRequest());
    }
}

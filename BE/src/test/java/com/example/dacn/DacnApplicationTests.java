package com.example.dacn;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@AutoConfigureMockMvc
class DacnApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void contextLoads() {
    }

    @Test
    void vnPayIpnIsPublic() throws Exception {
        mockMvc.perform(get("/api/v1/payments/vnpay/ipn"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("97"));
    }

    @Test
    void vnPayCreateRequiresAuthenticationAndUsesApiResponse() throws Exception {
        mockMvc.perform(post("/api/v1/payments/vnpay/create")
                        .contentType("application/json")
                        .content("{\"orderId\":10,\"locale\":\"vn\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1009))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void checkoutRequiresAuthenticationAndUsesApiResponse() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType("application/json")
                        .content(validCheckoutJson()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1009));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void checkoutRejectsNonUserRole() throws Exception {
        mockMvc.perform(post("/api/v1/checkout")
                        .contentType("application/json")
                        .content(validCheckoutJson()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));
    }

    @Test
    @WithMockUser(roles = "USER")
    void voucherManagementRejectsUserRole() throws Exception {
        mockMvc.perform(post("/api/v1/vouchers")
                        .contentType("application/json")
                        .content("""
                                {"code":"SAVE10","discountType":"PERCENTAGE","discountValue":10,
                                 "minOrderAmount":0,"usageLimit":10,"perUserLimit":1,
                                 "startDate":"2026-10-01T00:00:00","endDate":"2026-12-31T23:59:59","active":true}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void voucherValidationRejectsAdminRole() throws Exception {
        mockMvc.perform(post("/api/v1/vouchers/validate")
                        .contentType("application/json")
                        .content("""
                                {"voucherCode":"SAVE10","restaurantId":1,
                                 "deliveryLatitude":10.78,"deliveryLongitude":106.70,
                                 "items":[{"menuItemId":1,"quantity":1}]}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));
    }

    private String validCheckoutJson() {
        return """
                {"restaurantId":1,"idempotencyKey":"security-test","recipientName":"Test User",
                 "recipientPhone":"0901234567","deliveryAddress":"1 FCA Street",
                 "paymentMethod":"COD","deliveryLatitude":10.78,"deliveryLongitude":106.70,
                 "items":[{"menuItemId":1,"quantity":1}]}
                """;
    }

}

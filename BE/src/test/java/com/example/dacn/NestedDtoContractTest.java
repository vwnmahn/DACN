package com.example.dacn;

import com.example.dacn.dto.request.AccountRequest;
import com.example.dacn.dto.request.AuthRequest;
import com.example.dacn.dto.request.OrderManagementRequest;
import com.example.dacn.entity.OrderStatus;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;

class NestedDtoContractTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void jacksonKeepsAuthenticationRequestJsonContract() throws Exception {
        AuthRequest.Login login = objectMapper.readValue(
                "{\"phoneNumber\":\"0900000001\",\"password\":\"12345678\"}",
                AuthRequest.Login.class);

        assertEquals("0900000001", login.getPhoneNumber());
        assertEquals("12345678", login.getPassword());
        String json = objectMapper.writeValueAsString(login);
        assertTrue(json.contains("\"phoneNumber\":\"0900000001\""));
        assertTrue(json.contains("\"password\":\"12345678\""));
    }

    @Test
    void validationAnnotationsRemainEffectiveOnNestedDtos() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertFalse(validator.validate(new AuthRequest.Login()).isEmpty());
            assertFalse(validator.validate(new AccountRequest.Lock()).isEmpty());

            OrderManagementRequest.StatusUpdate status = new OrderManagementRequest.StatusUpdate();
            assertFalse(validator.validate(status).isEmpty());
            status.setStatus(OrderStatus.PREPARING);
            assertTrue(validator.validate(status).isEmpty());
        }
    }

    @Test
    void buildersConstructorsAndSensitiveToStringBehaviorArePreserved() {
        AuthRequest.SocialLogin social = AuthRequest.SocialLogin.builder().token("secret-social-token").build();
        AuthRequest.Refresh refresh = new AuthRequest.Refresh();
        refresh.setRefreshToken("secret-refresh-token");

        assertEquals("secret-social-token", social.getToken());
        assertFalse(social.toString().contains("secret-social-token"));
        assertFalse(refresh.toString().contains("secret-refresh-token"));
    }
}

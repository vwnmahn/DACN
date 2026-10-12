package com.example.dacn.config;

import com.example.dacn.security.WebSocketSecurityInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class WebsocketConfigTest {
    @Test
    void usesConfiguredOriginsAndRejectsWildcard() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins(List.of("http://localhost:3000", "https://frontend.example"));
        WebsocketConfig config = new WebsocketConfig(properties, mock(WebSocketSecurityInterceptor.class));

        String[] origins = ReflectionTestUtils.invokeMethod(config, "allowedOrigins");
        assertArrayEquals(new String[]{"http://localhost:3000", "https://frontend.example"}, origins);

        properties.setAllowedOrigins(List.of("*"));
        assertThrows(IllegalStateException.class,
                () -> ReflectionTestUtils.invokeMethod(config, "allowedOrigins"));
    }
}

package com.example.dacn.config;

import com.example.dacn.security.WebSocketSecurityInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WebsocketConfigTest {

    @Test
    void registersWebSocketEndpointWithoutCorsProperties() {
        WebsocketConfig config = new WebsocketConfig(
                mock(WebSocketSecurityInterceptor.class)
        );

        StompEndpointRegistry registry = mock(StompEndpointRegistry.class, org.mockito.Answers.RETURNS_SELF);

        assertDoesNotThrow(() -> config.registerStompEndpoints(registry));

        verify(registry).addEndpoint("/ws");
    }

    @Test
    void configuresMessageBroker() {
        WebsocketConfig config = new WebsocketConfig(
                mock(WebSocketSecurityInterceptor.class)
        );

        MessageBrokerRegistry registry = mock(MessageBrokerRegistry.class);

        assertDoesNotThrow(() -> config.configureMessageBroker(registry));
    }

    @Test
    void registersWebSocketSecurityInterceptor() {
        WebSocketSecurityInterceptor interceptor =
                mock(WebSocketSecurityInterceptor.class);

        WebsocketConfig config = new WebsocketConfig(interceptor);
        ChannelRegistration registration = mock(ChannelRegistration.class);

        assertDoesNotThrow(() -> config.configureClientInboundChannel(registration));

        verify(registration).interceptors(interceptor);
    }
}
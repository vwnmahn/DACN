package com.example.dacn;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.security.JwtUtil;
import com.example.dacn.security.WebSocketSecurityInterceptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import java.util.List;
import java.util.Optional;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebSocketSecurityInterceptorTest {
    private static final String SECRET = "test-only-jwt-signing-key-with-at-least-32-bytes";
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private JwtUtil jwtUtil;
    private WebSocketSecurityInterceptor interceptor;
    private Account user;

    @BeforeEach
    void setUp() {
        jwtUtil = jwt(600_000L);
        interceptor = new WebSocketSecurityInterceptor(jwtUtil, accountRepository);
        user = Account.builder().id(7L).role(Role.USER).locked(false).build();
        when(accountRepository.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void connectRequiresValidAccessTokenAndSetsPrincipal() {
        Message<?> message = frame(StompCommand.CONNECT, null, null,
                "Bearer " + jwtUtil.generateToken(7L, Role.USER));
        interceptor.preSend(message, mock(org.springframework.messaging.MessageChannel.class));
        assertSame(user, ((org.springframework.security.core.Authentication) accessor(message).getUser()).getPrincipal());
    }

    @Test
    void connectRejectsMissingExpiredAndLockedAccountTokens() {
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, null), mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, "Bearer " + jwt(-1).generateToken(7L, Role.USER)),
                mock(org.springframework.messaging.MessageChannel.class)));
        String wrongType = Jwts.builder().subject("7").claim("tokenType", "REFRESH")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, "Bearer " + wrongType),
                mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, "Bearer invalid.jwt.value"),
                mock(org.springframework.messaging.MessageChannel.class)));
        user.setLocked(true);
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(
                frame(StompCommand.CONNECT, null, null, "Bearer " + jwtUtil.generateToken(7L, Role.USER)),
                mock(org.springframework.messaging.MessageChannel.class)));
    }

    @Test
    void subscriptionsAreRestrictedToOwnAndRoleDestinations() {
        var authentication = new UsernamePasswordAuthenticationToken(user, null, List.of());
        assertDoesNotThrow(() -> interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, authentication, "/topic/accounts/7/orders", null),
                mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, authentication, "/topic/accounts/8/orders", null),
                mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, authentication, "/topic/admin/payments", null),
                mock(org.springframework.messaging.MessageChannel.class)));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(
                frame(StompCommand.SEND, authentication, "/topic/accounts/7/orders", null),
                mock(org.springframework.messaging.MessageChannel.class)));
    }

    private Message<byte[]> frame(StompCommand command, java.security.Principal principal,
                                  String destination, String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setLeaveMutable(true);
        if (principal != null) accessor.setUser(principal);
        if (destination != null) accessor.setDestination(destination);
        if (authorization != null) accessor.setNativeHeader("Authorization", authorization);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private StompHeaderAccessor accessor(Message<?> message) {
        return org.springframework.messaging.support.MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    }

    private JwtUtil jwt(long expiration) {
        JwtUtil result = new JwtUtil();
        ReflectionTestUtils.setField(result, "SECRET", SECRET);
        ReflectionTestUtils.setField(result, "EXPIRATION", expiration);
        return result;
    }
}

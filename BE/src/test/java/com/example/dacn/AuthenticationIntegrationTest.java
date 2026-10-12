package com.example.dacn;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.RefreshTokenRepository;
import com.example.dacn.security.JwtUtil;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import java.time.Duration;
import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthenticationIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired AccountRepository accountRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        accountRepository.deleteAll();
        accountRepository.save(Account.builder()
                .username("auth-user")
                .password(passwordEncoder.encode("12345678"))
                .email("auth-user@example.test")
                .phoneNumber("0900000001")
                .role(Role.USER)
                .locked(false)
                .build());
    }

    @Test
    void loginLogoutAndRepeatedLogoutRevokesOnlyRefreshTokenHash() throws Exception {
        Tokens tokens = login();

        mockMvc.perform(get("/api/v1/orders").header("Authorization", "Bearer " + tokens.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000));

        String logoutBody = objectMapper.writeValueAsString(Map.of("refreshToken", tokens.refreshToken()));
        mockMvc.perform(delete("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(logoutBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(logoutBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1023));

        mockMvc.perform(delete("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(logoutBody))
                .andExpect(status().isOk());

        var rows = refreshTokenRepository.findAll();
        assertEquals(1, rows.size());
        assertTrue(rows.getFirst().getRevoked());
        assertEquals(64, rows.getFirst().getTokenHash().length());
        assertNotEquals(tokens.refreshToken(), rows.getFirst().getTokenHash());
    }

    @Test
    void loginValidationUsesApiResponse() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"invalid\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1019));
    }

    @Test
    void loginIssuesTenMinuteAccessTokenAndSevenDayOpaqueRefreshToken() throws Exception {
        Tokens tokens = login();

        assertEquals(600L, Duration.between(
                jwtUtil.getIssuedAt(tokens.accessToken()), jwtUtil.getExpiration(tokens.accessToken())).getSeconds());
        assertEquals("ACCESS", jwtUtil.getTokenType(tokens.accessToken()));
        assertFalse(tokens.refreshToken().contains("."), "Refresh Token must be opaque, not JWT");

        var stored = refreshTokenRepository.findAll().getFirst();
        assertEquals(64, stored.getTokenHash().length());
        assertNotEquals(tokens.refreshToken(), stored.getTokenHash());
        long remainingSeconds = Duration.between(LocalDateTime.now(), stored.getExpiresAt()).getSeconds();
        assertTrue(remainingSeconds >= 604_790 && remainingSeconds <= 604_800);
    }

    @Test
    void wrongPasswordAndLockedAccountAreRejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"0900000001\",\"password\":\"wrong-pass\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1009));

        Account account = accountRepository.findByPhoneNumber("0900000001").orElseThrow();
        account.setLocked(true);
        accountRepository.saveAndFlush(account);
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"0900000001\",\"password\":\"12345678\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1012));
    }

    @Test
    void refreshRotatesTokenAndOldTokenCannotBeReused() throws Exception {
        Tokens original = login();
        String body = objectMapper.writeValueAsString(Map.of("refreshToken", original.refreshToken()));
        String response = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000))
                .andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(response).get("data");
        assertNotEquals(original.refreshToken(), data.get("refreshToken").asText());
        assertEquals(600L, Duration.between(jwtUtil.getIssuedAt(data.get("accessToken").asText()),
                jwtUtil.getExpiration(data.get("accessToken").asText())).getSeconds());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1023));
    }

    @Test
    void logoutAllAndChangePasswordRevokeAllRefreshTokensButNotCurrentAccessToken() throws Exception {
        Tokens first = login();
        Tokens second = login();

        mockMvc.perform(post("/api/v1/auth/logout-all")
                        .header("Authorization", "Bearer " + second.accessToken()))
                .andExpect(status().isOk());
        assertRefreshRejected(first.refreshToken());
        assertRefreshRejected(second.refreshToken());

        Tokens afterLogin = login();
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", "Bearer " + afterLogin.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"12345678\",\"newPassword\":\"87654321\"}"))
                .andExpect(status().isOk());
        assertRefreshRejected(afterLogin.refreshToken());
        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer " + afterLogin.accessToken()))
                .andExpect(status().isOk());
    }

    @Test
    void userCannotCallAdminApiAndOpaqueRefreshTokenCannotBeBearerAccessToken() throws Exception {
        Tokens tokens = login();
        mockMvc.perform(get("/api/v1/admin/accounts")
                        .header("Authorization", "Bearer " + tokens.accessToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));

        mockMvc.perform(get("/api/v1/orders")
                        .header("Authorization", "Bearer " + tokens.refreshToken()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1011));
    }

    @Test
    void statelessLoginDoesNotCreateJsessionid() throws Exception {
        var response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"0900000001\",\"password\":\"12345678\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        assertNull(response.getCookie("JSESSIONID"));
    }

    @Test
    void expiredAndWrongSignatureAccessTokensAreRejectedByJwtFilter() throws Exception {
        JwtUtil expiredIssuer = standaloneJwt(-1L,
                "test-only-jwt-signing-key-with-at-least-32-bytes");
        JwtUtil wrongIssuer = standaloneJwt(600_000L,
                "a-different-test-signing-key-with-at-least-32-bytes");

        assertInvalidBearer(expiredIssuer.generateToken(1L, Role.USER));
        assertInvalidBearer(wrongIssuer.generateToken(1L, Role.USER));
    }

    @Test
    void missingOrWrongTokenTypeIsRejectedByJwtFilter() throws Exception {
        var key = Keys.hmacShaKeyFor(
                "test-only-jwt-signing-key-with-at-least-32-bytes".getBytes(StandardCharsets.UTF_8));
        Date expiration = new Date(System.currentTimeMillis() + 60_000);
        String missingType = Jwts.builder().subject("1").expiration(expiration)
                .signWith(key, Jwts.SIG.HS256).compact();
        String refreshType = Jwts.builder().subject("1").claim("tokenType", "REFRESH")
                .expiration(expiration).signWith(key, Jwts.SIG.HS256).compact();

        assertInvalidBearer(missingType);
        assertInvalidBearer(refreshType);
    }

    @Test
    void expiredRefreshTokenIsRejectedWithUnauthorized() throws Exception {
        Tokens tokens = login();
        var stored = refreshTokenRepository.findAll().getFirst();
        stored.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        refreshTokenRepository.saveAndFlush(stored);

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", tokens.refreshToken()))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1022));
    }

    @Test
    void accountUpdateUsesAccountPrincipal() throws Exception {
        String token = login().accessToken();
        mockMvc.perform(multipart("/api/v1/auth/update")
                        .file("avatar", new byte[0])
                        .param("address", "Updated address")
                        .header("Authorization", "Bearer " + token)
                        .with(request -> { request.setMethod("PUT"); return request; }))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000));
    }

    private Tokens login() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"0900000001\",\"password\":\"12345678\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000))
                .andReturn().getResponse().getContentAsString();
        JsonNode root = objectMapper.readTree(response);
        return new Tokens(root.get("data").get("accessToken").asText(),
                root.get("data").get("refreshToken").asText());
    }

    private void assertRefreshRejected(String refreshToken) throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1023));
    }

    private void assertInvalidBearer(String token) throws Exception {
        mockMvc.perform(get("/api/v1/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1011));
    }

    private JwtUtil standaloneJwt(long expiration, String secret) {
        JwtUtil utility = new JwtUtil();
        ReflectionTestUtils.setField(utility, "SECRET", secret);
        ReflectionTestUtils.setField(utility, "EXPIRATION", expiration);
        return utility;
    }

    private record Tokens(String accessToken, String refreshToken) {}
}

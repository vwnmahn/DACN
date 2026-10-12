package com.example.dacn;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.RefreshTokenRepository;
import com.example.dacn.service.AdminAccountService;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.List;
import java.util.concurrent.*;

@SpringBootTest
@AutoConfigureMockMvc
class AdminAccountManagementIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired AccountRepository accounts;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;
    @Autowired AdminAccountService adminAccountService;

    private Account admin;
    private Account user;

    @BeforeEach
    void setUp() {
        refreshTokens.deleteAll();
        accounts.deleteAll();
        admin = save("admin", "admin@example.test", "0900000011", Role.ADMIN, false);
        user = save("target-user", "target@example.test", "0900000012", Role.USER, false);
    }

    @Test
    void adminCanSearchFilterSortViewDetailsAndStatistics() throws Exception {
        String token = login("0900000011").accessToken();
        mockMvc.perform(get("/api/v1/admin/accounts")
                        .header("Authorization", bearer(token))
                        .param("keyword", "TARGET").param("role", "USER").param("locked", "false")
                        .param("page", "0").param("size", "10")
                        .param("sortBy", "username").param("sortDirection", "desc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(1000))
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(user.getId()))
                .andExpect(jsonPath("$.data.content[0].password").doesNotExist())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        mockMvc.perform(get("/api/v1/admin/accounts/{id}", user.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.locked").value(false));

        mockMvc.perform(get("/api/v1/admin/accounts/statistics")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalAccounts").value(2))
                .andExpect(jsonPath("$.data.adminAccounts").value(1))
                .andExpect(jsonPath("$.data.userAccounts").value(1));
    }

    @Test
    void invalidPaginationIsRejected() throws Exception {
        String token = login("0900000011").accessToken();
        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(token))
                        .param("size", "101").param("sortBy", "password"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(2001));
    }

    @Test
    void userAndAnonymousCannotUseAdminApi() throws Exception {
        String userToken = login("0900000012").accessToken();
        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(userToken)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(1010));
        mockMvc.perform(get("/api/v1/admin/accounts"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(1009));
    }

    @Test
    void lockingUserRejectsOldAccessAndRevokesRefreshPermanently() throws Exception {
        Tokens adminTokens = login("0900000011");
        Tokens userTokens = login("0900000012");
        patchJson("/api/v1/admin/accounts/" + user.getId() + "/lock", "{\"locked\":true}", adminTokens.accessToken())
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.locked").value(true));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(userTokens.accessToken())))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(1012));
        assertRefreshRevoked(userTokens.refreshToken());

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"0900000012\",\"password\":\"12345678\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(1012));

        patchJson("/api/v1/admin/accounts/" + user.getId() + "/lock", "{\"locked\":false}", adminTokens.accessToken())
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.locked").value(false));
        assertRefreshRevoked(userTokens.refreshToken());
        assertDoesNotThrow(() -> login("0900000012"));
    }

    @Test
    void protectsSelfAndLastAdministrator() throws Exception {
        String token = login("0900000011").accessToken();
        patchJson("/api/v1/admin/accounts/" + admin.getId() + "/lock", "{\"locked\":true}", token)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(2002));
        patchJson("/api/v1/admin/accounts/" + admin.getId() + "/role", "{\"role\":\"USER\"}", token)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(2003));

        Account secondAdmin = save("admin-two", "admin2@example.test", "0900000013", Role.ADMIN, false);
        patchJson("/api/v1/admin/accounts/" + secondAdmin.getId() + "/role", "{\"role\":\"USER\"}", token)
                .andExpect(status().isOk());
        patchJson("/api/v1/admin/accounts/" + secondAdmin.getId() + "/lock", "{\"locked\":true}", token)
                .andExpect(status().isOk());
    }

    @Test
    void roleChangeTakesEffectForExistingAccessTokenAndRevokesRefresh() throws Exception {
        Tokens adminTokens = login("0900000011");
        Tokens userTokens = login("0900000012");
        patchJson("/api/v1/admin/accounts/" + user.getId() + "/role", "{\"role\":\"ADMIN\"}", adminTokens.accessToken())
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("ADMIN"));

        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(userTokens.accessToken())))
                .andExpect(status().isOk());
        assertRefreshRevoked(userTokens.refreshToken());
    }

    @Test
    void concurrentAdminDemotionsCannotRemoveEveryAdministrator() throws Exception {
        accounts.delete(user);
        Account secondAdmin = save("admin-two", "admin2@example.test", "0900000013", Role.ADMIN, false);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ErrorCode> first = executor.submit(() -> demoteConcurrently(start, admin, secondAdmin.getId()));
            Future<ErrorCode> second = executor.submit(() -> demoteConcurrently(start, secondAdmin, admin.getId()));
            start.countDown();
            ErrorCode[] outcomes = {first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)};
            assertEquals(1, java.util.Arrays.stream(outcomes).filter(e -> e == null).count());
            assertEquals(1, java.util.Arrays.stream(outcomes)
                    .filter(e -> e == ErrorCode.LAST_ADMIN_PROTECTED).count());
            assertEquals(1, accounts.countByRole(Role.ADMIN));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void meChangePasswordAndLogoutAllUseCurrentAccountAndRevokeRefreshTokens() throws Exception {
        Tokens tokens = login("0900000012");
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(tokens.accessToken())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(user.getId()))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", bearer(tokens.accessToken())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong-password\",\"newPassword\":\"87654321\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(2005));
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", bearer(tokens.accessToken())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"12345678\",\"newPassword\":\"87654321\"}"))
                .andExpect(status().isOk());
        assertRefreshRevoked(tokens.refreshToken());

        Tokens newTokens = loginWithPassword("0900000012", "87654321");
        mockMvc.perform(post("/api/v1/auth/logout-all").header("Authorization", bearer(newTokens.accessToken())))
                .andExpect(status().isOk());
        assertRefreshRevoked(newTokens.refreshToken());
    }

    private Account save(String username, String email, String phone, Role role, boolean locked) {
        return accounts.save(Account.builder().username(username).email(email).phoneNumber(phone)
                .password(passwordEncoder.encode("12345678")).role(role).locked(locked).build());
    }

    private Tokens login(String phone) throws Exception {
        return loginWithPassword(phone, "12345678");
    }

    private Tokens loginWithPassword(String phone, String password) throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phoneNumber\":\"" + phone + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).get("data");
        return new Tokens(data.get("accessToken").asText(), data.get("refreshToken").asText());
    }

    private org.springframework.test.web.servlet.ResultActions patchJson(String url, String body, String token)
            throws Exception {
        return mockMvc.perform(patch(url).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private void assertRefreshRevoked(String refreshToken) throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(1023));
    }

    private ErrorCode demoteConcurrently(CountDownLatch start, Account actor, Long targetId) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                actor, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        try {
            start.await();
            adminAccountService.changeRole(targetId, Role.USER);
            return null;
        } catch (AppException exception) {
            return exception.getErrorCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private String bearer(String token) { return "Bearer " + token; }
    private record Tokens(String accessToken, String refreshToken) {}
}

package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.AccountRequest.Update;
import com.example.dacn.dto.request.AuthRequest.Login;
import com.example.dacn.dto.request.AuthRequest.SocialLogin;
import com.example.dacn.dto.request.RegisterRequest;
import com.example.dacn.dto.request.AuthRequest.ChangePassword;
import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.dto.response.AuthResponse;
import com.example.dacn.dto.response.RTResponse;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.mapper.AccountMapper;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.security.JwtUtil;
import com.example.dacn.service.ATService;
import com.example.dacn.service.AvatarStorageService;
import com.example.dacn.service.AuthService;
import com.example.dacn.service.RTService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Collections;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AccountRepository accountRepo;
    private final AccountMapper accountMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RTService rtService;
    private final AvatarStorageService avatarStorageService;
    private final ObjectMapper objectMapper;
    private final ATService atService;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${social.google.client-id}")
    private String googleClientId;

    @Value("${social.facebook.app-id}")
    private String facebookAppId;

    @Value("${social.facebook.app-secret}")
    private String facebookAppSecret;

    // ==================== REGISTER ====================

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {

        if (!java.util.Objects.equals(
                request.getPassword(),
                request.getConfirmPassword()
        )) {
            throw new AppException(ErrorCode.PASSWORD_CONFIRM_NOT_MATCH);
        }
        if (accountRepo.existsByUsername(request.getUsername())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }

        if (accountRepo.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        if (accountRepo.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }

        // MapStruct: RegisterRequest -> Account
        Account account = accountMapper.toAccount(request);


        account.setPassword(
                passwordEncoder.encode(request.getPassword())
        );

        account.setRole(Role.USER);
        account.setLocked(false);

        // Upload avatar nếu có
        if (request.getAvatar() != null
                && !request.getAvatar().isEmpty()) {

            String avatarUrl = avatarStorageService.store(request.getAvatar());
            registerAvatarLifecycle(null, avatarUrl);
            account.setAvatarUrl(avatarUrl);
        }

        Account savedAccount = accountRepo.save(account);

        return createAuthResponse(savedAccount);
    }

    // ==================== LOGIN ====================

    @Override
    public AuthResponse login(Login request) {

        Account account = accountRepo
                .findByPhoneNumber(request.getPhoneNumber())
                .orElseThrow(() ->
                        new AppException(ErrorCode.UNAUTHENTICATED)
                );

        if (account.getPassword() == null
                || !passwordEncoder.matches(
                request.getPassword(),
                account.getPassword()
        )) {

            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        validateAccount(account);

        return createAuthResponse(account);
    }

    // ==================== LOGOUT ====================

    @Override
    public void logout(String token) {
        rtService.revokeRefreshToken(token);
    }

    // ==================== GOOGLE LOGIN ====================

    @Override
    public AuthResponse loginGoogle(SocialLogin request) {

        GoogleIdToken.Payload payload =
                verifyGoogleToken(request.getToken());

        String googleId = payload.getSubject();
        String email = payload.getEmail();

        if (googleId == null || googleId.isBlank()) {
            throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
        }

        Account account = accountRepo.findByGoogleId(googleId)
                .orElseGet(() ->
                        createGoogleAccount(googleId, email)
                );

        validateAccount(account);

        return createAuthResponse(account);
    }

    private GoogleIdToken.Payload verifyGoogleToken(String token) {

        try {
            GoogleIdTokenVerifier verifier =
                    new GoogleIdTokenVerifier.Builder(
                            new NetHttpTransport(),
                            GsonFactory.getDefaultInstance()
                    )
                            .setAudience(
                                    Collections.singletonList(googleClientId)
                            )
                            .build();

            GoogleIdToken idToken = verifier.verify(token);

            if (idToken == null) {
                throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
            }

            return idToken.getPayload();

        } catch (IOException | GeneralSecurityException e) {
            throw new AppException(ErrorCode.SOCIAL_LOGIN_FAILED);

        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
        }
    }

    private Account createGoogleAccount(
            String googleId,
            String email
    ) {

        if (email != null && accountRepo.existsByEmail(email)) {
            throw new AppException(ErrorCode.SOCIAL_ACCOUNT_CONFLICT);
        }

        Account account = new Account();

        account.setGoogleId(googleId);
        account.setEmail(email);
        account.setUsername("google_" + googleId);
        account.setRole(Role.USER);
        account.setLocked(false);

        return accountRepo.save(account);
    }

    // ==================== FACEBOOK LOGIN ====================

    @Override
    public AuthResponse loginFacebook(SocialLogin request) {

        JsonNode debugData =
                verifyFacebookToken(request.getToken());

        String facebookId =
                debugData.path("user_id").asString();

        if (facebookId == null || facebookId.isBlank()) {
            throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
        }

        Account account = accountRepo.findByFacebookId(facebookId)
                .orElseGet(() ->
                        createFacebookAccount(facebookId)
                );

        validateAccount(account);

        return createAuthResponse(account);
    }

    private JsonNode verifyFacebookToken(String accessToken) {

        try {
            String appAccessToken =
                    facebookAppId + "|" + facebookAppSecret;

            String url = "https://graph.facebook.com/debug_token"
                    + "?input_token=" + encode(accessToken)
                    + "&access_token=" + encode(appAccessToken);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200) {
                throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
            }

            JsonNode data = objectMapper
                    .readTree(response.body())
                    .path("data");

            boolean valid = data.path("is_valid").asBoolean(false);
            String appId = data.path("app_id").asString();

            if (!valid || !facebookAppId.equals(appId)) {
                throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
            }

            String userId = data.path("user_id").asString();

            if (userId == null || userId.isBlank()) {
                throw new AppException(ErrorCode.INVALID_SOCIAL_TOKEN);
            }

            return data;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AppException(ErrorCode.SOCIAL_LOGIN_FAILED);

        } catch (IOException | JacksonException e) {
            throw new AppException(ErrorCode.SOCIAL_LOGIN_FAILED);
        }
    }

    private Account createFacebookAccount(String facebookId) {

        Account account = new Account();

        account.setFacebookId(facebookId);
        account.setUsername("facebook_" + facebookId);
        account.setRole(Role.USER);
        account.setLocked(false);

        return accountRepo.save(account);
    }

    private String encode(String value) {
        return URLEncoder.encode(
                value,
                StandardCharsets.UTF_8
        );
    }

    // ==================== VALIDATE ACCOUNT ====================

    private void validateAccount(Account account) {

        if (Boolean.TRUE.equals(account.getLocked())) {
            throw new AppException(ErrorCode.ACCOUNT_LOCKED);
        }

        if (account.getRole() == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    // ==================== AUTH RESPONSE ====================

    private AuthResponse createAuthResponse(Account account) {

        String accessToken = jwtUtil.generateToken(
                account.getId(),
                account.getRole()
        );

        String refreshToken = rtService.createRefreshToken(account);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getExpirationSeconds())
                .account(accountMapper.toAccountResponse(account))
                .build();
    }

    @Override
    @Transactional
    public RTResponse refreshToken(String refreshToken) {

        Account account = rtService.validateRefreshToken(refreshToken);

        if (Boolean.TRUE.equals(account.getLocked())) {
            throw new AppException(ErrorCode.ACCOUNT_LOCKED);
        }

        if (account.getRole() == null) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        String newRefreshToken = rtService.rotateRefreshToken(refreshToken);

        String newAccessToken = atService.generateToken(account);

        return RTResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getExpirationSeconds())
                .build();
    }
    @Override
    @Transactional
    public AccountResponse updateAccount(Update request) {

        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof Account authenticatedAccount)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        Long accountId = authenticatedAccount.getId();

        Account account = accountRepo.findById(accountId)
                .orElseThrow(() ->
                        new AppException(ErrorCode.ACCOUNT_NOT_FOUND)
                );

        // Cập nhật địa chỉ
        accountMapper.updateAccount(request, account);

        // Cập nhật email
        if (request.getEmail() != null) {
            String email = request.getEmail().trim();

            if (email.isBlank()) {
                throw new AppException(ErrorCode.INVALID_EMAIL);
            }

            if (!email.equalsIgnoreCase(account.getEmail())) {
                if (accountRepo.existsByEmail(email)) {
                    throw new AppException(ErrorCode.EMAIL_EXISTED);
                }
                account.setEmail(email);
            }
        }

        // Cập nhật avatar bằng hàm đã có
        if (request.getAvatar() != null
                && !request.getAvatar().isEmpty()) {
            String oldAvatarUrl = account.getAvatarUrl();
            String newAvatarUrl = avatarStorageService.store(request.getAvatar());
            registerAvatarLifecycle(oldAvatarUrl, newAvatarUrl);
            account.setAvatarUrl(newAvatarUrl);
        }
        if (request.getGender() != null) {
            account.setGender(request.getGender());
        }
        return accountMapper.toAccountResponse(
                accountRepo.save(account)
        );
    }

    private void registerAvatarLifecycle(String oldAvatarUrl, String newAvatarUrl) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            avatarStorageService.deleteSafely(newAvatarUrl);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    avatarStorageService.deleteSafely(newAvatarUrl);
                    return;
                }
                if (oldAvatarUrl != null && !oldAvatarUrl.equals(newAvatarUrl)
                        ) {
                    try {
                        if (!accountRepo.existsByAvatarUrl(oldAvatarUrl)) {
                            avatarStorageService.deleteSafely(oldAvatarUrl);
                        }
                    } catch (RuntimeException ignored) {
                        // Không xóa nếu không xác minh được file còn được tài khoản khác dùng hay không.
                    }
                }
            }
        });
    }

    @Override
    @Transactional
    public AccountResponse getCurrentAccount() {
        return accountMapper.toAccountResponse(currentAccount(false));
    }

    @Override
    @Transactional
    public void changePassword(ChangePassword request) {
        Account account = currentAccount(true);
        if (account.getPassword() == null || account.getPassword().isBlank()) {
            throw new AppException(ErrorCode.PASSWORD_CHANGE_NOT_SUPPORTED);
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPassword())) {
            throw new AppException(ErrorCode.CURRENT_PASSWORD_INVALID);
        }
        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accountRepo.save(account);
        rtService.revokeAllForAccount(account.getId());
    }

    @Override
    @Transactional
    public void logoutAll() {
        Account account = currentAccount(true);
        rtService.revokeAllForAccount(account.getId());
    }

    private Account currentAccount(boolean lock) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof Account authenticatedAccount)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return (lock ? accountRepo.findByIdForUpdate(authenticatedAccount.getId())
                : accountRepo.findById(authenticatedAccount.getId()))
                .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND));
    }

}

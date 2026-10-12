
package com.example.dacn.service.Impl;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.RefreshToken;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.RefreshTokenRepository;
import com.example.dacn.service.RTService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class RTServiceImpl implements RTService {

    private final RefreshTokenRepository refreshTokenRepository;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    // Create a refresh token and store its SHA-256 hash.
    @Override
    @Transactional
    public String createRefreshToken(Account account) {

        if (account == null || account.getId() == null) {
            throw new IllegalArgumentException("Invalid account");
        }

        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);

        String rawToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);

        LocalDateTime expiresAt = LocalDateTime.now()
                .plusNanos(
                        Math.multiplyExact(refreshExpiration, 1_000_000L)
                );

        RefreshToken refreshToken = RefreshToken.builder()
                .account(account)
                .tokenHash(hashToken(rawToken))
                .expiresAt(expiresAt)
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    // Validate the refresh token and return its account.
    @Override
    @Transactional(readOnly = true)
    public Account validateRefreshToken(String rawToken) {

        RefreshToken token = findValidToken(rawToken);

        return token.getAccount();
    }

    // Revoke the old refresh token and issue a new one.
    @Override
    @Transactional
    public String rotateRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        RefreshToken oldToken = refreshTokenRepository
                .findByTokenHashForUpdate(tokenHash)
                .orElseThrow(() ->
                        new AppException(ErrorCode.INVALID_REFRESH_TOKEN)
                );

        validateTokenState(oldToken);

        oldToken.setRevoked(true);
        refreshTokenRepository.save(oldToken);

        return createRefreshToken(oldToken.getAccount());
    }

    // Revoke the refresh token on logout.
    @Override
    @Transactional
    public void revokeRefreshToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        refreshTokenRepository
                .findByTokenHashForUpdate(tokenHash)
                .ifPresent(token -> {
                    if (!Boolean.TRUE.equals(token.getRevoked())) {
                        token.setRevoked(true);
                        refreshTokenRepository.save(token);
                    }
                });
    }

    // Delete expired refresh tokens.
    @Override
    @Transactional
    public int cleanupExpiredTokens() {

        long deleted = refreshTokenRepository
                .deleteByExpiresAtBefore(LocalDateTime.now());

        return Math.toIntExact(deleted);
    }

    @Override
    @Transactional
    public int revokeAllForAccount(Long accountId) {
        int revoked = 0;
        for (RefreshToken token : refreshTokenRepository.findByAccountIdForUpdate(accountId)) {
            if (!Boolean.TRUE.equals(token.getRevoked())) {
                token.setRevoked(true);
                revoked++;
            }
        }
        return revoked;
    }

    private RefreshToken findValidToken(String rawToken) {

        RefreshToken token = refreshTokenRepository
                .findByTokenHash(hashToken(rawToken))
                .orElseThrow(() ->
                        new AppException(ErrorCode.INVALID_REFRESH_TOKEN)
                );

        validateTokenState(token);

        return token;
    }

    private void validateTokenState(RefreshToken token) {

        if (Boolean.TRUE.equals(token.getRevoked())) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_REVOKED);
        }

        if (!token.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_EXPIRED);
        }
    }

    private String hashToken(String rawToken) {

        if (rawToken == null || rawToken.isBlank()) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_REQUIRED);
        }

        try {
            byte[] digest = MessageDigest
                    .getInstance("SHA-256")
                    .digest(
                            rawToken.getBytes(StandardCharsets.UTF_8)
                    );

            return HexFormat.of().formatHex(digest);

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 is not available", e
            );
        }
    }
}

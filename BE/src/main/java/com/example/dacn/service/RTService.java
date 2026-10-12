package com.example.dacn.service;

import com.example.dacn.entity.Account;

public interface RTService {
    String createRefreshToken(Account account);

    Account validateRefreshToken(String rawToken);

    String rotateRefreshToken(String rawToken);

    void revokeRefreshToken(String rawToken);

    int cleanupExpiredTokens();

    int revokeAllForAccount(Long accountId);
}

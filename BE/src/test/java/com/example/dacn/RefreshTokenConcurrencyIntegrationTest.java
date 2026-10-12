package com.example.dacn;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.exception.AppException;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.RefreshTokenRepository;
import com.example.dacn.service.RTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RefreshTokenConcurrencyIntegrationTest {
    @Autowired RTService rtService;
    @Autowired AccountRepository accountRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    private Account account;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        accountRepository.deleteAll();
        account = accountRepository.save(Account.builder()
                .username("rotation-user")
                .email("rotation@example.test")
                .phoneNumber("0900000002")
                .role(Role.USER)
                .locked(false)
                .build());
    }

    @Test
    void concurrentRotationOfSameRefreshTokenCreatesOnlyOneActiveReplacement() throws Exception {
        String original = rtService.createRefreshToken(account);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Object> outcomes = new ArrayList<>();

        try (var executor = Executors.newFixedThreadPool(2)) {
            var tasks = List.of(1, 2).stream().map(ignored -> executor.submit(() -> {
                ready.countDown();
                start.await();
                try {
                    String replacement = rtService.rotateRefreshToken(original);
                    synchronized (outcomes) { outcomes.add(replacement); }
                } catch (AppException exception) {
                    synchronized (outcomes) { outcomes.add(exception.getErrorCode()); }
                }
                return null;
            })).toList();
            ready.await();
            start.countDown();
            for (var task : tasks) task.get();
        }

        long successfulRotations = outcomes.stream().filter(String.class::isInstance).count();
        long activeTokens = refreshTokenRepository.findAll().stream()
                .filter(token -> !Boolean.TRUE.equals(token.getRevoked()))
                .count();
        assertEquals(1, successfulRotations);
        assertEquals(1, activeTokens);
        assertEquals(2, refreshTokenRepository.count());
    }
}

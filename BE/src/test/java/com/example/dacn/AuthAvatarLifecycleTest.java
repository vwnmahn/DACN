package com.example.dacn;

import com.example.dacn.mapper.AccountMapper;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.security.JwtUtil;
import com.example.dacn.service.ATService;
import com.example.dacn.service.AvatarStorageService;
import com.example.dacn.service.Impl.AuthServiceImpl;
import com.example.dacn.service.RTService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import static org.mockito.Mockito.*;

class AuthAvatarLifecycleTest {
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final AvatarStorageService storage = mock(AvatarStorageService.class);
    private final AuthServiceImpl service = new AuthServiceImpl(accountRepository, mock(AccountMapper.class),
            mock(PasswordEncoder.class), mock(JwtUtil.class), mock(RTService.class), storage,
            mock(ObjectMapper.class), mock(ATService.class));

    @AfterEach
    void cleanupSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void rollbackDeletesNewAvatarAndKeepsOldAvatar() {
        TransactionSynchronizationManager.initSynchronization();
        ReflectionTestUtils.invokeMethod(service, "registerAvatarLifecycle",
                "/images/avatars/old.jpg", "/images/avatars/new.jpg");

        TransactionSynchronizationManager.getSynchronizations().getFirst()
                .afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);

        verify(storage).deleteSafely("/images/avatars/new.jpg");
        verify(storage, never()).deleteSafely("/images/avatars/old.jpg");
    }

    @Test
    void commitDeletesOldAvatarOnlyWhenItIsNotShared() {
        TransactionSynchronizationManager.initSynchronization();
        when(accountRepository.existsByAvatarUrl("/images/avatars/old.jpg")).thenReturn(false);
        ReflectionTestUtils.invokeMethod(service, "registerAvatarLifecycle",
                "/images/avatars/old.jpg", "/images/avatars/new.jpg");

        TransactionSynchronizationManager.getSynchronizations().getFirst()
                .afterCompletion(TransactionSynchronization.STATUS_COMMITTED);

        verify(storage).deleteSafely("/images/avatars/old.jpg");
        verify(storage, never()).deleteSafely("/images/avatars/new.jpg");
    }

    @Test
    void commitKeepsOldAvatarWhenAnotherAccountUsesIt() {
        TransactionSynchronizationManager.initSynchronization();
        when(accountRepository.existsByAvatarUrl("/images/avatars/shared.jpg")).thenReturn(true);
        ReflectionTestUtils.invokeMethod(service, "registerAvatarLifecycle",
                "/images/avatars/shared.jpg", "/images/avatars/new.jpg");

        TransactionSynchronizationManager.getSynchronizations().getFirst()
                .afterCompletion(TransactionSynchronization.STATUS_COMMITTED);

        verify(storage, never()).deleteSafely("/images/avatars/shared.jpg");
    }
}

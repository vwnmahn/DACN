package com.example.dacn;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.service.Impl.AdminAccountServiceImpl;
import com.example.dacn.service.RTService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAccountServiceImplTest {
    @Mock AccountRepository accounts;
    @Mock RTService refreshTokens;
    @InjectMocks AdminAccountServiceImpl service;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsInvalidPagingBeforeQueryingDatabase() {
        AppException exception = assertThrows(AppException.class,
                () -> service.search(null, null, null, -1, 20, "id", "asc"));
        assertEquals(ErrorCode.ACCOUNT_INVALID_PAGE_REQUEST, exception.getErrorCode());
        verifyNoInteractions(accounts);
    }

    @Test
    void protectsLastAdministratorEvenWhenChangedByAnotherAdminSession() {
        Account actor = Account.builder().id(1L).role(Role.ADMIN).locked(false).build();
        Account target = Account.builder().id(2L).role(Role.ADMIN).locked(false).build();
        authenticate(actor);
        when(accounts.findAllAdminsForUpdate()).thenReturn(List.of(target));
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(target));

        AppException exception = assertThrows(AppException.class,
                () -> service.changeRole(2L, Role.USER));

        assertEquals(ErrorCode.LAST_ADMIN_PROTECTED, exception.getErrorCode());
        verify(accounts, never()).save(any());
        verifyNoInteractions(refreshTokens);
    }

    @Test
    void lockingUserRevokesAllRefreshTokens() {
        Account actor = Account.builder().id(1L).role(Role.ADMIN).locked(false).build();
        Account target = Account.builder().id(2L).role(Role.USER).locked(false).build();
        authenticate(actor);
        when(accounts.findAllAdminsForUpdate()).thenReturn(List.of(actor));
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        when(accounts.save(target)).thenReturn(target);

        var response = service.changeLock(2L, true);

        assertTrue(response.getLocked());
        verify(refreshTokens).revokeAllForAccount(2L);
    }

    private void authenticate(Account account) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(account, null, List.of()));
    }
}

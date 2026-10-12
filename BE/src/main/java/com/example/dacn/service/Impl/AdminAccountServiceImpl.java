package com.example.dacn.service.Impl;

import com.example.dacn.dto.response.*;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.service.AdminAccountService;
import com.example.dacn.service.RTService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminAccountServiceImpl implements AdminAccountService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "id", "username", "email", "phoneNumber", "role", "locked", "createdAt", "updatedAt");

    private final AccountRepository accountRepository;
    private final RTService rtService;

    @Override
    @Transactional(readOnly = true)
    public AdminAccountPageResponse search(String keyword, Role role, Boolean locked, int page, int size,
                                           String sortBy, String sortDirection) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || !ALLOWED_SORT_FIELDS.contains(sortBy)) {
            throw new AppException(ErrorCode.ACCOUNT_INVALID_PAGE_REQUEST);
        }
        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(sortDirection);
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.ACCOUNT_INVALID_PAGE_REQUEST);
        }

        Specification<Account> specification = (root, query, builder) -> builder.conjunction();
        String normalizedKeyword = keyword == null ? null : keyword.trim().toLowerCase(Locale.ROOT);
        if (normalizedKeyword != null && !normalizedKeyword.isEmpty()) {
            String pattern = "%" + normalizedKeyword + "%";
            specification = specification.and((root, query, builder) -> builder.or(
                    builder.like(builder.lower(root.get("username")), pattern),
                    builder.like(builder.lower(root.get("email")), pattern),
                    builder.like(builder.lower(root.get("phoneNumber")), pattern)));
        }
        if (role != null) {
            specification = specification.and((root, query, builder) -> builder.equal(root.get("role"), role));
        }
        if (locked != null) {
            specification = specification.and((root, query, builder) -> builder.equal(root.get("locked"), locked));
        }

        Page<AdminAccountResponse> result = accountRepository
                .findAll(specification, PageRequest.of(page, size, Sort.by(direction, sortBy)))
                .map(this::toResponse);
        return AdminAccountPageResponse.builder()
                .content(result.getContent()).page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .sortBy(sortBy).sortDirection(direction.name().toLowerCase(Locale.ROOT)).build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminAccountResponse getById(Long id) {
        return toResponse(accountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND)));
    }

    @Override
    @Transactional
    public AdminAccountResponse changeLock(Long id, boolean locked) {
        List<Account> admins = accountRepository.findAllAdminsForUpdate();
        Account account = lockedAccount(id);
        Long actorId = authenticatedAccountId();

        if (locked && id.equals(actorId)) {
            throw new AppException(ErrorCode.ACCOUNT_SELF_LOCK_FORBIDDEN);
        }
        if (locked && account.getRole() == Role.ADMIN
                && admins.stream().filter(a -> !Boolean.TRUE.equals(a.getLocked())).count() <= 1) {
            throw new AppException(ErrorCode.LAST_ADMIN_PROTECTED);
        }
        if (Boolean.valueOf(locked).equals(account.getLocked())) {
            return toResponse(account);
        }

        account.setLocked(locked);
        if (locked) {
            rtService.revokeAllForAccount(account.getId());
        }
        return toResponse(accountRepository.save(account));
    }

    @Override
    @Transactional
    public AdminAccountResponse changeRole(Long id, Role role) {
        if (role == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        List<Account> admins = accountRepository.findAllAdminsForUpdate();
        Account account = lockedAccount(id);
        Long actorId = authenticatedAccountId();

        if (id.equals(actorId) && account.getRole() == Role.ADMIN && role == Role.USER) {
            throw new AppException(ErrorCode.ACCOUNT_SELF_DEMOTION_FORBIDDEN);
        }
        if (account.getRole() == Role.ADMIN && role == Role.USER && admins.size() <= 1) {
            throw new AppException(ErrorCode.LAST_ADMIN_PROTECTED);
        }
        if (account.getRole() == role) {
            return toResponse(account);
        }

        account.setRole(role);
        rtService.revokeAllForAccount(account.getId());
        return toResponse(accountRepository.save(account));
    }

    @Override
    @Transactional(readOnly = true)
    public AccountStatisticsResponse statistics() {
        return AccountStatisticsResponse.builder()
                .totalAccounts(accountRepository.count())
                .lockedAccounts(accountRepository.countByLockedTrue())
                .unlockedAccounts(accountRepository.countUnlocked())
                .adminAccounts(accountRepository.countByRole(Role.ADMIN))
                .userAccounts(accountRepository.countByRole(Role.USER))
                .build();
    }

    private Account lockedAccount(Long id) {
        return accountRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND));
    }

    private Long authenticatedAccountId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof Account account)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return account.getId();
    }

    private AdminAccountResponse toResponse(Account account) {
        return AdminAccountResponse.builder()
                .id(account.getId()).username(account.getUsername()).email(account.getEmail())
                .phoneNumber(account.getPhoneNumber()).avatarUrl(account.getAvatarUrl())
                .address(account.getAddress()).role(account.getRole()).locked(account.getLocked())
                .createdAt(account.getCreatedAt()).updatedAt(account.getUpdatedAt()).build();
    }
}

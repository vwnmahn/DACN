package com.example.dacn.repository;

import com.example.dacn.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.List;
import com.example.dacn.entity.Role;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long>, JpaSpecificationExecutor<Account> {

    // Kiểm tra tài khoản đã tồn tại
    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByPhoneNumber(String phoneNumber);

    boolean existsByAvatarUrl(String avatarUrl);

    // Đăng nhập bằng số điện thoại
    Optional<Account> findByPhoneNumber(String phoneNumber);

    // Tìm tài khoản bằng email
    Optional<Account> findByEmail(String email);

    // Đăng nhập Google
    Optional<Account> findByGoogleId(String googleId);

    // Đăng nhập Facebook
    Optional<Account> findByFacebookId(String facebookId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.role = com.example.dacn.entity.Role.ADMIN ORDER BY a.id")
    List<Account> findAllAdminsForUpdate();

    long countByLockedTrue();
    @Query("SELECT COUNT(a) FROM Account a WHERE a.locked = false OR a.locked IS NULL")
    long countUnlocked();
    long countByRole(Role role);
}

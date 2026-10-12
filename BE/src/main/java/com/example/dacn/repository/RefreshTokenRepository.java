
package com.example.dacn.repository;

import com.example.dacn.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

@Repository
public interface RefreshTokenRepository
        extends JpaRepository<RefreshToken, Long> {

    // Find refresh token by SHA-256 hash
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    // Check whether a refresh token exists
    boolean existsByTokenHash(String tokenHash);

    // Delete refresh token by hash
    void deleteByTokenHash(String tokenHash);

    // Find an active (not revoked) refresh token
    Optional<RefreshToken> findByTokenHashAndRevokedFalse(
            String tokenHash
    );

    // Lock refresh token during rotation or logout
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT rt
            FROM RefreshToken rt
            WHERE rt.tokenHash = :tokenHash
            """)
    Optional<RefreshToken> findByTokenHashForUpdate(
            @Param("tokenHash") String tokenHash
    );

    // Delete expired refresh tokens
    long deleteByExpiresAtBefore(LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rt FROM RefreshToken rt WHERE rt.account.id = :accountId ORDER BY rt.id")
    List<RefreshToken> findByAccountIdForUpdate(@Param("accountId") Long accountId);
}

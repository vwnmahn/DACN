
package com.example.dacn.repository;

import com.example.dacn.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.Collection;
import com.example.dacn.entity.VoucherUsageStatus;

public interface VoucherRepository
        extends JpaRepository<Voucher, Long> {

    Optional<Voucher> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
    boolean existsByRestaurantId(Long restaurantId);
    Page<Voucher> findByActive(Boolean active, Pageable pageable);
    Page<Voucher> findByRestaurantId(Long restaurantId, Pageable pageable);
    Page<Voucher> findByActiveAndRestaurantId(Boolean active, Long restaurantId, Pageable pageable);

    @Query("""
            SELECT v FROM Voucher v
            WHERE v.active = true
              AND v.startDate <= :now AND v.endDate >= :now
              AND (v.restaurantId IS NULL OR (:restaurantId IS NOT NULL AND v.restaurantId = :restaurantId))
              AND (SELECT COUNT(u.id) FROM VoucherUsage u
                   WHERE u.voucherId = v.id AND u.status IN :occupiedStatuses) < v.usageLimit
              AND (SELECT COUNT(u.id) FROM VoucherUsage u
                   WHERE u.voucherId = v.id AND u.accountId = :accountId
                     AND u.status IN :occupiedStatuses) < v.perUserLimit
            """)
    Page<Voucher> findAvailable(@Param("restaurantId") Long restaurantId,
                                @Param("accountId") Long accountId,
                                @Param("now") LocalDateTime now,
                                @Param("occupiedStatuses") Collection<VoucherUsageStatus> occupiedStatuses,
                                Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM Voucher v WHERE UPPER(v.code) = UPPER(:code)")
    Optional<Voucher> findByCodeForUpdate(
            @Param("code") String code
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM Voucher v WHERE v.id = :id")
    Optional<Voucher> findByIdForUpdate(@Param("id") Long id);
}

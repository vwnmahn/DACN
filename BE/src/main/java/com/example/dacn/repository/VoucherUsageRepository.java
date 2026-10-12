package com.example.dacn.repository;

import com.example.dacn.entity.VoucherUsage;
import com.example.dacn.entity.VoucherUsageStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {
    Optional<VoucherUsage> findByOrderId(Long orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM VoucherUsage u WHERE u.orderId = :orderId")
    Optional<VoucherUsage> findByOrderIdForUpdate(@Param("orderId") Long orderId);

    long countByVoucherIdAndStatusIn(Long voucherId, Collection<VoucherUsageStatus> statuses);

    long countByVoucherIdAndAccountIdAndStatusIn(
            Long voucherId, Long accountId, Collection<VoucherUsageStatus> statuses);

    boolean existsByVoucherId(Long voucherId);
}

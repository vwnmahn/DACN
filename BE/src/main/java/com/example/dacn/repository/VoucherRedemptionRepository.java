package com.example.dacn.repository;

import com.example.dacn.entity.VoucherRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VoucherRedemptionRepository extends JpaRepository<VoucherRedemption, Long> {
    long countByVoucherId(Long voucherId);
    long countByVoucherIdAndAccountId(Long voucherId, Long accountId);
    Optional<VoucherRedemption> findByAccountIdAndIdempotencyKey(Long accountId, String idempotencyKey);
    Optional<VoucherRedemption> findFirstByVoucherIdAndAccountIdOrderByRedeemedAtDesc(Long voucherId, Long accountId);
    List<VoucherRedemption> findByAccountIdOrderByRedeemedAtDesc(Long accountId);
}

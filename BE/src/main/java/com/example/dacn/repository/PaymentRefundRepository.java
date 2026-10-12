package com.example.dacn.repository;

import com.example.dacn.entity.PaymentRefund;
import com.example.dacn.entity.PaymentRefundStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.*;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, Long> {
    Optional<PaymentRefund> findByIdempotencyKey(String idempotencyKey);
    List<PaymentRefund> findByPaymentIdOrderByIdDesc(Long paymentId);
    Page<PaymentRefund> findByStatusIn(Collection<PaymentRefundStatus> statuses, Pageable pageable);
    boolean existsByPaymentIdAndStatusIn(Long paymentId, Collection<PaymentRefundStatus> statuses);
    Optional<PaymentRefund> findFirstByPaymentIdAndStatusInOrderByIdDesc(Long paymentId,
                                                                         Collection<PaymentRefundStatus> statuses);
    @Query("select coalesce(sum(r.amount), 0) from PaymentRefund r where r.payment.id = :paymentId and r.status in :statuses")
    BigDecimal sumAmountByPaymentAndStatuses(@Param("paymentId") Long paymentId,
                                              @Param("statuses") Collection<PaymentRefundStatus> statuses);
}

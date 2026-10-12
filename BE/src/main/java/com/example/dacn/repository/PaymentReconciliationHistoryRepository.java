package com.example.dacn.repository;

import com.example.dacn.entity.PaymentReconciliationHistory;
import com.example.dacn.entity.PaymentReconciliationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentReconciliationHistoryRepository extends JpaRepository<PaymentReconciliationHistory, Long> {
    boolean existsByPaymentIdAndStatus(Long paymentId, PaymentReconciliationStatus status);
}

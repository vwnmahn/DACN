
package com.example.dacn.repository;

import com.example.dacn.entity.Payment;
import com.example.dacn.entity.PaymentStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;

public interface PaymentRepository
        extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    @Override
    @EntityGraph(attributePaths = {"order", "order.account"})
    Page<Payment> findAll(Specification<Payment> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"order", "order.account"})
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    Optional<Payment> findAdminDetailById(@Param("id") Long id);

    // Tìm thanh toán theo mã giao dịch FCA
    Optional<Payment> findByTransactionReference(
            String transactionReference
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.transactionReference = :reference")
    Optional<Payment> findByTransactionReferenceForUpdate(@Param("reference") String reference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.orderId = :orderId ORDER BY p.id")
    List<Payment> findByOrderIdForUpdate(@Param("orderId") Long orderId);

    // Danh sách thanh toán của một đơn hàng
    List<Payment> findByOrderIdOrderByIdDesc(
            Long orderId
    );

    // Kiểm tra giao dịch đã tồn tại chưa
    boolean existsByTransactionReference(
            String transactionReference
    );

    // Tìm giao dịch theo mã phía cổng thanh toán
    Optional<Payment> findByGatewayTransactionId(
            String gatewayTransactionId
    );

    // Danh sách thanh toán theo trạng thái
    List<Payment> findByPaymentStatus(
            PaymentStatus paymentStatus
    );

    // Kiểm tra đơn hàng đã thanh toán thành công chưa
    boolean existsByOrderIdAndPaymentStatus(
            Long orderId,
            PaymentStatus paymentStatus
    );

    Optional<Payment> findFirstByOrderIdOrderByIdDesc(Long orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.paymentStatus = com.example.dacn.entity.PaymentStatus.PENDING "
            + "AND p.paymentUrl IS NOT NULL AND p.createdAt <= :cutoff ORDER BY p.id")
    List<Payment> findExpiredGatewayPaymentsForUpdate(@Param("cutoff") LocalDateTime cutoff, Pageable pageable);
}

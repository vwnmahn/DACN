package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;

@Entity
@Table(name = "payment_refunds", indexes = {
        @Index(name = "idx_refund_payment_created", columnList = "payment_id,created_at"),
        @Index(name = "idx_refund_status", columnList = "status")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_refund_idempotency", columnNames = "idempotency_key"),
        @UniqueConstraint(name = "uk_refund_request_id", columnNames = "request_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class PaymentRefund extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false, foreignKey = @ForeignKey(name = "fk_refund_payment"))
    private Payment payment;
    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;
    @Column(name = "request_id", nullable = false, length = 32)
    private String requestId;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private PaymentRefundStatus status;
    @Column(name = "actor_account_id", nullable = false)
    private Long actorAccountId;
    @Column(name = "gateway_refund_transaction_id", length = 150)
    private String gatewayRefundTransactionId;
    @Column(name = "response_code", length = 10)
    private String responseCode;
    @Column(name = "transaction_status", length = 10)
    private String transactionStatus;
    @Column(name = "reason", nullable = false, length = 255)
    private String reason;
    @Column(name = "message", length = 500)
    private String message;
}

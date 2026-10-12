package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "payment_reconciliation_history", indexes = {
        @Index(name = "idx_reconciliation_payment_created", columnList = "payment_id,created_at"),
        @Index(name = "idx_reconciliation_status", columnList = "status")
}, uniqueConstraints = @UniqueConstraint(name = "uk_reconciliation_request_id", columnNames = "request_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class PaymentReconciliationHistory extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false, foreignKey = @ForeignKey(name = "fk_reconciliation_payment"))
    private Payment payment;
    @Column(name = "request_id", nullable = false, length = 32)
    private String requestId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private PaymentReconciliationStatus status;
    @Column(name = "actor_account_id", nullable = false)
    private Long actorAccountId;
    @Column(name = "response_code", length = 10)
    private String responseCode;
    @Column(name = "transaction_status", length = 10)
    private String transactionStatus;
    @Column(name = "gateway_transaction_id", length = 150)
    private String gatewayTransactionId;
    @Column(name = "message", length = 500)
    private String message;
}

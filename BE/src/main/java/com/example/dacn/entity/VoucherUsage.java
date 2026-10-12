package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "voucher_usages", uniqueConstraints = {
        @UniqueConstraint(name = "uk_voucher_usage_order", columnNames = "order_id")
}, indexes = {
        @Index(name = "idx_voucher_usage_voucher_status", columnList = "voucher_id,status"),
        @Index(name = "idx_voucher_usage_account", columnList = "voucher_id,account_id,status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class VoucherUsage extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VoucherUsageStatus status;

    @Column(name = "reserved_at", nullable = false)
    private LocalDateTime reservedAt;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "released_at")
    private LocalDateTime releasedAt;
}

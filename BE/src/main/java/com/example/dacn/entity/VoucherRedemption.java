package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "voucher_redemptions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_voucher_redemption_account_idempotency",
                columnNames = {"account_id", "idempotency_key"})
}, indexes = {
        @Index(name = "idx_voucher_redemption_account", columnList = "account_id"),
        @Index(name = "idx_voucher_redemption_voucher", columnList = "voucher_id")
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class VoucherRedemption {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "account_id", nullable = false)
    private Long accountId;
    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;
    @Column(name = "redeemed_at", nullable = false)
    private LocalDateTime redeemedAt;
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;
}

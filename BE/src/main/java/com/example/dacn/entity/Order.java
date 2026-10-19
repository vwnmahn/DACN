package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_order_account", columnList = "account_id"),
        @Index(name = "idx_order_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_order_status", columnList = "status")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_order_account_idempotency",
                columnNames = {"account_id", "idempotency_key"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Order extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_order_account"))
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_order_restaurant"))
    private Restaurant restaurant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "confirmation_deadline")
    private LocalDateTime confirmationDeadline;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "confirmation_source", length = 20)
    private ConfirmationSource confirmationSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_reason", length = 100)
    private OrderCancellationReason cancellationReason;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Builder.Default
    @Column(name = "loyalty_points_awarded", nullable = false,
            columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private Boolean loyaltyPointsAwarded = false;

    @Column(name = "refund_required", nullable = false)
    @Builder.Default
    private Boolean refundRequired = false;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "delivery_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal deliveryFee;

    @Column(name = "delivery_latitude", precision = 10, scale = 7)
    private BigDecimal deliveryLatitude;
    @Column(name = "delivery_longitude", precision = 10, scale = 7)
    private BigDecimal deliveryLongitude;
    @Column(name = "restaurant_latitude", precision = 10, scale = 7)
    private BigDecimal restaurantLatitude;
    @Column(name = "restaurant_longitude", precision = 10, scale = 7)
    private BigDecimal restaurantLongitude;
    @Column(name = "delivery_distance_km", precision = 10, scale = 3)
    private BigDecimal deliveryDistanceKm;
    @Column(name = "delivery_radius_km_snapshot", precision = 10, scale = 3)
    private BigDecimal deliveryRadiusKmSnapshot;
    @Column(name = "base_delivery_fee_snapshot", precision = 15, scale = 2)
    private BigDecimal baseDeliveryFeeSnapshot;
    @Column(name = "base_distance_km_snapshot", precision = 10, scale = 3)
    private BigDecimal baseDistanceKmSnapshot;
    @Column(name = "additional_fee_per_km_snapshot", precision = 15, scale = 2)
    private BigDecimal additionalFeePerKmSnapshot;

    @Column(name = "discount_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "voucher_id")
    private Long voucherId;

    @Column(name = "voucher_code", length = 50)
    private String voucherCode;

    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "recipient_name", nullable = false, length = 100)
    private String recipientName;

    @Column(name = "recipient_phone", nullable = false, length = 20)
    private String recipientPhone;

    @Column(name = "delivery_address", nullable = false, length = 500)
    private String deliveryAddress;

    @Column(name = "delivery_note", length = 500)
    private String deliveryNote;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "request_fingerprint", nullable = false, length = 64)
    private String requestFingerprint;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
}

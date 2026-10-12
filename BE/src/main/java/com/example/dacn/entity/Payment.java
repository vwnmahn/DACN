
package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "payments",
        indexes = {
                @Index(
                        name = "idx_payment_order",
                        columnList = "order_id"
                )
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_payment_transaction_ref",
                        columnNames = "transaction_reference"
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Payment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ID đơn hàng liên kết với giao dịch
    @Column(name = "order_id", nullable = false)
    private Long orderId;

    // Transitional read-only association. The existing order_id column remains
    // the owning persisted value so legacy payment rows are not rewritten.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Order order;

    // VNPAY, MOMO, ZALOPAY, COD
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    // PENDING, SUCCESS, FAILED...
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    // Số tiền thực tế cần thanh toán sau voucher
    @Column(
            nullable = false,
            precision = 15,
            scale = 2
    )
    private BigDecimal amount;

    // Mã giao dịch nội bộ của FCA
    @Column(
            name = "transaction_reference",
            nullable = false,
            unique = true,
            length = 100
    )
    private String transactionReference;

    // Mã giao dịch do cổng thanh toán trả về
    @Column(length = 150)
    private String gatewayTransactionId;

    // URL chuyển khách đến trang thanh toán
    @Column(length = 2048)
    private String paymentUrl;

    // Thời gian thanh toán thành công
    private LocalDateTime paidAt;

    // Thông báo kết quả từ cổng thanh toán
    @Column(length = 500)
    private String paymentMessage;
}

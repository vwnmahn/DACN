package com.example.dacn.dto.response;

import com.example.dacn.entity.OrderStatus;
import com.example.dacn.entity.ConfirmationSource;
import com.example.dacn.entity.OrderCancellationReason;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long id;
    private Long restaurantId;
    private String restaurantName;
    private Long shipperId;
    private String shipperName;
    private String shipperPhone;
    private OrderStatus status;
    private LocalDateTime confirmationDeadline;
    private LocalDateTime cancellationDeadline;
    private LocalDateTime acceptedAt;
    private LocalDateTime confirmedAt;
    private ConfirmationSource confirmationSource;
    private OrderCancellationReason cancellationReason;
    private String cancellationCode;
    private String cancellationDetail;
    private LocalDateTime cancelledAt;
    private Boolean refundRequired;
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;
    private BigDecimal restaurantLatitude;
    private BigDecimal restaurantLongitude;
    private BigDecimal deliveryDistanceKm;
    private LocalDateTime estimatedDeliveryAt;
    private Boolean deliveryOverdue;
    private BigDecimal deliveryRadiusKmSnapshot;
    private BigDecimal baseDeliveryFeeSnapshot;
    private BigDecimal baseDistanceKmSnapshot;
    private BigDecimal additionalFeePerKmSnapshot;
    private BigDecimal discountAmount;
    private Long voucherId;
    private String voucherCode;
    private BigDecimal totalAmount;
    private String recipientName;
    private String recipientPhone;
    private String deliveryAddress;
    private String deliveryNote;
    private List<OrderItemResponse> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

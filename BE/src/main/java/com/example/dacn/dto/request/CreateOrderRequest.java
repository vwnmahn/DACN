package com.example.dacn.dto.request;

import com.example.dacn.entity.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;
import java.math.BigDecimal;

@Data
public class CreateOrderRequest {
    @NotNull(message = "Nhà hàng không được để trống")
    @Positive(message = "Mã nhà hàng không hợp lệ")
    private Long restaurantId;

    @NotBlank(message = "Idempotency key không được để trống")
    @Size(max = 100, message = "Idempotency key không được vượt quá 100 ký tự")
    private String idempotencyKey;

    // Included in the order fingerprint so checkout retries cannot switch payment methods.
    // OrderService itself does not create a payment; CheckoutService owns that orchestration.
    private PaymentMethod paymentMethod;

    private String voucherCode;
    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;

    @NotBlank(message = "Tên người nhận không được để trống")
    @Size(max = 100, message = "Tên người nhận không được vượt quá 100 ký tự")
    private String recipientName;

    @NotBlank(message = "Số điện thoại người nhận không được để trống")
    @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại người nhận không hợp lệ")
    private String recipientPhone;

    @NotBlank(message = "Địa chỉ giao hàng không được để trống")
    @Size(max = 500, message = "Địa chỉ giao hàng không được vượt quá 500 ký tự")
    private String deliveryAddress;

    @Size(max = 500, message = "Ghi chú không được vượt quá 500 ký tự")
    private String deliveryNote;

    @NotEmpty(message = "Đơn hàng phải có ít nhất một món")
    private List<@Valid Item> items;

    @Data
    public static class Item {
        @NotNull(message = "Mã món không được để trống")
        @Positive(message = "Mã món không hợp lệ")
        private Long menuItemId;

        @NotNull(message = "Số lượng không được để trống")
        @Min(value = 1, message = "Số lượng phải lớn hơn 0")
        @Max(value = 100, message = "Số lượng mỗi món không được vượt quá 100")
        private Integer quantity;
    }
}

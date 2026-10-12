package com.example.dacn.dto.request;

import com.example.dacn.entity.OrderStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Request contracts for administrative order state changes. */
public final class OrderManagementRequest {
    private OrderManagementRequest() {
    }

    @Data
    public static class StatusUpdate {
        @NotNull(message = "Trạng thái đơn hàng không được để trống")
        private OrderStatus status;
    }

    @Data
    public static class CodCompletion {
        @AssertTrue(message = "Phải xác nhận đã thu tiền COD thực tế")
        private boolean paymentCollected;
    }

    @Data
    public static class Cancellation {
        @NotBlank(message = "Lý do hủy đơn không được để trống")
        @Size(max = 500, message = "Lý do hủy đơn không được vượt quá 500 ký tự")
        private String reason;
    }
}

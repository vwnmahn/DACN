package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentRefundRequest {
    // Omit amount for the recommended full refund. Partial refund is intentionally unsupported.
    @DecimalMin(value = "0.01", message = "Số tiền hoàn phải lớn hơn 0")
    private BigDecimal amount;
    @NotBlank(message = "Lý do hoàn tiền không được để trống")
    @Size(max = 255, message = "Lý do hoàn tiền không vượt quá 255 ký tự")
    private String reason;
    @NotBlank(message = "Idempotency key không được để trống")
    @Size(max = 100, message = "Idempotency key không vượt quá 100 ký tự")
    private String idempotencyKey;
}

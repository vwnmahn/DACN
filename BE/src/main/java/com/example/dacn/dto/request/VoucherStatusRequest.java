package com.example.dacn.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VoucherStatusRequest {
    @NotNull(message = "Trạng thái voucher không được để trống")
    private Boolean active;
}

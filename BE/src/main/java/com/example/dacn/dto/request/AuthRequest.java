package com.example.dacn.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/** Request contracts for authentication operations. */
public final class AuthRequest {
    private AuthRequest() {
    }

    @Data
    public static class Login {
        @NotBlank(message = "Số điện thoại không được để trống")
        @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại không hợp lệ")
        private String phoneNumber;

        @ToString.Exclude
        @NotBlank(message = "Mật khẩu không được để trống")
        @Size(min = 8, max = 100, message = "Mật khẩu phải từ 8 đến 100 ký tự")
        private String password;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SocialLogin {
        @ToString.Exclude
        @NotBlank(message = "Token không được để trống")
        private String token;
    }

    @Data
    public static class Refresh {
        @ToString.Exclude
        @NotBlank
        private String refreshToken;
    }

    @Data
    public static class ChangePassword {
        @ToString.Exclude
        @NotBlank(message = "Mật khẩu hiện tại không được để trống")
        private String currentPassword;

        @ToString.Exclude
        @NotBlank(message = "Mật khẩu mới không được để trống")
        @Size(min = 8, max = 100, message = "Mật khẩu mới phải từ 8 đến 100 ký tự")
        private String newPassword;
    }
}

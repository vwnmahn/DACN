package com.example.dacn.dto.request;


import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

/** Request contracts for authentication operations. */
public final class AuthRequest {

    private AuthRequest() {
    }

    @Getter
    @Setter
    public static class Login {

        @NotBlank(message = "Số điện thoại không được để trống")
        @Pattern(
                regexp = "^0[0-9]{9}$",
                message = "Số điện thoại không hợp lệ"
        )
        private String phoneNumber;

        @NotBlank(message = "Mật khẩu không được để trống")
        @Size(
                min = 8,
                max = 100,
                message = "Mật khẩu phải từ 8 đến 100 ký tự"
        )
        private String password;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SocialLogin {

        @NotBlank(message = "Token không được để trống")
        private String token;
    }

    @Getter
    @Setter
    public static class Refresh {

        @NotBlank(message = "Refresh token không được để trống")
        private String refreshToken;
    }

    @Getter
    @Setter
    public static class ChangePassword {

        @NotBlank(message = "Mật khẩu hiện tại không được để trống")
        private String currentPassword;

        @NotBlank(message = "Mật khẩu mới không được để trống")
        @Size(
                min = 8,
                max = 100,
                message = "Mật khẩu mới phải từ 8 đến 100 ký tự"
        )
        private String newPassword;
    }
}

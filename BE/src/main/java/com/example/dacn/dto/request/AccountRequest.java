package com.example.dacn.dto.request;

import com.example.dacn.entity.GenderStatus;
import com.example.dacn.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

/** Request contracts for account profile and administration operations. */
public final class AccountRequest {
    private AccountRequest() {
    }

    @Data
    public static class Update {
        private MultipartFile avatar;

        @Email(message = "Email không đúng định dạng")
        @Size(max = 100, message = "Email không được vượt quá 100 ký tự")
        private String email;

        @Size(max = 255, message = "Địa chỉ không được vượt quá 255 ký tự")
        private String address;

        private LocalDate dateOfBirth;

        private GenderStatus gender;
    }

    @Data
    public static class Lock {
        @NotNull(message = "Trạng thái khóa không được để trống")
        private Boolean locked;
    }

    @Data
    public static class UpdateRole {
        @NotNull(message = "Vai trò không được để trống")
        private Role role;
    }
}

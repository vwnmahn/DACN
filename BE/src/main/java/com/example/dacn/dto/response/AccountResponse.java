package com.example.dacn.dto.response;

import com.example.dacn.entity.Role;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@Data
public class AccountResponse {
    private Long id;
    private String username;

    private String email;

    private String address;

    private Boolean gender;

    private String phoneNumber;

    private String avatarUrl;

    private Role role;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
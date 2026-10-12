package com.example.dacn.dto.response;

import com.example.dacn.entity.Role;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminAccountResponse {
    private Long id;
    private String username;
    private String email;
    private String phoneNumber;
    private String avatarUrl;
    private String address;
    private Role role;
    private Boolean locked;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

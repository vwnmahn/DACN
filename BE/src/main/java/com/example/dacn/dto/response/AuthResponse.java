package com.example.dacn.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    @ToString.Exclude
    private String accessToken;
    @ToString.Exclude
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private AccountResponse account;
}

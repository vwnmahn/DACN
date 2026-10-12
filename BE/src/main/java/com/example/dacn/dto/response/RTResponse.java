package com.example.dacn.dto.response;

import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class RTResponse {
    @ToString.Exclude
    private String accessToken;

    @ToString.Exclude
    private String refreshToken;

    private String tokenType;

    private long expiresIn;
}

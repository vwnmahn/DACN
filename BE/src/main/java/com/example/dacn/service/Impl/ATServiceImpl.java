package com.example.dacn.service.Impl;

import com.example.dacn.entity.Account;
import com.example.dacn.security.JwtUtil;
import com.example.dacn.service.ATService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ATServiceImpl implements ATService {

    private final JwtUtil jwtUtil;

    @Override
    public String generateToken(Account account) {
        return jwtUtil.generateToken(
                account.getId(),
                account.getRole()
        );
    }

    @Override
    public boolean validateToken(String token) {
        return token != null
                && !token.isBlank()
                && jwtUtil.validate(token)
                && "ACCESS".equals(jwtUtil.getTokenType(token));
    }

    @Override
    public Long getAccountId(String token) {
        if (!validateToken(token)) {
            throw new IllegalArgumentException(
                    "Access Token không hợp lệ hoặc đã hết hạn"
            );
        }

        return jwtUtil.getAccountId(token);
    }
}

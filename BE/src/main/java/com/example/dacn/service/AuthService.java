package com.example.dacn.service;

import com.example.dacn.dto.request.AccountRequest.Update;
import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.dto.request.AuthRequest.Login;
import com.example.dacn.dto.request.AuthRequest.SocialLogin;
import com.example.dacn.dto.request.RegisterRequest;
import com.example.dacn.dto.response.AuthResponse;
import com.example.dacn.dto.response.RTResponse;
import com.example.dacn.dto.request.AuthRequest.ChangePassword;
import org.springframework.stereotype.Service;

@Service
public interface AuthService {
    AuthResponse register(RegisterRequest registerRequest);
    AuthResponse login(Login loginRequest);
    void logout(String token);
    AuthResponse loginFacebook(SocialLogin loginRequest);
    AuthResponse loginGoogle(SocialLogin loginRequest);
    AccountResponse updateAccount(Update request);
    RTResponse refreshToken(String refreshToken);
    AccountResponse getCurrentAccount();
    void changePassword(ChangePassword request);
    void logoutAll();
}

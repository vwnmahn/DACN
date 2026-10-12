package com.example.dacn.controller;

import com.example.dacn.dto.request.AccountRequest.Update;
import com.example.dacn.dto.request.AuthRequest.Login;
import com.example.dacn.dto.request.AuthRequest.Refresh;
import com.example.dacn.dto.request.RegisterRequest;
import com.example.dacn.dto.request.AuthRequest.ChangePassword;
import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.AuthResponse;
import com.example.dacn.dto.response.RTResponse;
import com.example.dacn.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;


    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request
    ) {
        AuthResponse response = authService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.<AuthResponse>builder()
                        .code(1000)
                        .message("Đăng ký tài khoản thành công")
                        .data(response)
                        .build());
    }

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AuthResponse>> registerMultipart(
            @Valid @ModelAttribute RegisterRequest request
    ) {
        return register(request);
    }


    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody Login request
    ) {
        AuthResponse response = authService.login(request);

        return ResponseEntity.ok(
                ApiResponse.<AuthResponse>builder()
                        .code(1000)
                        .message("Đăng nhập thành công")
                        .data(response)
                        .build()
        );
    }

    @PutMapping("/update")
    public ResponseEntity<ApiResponse<AccountResponse>> updateAccount(
            @Valid @ModelAttribute Update request
    ) {
        AccountResponse response = authService.updateAccount(request);

        return ResponseEntity.ok(
                ApiResponse.<AccountResponse>builder()
                        .code(1000)
                        .message("Cập nhật tài khoản thành công")
                        .data(response)
                        .build()
        );
    }
    @DeleteMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @Valid @RequestBody Refresh request
    ) {
        authService.logout(request.getRefreshToken());

        return ResponseEntity.ok(
                ApiResponse.<Void>builder()
                        .code(1000)
                        .message("Đăng xuất thành công")
                        .data(null)
                        .build()
        );
    }
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<RTResponse>> refreshToken(
            @Valid @RequestBody Refresh request
    ) {
        RTResponse response = authService.refreshToken(
                request.getRefreshToken()
        );

        return ResponseEntity.ok(
                ApiResponse.<RTResponse>builder()
                        .code(1000)
                        .message("Làm mới token thành công")
                        .data(response)
                        .build()
        );
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AccountResponse>> me() {
        return ResponseEntity.ok(ApiResponse.<AccountResponse>builder()
                .code(1000).message("Lấy thông tin tài khoản thành công")
                .data(authService.getCurrentAccount()).build());
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePassword request) {
        authService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000).message("Đổi mật khẩu thành công").data(null).build());
    }

    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<Void>> logoutAll() {
        authService.logoutAll();
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000).message("Đã đăng xuất khỏi tất cả thiết bị").data(null).build());
    }


}

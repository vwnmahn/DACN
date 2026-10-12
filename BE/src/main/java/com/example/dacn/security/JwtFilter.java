
package com.example.dacn.security;

import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.entity.Account;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.AccountRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final AccountRepository accountRepo;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        // Không có Bearer Token: chuyển cho Spring Security xử lý
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String accessToken = header.substring(7).trim();

        // Kiểm tra Access Token
        if (accessToken.isBlank() || !jwtUtil.validate(accessToken)
                || !jwtUtil.isAccessToken(accessToken)) {
            sendError(response, ErrorCode.INVALID_TOKEN);
            return;
        }

        Long accountId;

        try {
            accountId = jwtUtil.getAccountId(accessToken);
        } catch (Exception e) {
            sendError(response, ErrorCode.INVALID_TOKEN);
            return;
        }

        if (accountId == null) {
            sendError(response, ErrorCode.INVALID_TOKEN);
            return;
        }

        // Nếu đã xác thực thì không cần xác thực lại
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Tìm Account trong database
        Account account = accountRepo.findById(accountId).orElse(null);

        if (account == null) {
            sendError(response, ErrorCode.USER_NOT_EXISTED);
            return;
        }

        // Kiểm tra tài khoản bị khóa
        if (Boolean.TRUE.equals(account.getLocked())) {
            sendError(response, ErrorCode.ACCOUNT_LOCKED);
            return;
        }

        // Kiểm tra Role
        if (account.getRole() == null) {
            sendError(response, ErrorCode.UNAUTHORIZED);
            return;
        }

        // Tạo quyền từ Role
        List<SimpleGrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority(
                        "ROLE_" + account.getRole().name()
                )
        );

        // Tạo Authentication
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        account,
                        null,
                        authorities
                );

        authentication.setDetails(
                new WebAuthenticationDetailsSource()
                        .buildDetails(request)
        );

        // Lưu Authentication vào SecurityContext
        SecurityContextHolder.getContext()
                .setAuthentication(authentication);

        // Tiếp tục xử lý request
        filterChain.doFilter(request, response);
    }

    private void sendError(
            HttpServletResponse response,
            ErrorCode error
    ) throws IOException {

        SecurityContextHolder.clearContext();

        response.setStatus(error.getStatusCode().value());
        response.setContentType("application/json;charset=UTF-8");

        ApiResponse<Object> apiResponse =
                ApiResponse.<Object>builder()
                        .code(error.getCode())
                        .message(error.getMessage())
                        .data(null)
                        .build();

        objectMapper.writeValue(
                response.getWriter(),
                apiResponse
        );
    }
}

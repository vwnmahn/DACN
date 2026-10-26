package com.example.dacn.config;

import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.security.JwtFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final ObjectMapper objectMapper;
    private final CorsProperties corsProperties;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .requestCache(cache -> cache.disable())
                .logout(logout -> logout.disable())

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            writeErrorResponse(response, ErrorCode.UNAUTHENTICATED);
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            writeErrorResponse(response, ErrorCode.UNAUTHORIZED);
                        })
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // ---------- PUBLIC ----------
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/images/avatars/**").permitAll()
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/update", "/api/v1/auth/change-password", "/api/v1/auth/logout-all").authenticated()
                        .requestMatchers("/api/v1/payments/vnpay/return", "/api/v1/payments/vnpay/ipn").permitAll()
                        .requestMatchers("/api/v1/restaurants/**").permitAll()
                        .requestMatchers("/api/v1/menu-items/**").permitAll()
                        .requestMatchers("/api/v1/orders/**").permitAll()

                        // ---------- ADMIN ----------
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/stories/admin/**").hasRole("ADMIN")


                        // ---------- USER (BẮT BUỘC LOGIN) ----------
                        .requestMatchers("/api/v1/user/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/checkout").hasRole("USER")
                        .requestMatchers(HttpMethod.POST, "/api/v1/delivery/estimate").hasRole("USER")
                        .requestMatchers( "/api/v1/table-reservations","/api/v1/table-reservations/**").hasRole("USER")
                        .requestMatchers("/api/v1/payments/**").hasRole("USER")


                        .requestMatchers("/api/v1/vouchers/**").hasAnyRole("ADMIN", "USER")
                        .requestMatchers("/api/v1/checkout/**").hasAnyRole("ADMIN", "USER")




                        // ---------- ALL OTHER ----------
                        .anyRequest().authenticated()
                )

                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("*"));
        config.setAllowedMethods(List.of("*"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private void writeErrorResponse(HttpServletResponse response,
                                    ErrorCode error) throws java.io.IOException {
        response.setStatus(error.getStatusCode().value());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), ApiResponse.builder()
                .code(error.getCode())
                .message(error.getMessage())
                .data(null)
                .build());
    }
}

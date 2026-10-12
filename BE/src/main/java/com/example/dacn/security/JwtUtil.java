package com.example.dacn.security;



import com.example.dacn.entity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.time.Instant;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String SECRET;

    @Value("${jwt.expiration}") // milliseconds
    private long EXPIRATION;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(
                SECRET.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String generateToken(Long accountId, Role role) {
        Date now = new Date();
        Date exp = new Date(System.currentTimeMillis() + EXPIRATION);

        return Jwts.builder()
                .subject(String.valueOf(accountId))
                .claim("role", role.name())
                .claim("tokenType", "ACCESS")
                .issuedAt(now)
                .expiration(exp)
                .signWith(key(), Jwts.SIG.HS256)
                .compact();
    }

    public boolean validate(String token) {
        try {
            parse(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
    public String getTokenType(String token) {
        return parse(token).get("tokenType", String.class);
    }

    public boolean isAccessToken(String token) {
        try {
            return "ACCESS".equals(getTokenType(token));
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }
    public Long getAccountId(String token) {
        return Long.parseLong(parse(token).getSubject());
    }

    public String getRole(String token) {
        Object r = parse(token).get("role");
        return r == null ? null : r.toString();
    }

    public Instant getExpiration(String token) {
        return parse(token).getExpiration().toInstant();
    }

    public Instant getIssuedAt(String token) {
        return parse(token).getIssuedAt().toInstant();
    }

    public long getExpirationSeconds() {
        return EXPIRATION / 1000;
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

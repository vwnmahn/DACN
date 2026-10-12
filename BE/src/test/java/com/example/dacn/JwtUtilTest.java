package com.example.dacn;

import com.example.dacn.entity.Role;
import com.example.dacn.security.JwtUtil;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {
    private static final String SECRET = "test-only-jwt-signing-key-with-at-least-32-bytes";

    @Test
    void accessTokenContainsExpectedClaimsAndExpiresAfterExactlyTenMinutes() {
        JwtUtil jwtUtil = jwtUtil(600_000L);

        String token = jwtUtil.generateToken(42L, Role.ADMIN);

        assertTrue(jwtUtil.validate(token));
        assertEquals(42L, jwtUtil.getAccountId(token));
        assertEquals("ADMIN", jwtUtil.getRole(token));
        assertEquals("ACCESS", jwtUtil.getTokenType(token));
        assertEquals(600L, Duration.between(jwtUtil.getIssuedAt(token), jwtUtil.getExpiration(token)).getSeconds());
    }

    @Test
    void expiredTokenIsRejected() {
        JwtUtil jwtUtil = jwtUtil(-1L);

        String token = jwtUtil.generateToken(1L, Role.USER);

        assertFalse(jwtUtil.validate(token));
    }

    @Test
    void tokenWithWrongSignatureAndMalformedTokenAreRejected() {
        JwtUtil issuer = jwtUtil(600_000L);
        JwtUtil verifier = new JwtUtil();
        ReflectionTestUtils.setField(verifier, "SECRET",
                "a-different-test-signing-key-with-at-least-32-bytes");
        ReflectionTestUtils.setField(verifier, "EXPIRATION", 600_000L);

        assertFalse(verifier.validate(issuer.generateToken(1L, Role.USER)));
        assertFalse(issuer.validate("not-a-jwt"));
    }

    @Test
    void onlyExplicitAccessTokenTypeIsAccepted() {
        JwtUtil jwtUtil = jwtUtil(600_000L);
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Date expiration = new Date(System.currentTimeMillis() + 60_000);
        String missingType = Jwts.builder().subject("1").expiration(expiration)
                .signWith(key, Jwts.SIG.HS256).compact();
        String refreshType = Jwts.builder().subject("1").claim("tokenType", "REFRESH")
                .expiration(expiration).signWith(key, Jwts.SIG.HS256).compact();

        assertFalse(jwtUtil.isAccessToken(missingType));
        assertFalse(jwtUtil.isAccessToken(refreshType));
        assertTrue(jwtUtil.isAccessToken(jwtUtil.generateToken(1L, Role.USER)));
    }

    private JwtUtil jwtUtil(long expiration) {
        JwtUtil jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "SECRET", SECRET);
        ReflectionTestUtils.setField(jwtUtil, "EXPIRATION", expiration);
        return jwtUtil;
    }
}

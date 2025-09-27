package com.xuqinyang.xmudemo.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.Key;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration:0}")
    private Long legacyExpiration; // 兼容旧字段

    @Value("${jwt.accessExpiration:900}")
    private Long accessExpiration; // 秒

    @Value("${jwt.refreshExpiration:604800}")
    private Long refreshExpiration; // 秒

    public String getUsernameFromToken(String token) {
        return getClaimFromToken(token, Claims::getSubject);
    }

    public String getTokenType(String token) {
        return getClaimFromToken(token, c -> (String)c.get("type"));
    }

    public Date getExpirationDateFromToken(String token) {
        return getClaimFromToken(token, Claims::getExpiration);
    }

    public <T> T getClaimFromToken(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = getAllClaimsFromToken(token);
        return claimsResolver.apply(claims);
    }

    private Key getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 64) {
            try { keyBytes = MessageDigest.getInstance("SHA-512").digest(keyBytes); } catch (NoSuchAlgorithmException e) { keyBytes = Arrays.copyOf(keyBytes, 64); }
        }
        if (keyBytes.length > 64) keyBytes = Arrays.copyOf(keyBytes, 64);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private Claims getAllClaimsFromToken(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(token).getBody();
    }

    private Boolean isTokenExpired(String token) {
        final Date expiration = getExpirationDateFromToken(token);
        return expiration.before(new Date());
    }

    // 旧接口：仍生成 access token，供兼容
    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "access");
        return doGenerateToken(claims, userDetails.getUsername(), accessExpiration>0?accessExpiration:legacyExpiration);
    }

    public String generateAccessToken(String username) {
        Map<String,Object> claims = new HashMap<>();
        claims.put("type", "access");
        return doGenerateToken(claims, username, accessExpiration);
    }

    public String generateRefreshToken(String username) {
        Map<String,Object> claims = new HashMap<>();
        claims.put("type", "refresh");
        return doGenerateToken(claims, username, refreshExpiration);
    }

    private String doGenerateToken(Map<String, Object> claims, String subject, Long ttlSeconds) {
        long effectiveTtl = (ttlSeconds!=null && ttlSeconds>0)? ttlSeconds : (legacyExpiration!=null && legacyExpiration>0? legacyExpiration: 3600);
        return Jwts.builder().setClaims(claims).setSubject(subject).setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + effectiveTtl * 1000))
                .signWith(getSigningKey(), SignatureAlgorithm.HS512).compact();
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = getUsernameFromToken(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    public boolean isAccessToken(String token) {
        try { return "access".equals(getTokenType(token)); } catch (Exception e) { return false; }
    }
    public boolean isRefreshToken(String token) {
        try { return "refresh".equals(getTokenType(token)); } catch (Exception e) { return false; }
    }
}

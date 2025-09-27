package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.dto.AuthRequest;
import com.xuqinyang.xmudemo.config.JwtUtil;
import com.xuqinyang.xmudemo.service.CustomUserDetailsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private CustomUserDetailsService userDetailsService;

    @PostMapping("/api/auth/login")
    public ResponseEntity<?> createAuthenticationToken(@RequestBody AuthRequest authRequest) {
        log.info("[LOGIN] Attempt studentId={}", authRequest.getStudentId());
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getStudentId(), authRequest.getPassword())
            );
        } catch (BadCredentialsException e) {
            log.warn("[LOGIN] Bad credentials for {}", authRequest.getStudentId());
            return ResponseEntity.status(401).body(Map.of("error", "\u5b66\u53f7\u6216\u5bc6\u7801\u9519\u8bef")); // 学号或密码错误
        } catch (AuthenticationException e) {
            log.warn("[LOGIN] AuthenticationException for {}: {}", authRequest.getStudentId(), e.getMessage());
            return ResponseEntity.status(401).body(Map.of("error", "\u8ba4\u8bc1\u5931\u8d25")); // 认证失败
        } catch (Exception e) {
            log.error("[LOGIN] Server error for {}", authRequest.getStudentId(), e);
            return ResponseEntity.status(500).body(Map.of("error", "\u670d\u52a1\u5668\u5185\u90e8\u9519\u8bef")); // 服务器内部错误
        }
        UserDetails userDetails = userDetailsService.loadUserByUsername(authRequest.getStudentId());
        String access = jwtUtil.generateAccessToken(userDetails.getUsername());
        String refresh = jwtUtil.generateRefreshToken(userDetails.getUsername());
        log.info("[LOGIN] Success studentId={} issued access+refresh", authRequest.getStudentId());
        return ResponseEntity.ok()
                .header("Set-Cookie", buildCookie("access_token", access, true, true, 900))
                .header("Set-Cookie", buildCookie("refresh_token", refresh, true, true, 604800))
                .body(Map.of("message", "ok"));
    }

    @PostMapping("/api/auth/refresh")
    public ResponseEntity<?> refreshToken(jakarta.servlet.http.HttpServletRequest request) {
        String refreshToken = extractCookie(request, "refresh_token");
        if (refreshToken == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u7f3a\u5c11\u5237\u65b0\u4ee4\u724c")); // 缺少刷新令牌
        }
        try {
            if (!jwtUtil.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(401).body(Map.of("error", "\u65e0\u6548\u5237\u65b0\u4ee4\u724c\u7c7b\u578b")); // 无效刷新令牌类型
            }
            String username = jwtUtil.getUsernameFromToken(refreshToken);
            UserDetails details = userDetailsService.loadUserByUsername(username);
            if (!jwtUtil.validateToken(refreshToken, details)) {
                return ResponseEntity.status(401).body(Map.of("error", "\u5237\u65b0\u4ee4\u724c\u5931\u6548")); // 刷新令牌失效
            }
            String newAccess = jwtUtil.generateAccessToken(username);
            return ResponseEntity.ok()
                    .header("Set-Cookie", buildCookie("access_token", newAccess, true, true, 900))
                    .body(Map.of("message", "refreshed"));
        } catch (Exception e) {
            log.warn("[REFRESH] failed: {}", e.getMessage());
            return ResponseEntity.status(401).body(Map.of("error", "\u5237\u65b0\u5931\u8d25")); // 刷新失败
        }
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok()
                .header("Set-Cookie", buildCookie("access_token", "", true, true, 0))
                .header("Set-Cookie", buildCookie("refresh_token", "", true, true, 0))
                .body(Map.of("message", "logged_out"));
    }

    private String extractCookie(jakarta.servlet.http.HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (jakarta.servlet.http.Cookie c : request.getCookies()) {
            if (c.getName().equals(name)) return c.getValue();
        }
        return null;
    }

    private String buildCookie(String name, String value, boolean httpOnly, boolean sameSiteLax, int maxAgeSeconds) {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append("=").append(value == null ? "" : value).append("; Path=/");
        if (maxAgeSeconds >= 0) sb.append("; Max-Age=").append(maxAgeSeconds);
        if (httpOnly) sb.append("; HttpOnly");
        sb.append("; SameSite=Lax");
        return sb.toString();
    }
}

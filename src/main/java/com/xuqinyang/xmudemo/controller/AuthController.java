package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.dto.AuthRequest;
import com.xuqinyang.xmudemo.config.JwtUtil;
import com.xuqinyang.xmudemo.service.CustomUserDetailsService;
import com.xuqinyang.xmudemo.service.MessageQueueService;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
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

import jakarta.servlet.http.HttpServletRequest;
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
    @Autowired
    private MessageQueueService messageQueueService;
    @Autowired
    private PerformanceMonitorService performanceMonitorService;

    @PostMapping("/api/auth/login")
    public ResponseEntity<?> createAuthenticationToken(@RequestBody AuthRequest authRequest, HttpServletRequest request) {
        long startTime = System.currentTimeMillis();
        String clientIp = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        log.info("[LOGIN] Attempt studentId={}, ip={}", authRequest.getStudentId(), clientIp);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.getStudentId(), authRequest.getPassword())
            );

            UserDetails userDetails = userDetailsService.loadUserByUsername(authRequest.getStudentId());
            String access = jwtUtil.generateAccessToken(userDetails.getUsername());
            String refresh = jwtUtil.generateRefreshToken(userDetails.getUsername());

            // 异步处理登录成功事件
            messageQueueService.sendUserAuthMessage(
                authRequest.getStudentId(),
                "LOGIN",
                clientIp,
                userAgent
            );

            // 发送审计日志
            messageQueueService.sendAuditLogMessage(
                authRequest.getStudentId(),
                "LOGIN_SUCCESS",
                "AUTH",
                String.format("User logged in from IP: %s", clientIp)
            );

            // 发送数据统计
            messageQueueService.sendDataStatisticsMessage(
                "USER",
                "LOGIN",
                Map.of("userId", authRequest.getStudentId(), "ip", clientIp)
            );

            // 记录性能指标
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/login", 200, duration);

            log.info("[LOGIN] Success studentId={} issued access+refresh, duration={}ms", authRequest.getStudentId(), duration);

            return ResponseEntity.ok()
                    .header("Set-Cookie", buildCookie("access_token", access, true, true, 900))
                    .header("Set-Cookie", buildCookie("refresh_token", refresh, true, true, 604800))
                    .body(Map.of("message", "ok"));

        } catch (BadCredentialsException e) {
            // 异步处理登录失败事件
            messageQueueService.sendUserAuthMessage(
                authRequest.getStudentId(),
                "LOGIN_FAILED",
                clientIp,
                userAgent
            );

            // 发送审计日志
            messageQueueService.sendAuditLogMessage(
                authRequest.getStudentId(),
                "LOGIN_FAILED",
                "AUTH",
                String.format("Failed login attempt from IP: %s - Bad credentials", clientIp)
            );

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/login", 401, duration);

            log.warn("[LOGIN] Bad credentials for {} from IP {}, duration={}ms", authRequest.getStudentId(), clientIp, duration);
            return ResponseEntity.status(401).body(Map.of("error", "学号或密码错误"));

        } catch (AuthenticationException e) {
            // 异步处理认证异常
            messageQueueService.sendUserAuthMessage(
                authRequest.getStudentId(),
                "LOGIN_FAILED",
                clientIp,
                userAgent
            );

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/login", 401, duration);

            log.warn("[LOGIN] AuthenticationException for {} from IP {}: {}, duration={}ms",
                authRequest.getStudentId(), clientIp, e.getMessage(), duration);
            return ResponseEntity.status(401).body(Map.of("error", "认证失败"));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/login", 500, duration);

            log.error("[LOGIN] Server error for {} from IP {}, duration={}ms",
                authRequest.getStudentId(), clientIp, duration, e);
            return ResponseEntity.status(500).body(Map.of("error", "服务器内部错误"));
        }
    }

    @PostMapping("/api/auth/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest request) {
        long startTime = System.currentTimeMillis();
        String clientIp = getClientIp(request);
        String refreshToken = extractCookie(request, "refresh_token");

        if (refreshToken == null) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/refresh", 401, duration);
            return ResponseEntity.status(401).body(Map.of("error", "缺少刷新令牌"));
        }

        try {
            if (!jwtUtil.isRefreshToken(refreshToken)) {
                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/auth/refresh", 401, duration);
                return ResponseEntity.status(401).body(Map.of("error", "无效刷新令牌类型"));
            }

            String username = jwtUtil.getUsernameFromToken(refreshToken);
            UserDetails details = userDetailsService.loadUserByUsername(username);

            if (!jwtUtil.validateToken(refreshToken, details)) {
                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/auth/refresh", 401, duration);
                return ResponseEntity.status(401).body(Map.of("error", "刷新令牌失效"));
            }

            String newAccess = jwtUtil.generateAccessToken(username);

            // 异步处理token刷新事件
            messageQueueService.sendUserAuthMessage(
                username,
                "REFRESH_TOKEN",
                clientIp,
                request.getHeader("User-Agent")
            );

            // 发送数据统计
            messageQueueService.sendDataStatisticsMessage(
                "USER",
                "REFRESH_TOKEN",
                Map.of("userId", username, "ip", clientIp)
            );

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/refresh", 200, duration);

            log.info("[REFRESH] Success for user {} from IP {}, duration={}ms", username, clientIp, duration);

            return ResponseEntity.ok()
                    .header("Set-Cookie", buildCookie("access_token", newAccess, true, true, 900))
                    .body(Map.of("message", "refreshed"));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/refresh", 401, duration);

            log.warn("[REFRESH] failed from IP {}: {}, duration={}ms", clientIp, e.getMessage(), duration);
            return ResponseEntity.status(401).body(Map.of("error", "刷新失败"));
        }
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        long startTime = System.currentTimeMillis();
        String clientIp = getClientIp(request);
        String accessToken = extractCookie(request, "access_token");

        try {
            if (accessToken != null) {
                String username = jwtUtil.getUsernameFromToken(accessToken);

                // 异步处理登出事件
                messageQueueService.sendUserAuthMessage(
                    username,
                    "LOGOUT",
                    clientIp,
                    request.getHeader("User-Agent")
                );

                // 发送审计日志
                messageQueueService.sendAuditLogMessage(
                    username,
                    "LOGOUT",
                    "AUTH",
                    String.format("User logged out from IP: %s", clientIp)
                );

                log.info("[LOGOUT] Success for user {} from IP {}", username, clientIp);
            }

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/logout", 200, duration);

            return ResponseEntity.ok()
                    .header("Set-Cookie", buildCookie("access_token", "", true, true, 0))
                    .header("Set-Cookie", buildCookie("refresh_token", "", true, true, 0))
                    .body(Map.of("message", "logged out"));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/auth/logout", 500, duration);

            log.error("[LOGOUT] Error from IP {}: {}", clientIp, e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "登出失败"));
        }
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

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
}

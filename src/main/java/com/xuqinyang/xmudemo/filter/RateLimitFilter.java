package com.xuqinyang.xmudemo.filter;

import com.xuqinyang.xmudemo.service.CacheService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * 限流过滤器
 * 基于Redis实现分布式限流
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final CacheService cacheService;

    // 限流配置
    private static final int DEFAULT_LIMIT = 100; // 默认每分钟100次请求
    private static final int LOGIN_LIMIT = 60;    // 登录接口每分钟30次（从10次放宽到30次）
    private static final int FILE_LIMIT = 30;     // 文件上传每分钟20次
    private static final int ADMIN_LIMIT = 200;   // 管理员接口每分钟200次

    // 开发环境特殊配置
    private static final boolean IS_DEV_MODE = true; // 可以通过配置文件控制

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        String clientIp = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        // 构建限流键
        String rateLimitKey = buildRateLimitKey(uri, clientIp, userAgent);

        // 获取当前限流配置
        int limit = getRateLimitForUri(uri);

        // 检查是否超过限流
        if (isRateLimited(rateLimitKey, limit)) {
            log.warn("Rate limit exceeded for IP: {}, URI: {}", clientIp, uri);
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"Rate limit exceeded\",\"message\":\"Too many requests, please try again later\"}");
            return;
        }

        // 增加计数
        cacheService.incrementRateLimit(rateLimitKey);

        filterChain.doFilter(request, response);
    }

    private String buildRateLimitKey(String uri, String clientIp, String userAgent) {
        // 使用IP、URI和User-Agent的组合作为限流键
        return String.format("%s:%s:%d", clientIp, uri, Math.abs(userAgent.hashCode()) % 1000);
    }

    private int getRateLimitForUri(String uri) {
        if (uri.contains("/api/auth/login") || uri.contains("/api/auth/register")) {
            return LOGIN_LIMIT;
        } else if (uri.contains("/api/files/upload")) {
            return FILE_LIMIT;
        } else if (uri.contains("/api/admin/")) {
            return ADMIN_LIMIT;
        } else {
            return DEFAULT_LIMIT;
        }
    }

    private boolean isRateLimited(String key, int limit) {
        Integer currentCount = cacheService.getRateLimitCount(key);
        if (currentCount == null) {
            // 第一次请求，设置过期时间为1分钟
            cacheService.cacheRateLimit(key, 1, 1, TimeUnit.MINUTES);
            return false;
        }
        return currentCount >= limit;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // 跳过健康检查、静态资源和通知API
        return uri.startsWith("/actuator/health") ||
               uri.startsWith("/static/") ||
               uri.startsWith("/css/") ||
               uri.startsWith("/js/") ||
               uri.startsWith("/images/") ||
               uri.startsWith("/api/notifications/"); // 通知API不限流
    }
}

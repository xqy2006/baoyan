package com.xuqinyang.xmudemo.interceptor;

import com.xuqinyang.xmudemo.service.MessageQueueService;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;

/**
 * API请求拦截器
 * 为所有API请求自动添加异步处理和性能监控
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApiRequestInterceptor implements HandlerInterceptor {

    private final MessageQueueService messageQueueService;
    private final PerformanceMonitorService performanceMonitorService;

    private static final String REQUEST_START_TIME = "requestStartTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 记录请求开始时间
        request.setAttribute(REQUEST_START_TIME, System.currentTimeMillis());

        String uri = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        // 获取当前用户信息
        String userId = "anonymous";
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            userId = auth.getName();
        }

        // 异步发送API调用统计
        if (isBusinessApi(uri)) {
            messageQueueService.sendDataStatisticsMessage(
                "SYSTEM",
                "API_CALL",
                Map.of(
                    "uri", uri,
                    "method", method,
                    "userId", userId,
                    "ip", clientIp,
                    "userAgent", userAgent != null ? userAgent : "unknown"
                )
            );

            // 发送审计日志（仅对重要操作）
            if (isImportantOperation(uri, method)) {
                messageQueueService.sendAuditLogMessage(
                    userId,
                    method + "_" + getResourceFromUri(uri),
                    getResourceFromUri(uri),
                    String.format("API call: %s %s from IP: %s", method, uri, clientIp)
                );
            }
        }

        log.debug("API Request: {} {} from IP: {} by user: {}", method, uri, clientIp, userId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        Long startTime = (Long) request.getAttribute(REQUEST_START_TIME);
        if (startTime != null) {
            long duration = System.currentTimeMillis() - startTime;
            String uri = request.getRequestURI();
            String method = request.getMethod();
            int statusCode = response.getStatus();

            // 记录性能指标
            performanceMonitorService.recordRequest(method, uri, statusCode, duration);

            // 只在真正的错误情况下发送错误统计（不包括权限检查失败但最终成功的情况）
            if (ex != null || (statusCode >= 400 && statusCode != 401 && statusCode != 403)) {
                messageQueueService.sendDataStatisticsMessage(
                    "SYSTEM",
                    "ERROR",
                    Map.of(
                        "uri", uri,
                        "method", method,
                        "statusCode", statusCode,
                        "duration", duration,
                        "error", ex != null ? ex.getMessage() : "HTTP " + statusCode
                    )
                );
            }

            log.debug("API Response: {} {} - Status: {} - Duration: {}ms",
                method, uri, statusCode, duration);
        }
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

    private boolean isBusinessApi(String uri) {
        return uri.startsWith("/api/") && !uri.startsWith("/api/actuator/");
    }

    private boolean isImportantOperation(String uri, String method) {
        // 定义重要操作
        return (uri.contains("/submit") ||
                uri.contains("/review") ||
                uri.contains("/approve") ||
                uri.contains("/reject") ||
                uri.contains("/auth/") ||
                (method.equals("POST") && (uri.contains("/applications") || uri.contains("/users"))) ||
                (method.equals("PUT") && uri.contains("/applications")) ||
                (method.equals("DELETE")));
    }

    private String getResourceFromUri(String uri) {
        if (uri.contains("/applications")) return "APPLICATION";
        if (uri.contains("/users")) return "USER";
        if (uri.contains("/activities")) return "ACTIVITY";
        if (uri.contains("/auth")) return "AUTH";
        if (uri.contains("/files")) return "FILE";
        return "SYSTEM";
    }
}

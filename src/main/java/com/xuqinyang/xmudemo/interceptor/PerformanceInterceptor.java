package com.xuqinyang.xmudemo.interceptor;

import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 性能监控拦截器
 * 自动收集HTTP请求的性能指标
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PerformanceInterceptor implements HandlerInterceptor {

    private final PerformanceMonitorService performanceMonitorService;
    private static final String START_TIME_ATTRIBUTE = "startTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_TIME_ATTRIBUTE, System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                               Object handler, Exception ex) {
        Long startTime = (Long) request.getAttribute(START_TIME_ATTRIBUTE);
        if (startTime != null) {
            long duration = System.currentTimeMillis() - startTime;
            String method = request.getMethod();
            String uri = request.getRequestURI();
            int statusCode = response.getStatus();

            // 记录性能指标
            performanceMonitorService.recordRequest(method, uri, statusCode, duration);

            // 记录慢请求
            if (duration > 1000) {
                log.warn("Slow request detected: {} {} took {}ms", method, uri, duration);
            }
        }
    }
}

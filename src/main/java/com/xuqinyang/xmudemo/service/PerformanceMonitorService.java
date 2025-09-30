package com.xuqinyang.xmudemo.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * 性能监控服务
 * 收集和记录应用性能指标
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PerformanceMonitorService {

    private final MeterRegistry meterRegistry;
    private final CacheService cacheService;

    /**
     * 记录请求指标
     */
    public void recordRequest(String method, String uri, int statusCode, long duration) {
        Counter requestCounter = Counter.builder("http_requests_total")
                .description("Total HTTP requests")
                .register(meterRegistry);
        requestCounter.increment();

        if (statusCode >= 400) {
            Counter errorCounter = Counter.builder("http_errors_total")
                    .description("Total HTTP errors")
                    .register(meterRegistry);
            errorCounter.increment();
        }

        Timer requestTimer = Timer.builder("http_request_duration")
                .description("HTTP request duration")
                .register(meterRegistry);
        requestTimer.record(duration, TimeUnit.MILLISECONDS);

        // 缓存性能统计
        String statsKey = String.format("perf:%s:%s", method, uri);
        cachePerformanceStats(statsKey, duration, statusCode);
    }

    /**
     * 记录数据库操作指标
     */
    public void recordDatabaseOperation(String operation, long duration) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("database_operation_duration")
                .tag("operation", operation)
                .register(meterRegistry));

        log.debug("Database operation {} took {} ms", operation, duration);
    }

    /**
     * 记录缓存命中率
     */
    public void recordCacheHit(String cacheName, boolean hit) {
        Counter cacheCounter = Counter.builder("cache_requests_total")
                .tag("cache", cacheName)
                .tag("result", hit ? "hit" : "miss")
                .register(meterRegistry);
        cacheCounter.increment();
    }

    /**
     * 记录消息队列指标
     */
    public void recordMessageQueueMetrics(String queueName, String operation, boolean success) {
        Counter queueCounter = Counter.builder("message_queue_operations_total")
                .tag("queue", queueName)
                .tag("operation", operation)
                .tag("result", success ? "success" : "failure")
                .register(meterRegistry);
        queueCounter.increment();
    }

    /**
     * 记录业务指标
     */
    public void recordBusinessMetrics(String metric, double value) {
        meterRegistry.gauge("business_metric_" + metric, value, Double::doubleValue);
    }

    /**
     * 获取系统性能统计
     */
    public SystemPerformanceStats getSystemStats() {
        // 从缓存中获取统计数据
        Object cachedStats = cacheService.getStats("system_performance");
        if (cachedStats != null) {
            return (SystemPerformanceStats) cachedStats;
        }

        // 计算新的统计数据
        SystemPerformanceStats stats = calculateSystemStats();

        // 缓存统计数据5分钟
        cacheService.cacheStats("system_performance", stats, 5, TimeUnit.MINUTES);

        return stats;
    }

    private void cachePerformanceStats(String key, long duration, int statusCode) {
        try {
            // 缓存性能数据用于分析
            PerformanceData data = new PerformanceData(duration, statusCode, System.currentTimeMillis());
            cacheService.cacheStats(key, data, 1, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to cache performance stats", e);
        }
    }

    private SystemPerformanceStats calculateSystemStats() {
        // 计算系统性能统计
        double requestRate = 0.0;
        double errorRate = 0.0;
        double avgResponseTime = 0.0;

        return new SystemPerformanceStats(requestRate, errorRate, avgResponseTime);
    }

    // 内部类定义
    public static class SystemPerformanceStats {
        private final double requestRate;
        private final double errorRate;
        private final double avgResponseTime;

        public SystemPerformanceStats(double requestRate, double errorRate, double avgResponseTime) {
            this.requestRate = requestRate;
            this.errorRate = errorRate;
            this.avgResponseTime = avgResponseTime;
        }

        // Getters
        public double getRequestRate() { return requestRate; }
        public double getErrorRate() { return errorRate; }
        public double getAvgResponseTime() { return avgResponseTime; }
    }

    public static class PerformanceData {
        private final long duration;
        private final int statusCode;
        private final long timestamp;

        public PerformanceData(long duration, int statusCode, long timestamp) {
            this.duration = duration;
            this.statusCode = statusCode;
            this.timestamp = timestamp;
        }

        // Getters
        public long getDuration() { return duration; }
        public int getStatusCode() { return statusCode; }
        public long getTimestamp() { return timestamp; }
    }
}

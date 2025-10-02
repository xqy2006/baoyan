package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.service.CacheService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 缓存管理接口
 * 提供缓存清理和管理功能
 */
@RestController
@RequestMapping("/api/admin/cache")
@RequiredArgsConstructor
@Slf4j
public class CacheManagementController {

    private final CacheService cacheService;

    /**
     * 清除所有应用相关缓存
     * 用于解决Hibernate代理序列化问题
     */
    @PostMapping("/clear-applications")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> clearApplicationCaches() {
        log.info("Admin requested to clear application caches");

        try {
            // 清除活动列表缓存中的应用数据
            cacheService.evictAllActivities();

            // 清除所有应用相关的缓存
            cacheService.evictAllApplications();

            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Application caches cleared successfully"
            ));
        } catch (Exception e) {
            log.error("Failed to clear application caches: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Failed to clear application caches: " + e.getMessage()
            ));
        }
    }

    /**
     * 清除所有缓存
     */
    @PostMapping("/clear-all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> clearAllCaches() {
        log.info("Admin requested to clear all caches");

        try {
            cacheService.clearAllCache();
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "All caches cleared successfully"
            ));
        } catch (Exception e) {
            log.error("Failed to clear all caches: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Failed to clear all caches: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取缓存状态信息
     */
    @GetMapping("/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getCacheStatus() {
        try {
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Cache status retrieved",
                "cacheEnabled", true,
                "notes", "ApplicationService now uses DTO-based caching to avoid Hibernate proxy serialization issues"
            ));
        } catch (Exception e) {
            log.error("Failed to get cache status: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Failed to get cache status: " + e.getMessage()
            ));
        }
    }
}

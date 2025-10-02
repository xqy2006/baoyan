package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.service.UserNotificationService;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * 通知控制器
 * 提供用户通知相关的API
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    @Autowired
    private UserNotificationService notificationService;
    @Autowired
    private PerformanceMonitorService performanceMonitorService;

    /**
     * 获取并消费用户的最新消息
     * 调用后会清除这些消息，下次调用时不会再返回相同的消息
     */
    @GetMapping("/consume")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> consumeNotifications() {
        long startTime = System.currentTimeMillis();
        String studentId = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            List<Map<String, Object>> notifications = notificationService.consumeNotificationsByStudentId(studentId);

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/consume", 200, duration);

            log.info("[NOTIFICATION_CONSUME] Success for user {}, returned {} notifications, duration={}ms",
                studentId, notifications.size(), duration);

            return ResponseEntity.ok(Map.of(
                "notifications", notifications,
                "count", notifications.size()
            ));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/consume", 500, duration);

            log.error("[NOTIFICATION_CONSUME] Error for user {}, duration={}ms", studentId, duration, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "获取通知失败"));
        }
    }

    /**
     * 获取用户未读通知数量
     */
    @GetMapping("/count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getUnreadCount() {
        long startTime = System.currentTimeMillis();
        String studentId = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            long count = notificationService.getUnreadCountByStudentId(studentId);

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/count", 200, duration);

            log.info("[NOTIFICATION_COUNT] Success for user {}, count={}, duration={}ms",
                studentId, count, duration);

            return ResponseEntity.ok(Map.of("count", count));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/count", 500, duration);

            log.error("[NOTIFICATION_COUNT] Error for user {}, duration={}ms", studentId, duration, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "获取通知数量失败"));
        }
    }

    /**
     * 预览用户未读通知（不会标记为已读）
     */
    @GetMapping("/preview")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> previewNotifications() {
        long startTime = System.currentTimeMillis();
        String studentId = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            Long userId = notificationService.getUserIdByStudentId(studentId);
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "用户不存在"));
            }

            List<Map<String, Object>> notifications = notificationService.getUnreadNotifications(userId);

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/preview", 200, duration);

            log.info("[NOTIFICATION_PREVIEW] Success for user {}, returned {} notifications, duration={}ms",
                studentId, notifications.size(), duration);

            return ResponseEntity.ok(Map.of(
                "notifications", notifications,
                "count", notifications.size()
            ));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("GET", "/api/notifications/preview", 500, duration);

            log.error("[NOTIFICATION_PREVIEW] Error for user {}, duration={}ms", studentId, duration, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "预览通知失败"));
        }
    }
}

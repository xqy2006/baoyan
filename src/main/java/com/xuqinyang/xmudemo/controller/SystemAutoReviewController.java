package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.service.SystemAutoReviewScheduler;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 系统自动审核管理控制器
 * 提供管理员控制自动审核系统的接口
 */
@RestController
@RequestMapping("/api/admin/auto-review")
@RequiredArgsConstructor
@Slf4j
public class SystemAutoReviewController {

    private final SystemAutoReviewScheduler autoReviewScheduler;
    private final ApplicationRepository applicationRepository;
    private final PerformanceMonitorService performanceMonitorService;

    /**
     * 获取自动审核系统状态
     */
    @GetMapping("/status")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAutoReviewStatus() {
        try {
            // 统计各状态的申请数量
            long systemReviewing = applicationRepository.countByStatus(ApplicationStatus.SYSTEM_REVIEWING);
            long systemApproved = applicationRepository.countByStatus(ApplicationStatus.SYSTEM_APPROVED);
            long systemRejected = applicationRepository.countByStatus(ApplicationStatus.SYSTEM_REJECTED);

            Map<String, Object> status = Map.of(
                "systemReviewing", systemReviewing,
                "systemApproved", systemApproved,
                "systemRejected", systemRejected,
                "totalPending", systemReviewing,
                "autoReviewEnabled", true,
                "scheduleInterval", "30 seconds",
                "batchSize", 50
            );

            log.info("Auto review status requested - pending: {}", systemReviewing);
            return ResponseEntity.ok(status);

        } catch (Exception e) {
            log.error("Error getting auto review status", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get auto review status"));
        }
    }

    /**
     * 手动触发系统自动审核
     */
    @PostMapping("/trigger")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Map<String, Object>> triggerAutoReview() {
        try {
            log.info("Manual auto review trigger requested by admin");

            long beforeCount = applicationRepository.countByStatus(ApplicationStatus.SYSTEM_REVIEWING);

            // 触发手动审核
            autoReviewScheduler.triggerManualReview(); // 修复：使用正确的方法名

            // 记录操作
            performanceMonitorService.recordBusinessMetrics("manual_auto_review_triggered", 1.0);

            Map<String, Object> response = Map.of(
                "message", "Auto review triggered successfully",
                "pendingApplications", beforeCount,
                "status", "processing"
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error triggering manual auto review", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to trigger auto review"));
        }
    }

    /**
     * 为特定申请触发自动审核
     */
    @PostMapping("/trigger/{applicationId}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Map<String, Object>> triggerAutoReviewForApplication(@PathVariable Long applicationId) {
        try {
            log.info("Manual auto review requested for application: {}", applicationId);

            autoReviewScheduler.triggerReviewForApplication(applicationId); // 修复：使用正确的方法名

            return ResponseEntity.ok(Map.of(
                "message", "Auto review triggered for application " + applicationId,
                "applicationId", applicationId,
                "status", "processing"
            ));
        } catch (Exception e) {
            log.error("Error triggering auto review for application: {}", applicationId, e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Server error while triggering auto review"));
        }
    }

    /**
     * 获取自动审核统计信息
     */
    @GetMapping("/statistics")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAutoReviewStatistics() {
        try {
            // 这里可以扩展更详细的统计信息
            Map<String, Object> stats = Map.of(
                "description", "System auto review statistics",
                "note", "详细统计信息可以通过性能监控系统查看",
                "metrics", Map.of(
                    "system_auto_review_approved", "已自动通过的申请数",
                    "system_auto_review_rejected", "已自动拒绝的申请数",
                    "auto_review_schedule_error", "调度错误次数",
                    "manual_auto_review_triggered", "手动触发次数"
                )
            );

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            log.error("Error getting auto review statistics", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get statistics"));
        }
    }

    /**
     * 获取待审核申请列表
     */
    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<?> getPendingApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            // 获取前50个待审核的申请
            var pendingApps = applicationRepository.findTop50ByStatusOrderByLastUpdateDateAsc(
                ApplicationStatus.SYSTEM_REVIEWING
            );

            Map<String, Object> response = Map.of(
                "applications", pendingApps.stream().map(app -> Map.of(
                    "id", app.getId(),
                    "userStudentId", app.getUserStudentId(),
                    "lastUpdateDate", app.getLastUpdateDate(),
                    "status", app.getStatus()
                )).toList(),
                "total", pendingApps.size(),
                "note", "显示最近的50个待审核申请"
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting pending applications", e);
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to get pending applications"));
        }
    }
}

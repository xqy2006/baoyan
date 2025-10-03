package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.config.RabbitMQConfig;
import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.model.Activity;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * 消息队列监听器
 * 只处理系统基本功能相关的异步消息
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageQueueListener {

    private final ApplicationRepository applicationRepository;
    private final ActivityRepository activityRepository;
    private final PerformanceMonitorService performanceMonitorService;
    private final CacheService cacheService;
    private final UserNotificationService userNotificationService;

    /**
     * 处理应用相关消息 - ApplicationController发送
     */
    @RabbitListener(queues = RabbitMQConfig.APPLICATION_PROCESS_QUEUE)
    @Async("messageTaskExecutor")
    public void handleApplicationProcessMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            Long applicationId = ((Number) message.get("applicationId")).longValue();
            String action = (String) message.get("action");

            log.info("Processing application message: applicationId={}, action={}", applicationId, action);

            switch (action) {
                case "CREATE":
                    processApplicationCreate(applicationId);
                    break;
                case "SUBMIT":
                    processApplicationSubmit(applicationId);
                    break;
                case "REVIEW":
                    processApplicationReview(applicationId);
                    break;
                case "APPROVE":
                    processApplicationApproval(applicationId);
                    break;
                case "REJECT":
                    processApplicationRejection(applicationId);
                    break;
                case "UPDATE":
                    processApplicationUpdate(applicationId);
                    break;
                case "EXPORT":
                    processApplicationExport(applicationId);
                    break;
                default:
                    log.warn("Unknown application action: {}", action);
            }

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.APPLICATION_PROCESS_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing application message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.APPLICATION_PROCESS_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Application message processing took {} ms", duration);
        }
    }

    /**
     * 处理活动相关消息 - ActivityService发送
     */
    @RabbitListener(queues = RabbitMQConfig.ACTIVITY_PROCESS_QUEUE)
    @Async("activityTaskExecutor")
    public void handleActivityProcessMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            Long activityId = ((Number) message.get("activityId")).longValue();
            String action = (String) message.get("action");

            log.info("Processing activity message: activityId={}, action={}", activityId, action);

            switch (action) {
                case "CREATE":
                    processActivityCreate(activityId);
                    break;
                case "UPDATE":
                    processActivityUpdate(activityId);
                    break;
                case "DELETE":
                    processActivityDelete(activityId);
                    break;
                case "TOGGLE":
                    processActivityToggle(activityId);
                    break;
                default:
                    log.warn("Unknown activity action: {}", action);
            }

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.ACTIVITY_PROCESS_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing activity message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.ACTIVITY_PROCESS_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Activity message processing took {} ms", duration);
        }
    }

    /**
     * 处理文件相关消息 - FileController发送
     */
    @RabbitListener(queues = RabbitMQConfig.FILE_PROCESS_QUEUE)
    @Async("fileProcessTaskExecutor")
    public void handleFileProcessMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String fileName = (String) message.get("fileName");
            String filePath = (String) message.get("filePath");
            String action = (String) message.get("action");

            log.info("Processing file message: fileName={}, action={}", fileName, action);

            switch (action) {
                case "UPLOAD":
                    processFileUpload(fileName, filePath);
                    break;
                case "VIRUS_SCAN":
                    processVirusScan(fileName, filePath);
                    break;
                default:
                    log.warn("Unknown file action: {}", action);
            }

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.FILE_PROCESS_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing file message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.FILE_PROCESS_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("File message processing took {} ms", duration);
        }
    }

    /**
     * 处理通知消息 - ApplicationController发送
     */
    @RabbitListener(queues = RabbitMQConfig.NOTIFICATION_QUEUE)
    @Async("messageTaskExecutor")
    public void handleNotificationMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            Long userId = ((Number) message.get("userId")).longValue();
            String title = (String) message.get("title");
            String content = (String) message.get("content");
            String type = (String) message.get("type");

            log.info("Processing notification message: userId={}, type={}", userId, type);

            processNotification(userId, title, content, type);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.NOTIFICATION_QUEUE, type, true
            );

        } catch (Exception e) {
            log.error("Error processing notification message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.NOTIFICATION_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Notification message processing took {} ms", duration);
        }
    }

    /**
     * 处理用户认证消息 - AuthController发送
     */
    @RabbitListener(queues = RabbitMQConfig.USER_AUTH_QUEUE)
    @Async("messageTaskExecutor")
    public void handleUserAuthMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String userId = (String) message.get("userId");
            String action = (String) message.get("action");
            String ip = (String) message.get("ip");
            String userAgent = (String) message.get("userAgent");

            log.info("Processing user auth message: userId={}, action={}", userId, action);

            processUserAuth(userId, action, ip, userAgent);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.USER_AUTH_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing user auth message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.USER_AUTH_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("User auth message processing took {} ms", duration);
        }
    }

    /**
     * 处理审计日志消息 - FileController发送
     */
    @RabbitListener(queues = RabbitMQConfig.AUDIT_LOG_QUEUE)
    @Async("messageTaskExecutor")
    public void handleAuditLogMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String userId = (String) message.get("userId");
            String action = (String) message.get("action");
            String resourceType = (String) message.get("resourceType");
            String details = (String) message.get("details");

            log.info("Processing audit log message: userId={}, action={}", userId, action);

            processAuditLog(userId, action, resourceType, details);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.AUDIT_LOG_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing audit log message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.AUDIT_LOG_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Audit log message processing took {} ms", duration);
        }
    }

    /**
     * 处理数据统计消息 - FileController发送
     */
    @RabbitListener(queues = RabbitMQConfig.STATISTICS_QUEUE)
    @Async("messageTaskExecutor")
    public void handleStatisticsMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String category = (String) message.get("category");
            String action = (String) message.get("action");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) message.get("data");

            log.info("Processing statistics message: category={}, action={}", category, action);

            processStatistics(category, action, data);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.STATISTICS_QUEUE, action, true
            );

        } catch (Exception e) {
            log.error("Error processing statistics message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.STATISTICS_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Statistics message processing took {} ms", duration);
        }
    }

    // 实现具体的业务逻辑 - 只保留真正被API使用的方法
    private void processApplicationCreate(Long applicationId) {
        log.info("Processing application creation: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());
                log.info("Application {} creation processed", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application creation: {}", applicationId, e);
        }
    }

    private void processApplicationSubmit(Long applicationId) {
        log.info("Processing application submit: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
                app.setSubmittedAt(LocalDateTime.now());
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());

                // 移除申请提交成功通知 - 自动审核会快速处理，不需要额外通知
                log.info("Application {} submitted successfully", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application submit: {}", applicationId, e);
        }
    }

    private void processApplicationReview(Long applicationId) {
        log.info("Processing application review: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());
                log.info("Application {} review processed", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application review: {}", applicationId, e);
        }
    }

    private void processApplicationApproval(Long applicationId) {
        log.info("Processing application approval: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setStatus(ApplicationStatus.APPROVED);
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());

                // 清除待审核数量缓存（所有审核员）
                evictAllReviewerCaches();

                userNotificationService.createNotification(
                    app.getUserId(),
                    "申请通过",
                    "恭喜！您的申请已被批准",
                    "APPLICATION_APPROVED"
                );
                log.info("Application {} approved", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application approval: {}", applicationId, e);
        }
    }

    private void processApplicationRejection(Long applicationId) {
        log.info("Processing application rejection: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setStatus(ApplicationStatus.REJECTED);
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());

                // 清除待审核数量缓存（所有审核员）
                evictAllReviewerCaches();

                userNotificationService.createNotification(
                    app.getUserId(),
                    "申请未通过",
                    "很遗憾，您的申请未能通过审核",
                    "APPLICATION_REJECTED"
                );
                log.info("Application {} rejected", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application rejection: {}", applicationId, e);
        }
    }

    /**
     * 清除所有审核员的待审核数量缓存
     */
    private void evictAllReviewerCaches() {
        try {
            // 清除所有待审核计数缓存（使用通配符模式）
            cacheService.evictCache("application:pending:count", "*");
            log.debug("Evicted all reviewer pending review caches");
        } catch (Exception e) {
            log.warn("Failed to evict reviewer caches: {}", e.getMessage());
        }
    }

    private void processApplicationUpdate(Long applicationId) {
        log.info("Processing application update: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);
                cacheService.evictCache("applications", applicationId.toString());
                cacheService.evictCache("applications", "all");
                log.info("Application {} updated", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application update: {}", applicationId, e);
        }
    }

    private void processApplicationExport(Long applicationId) {
        log.info("Processing application export: {}", applicationId);
        try {
            performanceMonitorService.recordBusinessMetrics("export_count", 1.0);
            log.info("Application {} export processed", applicationId);
        } catch (Exception e) {
            log.error("Failed to process application export: {}", applicationId, e);
        }
    }

    private void processActivityCreate(Long activityId) {
        log.info("Processing activity creation: {}", activityId);
        try {
            Optional<Activity> activityOpt = activityRepository.findById(activityId);
            if (activityOpt.isPresent()) {
                cacheService.evictAllActivities();
                performanceMonitorService.recordBusinessMetrics("activity_created", 1.0);
                log.info("Activity {} creation processed", activityId);
            }
        } catch (Exception e) {
            log.error("Failed to process activity creation: {}", activityId, e);
        }
    }

    private void processActivityUpdate(Long activityId) {
        log.info("Processing activity update: {}", activityId);
        try {
            Optional<Activity> activityOpt = activityRepository.findById(activityId);
            if (activityOpt.isPresent()) {
                cacheService.evictActivity(activityId);
                cacheService.evictAllActivities();
                performanceMonitorService.recordBusinessMetrics("activity_updated", 1.0);
                log.info("Activity {} update processed", activityId);
            }
        } catch (Exception e) {
            log.error("Failed to process activity update: {}", activityId, e);
        }
    }

    private void processActivityDelete(Long activityId) {
        log.info("Processing activity deletion: {}", activityId);
        try {
            cacheService.evictAllApplications();
            cacheService.evictAllActivities();
            performanceMonitorService.recordBusinessMetrics("activity_deleted", 1.0);
            log.info("Activity {} deletion processed", activityId);
        } catch (Exception e) {
            log.error("Failed to process activity deletion: {}", activityId, e);
        }
    }

    private void processActivityToggle(Long activityId) {
        log.info("Processing activity toggle: {}", activityId);
        try {
            Optional<Activity> activityOpt = activityRepository.findById(activityId);
            if (activityOpt.isPresent()) {
                cacheService.evictActivity(activityId);
                cacheService.evictAllActivities();
                performanceMonitorService.recordBusinessMetrics("activity_toggled", 1.0);
                log.info("Activity {} toggle processed", activityId);
            }
        } catch (Exception e) {
            log.error("Failed to process activity toggle: {}", activityId, e);
        }
    }

    private void processNotification(Long userId, String title, String content, String type) {
        log.info("Processing notification for user {}: {}", userId, title);
        try {
            // 使用同步方法直接创建通知（避免消息队列循环）
            userNotificationService.createNotificationSync(userId, title, content, type);
            performanceMonitorService.recordBusinessMetrics("notification_sent", 1.0);
            log.info("Notification created for user {}: {}", userId, title);
        } catch (Exception e) {
            log.error("Failed to create notification for user {}: {}", userId, title, e);
        }
    }

    private void processFileUpload(String fileName, String filePath) {
        log.info("Processing file upload: {} at path: {}", fileName, filePath);
        try {
            performanceMonitorService.recordBusinessMetrics("file_upload_completed", 1.0);
            log.info("File upload processed: {} -> {}", fileName, filePath);
        } catch (Exception e) {
            log.error("Failed to process file upload: {}", fileName, e);
        }
    }

    private void processVirusScan(String fileName, String filePath) {
        log.info("Processing virus scan: {} at path: {}", fileName, filePath);
        try {
            // 模拟病毒扫描
            Thread.sleep(1000);
            // 这里可以添加真实的病毒扫描逻辑
            boolean isSafe = performVirusScanCheck(filePath);
            performanceMonitorService.recordBusinessMetrics("virus_scan_completed", 1.0);
            if (isSafe) {
                performanceMonitorService.recordBusinessMetrics("virus_scan_clean", 1.0);
                log.info("Virus scan completed for file: {} - CLEAN", fileName);
            } else {
                performanceMonitorService.recordBusinessMetrics("virus_scan_threat", 1.0);
                log.warn("Virus scan completed for file: {} - THREAT DETECTED", fileName);
            }
        } catch (Exception e) {
            log.error("Failed to scan file: {}", fileName, e);
        }
    }

    private void processUserAuth(String userId, String action, String ip, String userAgent) {
        log.info("Processing user auth: userId={}, action={}, ip={}, userAgent={}", userId, action, ip, userAgent);
        try {
            switch (action) {
                case "LOGIN":
                    performanceMonitorService.recordBusinessMetrics("login_count", 1.0);
                    // 移除登录通知 - 不需要每次登录都发通知
                    log.debug("User {} logged in from IP {}", userId, ip);
                    break;
                case "LOGOUT":
                    performanceMonitorService.recordBusinessMetrics("logout_count", 1.0);
                    break;
                case "REFRESH_TOKEN":
                    performanceMonitorService.recordBusinessMetrics("token_refresh_count", 1.0);
                    break;
                case "LOGIN_FAILED":
                    performanceMonitorService.recordBusinessMetrics("login_failed_count", 1.0);
                    // 保留登录失败警告（安全相关）
                    userNotificationService.createNotificationByStudentId(
                        userId,
                        "登录失败警告",
                        String.format("检测到登录失败尝试，IP地址: %s，设备: %s", ip,
                            userAgent != null && userAgent.length() > 30 ?
                            userAgent.substring(0, 30) + "..." : userAgent),
                        "LOGIN_FAILED_WARNING"
                    );
                    break;
            }
            log.info("User auth processed: userId={}, action={}", userId, action);
        } catch (Exception e) {
            log.error("Failed to process user auth: {}", userId, e);
        }
    }

    private void processAuditLog(String userId, String action, String resourceType, String details) {
        log.info("Processing audit log: userId={}, action={}, resourceType={}", userId, action, resourceType);
        try {
            // 记录审计日志到数据库或文件系统
            performanceMonitorService.recordBusinessMetrics("audit_log_processed", 1.0);

            // 可以在这里添加具体的审计日志存储逻辑
            log.debug("Audit details: {}", details);

            log.info("Audit log processed: userId={}, action={}", userId, action);
        } catch (Exception e) {
            log.error("Failed to process audit log: {}", userId, e);
        }
    }

    private void processStatistics(String category, String action, Map<String, Object> data) {
        log.info("Processing statistics: category={}, action={}", category, action);
        try {
            // 处理统计数据
            performanceMonitorService.recordBusinessMetrics("statistics_processed", 1.0);

            // 可以在这里添加具体的统计数据处理逻辑
            if (data != null) {
                log.debug("Statistics data: {}", data);
                performanceMonitorService.recordBusinessMetrics(
                    String.format("stats_%s_%s", category.toLowerCase(), action.toLowerCase()), 1.0);
            }

            log.info("Statistics processed: category={}, action={}", category, action);
        } catch (Exception e) {
            log.error("Failed to process statistics: {}", category, e);
        }
    }

    /**
     * 模拟病毒扫描检查
     */
    private boolean performVirusScanCheck(String filePath) {
        // 这里可以集成真实的病毒扫描引擎
        // 目前返回随机结果进行测试
        return Math.random() > 0.01; // 99%的文件是安全的
    }
}

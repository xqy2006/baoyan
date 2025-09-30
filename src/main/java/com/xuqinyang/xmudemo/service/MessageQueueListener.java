package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.config.RabbitMQConfig;
import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * 消息队列监听器
 * 处理各种异步消息
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageQueueListener {

    private final ApplicationRepository applicationRepository;
    private final PerformanceMonitorService performanceMonitorService;
    private final CacheService cacheService;
    private final DistributedLockService distributedLockService;  // 新增分布式锁服务

    /**
     * 处理应用相关消息
     */
    @RabbitListener(queues = RabbitMQConfig.APPLICATION_PROCESS_QUEUE)
    @Async("messageTaskExecutor")
    public void handleApplicationProcessMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            Long applicationId = ((Number) message.get("applicationId")).longValue();
            String action = (String) message.get("action");

            log.info("Processing application message: applicationId={}, action={}", applicationId, action);

            // 根据action执行不同的处理逻辑
            switch (action) {
                case "CREATE":
                    processApplicationCreate(applicationId);
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
     * 处理文件相关消息
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

            // 根据action执行不同的文件处理逻辑
            switch (action) {
                case "UPLOAD":
                    processFileUpload(fileName, filePath);
                    break;
                case "COMPRESS":
                    processFileCompression(fileName, filePath);
                    break;
                case "CONVERT":
                    processFileConversion(fileName, filePath);
                    break;
                case "DELETE":
                    processFileDelete(fileName, filePath);
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
     * 处理通知消息
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

            // 处理通知逻辑
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
     * 处理邮件消息
     */
    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE)
    @Async("messageTaskExecutor")
    public void handleEmailMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String to = (String) message.get("to");
            String subject = (String) message.get("subject");
            String content = (String) message.get("content");

            log.info("Processing email message: to={}", to);

            // 处理邮件发送逻辑
            processEmailSending(to, subject, content);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.EMAIL_QUEUE, "send", true
            );

        } catch (Exception e) {
            log.error("Error processing email message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.EMAIL_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Email message processing took {} ms", duration);
        }
    }

    /**
     * 处理用户认证消息
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

            // 处理用户认证相关逻辑
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
     * 处理数据统计消息
     */
    @RabbitListener(queues = RabbitMQConfig.DATA_STATISTICS_QUEUE)
    @Async("messageTaskExecutor")
    public void handleDataStatisticsMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String type = (String) message.get("type");
            String operation = (String) message.get("operation");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) message.get("data");

            log.info("Processing data statistics message: type={}, operation={}", type, operation);

            // 处理数据统计逻辑
            processDataStatistics(type, operation, data);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.DATA_STATISTICS_QUEUE, operation, true
            );

        } catch (Exception e) {
            log.error("Error processing data statistics message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.DATA_STATISTICS_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Data statistics message processing took {} ms", duration);
        }
    }

    /**
     * 处理审计日志消息
     */
    @RabbitListener(queues = RabbitMQConfig.AUDIT_LOG_QUEUE)
    @Async("messageTaskExecutor")
    public void handleAuditLogMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            String userId = (String) message.get("userId");
            String action = (String) message.get("action");
            String resource = (String) message.get("resource");
            String details = (String) message.get("details");

            log.info("Processing audit log message: userId={}, action={}, resource={}", userId, action, resource);

            // 处理审计日志逻辑
            processAuditLog(userId, action, resource, details);

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
     * 处理系统自动审核消息
     */
    @RabbitListener(queues = RabbitMQConfig.SYSTEM_AUTO_REVIEW_QUEUE)
    @Async("autoReviewTaskExecutor")  // 使用专门的自动审核线程池
    public void handleSystemAutoReviewMessage(Map<String, Object> message) {
        long startTime = System.currentTimeMillis();
        try {
            Long applicationId = ((Number) message.get("applicationId")).longValue();
            String reviewType = (String) message.get("reviewType");
            String source = (String) message.get("source");

            log.info("Processing system auto review message: applicationId={}, reviewType={}, source={}",
                applicationId, reviewType, source);

            // 处理系统自动审核逻辑
            processSystemAutoReview(applicationId, reviewType);

            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.SYSTEM_AUTO_REVIEW_QUEUE, reviewType, true
            );

        } catch (Exception e) {
            log.error("Error processing system auto review message: {}", message, e);
            performanceMonitorService.recordMessageQueueMetrics(
                RabbitMQConfig.SYSTEM_AUTO_REVIEW_QUEUE, "error", false
            );
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("System auto review message processing took {} ms", duration);
        }
    }

    // 实现具体的业务逻辑
    private void processApplicationCreate(Long applicationId) {
        log.info("Processing application creation: {}", applicationId);
        try {
            // 更新申请状态为系统审核中
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setStatus(ApplicationStatus.SYSTEM_REVIEWING); // 修复：使用SYSTEM_REVIEWING而不是SUBMITTED
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);

                // 清理缓存
                cacheService.evictCache("applications", applicationId.toString());

                log.info("Application {} status updated to SYSTEM_REVIEWING", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application creation: {}", applicationId, e);
        }
    }

    private void processApplicationReview(Long applicationId) {
        log.info("Processing application review: {}", applicationId);
        try {
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);

                // 清理缓存
                cacheService.evictCache("applications", applicationId.toString());

                log.info("Application {} status updated to SYSTEM_REVIEWING", applicationId);
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

                // 清理缓存
                cacheService.evictCache("applications", applicationId.toString());

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

                // 清理缓存
                cacheService.evictCache("applications", applicationId.toString());

                log.info("Application {} rejected", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application rejection: {}", applicationId, e);
        }
    }

    private void processApplicationUpdate(Long applicationId) {
        log.info("Processing application update: {}", applicationId);
        try {
            // 清理相关缓存
            cacheService.evictCache("applications", applicationId.toString());
            cacheService.evictCache("applications", "all");

            // 记录更新时间
            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isPresent()) {
                Application app = appOpt.get();
                app.setLastUpdateDate(LocalDateTime.now());
                applicationRepository.save(app);

                log.info("Application {} updated", applicationId);
            }
        } catch (Exception e) {
            log.error("Failed to process application update: {}", applicationId, e);
        }
    }

    private void processApplicationExport(Long applicationId) {
        log.info("Processing application export: {}", applicationId);
        try {
            // 记录导出操作
            performanceMonitorService.recordBusinessMetrics("export_count", 1.0);
            log.info("Application {} export processed", applicationId);
        } catch (Exception e) {
            log.error("Failed to process application export: {}", applicationId, e);
        }
    }

    private void processFileUpload(String fileName, String filePath) {
        log.info("Processing file upload: {} at {}", fileName, filePath);
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                // 验证文件类型和大小
                long fileSize = Files.size(path);
                performanceMonitorService.recordBusinessMetrics("file_upload_size", fileSize);

                log.info("File upload processed: {} ({} bytes)", fileName, fileSize);
            }
        } catch (Exception e) {
            log.error("Failed to process file upload: {} at {}", fileName, filePath, e);
        }
    }

    private void processFileCompression(String fileName, String filePath) {
        log.info("Processing file compression: {} at {}", fileName, filePath);
        try {
            // 模拟文件压缩逻辑
            Thread.sleep(1000); // 模拟压缩时间
            log.info("File compression completed: {}", fileName);
        } catch (Exception e) {
            log.error("Failed to process file compression: {} at {}", fileName, filePath, e);
        }
    }

    private void processFileConversion(String fileName, String filePath) {
        log.info("Processing file conversion: {} at {}", fileName, filePath);
        try {
            // 模拟文件转换逻辑
            Thread.sleep(2000); // 模拟转换时间
            log.info("File conversion completed: {}", fileName);
        } catch (Exception e) {
            log.error("Failed to process file conversion: {} at {}", fileName, filePath, e);
        }
    }

    private void processFileDelete(String fileName, String filePath) {
        log.info("Processing file deletion: {} at {}", fileName, filePath);
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                Files.delete(path);
                log.info("File deleted: {}", fileName);
            }
        } catch (Exception e) {
            log.error("Failed to delete file: {} at {}", fileName, filePath, e);
        }
    }

    private void processVirusScan(String fileName, String filePath) {
        log.info("Processing virus scan: {} at {}", fileName, filePath);
        try {
            // 模拟病毒扫描
            Thread.sleep(3000);
            log.info("Virus scan completed for file: {}", fileName);
        } catch (Exception e) {
            log.error("Failed to scan file: {} at {}", fileName, filePath, e);
        }
    }

    private void processNotification(Long userId, String title, String content, String type) {
        log.info("Processing notification for user {}: {}", userId, title);
        try {
            // 实现通知发送逻辑
            // 这里可以集成推送服务、站内消息等
            performanceMonitorService.recordBusinessMetrics("notification_sent", 1.0);
            log.info("Notification sent to user {}: {}", userId, title);
        } catch (Exception e) {
            log.error("Failed to send notification to user {}: {}", userId, title, e);
        }
    }

    private void processEmailSending(String to, String subject, String content) {
        log.info("Processing email to {}: {}", to, subject);
        try {
            // 实现邮件发送逻辑
            // 这里可以集成邮件服务提供商
            performanceMonitorService.recordBusinessMetrics("email_sent", 1.0);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, subject, e);
        }
    }

    // 新增的业务逻辑处理方法
    private void processUserAuth(String userId, String action, String ip, String userAgent) {
        log.info("Processing user auth: userId={}, action={}, ip={}", userId, action, ip);
        try {
            switch (action) {
                case "LOGIN":
                    // 记录登录日志
                    performanceMonitorService.recordBusinessMetrics("login_count", 1.0);
                    // 可以在这里添加登录后的额外处理，如更新最后登录时间等
                    break;
                case "LOGOUT":
                    // 记录登出日志
                    performanceMonitorService.recordBusinessMetrics("logout_count", 1.0);
                    break;
                case "REFRESH_TOKEN":
                    // 记录token刷新
                    performanceMonitorService.recordBusinessMetrics("token_refresh_count", 1.0);
                    break;
                case "LOGIN_FAILED":
                    // 记录登录失败，可以用于安全监控
                    performanceMonitorService.recordBusinessMetrics("login_failed_count", 1.0);
                    break;
            }
            log.info("User auth processed: userId={}, action={}", userId, action);
        } catch (Exception e) {
            log.error("Failed to process user auth: userId={}, action={}", userId, action, e);
        }
    }

    private void processDataStatistics(String type, String operation, Map<String, Object> data) {
        log.info("Processing data statistics: type={}, operation={}", type, operation);
        try {
            switch (type) {
                case "APPLICATION":
                    // 处理申请相关统计
                    processApplicationStatistics(operation, data);
                    break;
                case "USER":
                    // 处理用户相关统计
                    processUserStatistics(operation, data);
                    break;
                case "ACTIVITY":
                    // 处理活动相关统计
                    processActivityStatistics(operation, data);
                    break;
                case "SYSTEM":
                    // 处理系统相关统计
                    processSystemStatistics(operation, data);
                    break;
            }
            log.info("Data statistics processed: type={}, operation={}", type, operation);
        } catch (Exception e) {
            log.error("Failed to process data statistics: type={}, operation={}", type, operation, e);
        }
    }

    private void processAuditLog(String userId, String action, String resource, String details) {
        log.info("Processing audit log: userId={}, action={}, resource={}", userId, action, resource);
        try {
            // 记录审计日志到数据库或日志文件
            // 这里可以实现具体的审计日志存储逻辑
            performanceMonitorService.recordBusinessMetrics("audit_log_count", 1.0);
            log.info("Audit log processed: userId={}, action={}, resource={}", userId, action, resource);
        } catch (Exception e) {
            log.error("Failed to process audit log: userId={}, action={}, resource={}", userId, action, resource, e);
        }
    }

    // 统计处理的辅助方法
    private void processApplicationStatistics(String operation, Map<String, Object> data) {
        switch (operation) {
            case "CREATE":
                performanceMonitorService.recordBusinessMetrics("application_created", 1.0);
                break;
            case "UPDATE":
                performanceMonitorService.recordBusinessMetrics("application_updated", 1.0);
                break;
            case "SUBMIT":
                performanceMonitorService.recordBusinessMetrics("application_submitted", 1.0);
                break;
            case "APPROVE":
                performanceMonitorService.recordBusinessMetrics("application_approved", 1.0);
                break;
            case "REJECT":
                performanceMonitorService.recordBusinessMetrics("application_rejected", 1.0);
                break;
        }
    }

    private void processUserStatistics(String operation, Map<String, Object> data) {
        switch (operation) {
            case "REGISTER":
                performanceMonitorService.recordBusinessMetrics("user_registered", 1.0);
                break;
            case "LOGIN":
                performanceMonitorService.recordBusinessMetrics("user_login", 1.0);
                break;
            case "PROFILE_UPDATE":
                performanceMonitorService.recordBusinessMetrics("user_profile_updated", 1.0);
                break;
        }
    }

    private void processActivityStatistics(String operation, Map<String, Object> data) {
        switch (operation) {
            case "VIEW":
                performanceMonitorService.recordBusinessMetrics("activity_viewed", 1.0);
                break;
            case "CREATE":
                performanceMonitorService.recordBusinessMetrics("activity_created", 1.0);
                break;
            case "UPDATE":
                performanceMonitorService.recordBusinessMetrics("activity_updated", 1.0);
                break;
        }
    }

    private void processSystemStatistics(String operation, Map<String, Object> data) {
        switch (operation) {
            case "API_CALL":
                performanceMonitorService.recordBusinessMetrics("api_call_count", 1.0);
                break;
            case "ERROR":
                performanceMonitorService.recordBusinessMetrics("system_error_count", 1.0);
                break;
            case "CACHE_HIT":
                performanceMonitorService.recordBusinessMetrics("cache_hit_count", 1.0);
                break;
            case "CACHE_MISS":
                performanceMonitorService.recordBusinessMetrics("cache_miss_count", 1.0);
                break;
        }
    }

    /**
     * 处理系统自动审核逻辑
     */
    private void processSystemAutoReview(Long applicationId, String reviewType) {
        String lockKey = "systemReview:" + applicationId;

        distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            log.info("Starting system auto review for application: {}, type: {}", applicationId, reviewType);

            Optional<Application> appOpt = applicationRepository.findById(applicationId);
            if (appOpt.isEmpty()) {
                log.warn("Application not found: {}", applicationId);
                return null;
            }

            Application app = appOpt.get();

            // 检查状态是否为SYSTEM_REVIEWING
            if (app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                log.warn("Application {} is not in SYSTEM_REVIEWING status, current: {}",
                    applicationId, app.getStatus());
                return null;
            }

            try {
                // 执行自动审核逻辑
                boolean reviewPassed = performSystemReview(app, reviewType);

                if (reviewPassed) {
                    app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
                    app.setSystemReviewComment("系统自动审核通过 - " + reviewType);
                    log.info("System auto review PASSED for application: {}", applicationId);
                } else {
                    app.setStatus(ApplicationStatus.SYSTEM_REJECTED);
                    app.setSystemReviewComment("系统自动审核未通过 - " + reviewType + " - 不符合自动通过条件");
                    log.info("System auto review REJECTED for application: {}", applicationId);
                }

                app.setSystemReviewedAt(LocalDateTime.now());
                applicationRepository.save(app);

                // 清理缓存
                cacheService.evictCache("applications", applicationId.toString());

                // 记录审核指标
                performanceMonitorService.recordBusinessMetrics(
                    "system_review_" + (reviewPassed ? "approved" : "rejected"), 1.0);

                log.info("System auto review completed for application: {}, result: {}",
                    applicationId, reviewPassed ? "APPROVED" : "REJECTED");

            } catch (Exception e) {
                log.error("Error during system auto review for application: {}", applicationId, e);
                // 审核失败，保持SYSTEM_REVIEWING状态，等待后续重试或人工介入
            }

            return null;
        }, 5);
    }

    /**
     * 执行具体的系统审核逻辑
     */
    private boolean performSystemReview(Application app, String reviewType) {
        try {
            // 重新计算分数
            recalculateApplicationScores(app);

            switch (reviewType) {
                case "STANDARD":
                    return performStandardReview(app);
                case "FAST_TRACK":
                    return performFastTrackReview(app);
                case "ACADEMIC_EXCELLENCE":
                    return performAcademicExcellenceReview(app);
                default:
                    log.warn("Unknown review type: {}, using standard review", reviewType);
                    return performStandardReview(app);
            }
        } catch (Exception e) {
            log.error("Error in system review logic for application: {}", app.getId(), e);
            return false;
        }
    }

    /**
     * 标准审核逻辑
     */
    private boolean performStandardReview(Application app) {
        Double academicScore = app.getAcademicScore();
        if (academicScore == null) return false;

        // 学业成绩需要达到48分（满分80）
        return academicScore >= 48.0;
    }

    /**
     * 快速通道审核（对于特别优秀的申请）
     */
    private boolean performFastTrackReview(Application app) {
        Double academicScore = app.getAcademicScore();
        Double achievementScore = app.getAchievementScore();

        if (academicScore == null || achievementScore == null) return false;

        // 学业成绩70分以上且学术成就10分以上可快速通过
        return academicScore >= 70.0 && achievementScore >= 10.0;
    }

    /**
     * 学术卓越审核（对于学术成就突出的申请）
     */
    private boolean performAcademicExcellenceReview(Application app) {
        Double achievementScore = app.getAchievementScore();
        if (achievementScore == null) return false;

        // 学术成就达到12分以上可直接通过（针对有重大学术成果的学生）
        return achievementScore >= 12.0;
    }

    /**
     * 重新计算申请分数（简化版本，实际应该调用ApplicationService的方法）
     */
    private void recalculateApplicationScores(Application app) {
        try {
            // 这里应该调用ApplicationService的recalcScores方法
            // 为了避免循环依赖，这里做简化处理
            if (app.getAcademicScore() == null) {
                // 设置默认分数，实际应该根据GPA、排名等计算
                app.setAcademicScore(60.0); // 默认60分
            }
            if (app.getAchievementScore() == null) {
                app.setAchievementScore(5.0); // 默认5分
            }
            if (app.getPerformanceScore() == null) {
                app.setPerformanceScore(3.0); // 默认3分
            }

            Double total = (app.getAcademicScore() != null ? app.getAcademicScore() : 0) +
                          (app.getAchievementScore() != null ? app.getAchievementScore() : 0) +
                          (app.getPerformanceScore() != null ? app.getPerformanceScore() : 0);
            app.setTotalScore(total);

        } catch (Exception e) {
            log.error("Error recalculating scores for application: {}", app.getId(), e);
        }
    }
}

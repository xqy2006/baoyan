package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 系统自动审核调度服务
 * 定期扫描SYSTEM_REVIEWING状态的申请并进行自动审核
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemAutoReviewScheduler {

    private final ApplicationRepository applicationRepository;
    private final DistributedLockService distributedLockService;

    /**
     * 每15秒执行一次系统自动审核
     */
    @Scheduled(fixedRate = 15000) // 15秒
    public void scheduleSystemReviews() {
        String lockKey = "systemReview:scheduler";

        try {
            if (distributedLockService.tryLock(lockKey, 50, java.util.concurrent.TimeUnit.SECONDS)) {
                try {
                    processSystemReviews();
                } finally {
                    distributedLockService.unlock(lockKey);
                }
            } else {
                log.debug("System review scheduler already running on another instance");
            }
        } catch (Exception e) {
            log.error("Error in system review scheduler", e);
        }
    }

    /**
     * 处理系统审核
     */
    private void processSystemReviews() {
        log.info("Starting system auto review processing");

        // 查找所有待系统审核的申请，按提交时间排序
        List<Application> pendingReviews = applicationRepository.findByStatusOrderByLastUpdateDateAsc(ApplicationStatus.SYSTEM_REVIEWING);

        if (pendingReviews.isEmpty()) {
            log.debug("No applications pending system review");
            return;
        }

        log.info("Found {} applications pending system review", pendingReviews.size());

        // 逐个处理申请
        int processedCount = 0;
        for (Application application : pendingReviews) {
            try {
                if (processApplication(application)) {
                    processedCount++;
                }
            } catch (Exception e) {
                log.error("Error processing application {} for auto review", application.getId(), e);
            }
        }

        log.info("System auto review completed, processed {} applications", processedCount);
    }

    /**
     * 处理单个申请
     */
    private boolean processApplication(Application application) {
        // 检查申请是否超过一定时间未处理（避免重复处理刚提交的申请）
        LocalDateTime submitTime = application.getSubmittedAt();
        if (submitTime != null && submitTime.plusMinutes(1).isAfter(LocalDateTime.now())) {
            log.debug("Application {} submitted too recently, skipping", application.getId());
            return false;
        }

        String lockKey = "systemReview:process:" + application.getId();

        try {
            // 使用默认重试策略（10次），移除硬编码的3次
            return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
                // 重新查询申请状态（防止并发修改）
                Application app = applicationRepository.findById(application.getId()).orElse(null);
                if (app == null) {
                    log.warn("Application {} not found during processing", application.getId());
                    return false;
                }

                if (app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                    log.debug("Application {} status changed to {}, skipping", app.getId(), app.getStatus());
                    return false;
                }

                // 执行自动审核 - 修改为跳转到人工审核
                performAutoReview(app);
                return true;
            });
        } catch (RuntimeException e) {
            // 高并发时可能无法获取锁，这是正常的，不应该算作错误
            if (e.getMessage() != null && e.getMessage().contains("Unable to acquire lock")) {
                log.debug("Could not acquire lock for application {} due to high concurrency, will retry in next cycle", application.getId());
                return false;
            }
            // 其他异常继续抛出
            throw e;
        }
    }

    /**
     * 执行自动审核逻辑 - 系统预审核通过后进入人工审核阶段
     */
    @Transactional
    public void performAutoReview(Application application) {  // 改为public方法使@Transactional生效
        log.info("Processing system pre-review for application: {}", application.getId());

        try {
            // 修复：系统审核通过后应该进入人工审核阶段，而不是直接通过
            application.setStatus(ApplicationStatus.ADMIN_REVIEWING);
            application.setSystemReviewComment("系统预审核通过，等待人工审核");
            application.setSystemReviewedAt(LocalDateTime.now());

            applicationRepository.save(application);

            log.info("Application {} passed system pre-review, moved to manual review queue", application.getId());

        } catch (Exception e) {
            log.error("Error during system pre-review for application: {}", application.getId(), e);
            // 审核失败时保持原状态，等待下次处理或人工介入
        }
    }

    /**
     * 手动触发系统审核（用于测试或紧急情况）
     */
    public void triggerManualReview() {
        log.info("Manual system review triggered");
        processSystemReviews();
    }

    /**
     * 为特定申请触发审核
     */
    public void triggerReviewForApplication(Long applicationId) {
        distributedLockService.executeWithLockAndRetry("systemReview:manual:" + applicationId, () -> {
            Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("申请不存在"));

            if (application.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                throw new IllegalStateException("申请状态不是系统审核中");
            }

            performAutoReview(application);
            log.info("Manual review completed for application {}", applicationId);
            return null;
        }, 3);
    }
}

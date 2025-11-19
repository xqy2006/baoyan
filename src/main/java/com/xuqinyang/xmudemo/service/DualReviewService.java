package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 双审核员审核服务
 * 实现两位不同审核员顺序审核的逻辑
 */
@Service
public class DualReviewService {

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DistributedLockService distributedLockService;

    @Autowired
    private CacheService cacheService;

    /**
     * 系统审核通过后，进入第一审核员待审核状态
     */
    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application systemReviewApproved(Long id, String comment, double academicScore) {
        return distributedLockService.executeWithLockAndRetry("application:systemReview:" + id, () -> {
            Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("申请不存在"));

            if (app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                throw new IllegalStateException("当前状态不允许系统审核");
            }

            // 系统审核通过，进入第一审核员待审核状态
            app.setStatus(ApplicationStatus.FIRST_REVIEW_PENDING);
            app.setSystemReviewedAt(LocalDateTime.now());
            app.setSystemReviewComment(comment);

            return applicationRepository.save(app);
        }, 5);
    }

    /**
     * 第一审核员审核
     */
    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application firstReview(Long id, boolean approve, String comment) {
        return distributedLockService.executeWithLockAndRetry("application:firstReview:" + id, () -> {
            Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("申请不存在"));

            // 验证状态
            if (app.getStatus() != ApplicationStatus.FIRST_REVIEW_PENDING) {
                throw new IllegalStateException("当前状态不允许第一审核");
            }

            // 获取当前审核员信息
            User currentReviewer = getCurrentUser();

            // 拒绝操作必须填写理由
            if (!approve && (comment == null || comment.isBlank())) {
                throw new IllegalStateException("拒绝操作必须填写审核意见");
            }

            // 设置第一审核员信息
            app.setFirstReviewer(currentReviewer);
            app.setFirstReviewerName(currentReviewer.getName() != null ? currentReviewer.getName() : currentReviewer.getStudentId());
            app.setFirstReviewedAt(LocalDateTime.now());
            app.setFirstReviewComment(comment);

            if (approve) {
                // 第一审核员通过，进入第二审核员待审核状态
                app.setStatus(ApplicationStatus.SECOND_REVIEW_PENDING);
            } else {
                // 第一审核员拒绝，申请最终被拒绝
                app.setStatus(ApplicationStatus.FIRST_REVIEW_REJECTED);
            }

            Application saved = applicationRepository.save(app);

            // 清除缓存
            cacheService.evictCache("applications", id.toString());
            cacheService.evictAllApplications();

            return saved;
        }, 5);
    }

    /**
     * 第二审核员审核
     */
    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application secondReview(Long id, boolean approve, String comment) {
        return distributedLockService.executeWithLockAndRetry("application:secondReview:" + id, () -> {
            Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("申请不存在"));

            // 验证状态
            if (app.getStatus() != ApplicationStatus.SECOND_REVIEW_PENDING) {
                throw new IllegalStateException("当前状态不允许第二审核");
            }

            // 获取当前审核员信息
            User currentReviewer = getCurrentUser();

            // 验证不能是同一个审核员
            if (app.getFirstReviewer() != null &&
                app.getFirstReviewer().getId().equals(currentReviewer.getId())) {
                throw new IllegalStateException("不能由同一审核员进行两次审核");
            }

            // 拒绝操作必须填写理由
            if (!approve && (comment == null || comment.isBlank())) {
                throw new IllegalStateException("拒绝操作必须填写审核意见");
            }

            // 设置第二审核员信息
            app.setSecondReviewer(currentReviewer);
            app.setSecondReviewerName(currentReviewer.getName() != null ? currentReviewer.getName() : currentReviewer.getStudentId());
            app.setSecondReviewedAt(LocalDateTime.now());
            app.setSecondReviewComment(comment);

            if (approve) {
                // 第二审核员通过，申请最终通过
                app.setStatus(ApplicationStatus.APPROVED);
            } else {
                // 第二审核员拒绝，申请最终被拒绝
                app.setStatus(ApplicationStatus.REJECTED);
            }

            Application saved = applicationRepository.save(app);

            // 清除缓存
            cacheService.evictCache("applications", id.toString());
            cacheService.evictAllApplications();

            return saved;
        }, 5);
    }

    /**
     * 获取当前登录的用户
     */
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String studentId = auth.getName();
        return userRepository.findByStudentId(studentId)
            .orElseThrow(() -> new IllegalStateException("当前用户不存在"));
    }

    /**
     * 判断当前用户是否可以对该申请进行审核
     * @param app 申请
     * @param reviewStage 审核阶段：1-第一审核，2-第二审核
     * @return 是否可以审核
     */
    public boolean canReview(Application app, int reviewStage) {
        try {
            User currentUser = getCurrentUser();

            if (reviewStage == 1) {
                // 第一审核阶段：任何审核员都可以审核
                return app.getStatus() == ApplicationStatus.FIRST_REVIEW_PENDING;
            } else if (reviewStage == 2) {
                // 第二审核阶段：不能是第一审核员
                if (app.getStatus() != ApplicationStatus.SECOND_REVIEW_PENDING) {
                    return false;
                }
                if (app.getFirstReviewer() != null &&
                    app.getFirstReviewer().getId().equals(currentUser.getId())) {
                    return false;
                }
                return true;
            }

            return false;
        } catch (Exception e) {
            return false;
        }
    }
}


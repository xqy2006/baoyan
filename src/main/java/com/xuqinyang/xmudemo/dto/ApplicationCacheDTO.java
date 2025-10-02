package com.xuqinyang.xmudemo.dto;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Application缓存DTO - 避免Hibernate代理序列化问题
 */
@Data
public class ApplicationCacheDTO {
    private Long id;
    private String content;
    private ApplicationStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime lastUpdateDate;
    private LocalDateTime submittedAt;
    private LocalDateTime systemReviewedAt;
    private LocalDateTime adminReviewedAt;
    private String systemReviewComment;
    private String adminReviewComment;
    private Double academicScore;
    private Double achievementScore;
    private Double performanceScore;
    private Double totalScore;
    private Long version;

    // 关联对象的基本信息，避免序列化完整的关联对象
    private Long userId;
    private String userStudentId;
    private String userName;
    private Long activityId;
    private String activityName;

    /**
     * 从Application实体转换为DTO
     */
    public static ApplicationCacheDTO fromEntity(Application app) {
        ApplicationCacheDTO dto = new ApplicationCacheDTO();
        dto.setId(app.getId());
        dto.setContent(app.getContent());
        dto.setStatus(app.getStatus());
        dto.setCreatedAt(app.getCreatedAt());
        dto.setLastUpdateDate(app.getLastUpdateDate());
        dto.setSubmittedAt(app.getSubmittedAt());
        dto.setSystemReviewedAt(app.getSystemReviewedAt());
        dto.setAdminReviewedAt(app.getAdminReviewedAt());
        dto.setSystemReviewComment(app.getSystemReviewComment());
        dto.setAdminReviewComment(app.getAdminReviewComment());
        dto.setAcademicScore(app.getAcademicScore());
        dto.setAchievementScore(app.getAchievementScore());
        dto.setPerformanceScore(app.getPerformanceScore());
        dto.setTotalScore(app.getTotalScore());
        dto.setVersion(app.getVersion());

        // 安全地获取关联对象信息
        try {
            if (app.getUser() != null) {
                dto.setUserId(app.getUser().getId());
                dto.setUserStudentId(app.getUser().getStudentId());
                dto.setUserName(app.getUser().getName());
            }
        } catch (Exception e) {
            // 如果懒加载失败，只记录警告，不抛出异常
            System.err.println("Warning: Failed to load user info for caching: " + e.getMessage());
        }

        try {
            if (app.getActivity() != null) {
                dto.setActivityId(app.getActivity().getId());
                dto.setActivityName(app.getActivity().getName());
            }
        } catch (Exception e) {
            // 如果懒加载失败，只记录警告，不抛出异常
            System.err.println("Warning: Failed to load activity info for caching: " + e.getMessage());
        }

        return dto;
    }

    /**
     * 转换为Application实体（仅用于展示，不包含完整关联对象）
     */
    public Application toEntity() {
        Application app = new Application();
        app.setId(this.id);
        app.setContent(this.content);
        app.setStatus(this.status);
        app.setLastUpdateDate(this.lastUpdateDate);
        app.setSubmittedAt(this.submittedAt);
        app.setSystemReviewedAt(this.systemReviewedAt);
        app.setAdminReviewedAt(this.adminReviewedAt);
        app.setSystemReviewComment(this.systemReviewComment);
        app.setAdminReviewComment(this.adminReviewComment);
        app.setAcademicScore(this.academicScore);
        app.setAchievementScore(this.achievementScore);
        app.setPerformanceScore(this.performanceScore);
        app.setTotalScore(this.totalScore);
        app.setVersion(this.version);

        // 创建包含基本信息的User对象，避免懒加载问题
        if (this.userId != null || this.userStudentId != null || this.userName != null) {
            com.xuqinyang.xmudemo.model.User user = new com.xuqinyang.xmudemo.model.User();
            if (this.userId != null) user.setId(this.userId);
            if (this.userStudentId != null) user.setStudentId(this.userStudentId);
            if (this.userName != null) user.setName(this.userName);
            app.setUser(user);
        }

        // 创建包含基本信息的Activity对象，避免懒加载问题
        if (this.activityId != null || this.activityName != null) {
            com.xuqinyang.xmudemo.model.Activity activity = new com.xuqinyang.xmudemo.model.Activity();
            if (this.activityId != null) activity.setId(this.activityId);
            if (this.activityName != null) activity.setName(this.activityName);
            app.setActivity(activity);
        }

        // 注意：createdAt字段是实体的创建时间，不应该手动设置
        // 但为了保持数据一致性，我们需要反射设置这个值
        try {
            java.lang.reflect.Field createdAtField = com.xuqinyang.xmudemo.model.Application.class.getDeclaredField("createdAt");
            createdAtField.setAccessible(true);
            createdAtField.set(app, this.createdAt);
        } catch (Exception e) {
            // 忽略反射异常，使用默认值
        }

        return app;
    }
}

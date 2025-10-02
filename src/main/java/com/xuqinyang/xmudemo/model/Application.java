package com.xuqinyang.xmudemo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "application", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","activity_id"}))
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    @JsonIgnore
    private Activity activity;

    @Lob
    private String content; // JSON snapshot of form data

    @Enumerated(EnumType.STRING)
    @Column(length = 40) // ensure enough space for longest enum value
    private ApplicationStatus status = ApplicationStatus.DRAFT;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime lastUpdateDate = LocalDateTime.now();
    private LocalDateTime submittedAt;
    private LocalDateTime systemReviewedAt;
    private LocalDateTime adminReviewedAt;

    @Column(length = 1000)
    private String systemReviewComment;
    @Column(length = 1000)
    private String adminReviewComment;

    // Scoring fields (simple placeholders)
    private Double academicScore;
    private Double achievementScore;
    private Double performanceScore;
    private Double totalScore;

    @Version
    private Long version; // 乐观锁版本号

    @PreUpdate
    public void preUpdate() { this.lastUpdateDate = LocalDateTime.now(); }

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Activity getActivity() { return activity; }
    public void setActivity(Activity activity) { this.activity = activity; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public ApplicationStatus getStatus() { return status; }
    public void setStatus(ApplicationStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getLastUpdateDate() { return lastUpdateDate; }
    public void setLastUpdateDate(LocalDateTime lastUpdateDate) { this.lastUpdateDate = lastUpdateDate; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getSystemReviewedAt() { return systemReviewedAt; }
    public void setSystemReviewedAt(LocalDateTime systemReviewedAt) { this.systemReviewedAt = systemReviewedAt; }
    public LocalDateTime getAdminReviewedAt() { return adminReviewedAt; }
    public void setAdminReviewedAt(LocalDateTime adminReviewedAt) { this.adminReviewedAt = adminReviewedAt; }
    public String getSystemReviewComment() { return systemReviewComment; }
    public void setSystemReviewComment(String systemReviewComment) { this.systemReviewComment = systemReviewComment; }
    public String getAdminReviewComment() { return adminReviewComment; }
    public void setAdminReviewComment(String adminReviewComment) { this.adminReviewComment = adminReviewComment; }
    public Double getAcademicScore() { return academicScore; }
    public void setAcademicScore(Double academicScore) { this.academicScore = academicScore; }
    public Double getAchievementScore() { return achievementScore; }
    public void setAchievementScore(Double achievementScore) { this.achievementScore = achievementScore; }
    public Double getPerformanceScore() { return performanceScore; }
    public void setPerformanceScore(Double performanceScore) { this.performanceScore = performanceScore; }
    public Double getTotalScore() { return totalScore; }
    public void setTotalScore(Double totalScore) { this.totalScore = totalScore; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    // 辅助方法
    public String getActivityName() {
        return activity != null ? activity.getName() : null;
    }

    // Additional convenience methods for accessing related entity data
    public Long getUserId() {
        return user != null ? user.getId() : null;
    }

    public String getUserStudentId() {
        return user != null ? user.getStudentId() : null;
    }

    public String getUserName() {
        return user != null ? user.getName() : null;
    }

    public Long getActivityId() {
        return activity != null ? activity.getId() : null;
    }
}

package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.UserNotification;
import com.xuqinyang.xmudemo.repository.UserNotificationRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 用户通知服务
 * 负责创建、获取和管理用户通知
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationService {

    private final UserNotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /**
     * 创建用户通知
     */
    public void createNotification(Long userId, String title, String content, String type) {
        try {
            // 验证用户是否存在
            if (!userRepository.existsById(userId)) {
                log.warn("Attempted to create notification for non-existent user: {}", userId);
                return;
            }

            UserNotification notification = new UserNotification();
            notification.setUserId(userId);
            notification.setTitle(title);
            notification.setContent(content);
            notification.setType(type);
            notification.setIsRead(false);

            notificationRepository.save(notification);
            log.info("Created notification for user {}: {}", userId, title);

        } catch (Exception e) {
            log.error("Failed to create notification for user {}: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * 通过学号创建通知
     */
    public void createNotificationByStudentId(String studentId, String title, String content, String type) {
        try {
            userRepository.findByStudentId(studentId).ifPresentOrElse(
                user -> createNotification(user.getId(), title, content, type),
                () -> log.warn("User not found for studentId: {}", studentId)
            );
        } catch (Exception e) {
            log.error("Failed to create notification for studentId {}: {}", studentId, e.getMessage(), e);
        }
    }

    /**
     * 获取用户未读通知
     */
    public List<Map<String, Object>> getUnreadNotifications(Long userId) {
        try {
            List<UserNotification> notifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);

            return notifications.stream()
                .map(this::convertToMap)
                .toList();

        } catch (Exception e) {
            log.error("Failed to get unread notifications for user {}: {}", userId, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * 获取用户未读通知并标记为已读（消费通知）
     */
    @Transactional
    public List<Map<String, Object>> consumeNotifications(Long userId) {
        try {
            // 先获取未读通知
            List<UserNotification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);

            if (unreadNotifications.isEmpty()) {
                return List.of();
            }

            // 转换为返回格式
            List<Map<String, Object>> result = unreadNotifications.stream()
                .map(this::convertToMap)
                .toList();

            // 标记所有未读通知为已读
            int markedCount = notificationRepository.markAllAsReadByUserId(userId);

            // 异步删除已读通知（保持数据库清洁）
            try {
                int deletedCount = notificationRepository.deleteReadNotificationsByUserId(userId);
                log.info("Consumed {} notifications for user {}, deleted {} old notifications",
                    markedCount, userId, deletedCount);
            } catch (Exception e) {
                log.warn("Failed to delete old notifications for user {}: {}", userId, e.getMessage());
            }

            return result;

        } catch (Exception e) {
            log.error("Failed to consume notifications for user {}: {}", userId, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * 获取用户未读通知数量
     */
    public long getUnreadCount(Long userId) {
        try {
            return notificationRepository.countByUserIdAndIsReadFalse(userId);
        } catch (Exception e) {
            log.error("Failed to get unread count for user {}: {}", userId, e.getMessage(), e);
            return 0;
        }
    }

    /**
     * 通过学号获取并消费通知
     */
    @Transactional
    public List<Map<String, Object>> consumeNotificationsByStudentId(String studentId) {
        try {
            return userRepository.findByStudentId(studentId)
                .map(user -> consumeNotifications(user.getId()))
                .orElse(List.of());
        } catch (Exception e) {
            log.error("Failed to consume notifications for studentId {}: {}", studentId, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * 通过学号获取未读通知数量
     */
    public long getUnreadCountByStudentId(String studentId) {
        try {
            return userRepository.findByStudentId(studentId)
                .map(user -> getUnreadCount(user.getId()))
                .orElse(0L);
        } catch (Exception e) {
            log.error("Failed to get unread count for studentId {}: {}", studentId, e.getMessage(), e);
            return 0;
        }
    }

    /**
     * 通过学号获取用户ID
     */
    public Long getUserIdByStudentId(String studentId) {
        try {
            return userRepository.findByStudentId(studentId)
                .map(user -> user.getId())
                .orElse(null);
        } catch (Exception e) {
            log.error("Failed to get userId for studentId {}: {}", studentId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * 创建系统通知（给所有管理员）
     */
    public void createSystemNotification(String title, String content, String type) {
        try {
            // 这里可以扩展为给所有管理员发送通知
            // 暂时简化为给ID为1的管理员发送
            createNotification(1L, "[系统通知] " + title, content, "SYSTEM_" + type);

        } catch (Exception e) {
            log.error("Failed to create system notification: {}", e.getMessage(), e);
        }
    }

    /**
     * 转换通知为Map格式
     */
    private Map<String, Object> convertToMap(UserNotification notification) {
        return Map.of(
            "id", notification.getId(),
            "title", notification.getTitle(),
            "content", notification.getContent() != null ? notification.getContent() : "",
            "type", notification.getType() != null ? notification.getType() : "",
            "createdAt", notification.getCreatedAt(),
            "isRead", notification.getIsRead()
        );
    }
}

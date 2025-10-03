package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.UserNotification;
import com.xuqinyang.xmudemo.repository.UserNotificationRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.dto.NotificationCacheDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 用户通知服务
 * 负责创建、获取和管理用户通知
 * 使用Redis缓存 + 消息队列优化高并发性能
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationService {

    private final UserNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final CacheService cacheService;
    private final MessageQueueService messageQueueService; // 新增：消息队列服务

    // 缓存键前缀
    private static final String NOTIFICATION_CACHE_PREFIX = "notification:";

    // 缓存过期时间
    private static final int CACHE_EXPIRE_SECONDS = 30; // 30秒缓存

    /**
     * 创建用户通知 - 异步方式（通过消息队列）
     * 高并发场景下推荐使用此方法
     */
    public void createNotificationAsync(Long userId, String title, String content, String type) {
        try {
            // 通过消息队列异步创建通知
            messageQueueService.sendNotificationMessage(userId, title, content, type);
            log.debug("Queued notification for user {}: {}", userId, title);
        } catch (Exception e) {
            log.error("Failed to queue notification for user {}: {}", userId, e.getMessage(), e);
            // 降级：如果消息队列失败，直接同步创建
            createNotificationSync(userId, title, content, type);
        }
    }

    /**
     * 创建用户通知 - 同步方式（直接写入数据库）
     * 由消息队列监听器调用，或作为降级方案
     */
    public void createNotificationSync(Long userId, String title, String content, String type) {
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

            // 清除相关缓存
            evictNotificationCache(userId);

            log.info("Created notification for user {}: {}", userId, title);

        } catch (Exception e) {
            log.error("Failed to create notification for user {}: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * 创建用户通知 - 兼容旧接口（默认使用异步方式）
     */
    public void createNotification(Long userId, String title, String content, String type) {
        createNotificationAsync(userId, title, content, type);
    }

    /**
     * 通过学号创建通知 - 异步方式
     */
    public void createNotificationByStudentId(String studentId, String title, String content, String type) {
        try {
            userRepository.findByStudentId(studentId).ifPresentOrElse(
                user -> createNotificationAsync(user.getId(), title, content, type),
                () -> log.warn("User not found for studentId: {}", studentId)
            );
        } catch (Exception e) {
            log.error("Failed to create notification for studentId {}: {}", studentId, e.getMessage(), e);
        }
    }

    /**
     * 获取用户未读通知（带缓存）
     */
    public List<Map<String, Object>> getUnreadNotifications(Long userId) {
        try {
            // 尝试从缓存获取
            String cacheKey = "unread_list_" + userId;
            Object cached = cacheService.getActivitiesListFromCache(cacheKey);
            if (cached instanceof List<?>) {
                @SuppressWarnings("unchecked")
                List<NotificationCacheDTO> dtoList = (List<NotificationCacheDTO>) cached;
                log.debug("Cache hit for unread notifications: userId={}", userId);
                return dtoList.stream()
                    .map(NotificationCacheDTO::toMap)
                    .collect(Collectors.toList());
            }

            // 缓存未命中，查询数据库
            List<UserNotification> notifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);

            // 转换为DTO并缓存
            List<NotificationCacheDTO> dtoList = notifications.stream()
                .map(NotificationCacheDTO::fromEntity)
                .collect(Collectors.toList());

            // 存入缓存
            cacheService.putActivitiesListToCache(cacheKey, dtoList, CACHE_EXPIRE_SECONDS, TimeUnit.SECONDS);

            // 返回Map格式
            return dtoList.stream()
                .map(NotificationCacheDTO::toMap)
                .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("Failed to get unread notifications for user {}: {}", userId, e.getMessage(), e);
            return new ArrayList<>();
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
                return new ArrayList<>();
            }

            // 转换为返回格式
            List<Map<String, Object>> result = unreadNotifications.stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());

            // 标记所有未读通知为已读
            int markedCount = notificationRepository.markAllAsReadByUserId(userId);

            // 清除缓存
            evictNotificationCache(userId);

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
            return new ArrayList<>();
        }
    }

    /**
     * 获取用户未读通知数量（带缓存）
     */
    public long getUnreadCount(Long userId) {
        try {
            // 尝试从缓存获取
            String cacheKey = "unread_count_" + userId;
            Object cached = cacheService.getStats(cacheKey);
            if (cached instanceof Number) {
                long count = ((Number) cached).longValue();
                log.debug("Cache hit for unread count: userId={}, count={}", userId, count);
                return count;
            }

            // 缓存未命中，查询数据库
            long count = notificationRepository.countByUserIdAndIsReadFalse(userId);

            // 存入缓存
            cacheService.cacheStats(cacheKey, count, CACHE_EXPIRE_SECONDS, TimeUnit.SECONDS);

            return count;
        } catch (Exception e) {
            log.error("Failed to get unread count for user {}: {}", userId, e.getMessage(), e);
            return 0;
        }
    }

    /**
     * 获取审核员待处理的申请数量（新增功能）
     */
    public long getPendingReviewCount(Long reviewerId) {
        try {
            // 尝试从缓存获取
            String cacheKey = "pending_review_count_" + reviewerId;
            Object cached = cacheService.getStats(cacheKey);
            if (cached instanceof Number) {
                long count = ((Number) cached).longValue();
                log.debug("Cache hit for pending review count: reviewerId={}, count={}", reviewerId, count);
                return count;
            }

            // 缓存未命中，查询数据库 - 查询所有待审核状态的申请
            long count = applicationRepository.countByStatus(ApplicationStatus.ADMIN_REVIEWING);

            // 存入缓存
            cacheService.cacheStats(cacheKey, count, CACHE_EXPIRE_SECONDS, TimeUnit.SECONDS);

            return count;
        } catch (Exception e) {
            log.error("Failed to get pending review count for reviewer {}: {}", reviewerId, e.getMessage(), e);
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
                .orElse(new ArrayList<>());
        } catch (Exception e) {
            log.error("Failed to consume notifications for studentId {}: {}", studentId, e.getMessage(), e);
            return new ArrayList<>();
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
     * 通过学号获取待审核数量（新增功能）
     */
    public long getPendingReviewCountByStudentId(String studentId) {
        try {
            return userRepository.findByStudentId(studentId)
                .map(user -> getPendingReviewCount(user.getId()))
                .orElse(0L);
        } catch (Exception e) {
            log.error("Failed to get pending review count for studentId {}: {}", studentId, e.getMessage(), e);
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
     * 清除用户通知相关缓存
     */
    private void evictNotificationCache(Long userId) {
        try {
            // 清除未读通知列表缓存
            cacheService.evictCache("notification", "unread_list_" + userId);
            // 清除未读通知数量缓存
            cacheService.evictCache("notification", "unread_count_" + userId);
            log.debug("Evicted notification cache for user {}", userId);
        } catch (Exception e) {
            log.warn("Failed to evict notification cache for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * 清除待审核数量缓存（所有审核员）
     */
    public void evictAllPendingReviewCache() {
        try {
            // 清除所有待审核计数缓存
            cacheService.evictAllCache("notification");
            log.debug("Evicted all pending review caches");
        } catch (Exception e) {
            log.warn("Failed to evict pending review caches: {}", e.getMessage());
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

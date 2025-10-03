package com.xuqinyang.xmudemo.dto;

import com.xuqinyang.xmudemo.model.UserNotification;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 通知缓存DTO - 避免Hibernate代理序列化问题
 * 用于Redis缓存优化
 */
@Data
public class NotificationCacheDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long userId;
    private String title;
    private String content;
    private String type;
    private Boolean isRead;
    private LocalDateTime createdAt;

    /**
     * 从UserNotification实体转换为DTO
     */
    public static NotificationCacheDTO fromEntity(UserNotification notification) {
        NotificationCacheDTO dto = new NotificationCacheDTO();
        dto.setId(notification.getId());
        dto.setUserId(notification.getUserId());
        dto.setTitle(notification.getTitle());
        dto.setContent(notification.getContent());
        dto.setType(notification.getType());
        dto.setIsRead(notification.getIsRead());
        dto.setCreatedAt(notification.getCreatedAt());
        return dto;
    }

    /**
     * 转换为UserNotification实体
     */
    public UserNotification toEntity() {
        UserNotification notification = new UserNotification();
        notification.setId(this.id);
        notification.setUserId(this.userId);
        notification.setTitle(this.title);
        notification.setContent(this.content);
        notification.setType(this.type);
        notification.setIsRead(this.isRead);
        notification.setCreatedAt(this.createdAt);
        return notification;
    }

    /**
     * 转换为Map格式（用于API响应）
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("id", this.id);
        map.put("title", this.title);
        map.put("content", this.content != null ? this.content : "");
        map.put("type", this.type != null ? this.type : "");
        map.put("createdAt", this.createdAt);
        map.put("isRead", this.isRead);
        return map;
    }
}


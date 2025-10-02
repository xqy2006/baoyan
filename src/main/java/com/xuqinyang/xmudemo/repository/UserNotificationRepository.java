package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 用户通知Repository
 */
@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    /**
     * 查找用户未读通知，按创建时间倒序
     */
    List<UserNotification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(Long userId);

    /**
     * 查找用户所有通知，按创建时间倒序
     */
    List<UserNotification> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 标记用户所有未读通知为已读
     */
    @Modifying
    @Transactional
    @Query("UPDATE UserNotification n SET n.isRead = true, n.readAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.isRead = false")
    int markAllAsReadByUserId(@Param("userId") Long userId);

    /**
     * 删除用户已读通知
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM UserNotification n WHERE n.userId = :userId AND n.isRead = true")
    int deleteReadNotificationsByUserId(@Param("userId") Long userId);

    /**
     * 统计用户未读通知数量
     */
    long countByUserIdAndIsReadFalse(Long userId);
}

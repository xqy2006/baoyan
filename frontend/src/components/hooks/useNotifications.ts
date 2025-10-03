import { useState, useEffect, useCallback, useRef } from 'react';
import { ElNotification } from 'element-plus/es';
import type { NotificationParams } from 'element-plus/es';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  data?: any;
}

export interface NotificationResponse {
  notifications: Notification[];
  count: number;
}

// 消息去重合并逻辑 - 修复：使用更严格的合并策略
const mergeNotifications = (notifications: Notification[]): Notification[] => {
  const merged = new Map<string, { notification: Notification; count: number }>();

  notifications.forEach(notification => {
    // 使用 title 作为主键进行合并（因为同一个申请会产生相同 title 的通知）
    const key = notification.title;

    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.count += 1;
      // 保留最新的消息
      if (new Date(notification.createdAt) > new Date(existing.notification.createdAt)) {
        existing.notification = notification;
      }
    } else {
      merged.set(key, { notification, count: 1 });
    }
  });

  return Array.from(merged.values()).map(({ notification, count }) => ({
    ...notification,
    content: count > 1 ? `${notification.content} (${count}条)` : notification.content
  }));
};

interface UseNotificationsProps {
  userRole?: string; // 传入用户角色
}

export const useNotifications = (props?: UseNotificationsProps) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConsumingRef = useRef(false); // 新增：防止重复consume的锁
  const isFetchingCountRef = useRef(false); // 新增：防止重复fetch count的锁

  const isReviewer = props?.userRole === 'REVIEWER' || props?.userRole === 'ADMIN';

  // 获取未读消息数量（带锁）
  const fetchUnreadCount = useCallback(async () => {
    // 如果正在获取中，直接返回
    if (isFetchingCountRef.current) {
      return unreadCount;
    }

    isFetchingCountRef.current = true;
    try {
      const res = await fetch('/api/notifications/count', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
        return data.count || 0;
      }
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
    } finally {
      isFetchingCountRef.current = false;
    }
    return 0;
  }, [unreadCount]);

  // 获取待审核申请数量（仅审核员调用）
  const fetchPendingReviewCount = useCallback(async () => {
    // 只有审核员才调用此API，减轻服务器压力
    if (!isReviewer) {
      setPendingReviewCount(0);
      return 0;
    }

    try {
      const res = await fetch('/api/notifications/pending-reviews', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setPendingReviewCount(data.count || 0);
        return data.count || 0;
      } else if (res.status === 403) {
        // 403表示权限不足，静默处理
        setPendingReviewCount(0);
        return 0;
      }
    } catch (error) {
      // 静默处理错误
      setPendingReviewCount(0);
    }
    return 0;
  }, [isReviewer]);

  // 获取并消费最新消息（带锁，防止重复调用）
  const consumeNotifications = useCallback(async () => {
    // 如果正在消费中，直接返回，防止重复请求
    if (isConsumingRef.current) {
      console.log('Already consuming notifications, skipping...');
      return null;
    }

    isConsumingRef.current = true;
    try {
      const res = await fetch('/api/notifications/consume', {
        credentials: 'include'
      });

      if (res.ok) {
        const data: NotificationResponse = await res.json();

        if (data.notifications && data.notifications.length > 0) {
          // 合并重复消息
          const mergedNotifications = mergeNotifications(data.notifications);

          // 显示通知
          mergedNotifications.forEach(notification => {
            showNotification(notification);
          });

          // 更新未读数量为0
          setUnreadCount(0);
        }

        return data;
      }
    } catch (error) {
      console.error('获取消息失败:', error);
    } finally {
      // 延迟释放锁，防止短时间内的重复调用
      setTimeout(() => {
        isConsumingRef.current = false;
      }, 500);
    }
    return null;
  }, []);

  // 显示通知（使用 Element Plus Notification）
  const showNotification = useCallback((notification: Notification) => {
    // 根据消息类型选择不同的通知样式
    let notificationType: NotificationParams['type'] = 'info';

    const type = notification.type?.toUpperCase() || '';
    if (type.includes('APPROVE') || type.includes('SUCCESS') || type.includes('SUBMIT')) {
      notificationType = 'success';
    } else if (type.includes('REJECT') || type.includes('FAIL')) {
      notificationType = 'error';
    } else if (type.includes('WARNING') || type.includes('DEADLINE')) {
      notificationType = 'warning';
    }

    ElNotification({
      title: notification.title,
      message: notification.content || '',
      type: notificationType,
      duration: 5000,
      position: 'top-right',
      showClose: true,
      offset: 50,
    } as NotificationParams);
  }, []);

  // 检查并消费通知（优化：先查count，非0才consume，减轻服务器压力）
  const checkAndConsumeNotifications = useCallback(async () => {
    // 先获取未读数量
    const count = await fetchUnreadCount();

    // 只有未读数量大于0时才消费通知
    if (count > 0) {
      await consumeNotifications();
    }

    // 如果是审核员，也检查待审核数量
    if (isReviewer) {
      await fetchPendingReviewCount();
    }
  }, [fetchUnreadCount, consumeNotifications, fetchPendingReviewCount, isReviewer]);

  // 开始轮询
  const startPolling = useCallback((intervalMs: number = 30000) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsPolling(true);

    // 立即检查一次
    checkAndConsumeNotifications();

    // 设置定时轮询
    pollingIntervalRef.current = setInterval(() => {
      checkAndConsumeNotifications();
    }, intervalMs);
  }, [checkAndConsumeNotifications]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 手动检查新消息
  const checkForNewMessages = useCallback(async () => {
    await checkAndConsumeNotifications();
  }, [checkAndConsumeNotifications]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    unreadCount,
    pendingReviewCount,
    isPolling,
    fetchUnreadCount,
    consumeNotifications,
    startPolling,
    stopPolling,
    checkForNewMessages,
    showNotification
  };
};

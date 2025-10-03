/**
 * 通知本地存储管理工具
 * 使用 localStorage 持久化存储通知消息
 * 每个用户（基于学号）单独存储
 */

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  content?: string;
  createdAt: string;
  receivedAt: string; // 接收到消息的时间戳
  isRead: boolean;
  data?: any;
}

const STORAGE_KEY_PREFIX = 'xmu_notifications_';
const MAX_NOTIFICATIONS = 100; // 最多存储100条通知

/**
 * 获取当前用户的存储 key
 */
const getUserStorageKey = (userId?: string): string => {
  if (!userId) {
    // 如果没有传入用户ID，尝试从当前登录用户获取
    console.warn('No userId provided for notification storage');
    return `${STORAGE_KEY_PREFIX}guest`;
  }
  return `${STORAGE_KEY_PREFIX}${userId}`;
};

/**
 * 获取所有存储的通知
 */
export const getStoredNotifications = (userId?: string): StoredNotification[] => {
  try {
    const key = getUserStorageKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const notifications = JSON.parse(stored) as StoredNotification[];
    // 按接收时间倒序排列（最新的在前面）
    return notifications.sort((a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  } catch (error) {
    console.error('Failed to get stored notifications:', error);
    return [];
  }
};

/**
 * 保存新通知到 localStorage
 */
export const saveNotifications = (newNotifications: any[], userId?: string): StoredNotification[] => {
  try {
    const key = getUserStorageKey(userId);
    const existing = getStoredNotifications(userId);
    const now = new Date().toISOString();

    // 转换新通知格式并添加接收时间戳
    const toAdd: StoredNotification[] = newNotifications.map(n => ({
      id: n.id || `${Date.now()}-${Math.random()}`,
      type: n.type || 'info',
      title: n.title || '系统通知',
      message: n.content || n.message || '',
      content: n.content || n.message || '',
      createdAt: n.createdAt || now,
      receivedAt: now,
      isRead: false,
      data: n.data
    }));

    // 合并新旧通知，去重（基于 id 或 title+createdAt 组合）
    const merged = [...toAdd];
    const existingIds = new Set(toAdd.map(n => n.id));

    existing.forEach(n => {
      // 如果ID不重复，则添加
      if (!existingIds.has(n.id)) {
        merged.push(n);
      }
    });

    // 限制最大数量，保留最新的
    const limited = merged
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, MAX_NOTIFICATIONS);

    localStorage.setItem(key, JSON.stringify(limited));

    return limited;
  } catch (error) {
    console.error('Failed to save notifications:', error);
    return [];
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = (userId?: string): StoredNotification[] => {
  try {
    const key = getUserStorageKey(userId);
    const notifications = getStoredNotifications(userId);
    const updated = notifications.map(n => ({
      ...n,
      isRead: true
    }));

    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    return [];
  }
};

/**
 * 标记单个通知为已读
 */
export const markAsRead = (id: string, userId?: string): StoredNotification[] => {
  try {
    const key = getUserStorageKey(userId);
    const notifications = getStoredNotifications(userId);
    const updated = notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );

    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to mark as read:', error);
    return [];
  }
};

/**
 * 删除单个通知
 */
export const deleteNotification = (id: string, userId?: string): StoredNotification[] => {
  try {
    const key = getUserStorageKey(userId);
    const notifications = getStoredNotifications(userId);
    const filtered = notifications.filter(n => n.id !== id);

    localStorage.setItem(key, JSON.stringify(filtered));
    return filtered;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return [];
  }
};

/**
 * 清空所有通知
 */
export const clearAllNotifications = (userId?: string): void => {
  try {
    const key = getUserStorageKey(userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
};

/**
 * 获取未读通知数量
 */
export const getUnreadCount = (userId?: string): number => {
  try {
    const notifications = getStoredNotifications(userId);
    return notifications.filter(n => !n.isRead).length;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
};

/**
 * 获取今天的通知
 */
export const getTodayNotifications = (userId?: string): StoredNotification[] => {
  try {
    const notifications = getStoredNotifications(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return notifications.filter(n => {
      const receivedDate = new Date(n.receivedAt);
      return receivedDate >= today;
    });
  } catch (error) {
    console.error('Failed to get today notifications:', error);
    return [];
  }
};

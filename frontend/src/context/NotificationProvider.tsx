import React, { createContext, useContext, useEffect } from 'react';
import { useNotifications } from '../components/hooks/useNotifications';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadCount: number;
  pendingReviewCount: number;
  isPolling: boolean;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  checkForNewMessages: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();

  // 传递用户角色给 useNotifications
  const notifications = useNotifications({ userRole: user?.role });

  // 当用户登录时开始轮询，登出时停止轮询
  useEffect(() => {
    if (user) {
      // 用户登录后开始轮询消息，每30秒检查一次
      notifications.startPolling(30000);

      // 立即获取一次未读数量
      notifications.fetchUnreadCount();
    } else {
      // 用户登出时停止轮询
      notifications.stopPolling();
    }

    // 清理函数
    return () => {
      notifications.stopPolling();
    };
  }, [user, notifications]);

  // 页面可见性变化时的处理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // 页面重新变为可见时，立即检查新消息
        notifications.checkForNewMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, notifications]);

  const contextValue: NotificationContextType = {
    unreadCount: notifications.unreadCount,
    pendingReviewCount: notifications.pendingReviewCount,
    isPolling: notifications.isPolling,
    startPolling: notifications.startPolling,
    stopPolling: notifications.stopPolling,
    checkForNewMessages: notifications.checkForNewMessages,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

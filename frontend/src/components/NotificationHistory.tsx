import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell, Trash2, RefreshCw, Eye, X } from 'lucide-react';
import { useNotifications } from './hooks/useNotifications';
import {
  getStoredNotifications,
  markAllAsRead,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
  StoredNotification
} from '../utils/notificationStorage';

interface NotificationHistoryProps {
  className?: string;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { checkForNewMessages, fetchUnreadCount } = useNotifications();

  // 从 localStorage 加载通知
  const loadNotifications = () => {
    const stored = getStoredNotifications();
    setNotifications(stored);
  };

  // 获取服务器端的新通知
  const fetchNewNotifications = async () => {
    setLoading(true);
    try {
      // 调用 checkForNewMessages 会自动获取新消息并保存到 localStorage
      await checkForNewMessages();

      // 重新加载 localStorage 中的通知
      loadNotifications();
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 标记所有消息为已读
  const handleMarkAllAsRead = () => {
    markAllAsRead();
    loadNotifications();
    fetchUnreadCount();
  };

  // 标记单条消息为已读
  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
    loadNotifications();
  };

  // 删除单条通知
  const handleDelete = (id: string) => {
    deleteNotification(id);
    loadNotifications();
  };

  // 清空所有通知
  const handleClearAll = () => {
    if (confirm('确定要清空所有通知记录吗？此操作不可恢复。')) {
      clearAllNotifications();
      loadNotifications();
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const typeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'success': { label: '成功', variant: 'default' },
      'error': { label: '错误', variant: 'destructive' },
      'warning': { label: '警告', variant: 'outline' },
      'info': { label: '信息', variant: 'secondary' },
      'application_approved': { label: '申请通过', variant: 'default' },
      'application_rejected': { label: '申请驳回', variant: 'destructive' },
      'status_update': { label: '状态更新', variant: 'secondary' },
      'deadline_reminder': { label: '截止提醒', variant: 'outline' },
    };

    return typeMap[type] || { label: '通知', variant: 'secondary' as const };
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              消息通知
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} 条未读
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNewNotifications}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              {notifications.length > 0 && unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  全部已读
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  清空全部
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>暂无消息通知</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const typeInfo = getNotificationTypeLabel(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`border rounded-lg p-4 transition-colors relative ${
                      !notification.isRead 
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {!notification.isRead && (
                            <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                          )}
                          <Badge variant={typeInfo.variant} className="text-xs">
                            {typeInfo.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.receivedAt)}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {notification.message}
                        </p>
                        {notification.data?.actionUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              if (notification.data.actionUrl) {
                                handleMarkAsRead(notification.id);
                                window.location.href = notification.data.actionUrl;
                              }
                            }}
                          >
                            查看详情 →
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-8 w-8 p-0"
                            title="标记为已读"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="删除"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

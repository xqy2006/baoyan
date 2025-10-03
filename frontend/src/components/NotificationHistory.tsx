import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell, Trash2, RefreshCw, Eye } from 'lucide-react';
import { useNotifications, Notification } from './hooks/useNotifications';

interface NotificationHistoryProps {
  className?: string;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { checkForNewMessages, fetchUnreadCount } = useNotifications();

  // 预览未读通知
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/preview', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('获取通知历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 标记所有消息为已读
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/consume', {
        credentials: 'include'
      });

      // 重新获取通知列表和计数
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (error) {
      console.error('标记消息为已读失败:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
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

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              消息通知
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotifications}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  全部已读
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
              {notifications.map((notification, index) => {
                const typeInfo = getNotificationTypeLabel(notification.type);
                return (
                  <div
                    key={`${notification.id}-${index}`}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={typeInfo.variant} className="text-xs">
                            {typeInfo.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.createdAt)}
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
                                window.location.href = notification.data.actionUrl;
                              }
                            }}
                          >
                            查看详情 →
                          </Button>
                        )}
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

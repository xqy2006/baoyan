import React from 'react';
import { Badge } from './ui/badge';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { useNotifications } from './hooks/useNotifications';

interface NotificationBadgeProps {
  className?: string;
  showIcon?: boolean;
  onClick?: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  className = '',
  showIcon = true,
  onClick
}) => {
  const { unreadCount, checkForNewMessages } = useNotifications();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 默认行为：手动检查新消息
      checkForNewMessages();
    }
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="relative p-2"
      >
        {showIcon && <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    </div>
  );
};

import React from 'react';
import { Button } from './ui/button';
import { User } from '../App';
import { Home, FileText, Plus, LogOut, Users, Settings, Upload, Activity } from 'lucide-react';

interface NavigationProps {
  user: User;
  currentView: string;
  onViewChange: (view: 'dashboard' | 'applications' | 'apply' | 'review' | 'activities' | 'import' | 'settings') => void;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  user, 
  currentView, 
  onViewChange, 
  onLogout 
}) => {
  return (
    <>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm">推</span>
          </div>
          <div>
            <h1 className="text-lg">推免保研</h1>
            <p className="text-sm text-gray-500">欢迎，{user.name}</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onLogout}
          className="text-gray-600"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2">
        <div className="flex items-center justify-around">
          <Button
            variant={currentView === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('dashboard')}
            className="flex flex-col items-center space-y-1 h-auto py-2"
          >
            <Home className="w-4 h-4" />
            <span className="text-xs">首页</span>
          </Button>

          {user.role === 'student' && (
            <Button
              variant={currentView === 'applications' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('applications')}
              className="flex flex-col items-center space-y-1 h-auto py-2"
            >
              <FileText className="w-4 h-4" />
              <span className="text-xs">申请</span>
            </Button>
          )}

          {(user.role === 'admin' || user.role === 'reviewer') && (
            <Button
              variant={currentView === 'applications' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('applications')}
              className="flex flex-col items-center space-y-1 h-auto py-2"
            >
              <Users className="w-4 h-4" />
              <span className="text-xs">审核</span>
            </Button>
          )}

          {user.role === 'admin' && (
            <>
              <Button
                variant={currentView === 'activities' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('activities')}
                className="flex flex-col items-center space-y-1 h-auto py-2"
              >
                <Activity className="w-4 h-4" />
                <span className="text-xs">活动</span>
              </Button>

              <Button
                variant={currentView === 'import' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('import')}
                className="flex flex-col items-center space-y-1 h-auto py-2"
              >
                <Upload className="w-4 h-4" />
                <span className="text-xs">导入</span>
              </Button>

              <Button
                variant={currentView === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('settings')}
                className="flex flex-col items-center space-y-1 h-auto py-2"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs">设置</span>
              </Button>
            </>
          )}
        </div>
      </nav>
    </>
  );
};
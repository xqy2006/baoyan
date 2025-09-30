import React from 'react';
import { Button } from './ui/button';
import { User } from '../App';
import { Home, FileText, Users, Settings, Upload, Activity } from 'lucide-react';

interface NavigationProps {
  user: User;
  currentView: string;
  onViewChange: (view: 'dashboard' | 'applications' | 'apply' | 'review' | 'activities' | 'import' | 'settings' | 'account') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ user, currentView, onViewChange }) => {
  const isAdmin = user.role === 'ADMIN';
  const isReviewer = user.role === 'REVIEWER';
  const isStudent = user.role === 'STUDENT';

  const DesktopButton: React.FC<{view:string; label:string; icon:React.ReactNode; show?:boolean;}> = ({view,label,icon,show=true}) => {
    if(!show) return null;
    const active = currentView === view;
    return (
      <Button
        aria-label={label}
        variant={active? 'default':'ghost'}
        size="sm"
        onClick={()=>onViewChange(view as any)}
        className="w-full justify-start gap-2 h-9"
      >
        {icon}
        <span className="text-sm">{label}</span>
      </Button>
    );
  };

  const MobileButton: React.FC<{view:string; label:string; icon:React.ReactNode; show?:boolean;}> = ({view,label,icon,show=true}) => {
    if(!show) return null;
    const active = currentView === view;
    return (
      <Button
        aria-label={label}
        variant={active? 'default':'ghost'}
        size="sm"
        onClick={()=>onViewChange(view as any)}
        className="flex flex-col items-center h-auto py-1 px-2 min-w-[54px]"
      >
        {icon}
        <span className="text-[11px] leading-none mt-0.5">{label}</span>
      </Button>
    );
  };

  return (
    <>
      {/* 顶部栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:pl-56 sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-medium">推</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold tracking-wide">推免保研平台</h1>
            <p className="text-xs text-gray-500 hidden sm:block">欢迎，{user.name}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 pr-2">
          <span className="text-sm text-gray-600">{user.role}</span>
          <Button aria-label="账户" variant={currentView==='account'? 'default':'outline'} size="sm" onClick={()=>onViewChange('account')}>账户</Button>
        </div>
      </header>

      {/* 桌面侧边栏 */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-56 md:bg-white md:border-r md:flex md:flex-col md:z-40">
        <div className="relative flex-1 overflow-hidden">
          {/* 渐变遮罩 */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent z-10" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent z-10" />
            <div className="h-full overflow-y-auto px-3 py-4 space-y-1" id="desktop-nav-scroll">
              <DesktopButton view="dashboard" label="首页" icon={<Home className="w-4 h-4" />} show/>
              <DesktopButton view="applications" label={isStudent? '申请' : (isAdmin? '审核管理':'审核')} icon={<FileText className="w-4 h-4" />} show={isStudent || isReviewer} />
              <DesktopButton view="activities" label="活动" icon={<Activity className="w-4 h-4" />} show={isAdmin} />
              <DesktopButton view="import" label="用户" icon={<Upload className="w-4 h-4" />} show={isAdmin} />
              <DesktopButton view="settings" label="设置" icon={<Settings className="w-4 h-4" />} show={isAdmin} />
              <DesktopButton view="account" label="账户" icon={<Users className="w-4 h-4" />} show/>
              <div className="pt-4 text-[10px] text-gray-400 select-none">© {new Date().getFullYear()} XM U Demo</div>
            </div>
        </div>
      </aside>

      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-40">
        <div className="flex items-stretch justify-between">
          <MobileButton view="dashboard" label="首页" icon={<Home className="w-4 h-4" />} />
          <MobileButton view="applications" label={isStudent? '申请' : '审核'} icon={<FileText className="w-4 h-4" />} show={isStudent || isAdmin || isReviewer} />
          {isAdmin && <MobileButton view="activities" label="活动" icon={<Activity className="w-4 h-4" />} />}
          {isAdmin && <MobileButton view="import" label="用户" icon={<Upload className="w-4 h-4" />} />}
          {isAdmin && <MobileButton view="settings" label="设置" icon={<Settings className="w-4 h-4" />} />}
          <MobileButton view="account" label="账户" icon={<Users className="w-4 h-4" />} />
        </div>
      </nav>
    </>
  );
};
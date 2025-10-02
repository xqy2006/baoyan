import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Settings, Save, RefreshCw, Shield, Bell, Database } from 'lucide-react';
import { SystemSettings as SystemSettingsType } from '../App';

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  systemAnnouncements: boolean;
  applicationDeadlineReminder: boolean;
  reviewDeadlineReminder: boolean;
}

interface SecuritySettings {
  passwordComplexity: 'low' | 'medium' | 'high';
  sessionTimeout: number; // 分钟
  maxLoginAttempts: number;
  ipWhitelist: string[];
  enableTwoFactor: boolean;
}

export const SystemSettings: React.FC = () => {
  const [systemSettings, setSystemSettings] = useState<SystemSettingsType>({
    currentAcademicYear: '2023-2024',
    applicationPeriod: {
      start: '2024-03-01T09:00',
      end: '2024-04-30T23:59'
    },
    systemMaintenanceMode: false
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    systemAnnouncements: true,
    applicationDeadlineReminder: true,
    reviewDeadlineReminder: true
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    passwordComplexity: 'medium',
    sessionTimeout: 120,
    maxLoginAttempts: 5,
    ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
    enableTwoFactor: true
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    // 模拟保存过程
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage('设置已成功保存！');
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  const handleResetSettings = () => {
    if (confirm('确定要重置所有设置为默认值吗？此操作不可撤销。')) {
      // 重置为默认设置
      setSystemSettings({
        currentAcademicYear: '2023-2024',
        applicationPeriod: {
          start: '2024-03-01T09:00',
          end: '2024-04-30T23:59'
        },
        systemMaintenanceMode: false
      });
      
      setNotificationSettings({
        emailNotifications: true,
        smsNotifications: false,
        systemAnnouncements: true,
        applicationDeadlineReminder: true,
        reviewDeadlineReminder: true
      });

      setSaveMessage('设置已重置为默认值！');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1>系统设置</h1>
          <p className="text-gray-600 mt-2">管理系统的全局配置和参数</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleResetSettings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重置默认
          </Button>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>

      {/* 保存成功提示 */}
      {saveMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            {saveMessage}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            基本设置
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            通知设置
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            安全设置
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="h-4 w-4 mr-2" />
            数据备份
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>学年设置</CardTitle>
              <CardDescription>
                配置当前学年和申请时间段
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="academicYear">当前学年</Label>
                <Select
                  value={systemSettings.currentAcademicYear}
                  onValueChange={(value) => setSystemSettings({ 
                    ...systemSettings, 
                    currentAcademicYear: value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择学年" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2023-2024">2023-2024学年</SelectItem>
                    <SelectItem value="2024-2025">2024-2025学年</SelectItem>
                    <SelectItem value="2025-2026">2025-2026学年</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">申请开始时间</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={systemSettings.applicationPeriod.start}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      applicationPeriod: {
                        ...systemSettings.applicationPeriod,
                        start: e.target.value
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">申请结束时间</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={systemSettings.applicationPeriod.end}
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      applicationPeriod: {
                        ...systemSettings.applicationPeriod,
                        end: e.target.value
                      }
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>系统维护</CardTitle>
              <CardDescription>
                系统维护模式和公告设置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="maintenance">维护模式</Label>
                  <p className="text-sm text-gray-600">
                    启用后，除管理员外的用户将无法访问系统
                  </p>
                </div>
                <Switch
                  id="maintenance"
                  checked={systemSettings.systemMaintenanceMode}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    systemMaintenanceMode: checked
                  })}
                />
              </div>

              {systemSettings.systemMaintenanceMode && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription className="text-yellow-800">
                    ⚠️ 系统当前处于维护模式，普通用户无法访问
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="announcement">系统公告</Label>
                <Textarea
                  id="announcement"
                  placeholder="输入系统公告内容，将在所有用户登录后显示"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>通知渠道</CardTitle>
              <CardDescription>
                配置系统通知的发送方式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email">邮件通知</Label>
                    <p className="text-sm text-gray-600">通过邮件发送系统通知</p>
                  </div>
                  <Switch
                    id="email"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => setNotificationSettings({
                      ...notificationSettings,
                      emailNotifications: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms">短信通知</Label>
                    <p className="text-sm text-gray-600">通过短信发送重要通知</p>
                  </div>
                  <Switch
                    id="sms"
                    checked={notificationSettings.smsNotifications}
                    onCheckedChange={(checked) => setNotificationSettings({
                      ...notificationSettings,
                      smsNotifications: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="announcements">系统公告</Label>
                    <p className="text-sm text-gray-600">在系统内显示公告信息</p>
                  </div>
                  <Switch
                    id="announcements"
                    checked={notificationSettings.systemAnnouncements}
                    onCheckedChange={(checked) => setNotificationSettings({
                      ...notificationSettings,
                      systemAnnouncements: checked
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>提醒设置</CardTitle>
              <CardDescription>
                配置自动提醒功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="appDeadline">申请截止提醒</Label>
                  <p className="text-sm text-gray-600">在申请截止前提醒学生</p>
                </div>
                <Switch
                  id="appDeadline"
                  checked={notificationSettings.applicationDeadlineReminder}
                  onCheckedChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    applicationDeadlineReminder: checked
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reviewDeadline">审核截止提醒</Label>
                  <p className="text-sm text-gray-600">在审核截止前提醒审核员</p>
                </div>
                <Switch
                  id="reviewDeadline"
                  checked={notificationSettings.reviewDeadlineReminder}
                  onCheckedChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    reviewDeadlineReminder: checked
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>账户安全</CardTitle>
              <CardDescription>
                配置用户账户的安全策略
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passwordComplexity">密码复杂度要求</Label>
                <Select
                  value={securitySettings.passwordComplexity}
                  onValueChange={(value) => setSecuritySettings({
                    ...securitySettings,
                    passwordComplexity: value as SecuritySettings['passwordComplexity']
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择密码复杂度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低 (6位数字或字母)</SelectItem>
                    <SelectItem value="medium">中 (8位字母+数字)</SelectItem>
                    <SelectItem value="high">高 (8位字母+数字+特殊字符)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">会话超时时间 (分钟)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings({
                    ...securitySettings,
                    sessionTimeout: Number(e.target.value)
                  })}
                  min="30"
                  max="480"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAttempts">最大登录尝试次数</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  value={securitySettings.maxLoginAttempts}
                  onChange={(e) => setSecuritySettings({
                    ...securitySettings,
                    maxLoginAttempts: Number(e.target.value)
                  })}
                  min="3"
                  max="10"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="twoFactor">启用双因子认证</Label>
                  <p className="text-sm text-gray-600">为管理员账户启用2FA</p>
                </div>
                <Switch
                  id="twoFactor"
                  checked={securitySettings.enableTwoFactor}
                  onCheckedChange={(checked) => setSecuritySettings({
                    ...securitySettings,
                    enableTwoFactor: checked
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>访问控制</CardTitle>
              <CardDescription>
                配置IP白名单和访问限制
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipWhitelist">IP白名单</Label>
                <Textarea
                  id="ipWhitelist"
                  placeholder="每行一个IP地址或CIDR段，例如：192.168.1.0/24"
                  value={securitySettings.ipWhitelist.join('\n')}
                  onChange={(e) => setSecuritySettings({
                    ...securitySettings,
                    ipWhitelist: e.target.value.split('\n').filter(ip => ip.trim())
                  })}
                  rows={4}
                />
                <p className="text-sm text-gray-600">
                  留空表示不限制IP访问
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>数据备份</CardTitle>
              <CardDescription>
                管理系统数据的备份和恢复
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">手动备份</h3>
                  <p className="text-sm text-gray-600">
                    立即创建系统数据的完整备份
                  </p>
                  <Button className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    创建备份
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">自动备份</h3>
                  <div className="space-y-2">
                    <Label>备份频率</Label>
                    <Select defaultValue="daily">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">每天</SelectItem>
                        <SelectItem value="weekly">每周</SelectItem>
                        <SelectItem value="monthly">每月</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>保留时间</Label>
                    <Select defaultValue="30">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7天</SelectItem>
                        <SelectItem value="30">30天</SelectItem>
                        <SelectItem value="90">90天</SelectItem>
                        <SelectItem value="365">1年</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">备份历史</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">完整备份 - 2024-03-15</p>
                      <p className="text-sm text-gray-600">大小: 2.5 GB</p>
                    </div>
                    <Button variant="outline" size="sm">下载</Button>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">完整备份 - 2024-03-14</p>
                      <p className="text-sm text-gray-600">大小: 2.3 GB</p>
                    </div>
                    <Button variant="outline" size="sm">下载</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit3, Trash2, Calendar, Users, Settings } from 'lucide-react';
import { Activity } from '../App';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';

export const ActivityManagement: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null);

  const loadActivities = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/activities', { credentials:'include' });
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      const typeMap: Record<string,string> = { ACADEMIC_MASTER:'学术型硕士', PROFESSIONAL_MASTER:'专业型硕士', PHD:'直博' };
      const mapped: Activity[] = data.map((a:any)=>({
        id: String(a.id),
        name: a.name,
        department: a.department,
        type: typeMap[a.type] || a.type,
        startTime: a.startTime || '',
        deadline: a.deadline || '',
        description: a.description,
        isActive: a.active ?? a.isActive,
        maxApplications: a.maxApplications
      }));
      setActivities(mapped);
    } catch (e:any) { setError(e.message || '加载异常'); }
    finally { setLoading(false); }
  };
  React.useEffect(()=>{ loadActivities(); }, []);

  const apiTypeMap: Record<string,string> = { '学术型硕士':'ACADEMIC_MASTER','专业型硕士':'PROFESSIONAL_MASTER','直博':'PHD' };

  const saveToBackend = async (activity: Activity, isNew: boolean) => {
    const payload = {
      name: activity.name,
      department: activity.department,
      type: apiTypeMap[activity.type] || 'ACADEMIC_MASTER',
      startTime: activity.startTime || null,
      deadline: activity.deadline || null,
      description: activity.description,
      active: activity.isActive,
      maxApplications: activity.maxApplications
    };
    const url = isNew? '/api/activities' : `/api/activities/${activity.id}`;
    const method = isNew? 'POST':'PUT';
    const res = await fetch(url, { method, headers: { 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify(payload)});
    if (!res.ok) throw new Error('保存失败');
  };

  const handleSaveActivity = async (activity: Activity) => {
    try {
      await saveToBackend(activity, !activity.id);
      setIsDialogOpen(false); setEditingActivity(null); await loadActivities();
      toast.success('保存成功');
    } catch (e:any) { toast.error(e.message||'保存失败'); }
  };

  const handleDeleteActivity = async (activityId: string) => {
    setConfirmDeleteId(activityId);
  };
  const doDeleteActivity = async () => {
    if(!confirmDeleteId) return;
    try {
      const res = await fetch(`/api/activities/${confirmDeleteId}`, { method:'DELETE', credentials:'include' });
      if (!res.ok) throw new Error('删除失败');
      toast.success('已删除');
      await loadActivities();
    } catch (e:any) { toast.error(e.message||'删除失败'); }
    finally { setConfirmDeleteId(null); }
  };

  const handleToggleActivity = async (activityId: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}/toggle`, { method:'POST', credentials:'include' });
      if (!res.ok) throw new Error('切换失败');
      await loadActivities();
    } catch (e:any) { toast.error(e.message||'切换失败'); }
  };

  const getStatusBadge = (activity: Activity) => {
    const now = new Date();
    const startTime = new Date(activity.startTime);
    const deadline = new Date(activity.deadline);

    if (!activity.isActive) {
      return <Badge variant="secondary">已停用</Badge>;
    } else if (now < startTime) {
      return <Badge className="bg-blue-100 text-blue-800">未开始</Badge>;
    } else if (now > deadline) {
      return <Badge className="bg-red-100 text-red-800">已结束</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">进行中</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1>活动管理</h1>
          <p className="text-gray-600 mt-2">管理推免申请活动的时间、参数和状态</p>
        </div>
        <Button onClick={() => { setEditingActivity({ id: '', name:'', department:'', type:'学术型硕士', startTime:'', deadline:'', description:'', isActive:true, maxApplications:50 }); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          创建新活动
        </Button>
      </div>

      {loading && <div className="text-center py-4 text-gray-500">加载中...</div>}
      {error && <div className="text-center py-4 text-red-500">{error}</div>}

      {/* 活动列表 */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">进行中的活动</TabsTrigger>
          <TabsTrigger value="all">所有活动</TabsTrigger>
          <TabsTrigger value="statistics">活动统计</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4">
            {activities.filter(a => a.isActive).map((activity) => (
              <Card key={activity.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold">{activity.name}</h3>
                        {getStatusBadge(activity)}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">系别:</span> {activity.department}
                        </div>
                        <div>
                          <span className="font-medium">类型:</span> {activity.type}
                        </div>
                        <div>
                          <span className="font-medium">开始时间:</span> {new Date(activity.startTime).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">截止时间:</span> {new Date(activity.deadline).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{activity.description}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm">
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          最大申请数: {activity.maxApplications}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          剩余时间: {Math.max(0, Math.ceil((new Date(activity.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} 天
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={activity.isActive}
                        onCheckedChange={() => handleToggleActivity(activity.id)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingActivity(activity); setIsDialogOpen(true); }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteActivity(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold">{activity.name}</h3>
                        {getStatusBadge(activity)}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">系别:</span> {activity.department}
                        </div>
                        <div>
                          <span className="font-medium">类型:</span> {activity.type}
                        </div>
                        <div>
                          <span className="font-medium">开始时间:</span> {new Date(activity.startTime).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">截止时间:</span> {new Date(activity.deadline).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={activity.isActive}
                        onCheckedChange={() => handleToggleActivity(activity.id)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingActivity(activity); setIsDialogOpen(true); }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteActivity(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>活动总览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>总活动数</span>
                    <span className="font-semibold">{activities.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>进行中</span>
                    <span className="font-semibold text-green-600">
                      {activities.filter(a => a.isActive).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>已结束</span>
                    <span className="font-semibold text-red-600">
                      {activities.filter(a => !a.isActive).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>申请统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>总申请数</span>
                    <span className="font-semibold">156</span>
                  </div>
                  <div className="flex justify-between">
                    <span>待审核</span>
                    <span className="font-semibold text-yellow-600">23</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已通过</span>
                    <span className="font-semibold text-green-600">98</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>系别分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>计算机科学系</span>
                    <span className="font-semibold">65</span>
                  </div>
                  <div className="flex justify-between">
                    <span>软件工程系</span>
                    <span className="font-semibold">52</span>
                  </div>
                  <div className="flex justify-between">
                    <span>信息安全系</span>
                    <span className="font-semibold">39</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 编辑/创建活动对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingActivity?.id ? '编辑活动' : '创建新活动'}
            </DialogTitle>
            <DialogDescription>
              设置推免申请活动的基本信息和参数
            </DialogDescription>
          </DialogHeader>
          
          {editingActivity && (
            <ActivityForm
              activity={editingActivity}
              onSave={handleSaveActivity}
              onCancel={() => setIsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDeleteId} onOpenChange={o=>{ if(!o) setConfirmDeleteId(null); }} title="确认删除活动" description={`删除后不可恢复，确定删除该活动? (${confirmDeleteId||''})`} confirmText="删除" destructive onConfirm={doDeleteActivity} />
    </div>
  );
};

// 活动表单组件
interface ActivityFormProps {
  activity: Activity;
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ activity, onSave, onCancel }) => {
  const [formData, setFormData] = useState(activity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">活动名称</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">系别</Label>
          <Select
            value={formData.department}
            onValueChange={(value) => setFormData({ ...formData, department: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择系别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="计算机科学系">计算机科学系</SelectItem>
              <SelectItem value="软件工程系">软件工程系</SelectItem>
              <SelectItem value="信息安全系">信息安全系</SelectItem>
              <SelectItem value="人工智能系">人工智能系</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">类型</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value as Activity['type'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="学术型硕士">学术型硕士</SelectItem>
              <SelectItem value="专业型硕士">专业型硕士</SelectItem>
              <SelectItem value="直博">直博</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">开始时间</Label>
          <Input
            id="startTime"
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">截止时间</Label>
          <Input
            id="deadline"
            type="datetime-local"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxApplications">最大申请人数</Label>
        <Input
          id="maxApplications"
          type="number"
          value={formData.maxApplications}
          onChange={(e) => setFormData({ ...formData, maxApplications: Number(e.target.value) })}
          min="1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">活动描述</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive">启用活动</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          保存
        </Button>
      </div>
    </form>
  );
};
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, Clock, XCircle, FileText, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ReviewStats {
  pendingReview: number;
  systemApproved: number;
  totalReviewed: number;
  averageReviewTime: string;
}

interface ReviewerDashboardProps {
  // 可以传入用户信息用于权限控制
}

export const ReviewerDashboard: React.FC<ReviewerDashboardProps> = () => {
  const { fetchWithAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ pendingReview:0, systemApproved:0, totalReviewed:0, averageReviewTime:'--' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      // 优化：使用分页接口，只加载待审核的申请，按最新提交时间排序
      const statusFilter = ['SYSTEM_REVIEWING', 'SYSTEM_APPROVED', 'ADMIN_REVIEWING', 'APPROVED', 'REJECTED']
        .map(s => `statuses=${s}`).join('&');
      const params = `page=0&size=100&sortBy=submittedAt&sortDirection=DESC&${statusFilter}`;

      const res = await fetchWithAuth(`/api/applications/page?${params}`);
      if(!res.ok) throw new Error('加载失败');
      const pageData = await res.json();
      const data = pageData.content || [];

      const inQueue = data.filter((a:any)=> ['SYSTEM_REVIEWING','SYSTEM_APPROVED','ADMIN_REVIEWING'].includes(a.status));
      const done = data.filter((a:any)=> ['APPROVED','REJECTED'].includes(a.status));
      setQueue(inQueue);
      setCompleted(done);
      const pendingReview = inQueue.filter((a:any)=> a.status==='SYSTEM_REVIEWING').length;
      const systemApproved = inQueue.filter((a:any)=> a.status==='SYSTEM_APPROVED').length;
      const totalReviewed = done.length;
      setStats({ pendingReview, systemApproved, totalReviewed, averageReviewTime:'--' });
    } catch(e:any){ setError(e.message||'获取数据失败'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SYSTEM_APPROVED': return <Badge className="bg-blue-100 text-blue-800">待管理员</Badge>;
      case 'SYSTEM_REVIEWING': return <Badge className="bg-amber-100 text-amber-800">系统审核中</Badge>;
      case 'ADMIN_REVIEWING': return <Badge className="bg-indigo-100 text-indigo-800">人工中</Badge>;
      case 'APPROVED': return <Badge className="bg-green-100 text-green-800">已通过</Badge>;
      case 'REJECTED': return <Badge className="bg-red-100 text-red-800">已拒绝</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-6 overflow-x-hidden p-3 sm:p-4 md:p-6">
      {/* 页面标题 */}
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">审核员工作台</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2 break-words">厦门大学信息学院推免申请审核系统</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">待审核</p>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.pendingReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">系统通过</p>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.systemApproved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">已审核</p>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.totalReviewed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 truncate">平均审核时间</p>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.averageReviewTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区 */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">待审核申请</TabsTrigger>
          <TabsTrigger value="completed">已完成审核</TabsTrigger>
          <TabsTrigger value="statistics">审核统计</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>待审核申请</CardTitle>
              <CardDescription>系统初审或待人工审核的申请</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && <div className="text-sm text-gray-500">加载中...</div>}
              {error && <div className="text-sm text-red-600">{error}</div>}
              {!loading && queue.length===0 && <div className="text-sm text-gray-500 py-4">暂无待审核申请</div>}
              <div className="space-y-4">
                {queue.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg bg-white/60">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div>
                          <h4 className="font-medium text-sm">{app.userName || app.userStudentId}</h4>
                          <p className="text-xs text-gray-600">学号: {app.userStudentId}</p>
                        </div>
                        <div className="text-xs">
                          <p className="font-medium">{app.activityName}</p>
                          {typeof app.totalScore==='number' && <p className="text-gray-600">综合: {app.totalScore.toFixed(2)}</p>}
                        </div>
                        <div>{getStatusBadge(app.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button size="sm" onClick={()=>navigate(`/review/${app.id}`)}>
                        <FileText className="h-4 w-4 mr-1" />审核
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>已完成审核</CardTitle>
              <CardDescription>已人工终审的申请（通过或拒绝）</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && <div className="text-sm text-gray-500">加载中...</div>}
              {!loading && completed.length===0 && <div className="text-sm text-gray-500 py-6">暂无已完成记录</div>}
              <div className="space-y-3">
                {completed.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-3 border rounded bg-gray-50">
                    <div className="flex flex-col text-xs">
                      <span className="font-medium">{app.userName || app.userStudentId} ({app.userStudentId})</span>
                      <span className="text-gray-600">{app.activityName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}
                      {typeof app.totalScore==='number' && <span className="text-[11px] text-gray-600">{app.totalScore.toFixed(2)}</span>}
                      <Button size="xs" variant="outline" onClick={()=>navigate(`/review/${app.id}`)}>详情</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>审核效率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>本周审核数量</span>
                    <span className="font-semibold">12份</span>
                  </div>
                  <div className="flex justify-between">
                    <span>平均审核时长</span>
                    <span className="font-semibold">2.5小时</span>
                  </div>
                  <div className="flex justify-between">
                    <span>审核通过率</span>
                    <span className="font-semibold">85%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>审核质量</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>复议申请</span>
                    <span className="font-semibold">1份</span>
                  </div>
                  <div className="flex justify-between">
                    <span>审核准确率</span>
                    <span className="font-semibold">96%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>平均评分差异</span>
                    <span className="font-semibold">±2.3分</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
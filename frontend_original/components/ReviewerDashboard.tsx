import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, Clock, XCircle, FileText, Users, TrendingUp } from 'lucide-react';

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
  const [stats] = useState<ReviewStats>({
    pendingReview: 15,
    systemApproved: 8,
    totalReviewed: 23,
    averageReviewTime: '2.5小时'
  });

  // 模拟近期申请数据
  const recentApplications = [
    {
      id: '1',
      studentName: '李明',
      studentId: '20210001',
      activityName: '计算机科学系学术型硕士',
      submittedAt: '2024-03-15 14:30',
      status: 'system_approved',
      totalScore: 88.5
    },
    {
      id: '2',
      studentName: '王小红',
      studentId: '20210002',
      activityName: '软件工程系专业型硕士',
      submittedAt: '2024-03-15 10:15',
      status: 'system_approved',
      totalScore: 92.3
    },
    {
      id: '3',
      studentName: '张伟',
      studentId: '20210003',
      activityName: '信息安全系直博',
      submittedAt: '2024-03-14 16:45',
      status: 'system_approved',
      totalScore: 95.1
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'system_approved':
        return <Badge className="bg-blue-100 text-blue-800">待审核</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">已通过</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">已拒绝</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">处理中</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1>审核员工作台</h1>
        <p className="text-gray-600 mt-2">厦门大学信息学院推免申请审核系统</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">待审核</p>
                <p className="text-2xl font-semibold">{stats.pendingReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">系统通过</p>
                <p className="text-2xl font-semibold">{stats.systemApproved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">已审核</p>
                <p className="text-2xl font-semibold">{stats.totalReviewed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">平均审核时间</p>
                <p className="text-2xl font-semibold">{stats.averageReviewTime}</p>
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
              <CardDescription>
                系统初审通过的申请，需要进行人工审核
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentApplications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium">{app.studentName}</h4>
                          <p className="text-sm text-gray-600">学号: {app.studentId}</p>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium">{app.activityName}</p>
                          <p className="text-gray-600">综合成绩: {app.totalScore}分</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(app.status)}
                      <Button size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        审核
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
              <CardDescription>
                您已完成审核的申请记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无已完成的审核记录</p>
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
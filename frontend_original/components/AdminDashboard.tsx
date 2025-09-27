import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Users, FileText, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, Settings } from 'lucide-react';

// 模拟管理员统计数据
const mockAdminStats = {
  totalApplications: 68,
  pendingSystemReview: 8,
  systemApproved: 45,
  systemRejected: 5,
  pendingAdminReview: 12,
  finalApproved: 28,
  finalRejected: 5,
  todayApplications: 6
};

// 各系申请统计
const departmentStats = [
  { department: '计算机科学与技术系', total: 25, approved: 12, quota: 25 },
  { department: '软件工程系', total: 22, approved: 8, quota: 30 },
  { department: '人工智能系', total: 12, approved: 5, quota: 8 },
  { department: '信息与通信工程系', total: 9, approved: 3, quota: 20 }
];

// 模拟待审核申请
const mockPendingApplications = [
  {
    id: '1',
    studentName: '李哲彦',
    studentId: '37220222203675',
    department: '计算机科学与技术系',
    major: '计算机科学与技术',
    submittedAt: '2025-09-20',
    gpa: 3.85,
    ranking: '6/123',
    totalScore: 87.86,
    status: 'system_approved',
    hasSpecialTalent: true,
    systemComment: '系统审核通过：外语成绩达标，学术专长显著'
  },
  {
    id: '2',
    studentName: '李嘉乐',
    studentId: '37220222203659',
    department: '人工智能系',
    major: '人工智能',
    submittedAt: '2025-09-21',
    gpa: 3.70,
    ranking: '16/106',
    totalScore: 86.52,
    status: 'system_approved',
    hasSpecialTalent: true,
    systemComment: '系统审核通过：通过学术专长答辩，发表多篇A类论文'
  },
  {
    id: '3',
    studentName: '洪伟鑫',
    studentId: '37220222203612',
    department: '软件工程系',
    major: '软件工程',
    submittedAt: '2025-09-22',
    gpa: 3.91,
    ranking: '1/144',
    totalScore: 80.55,
    status: 'system_approved',
    hasSpecialTalent: false,
    systemComment: '系统审核通过：学业成绩优秀，综合表现良好'
  }
];

export const AdminDashboard: React.FC = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'system_approved': return 'default';
      case 'pending': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'system_approved': return '待管理员审核';
      case 'pending': return '待系统审核';
      default: return status;
    }
  };

  const calculateProgress = (approved: number, quota: number) => {
    return Math.min((approved / quota) * 100, 100);
  };

  return (
    <div className="p-4 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl mb-1">推免审核管理</h1>
          <p className="text-sm text-gray-600">厦门大学信息学院推免工作管理平台</p>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          系统设置
        </Button>
      </div>

      {/* 审核流程统计 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">总申请数</p>
                <p className="text-2xl">{mockAdminStats.totalApplications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">待管理员审核</p>
                <p className="text-2xl">{mockAdminStats.pendingAdminReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">最终通过</p>
                <p className="text-2xl">{mockAdminStats.finalApproved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">已拒绝</p>
                <p className="text-2xl">{mockAdminStats.finalRejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 系统审核概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>系统审核概览</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl">{mockAdminStats.pendingSystemReview}</p>
              <p className="text-sm text-gray-600">待系统审核</p>
            </div>
            <div>
              <p className="text-2xl text-green-600">{mockAdminStats.systemApproved}</p>
              <p className="text-sm text-gray-600">系统通过</p>
            </div>
            <div>
              <p className="text-2xl text-red-600">{mockAdminStats.systemRejected}</p>
              <p className="text-sm text-gray-600">系统拒绝</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              系统审核主要检查：外语成绩是否达标、基本资格是否符合、材料是否完整等
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 各系推免进度 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>各系推免进度</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentStats.map((dept, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>{dept.department}</span>
                  <span className="text-gray-600">{dept.approved}/{dept.quota}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={calculateProgress(dept.approved, dept.quota)} 
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500 min-w-12">
                    {Math.round(calculateProgress(dept.approved, dept.quota))}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>申请: {dept.total}</span>
                  <span>录取率: {Math.round((dept.approved / dept.total) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 待管理员审核申请 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>待管理员审核申请</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockPendingApplications.map((application) => (
              <Card key={application.id} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm">{application.studentName}</h3>
                          {application.hasSpecialTalent && (
                            <Badge variant="secondary" className="text-xs">特殊学术专长</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          学号：{application.studentId} | {application.department}
                        </p>
                        <p className="text-xs text-gray-500">
                          专业：{application.major}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant={getStatusColor(application.status)}>
                          {getStatusText(application.status)}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          <p>GPA: {application.gpa}</p>
                          <p>排名: {application.ranking}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded text-xs">
                      <p className="text-gray-600 mb-1">系统审核意见：</p>
                      <p>{application.systemComment}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">提交时间：</span>
                        <span>{application.submittedAt}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">综合成绩：</span>
                        <span className="text-blue-600">{application.totalScore}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button size="sm" className="flex-1">
                        查看详情
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        通过
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1">
                        拒绝
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button className="w-full mt-4" variant="outline">
            查看所有待审核申请 ({mockAdminStats.pendingAdminReview})
          </Button>
        </CardContent>
      </Card>

      {/* 今日工作概览 */}
      <Card>
        <CardHeader>
          <CardTitle>今日工作概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">新增申请</span>
              <span className="text-lg">{mockAdminStats.todayApplications}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">系统审核通过率</span>
              <span className="text-lg text-green-600">84.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">平均审核时间</span>
              <span className="text-lg">1.8天</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">待处理事项</span>
              <span className="text-lg text-orange-600">{mockAdminStats.pendingAdminReview}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统提醒 */}
      <Card>
        <CardHeader>
          <CardTitle>系统提醒</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>有{mockAdminStats.pendingAdminReview}个申请等待管理员审核</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>推免申请截止时间临近，请及时处理</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>3名学生申请特殊学术专长推免</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>系统运行正常，审核效率稳定</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
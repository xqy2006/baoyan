import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity } from '../App';
import { Calendar, Clock, FileText, TrendingUp, Award, Users, GraduationCap, AlertCircle } from 'lucide-react';

interface StudentDashboardProps {
  onApply: (activity: Activity) => void;
}

// 根据保研条例，系统应显示所有可申请的推免项目（不是特定专业）
const mockActivities: Activity[] = [
  {
    id: '1',
    name: '厦门大学信息学院2025年推免生招生',
    department: '信息学院',
    type: '学术型硕士',
    deadline: '2025-10-31',
    description: '面向信息学院各专业优秀本科毕业生的推免招生，培养计算机、软件工程、人工智能、信息通信等领域的学术型研究生。'
  },
  {
    id: '2',
    name: '厦门大学信息学院2025年专业型硕士推免招生',
    department: '信息学院',
    type: '专业型硕士',
    deadline: '2025-10-31',
    description: '面向信息学院各专业优秀本科毕业生的专业型硕士推免招生，注重实践能力和工程应用能力培养。'
  },
  {
    id: '3',
    name: '厦门大学信息学院2025年直博生招生',
    department: '信息学院',
    type: '直博',
    deadline: '2025-10-31',
    description: '面向特别优秀的本科毕业生，直接攻读博士学位，在相关前沿领域进行深入研究。'
  }
];

// 模拟统计数据
const mockStats = {
  totalApplications: 1,
  systemApproved: 0,
  adminApproved: 0,
  rejected: 0
};

// 推免工作时间节点
const timelineEvents = [
  { date: '2025-09-01', event: '推免工作启动', status: 'completed' },
  { date: '2025-09-15', event: '学生申请开始', status: 'completed' },
  { date: '2025-10-31', event: '申请截止', status: 'current' },
  { date: '2025-11-15', event: '系统审核完成', status: 'pending' },
  { date: '2025-11-30', event: '学院审核完成', status: 'pending' },
  { date: '2025-12-10', event: '推免名单公示', status: 'pending' }
];

// 根据保研条例的基本要求
const generalRequirements = [
  '拥护中国共产党的领导，遵纪守法',
  '德智体美劳全面发展、身心健康',
  '学习成绩良好的应届本科毕业生',
  '在推免当年没有需要重修的课程（游泳课除外）',
  '无考试作弊、剽窃他人学术成果记录',
  '外语水平达标：CET4≥500分或CET6≥425分或TOEFL≥90分或IELTS≥6.0分',
  '本科毕业后无出国留学或参加就业的计划'
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onApply }) => {
  const getStatusColor = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 7) return 'destructive';
    if (daysLeft <= 14) return 'secondary';
    return 'default';
  };

  const getDaysLeft = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

  return (
    <div className="p-4 space-y-6">
      {/* 欢迎信息 */}
      <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl mb-1">厦门大学信息学院推免系统</h2>
              <p className="text-blue-100">2025年推荐免试攻读研究生申请平台</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">我的申请</p>
                <p className="text-2xl">{mockStats.totalApplications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">系统通过</p>
                <p className="text-2xl">{mockStats.systemApproved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 推免时间轴 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>推免工作进度</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timelineEvents.map((event, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  event.status === 'completed' ? 'bg-green-500' :
                  event.status === 'current' ? 'bg-blue-500' : 'bg-gray-300'
                }`}></div>
                <div className="flex-1 flex justify-between items-center">
                  <span className={`text-sm ${
                    event.status === 'current' ? 'text-blue-600' : 'text-gray-600'
                  }`}>{event.event}</span>
                  <span className="text-xs text-gray-500">{event.date}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 推免申请要求 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>推免基本要求</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            根据《厦门大学信息学院推荐优秀应届本科毕业生免试攻读研究生工作实施细则》
          </p>
          <div className="space-y-2">
            {generalRequirements.map((req, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                <span className="text-gray-700">{req}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 推免项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="w-5 h-5" />
            <span>推免招生项目</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            厦门大学信息学院2025年推免招生项目
          </p>
          <div className="space-y-4">
            {mockActivities.map((activity) => (
              <Card key={activity.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm mb-1">{activity.name}</h3>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                          <span className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{activity.department}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>截止：{activity.deadline}</span>
                          </span>
                        </div>
                        <Badge variant="outline" className="mb-2">
                          {activity.type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusColor(activity.deadline)}>
                          {getDaysLeft(activity.deadline)}天后截止
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed">
                      {activity.description}
                    </p>

                    <Button 
                      onClick={() => onApply(activity)}
                      className="w-full"
                      size="sm"
                    >
                      立即申请
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 重要提醒 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>重要提醒</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-yellow-800">
                    <span className="text-sm">推免综合成绩计算：</span>
                    <br />
                    学业综合成绩×80% + 学术专长成绩×15% + 综合表现成绩×5%
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-blue-800">
                    <span className="text-sm">材料准备：</span>
                    <br />
                    请提前准备外语成绩证明、获奖证书、论文发表证明等材料的电子版
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-green-800">
                    <span className="text-sm">特殊学术专长：</span>
                    <br />
                    发表A/B类高水平论文或获A+、A类竞赛国家一等奖可申请特殊学术专长推免
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
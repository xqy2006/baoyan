import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity } from '../App';
import { Calendar, Clock, FileText, TrendingUp, Award, Users, GraduationCap, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// 定义时间轴与基本要求
const timelineEvents = [
  { date: '2025-09-01', event: '推免工作启动', status: 'completed' },
  { date: '2025-09-15', event: '学生申请开始', status: 'completed' },
  { date: '2025-10-31', event: '申请截止', status: 'current' },
  { date: '2025-11-15', event: '系统审核完成', status: 'pending' },
  { date: '2025-11-30', event: '学院审核完成', status: 'pending' },
  { date: '2025-12-10', event: '推免名单公示', status: 'pending' }
];
const generalRequirements = [
  '拥护中国共产党的领导，遵纪守法',
  '德智体美劳全面发展、身心健康',
  '学习成绩良好的应届本科毕业生',
  '在推免当年没有需要重修的课程（游泳课除外）',
  '无考试作弊、剽窃他人学术成果记录',
  '外语水平达标：CET4≥500 或 CET6≥425 或 TOEFL≥90 或 IELTS≥6.0',
  '本科毕业后无出国留学或参加就业计划'
];

interface StudentDashboardProps {
  onApply: (activity: Activity) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onApply }) => {
  const { user } = useAuth();
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [myStats, setMyStats] = React.useState({ total:0, systemApproved:0 });
  const [appByActivity, setAppByActivity] = React.useState<Record<string,{id:string;status:string}>>({});

  React.useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch('/api/activities/active', { credentials:'include' });
        if (!res.ok) throw new Error('加载活动失败');
        const data = await res.json();
        // 后端 ActivityType 枚举 => 中文映射
        const typeMap: Record<string,string> = { ACADEMIC_MASTER:'学术型硕士', PROFESSIONAL_MASTER:'专业型硕士', PHD:'直博' };
        const mapped: Activity[] = data.map((a: any) => ({
          id: String(a.id),
          name: a.name,
          department: a.department,
            type: typeMap[a.type] || a.type,
          startTime: a.startTime || '',
          deadline: a.deadline ? a.deadline.substring(0,10) : '',
          description: a.description,
          isActive: a.active ?? a.isActive,
          maxApplications: a.maxApplications
        }));
        setActivities(mapped);
      } catch (e:any) { setError(e.message || '活动加载出错'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  React.useEffect(()=>{
    const loadMyApps = async () => {
      try {
        const res = await fetch('/api/applications/mine', { credentials:'include' });
        if(!res.ok) return; const data = await res.json();
        const total = data.length || 0;
        const systemApproved = data.filter((a:any)=> a.status==='SYSTEM_APPROVED' || a.status==='APPROVED').length;
        setMyStats({ total, systemApproved });
        const map: Record<string,{id:string;status:string}> = {};
        data.forEach((a:any)=>{ if(a.activityId) map[String(a.activityId)] = { id:String(a.id), status:a.status }; });
        setAppByActivity(map);
      } catch {}
    }; loadMyApps();
  }, []);

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

  const hasLocalDraft = React.useCallback((activityId:string)=>{
    if(!user) return false;
    try { return !!localStorage.getItem(`appDraft:${(user as any).id||user.studentId}:${activityId}`); } catch { return false; }
  },[user]);

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
                <p className="text-2xl">{myStats.total}</p>
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
                <p className="text-2xl">{myStats.systemApproved}</p>
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
            {generalRequirements.map((req, i)=>(
              <div key={i} className="flex items-start space-x-2 text-sm">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
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
            <span>可申请项目</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500">加载中...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && activities.length===0 && <div className="text-sm text-gray-500">暂无活动</div>}
          <div className="space-y-4">
            {activities.map((activity) => {
              const existed = appByActivity[activity.id];
              const existedStatus = existed?.status;
              const canReDraftStatuses = ['CANCELLED','REJECTED','SYSTEM_REJECTED'];
              const inProgress = existedStatus && !canReDraftStatuses.includes(existedStatus) && existedStatus !== 'DRAFT';
              const localOnly = !existed && hasLocalDraft(activity.id);
              let btnLabel: string;
              if(!existed){
                btnLabel = localOnly? '继续填写(本地草稿)':'立即申请';
              } else {
                switch(existedStatus){
                  case 'DRAFT': btnLabel = '继续填写'; break;
                  case 'CANCELLED':
                  case 'REJECTED':
                  case 'SYSTEM_REJECTED': btnLabel = '重新申请'; break;
                  case 'APPROVED': btnLabel = '已通过'; break;
                  case 'SYSTEM_APPROVED': btnLabel = '待人工审核'; break;
                  case 'ADMIN_REVIEWING': btnLabel = '人工审核中'; break;
                  case 'SYSTEM_REVIEWING': btnLabel = '系统审核中'; break;
                  default: btnLabel = '查看';
                }
              }
              return (
                <Card key={activity.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm mb-1 flex items-center gap-2">{activity.name}{localOnly && <Badge variant="secondary" className="text-[10px]">本地草稿</Badge>}</h3>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                            <span className="flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{activity.department}</span>
                            </span>
                            {activity.deadline && (
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>截止：{activity.deadline}</span>
                              </span>
                            )}
                          </div>
                          <Badge variant="outline" className="mb-2">
                            {activity.type}
                          </Badge>
                        </div>
                        <div className="text-right">
                          {activity.deadline && <Badge variant="secondary">{activity.deadline}</Badge>}
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed">
                        {activity.description}
                      </p>

                      <Button onClick={() => !inProgress && onApply(activity)} className="w-full" size="sm" disabled={!activity.isActive || inProgress || existedStatus==='APPROVED'}>
                        {activity.isActive? btnLabel:'未开放'}
                      </Button>
                      {(inProgress || existedStatus==='APPROVED') && (
                        <div className="mt-2 text-[11px] text-gray-500 leading-snug">
                          {existedStatus==='APPROVED' && '该活动申请已通过，不能再提交新的申请。'}
                          {inProgress && existedStatus!=='APPROVED' && '已有进行中的申请，需等待结果或取消后才能重新申请。'}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
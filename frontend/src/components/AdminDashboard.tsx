import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Users, FileText, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle, Settings } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = React.useState<any>(null);
  const [deptStats, setDeptStats] = React.useState<any[]>([]);
  const [pending, setPending] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(()=>{
    setLoading(true); setError('');
    Promise.all([
      fetch('/api/admin/stats',{credentials:'include'}),
      fetch('/api/admin/department-stats',{credentials:'include'}),
      // 优化：使用分页接口，只加载待审核的申请
      fetch('/api/applications/page?page=0&size=100&sortBy=submittedAt&sortDirection=DESC&statuses=SYSTEM_REVIEWING&statuses=SYSTEM_APPROVED&statuses=ADMIN_REVIEWING',{credentials:'include'})
    ]).then(async ([s,d,q])=>{
      if(!s.ok) throw new Error('统计接口失败');
      if(!d.ok) throw new Error('系别统计失败');
      if(!q.ok) throw new Error('审核队列获取失败');
      const sv = await s.json();
      const dv = await d.json();
      const qData = await q.json();
      const qv = qData.content || []; // 从分页响应中获取content

      setStats(sv); setDeptStats(dv);
      // 仅展示 system_approved / ADMIN_REVIEWING / SYSTEM_REVIEWING
      const mapStatus=(st:string)=>{
        switch(st){
          case 'SYSTEM_REVIEWING': return 'system_reviewing';
          case 'SYSTEM_APPROVED': return 'system_approved';
          case 'ADMIN_REVIEWING': return 'admin_reviewing';
          default: return st.toLowerCase();
        }
      };
      setPending(qv.filter((a:any)=>['SYSTEM_APPROVED','SYSTEM_REVIEWING','ADMIN_REVIEWING'].includes(a.status)).map((a:any)=>({
        id: a.id,
        studentName: (a.content && JSON.parse(a.content).basicInfo?.name)||a.userStudentId||'—',
        studentId: a.userStudentId,
        department: a.activity?.department || '—',
        major: JSON.parse(a.content||'{}').basicInfo?.major || '—',
        submittedAt: a.submittedAt?.replace('T',' ').substring(0,10) || '-',
        gpa: JSON.parse(a.content||'{}').basicInfo?.gpa || a.academicScore || '-',
        ranking: '-',
        totalScore: a.totalScore || 0,
        status: mapStatus(a.status),
        hasSpecialTalent: false,
        systemComment: a.systemReviewComment
      })));
    }).catch(e=> setError(e.message||'加载失败')).finally(()=> setLoading(false));
  },[]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-6 overflow-x-hidden p-3 sm:p-4 md:p-6">
      {/* 页面标题 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">推免审核管理</h1>
          <p className="text-xs sm:text-sm text-gray-600 break-words">厦门大学信息学院推免工作管理平台</p>
        </div>
      </div>
      {loading && <div className='text-xs sm:text-sm text-gray-500'>加载中...</div>}
      {error && <div className='text-xs sm:text-sm text-red-600 break-words'>{error}</div>}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">总申请数</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.totalApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">待管理员审核</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.pendingAdminReview}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">最终通过</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.finalApproved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">已拒绝</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.finalRejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {stats && (
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
                <p className="text-2xl">{stats.pendingSystemReview}</p>
                <p className="text-sm text-gray-600">系统审核中</p>
              </div>
              <div>
                <p className="text-2xl text-green-600">{stats.systemApproved}</p>
                <p className="text-sm text-gray-600">系统通过</p>
              </div>
              <div>
                <p className="text-2xl text-red-600">{stats.systemRejected}</p>
                <p className="text-sm text-gray-600">系统拒绝</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {deptStats.length>0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>各系推免进度</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deptStats.map((d,i)=>{
                const quota =  (d.approved||0)+( (d.total||0)>(d.approved||0)? Math.max((d.total - d.approved),0):0);
                const progress = d.approved && quota? Math.min(100, Math.round(d.approved/ (d.total||1) *100)):0;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{d.department}</span>
                      <span className="text-gray-600">{d.approved||0}/{d.total||0}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                      <div style={{width: progress+ '%'}} className="h-2 bg-blue-500"/>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>申请: {d.total||0}</span>
                      <span>通过: {d.approved||0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>待处理申请</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length===0?
            <div className='text-sm text-gray-500'>暂无待处理申请</div>
            :
            <div className='space-y-3'>
              {pending.slice(0,8).map(p=>(
                <Card key={p.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{p.studentName}</span>
                      <Badge variant='outline'>{p.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      <span>学号: {p.studentId}</span>
                      <span>提交: {p.submittedAt}</span>
                      <span>GPA: {p.gpa}</span>
                      <span>得分: {p.totalScore}</span>
                    </div>
                    {p.systemComment &&
                      <div className='bg-gray-50 p-2 rounded'>
                        {p.systemComment}
                      </div>
                    }
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
};
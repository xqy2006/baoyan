import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Application } from '../App';
import { CheckCircle, XCircle, Clock, Calendar, FileText, AlertTriangle, Eye } from 'lucide-react';
import { Input } from './ui/input';
import { exportApplicationsExcel } from './utils/exportExcel';

interface ApplicationListProps {
  user: User;
  onReview?: (application: Application) => void;
}

const statusMap: Record<string,string> = {
  DRAFT: 'pending',
  SYSTEM_REVIEWING: 'system_reviewing',
  SYSTEM_APPROVED: 'system_approved',
  SYSTEM_REJECTED: 'system_rejected',
  ADMIN_REVIEWING: 'admin_reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const ApplicationList: React.FC<ApplicationListProps> = ({ user, onReview }) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const isAdmin = user.role === 'ADMIN';

  const mapBackendApp = (a:any): Application => {
    const content = a.content? (()=>{try{return JSON.parse(a.content);}catch{return {};}})():{};
    const basic = content.basicInfo || {};
    return {
      id: String(a.id),
      studentId: a.userStudentId || basic.studentId || '未知',
      studentName: basic.name || a.userStudentId || '未知',
      activityId: String(a.activityId || ''),
      activityName: a.activityName || '活动',
      status: (statusMap[a.status] || 'pending') as Application['status'],
      submittedAt: a.submittedAt || '-',
      systemReviewedAt: a.systemReviewedAt || undefined,
      adminReviewedAt: a.adminReviewedAt || undefined,
      systemReviewComment: a.systemReviewComment || undefined,
      adminReviewComment: a.adminReviewComment || undefined,
      basicInfo: {
        name: basic.name || '—',
        studentId: basic.studentId || a.userStudentId || '—',
        gender: basic.gender || '男',
        department: basic.department || '—',
        major: basic.major || '—',
        gpa: basic.gpa || 0,
        academicRanking: basic.academicRanking || 0,
        totalStudents: basic.totalStudents || 0
      },
      languageScores: content.languageScores || {},
      academicAchievements: content.academicAchievements || { publications:[], patents:[], competitions:[], innovationProjects:[], totalAcademicScore:0 },
      comprehensivePerformance: content.comprehensivePerformance || { volunteerService:{hours:0, awards:[], totalScore:0}, socialWork:[], honors:[], sportsCompetitions:[], totalPerformanceScore:0 },
      calculatedScores: content.calculatedScores || { academicScore: a.academicScore||0, academicAchievementScore: a.achievementScore||0, performanceScore: a.performanceScore||0, totalScore: a.totalScore||0 },
      calculatedRaw: content.calculatedRaw,
      personalStatement: content.personalStatement || '',
      uploadedFiles: content.uploadedFiles || { languageCertificates:[], academicDocuments:[], transcripts:[], recommendationLetters:[] },
      specialAcademicTalent: content.specialAcademicTalent || (content.isSpecialTalent? { isApplying: !!content.isSpecialTalent, description: content.specialTalentDesc, achievements: content.specialTalentAchievements, professors: content.professors||[] }: undefined)
    } as Application;
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      let url = '/api/applications';
      if (user.role === 'STUDENT') url = '/api/applications/mine';
      else if (user.role !== 'ADMIN') url = '/api/applications/review-queue';
      const res = await fetch(url, { credentials:'include' });
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      const arr = Array.isArray(data)? data : [data];
      setApplications(arr.map(mapBackendApp));
    } catch (e:any) { setError(e.message || '获取申请失败'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, [user.role]);

  const action = async (id:string, endpoint:string, body?:any) => {
    const res = await fetch(`/api/applications/${id}/${endpoint}`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: body? JSON.stringify(body): undefined });
    if (!res.ok) { const err= await res.json().catch(()=>({})); throw new Error(err.error||'操作失败'); }
    await load();
  };

  const handleSystemReview = (id:string)=> action(id,'system-review').catch(e=>alert(e.message));
  const handleStartAdmin = (id:string)=> action(id,'admin-start').catch(e=>alert(e.message));
  const handleAdminApprove = (id:string)=> action(id,'admin-review', { approve:true, comment: reviewComment }).catch(e=>alert(e.message));
  const handleAdminReject = (id:string)=> {
    if (!reviewComment) { alert('请输入拒绝理由'); return; }
    action(id,'admin-review',{ approve:false, comment: reviewComment }).catch(e=>alert(e.message));
  };

  const deletable = (app:Application) => {
    // 使用后端状态映射前的原枚举已转为 statusMap -> 我们判断原字符串对应
    return app.status==='pending' || app.status==='system_reviewing';
  };

  const deleteApp = async (id:string) => {
    if(!window.confirm('确认删除该申请？')) return;
    try {
      const res = await fetch(`/api/applications/${id}`, { method:'DELETE', credentials:'include' });
      if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error||'删除失败'); }
      await load();
    } catch(e:any){ alert(e.message); }
  };

  const getStatusInfo = (status: Application['status']) => {
    switch (status) {
      case 'pending': return { color: 'secondary', icon: Clock, text: '待系统审核', className: '' };
      case 'system_reviewing': return { color: 'default', icon: AlertTriangle, text: '系统审核中', className: '' };
      case 'system_approved': return { color: 'default', icon: Eye, text: '待管理员审核', className: 'bg-blue-100 text-blue-800' };
      case 'system_rejected': return { color: 'destructive', icon: XCircle, text: '系统审核未通过', className: '' };
      case 'admin_reviewing': return { color: 'default', icon: Eye, text: '管理员审核中', className: '' };
      case 'approved': return { color: 'default', icon: CheckCircle, text: '审核通过', className: 'bg-green-100 text-green-800' };
      case 'rejected': return { color: 'destructive', icon: XCircle, text: '审核未通过', className: '' };
      default: return { color: 'secondary', icon: Clock, text: '未知状态', className: '' };
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg">{user.role === 'ADMIN' ? '推免申请审核' : (user.role==='STUDENT'? '我的推免申请':'审核队列')}</h1>
          <p className="text-sm text-gray-600">{user.role === 'ADMIN' ? '厦门大学信息学院推免申请管理' : '查看申请状态和详细信息'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{loading? '加载中...' : `共 ${applications.length} 个申请`}</span>
          {isAdmin && applications.length>0 && <Button size="sm" variant="outline" onClick={()=>exportApplicationsExcel(applications)}>导出Excel</Button>}
        </div>
      </div>
      {isAdmin && applications.length>0 && (
        <div className="text-xs text-gray-500 pb-1">显示列：学业综合 / 学术专长(加权) / 综合表现(加权) / 总成绩</div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="space-y-4">
        {applications.map(application => {
          const statusInfo = getStatusInfo(application.status);
          const StatusIcon = statusInfo.icon;
          return (
            <Card key={application.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm">{application.activityName}</h3>
                        {application.specialAcademicTalent?.isApplying && (
                          <Badge variant="secondary" className="text-xs">特殊学术专长</Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="text-xs text-gray-500 mb-2">
                          <p>申请人：{application.studentName} ({application.studentId})</p>
                        </div>
                      )}
                      <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center space-x-1"><Calendar className="w-3 h-3" /><span>{application.submittedAt? `提交于 ${application.submittedAt}`:'未提交'}</span></span>
                        <span className="flex items-center space-x-1"><FileText className="w-3 h-3" /><span>状态: {statusInfo.text}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={statusInfo.color as any} className={statusInfo.className}>{statusInfo.text}</Badge>
                      <Button size="sm" variant="outline" onClick={()=> onReview && onReview(application)}>详情</Button>
                      {!isAdmin && deletable(application) && <Button size="sm" variant="destructive" onClick={()=>deleteApp(application.id)}>删除</Button>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {application.status==='system_reviewing' && <Button size="xs" variant="outline" onClick={()=>handleSystemReview(application.id)}>系统审核</Button>}
                      {application.status==='system_approved' && <Button size="xs" variant="outline" onClick={()=>handleStartAdmin(application.id)}>进入人工审核</Button>}
                      {application.status==='admin_reviewing' && (
                        <>
                          <Input placeholder="审核意见" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} className="h-7 w-48" />
                          <Button size="xs" onClick={()=>handleAdminApprove(application.id)}>通过</Button>
                          <Button size="xs" variant="destructive" onClick={()=>handleAdminReject(application.id)}>拒绝</Button>
                        </>
                      )}
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-600 mt-2">
                      <span>学业:{(application.calculatedScores?.academicScore||0).toFixed(2)}</span>
                      <span>专长:{(application.calculatedScores?.academicAchievementScore||0).toFixed(2)}</span>
                      <span>综合:{(application.calculatedScores?.performanceScore||0).toFixed(2)}</span>
                      <span>总分:{(application.calculatedScores?.totalScore||0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && applications.length===0 && <div className="text-sm text-gray-500">暂无申请</div>}
      </div>
    </div>
  );
};
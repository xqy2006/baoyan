import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Application } from '../App';
import { CheckCircle, XCircle, Clock, Calendar, FileText, AlertTriangle, Eye } from 'lucide-react';
import { Input } from './ui/input';
import { exportApplicationsExcel } from './utils/exportExcel';
import { toast } from 'sonner';
import { ConfirmDialog, InputDialog } from './ui/confirm-dialog';
import { SearchBox } from './SearchBox';
import { Pagination } from './Pagination';

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
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export const ApplicationList: React.FC<ApplicationListProps> = ({ user, onReview }) => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewComments, setReviewComments] = useState<Record<string,string>>({});
  const [pendingCancelId, setPendingCancelId] = useState<string|null>(null);
  const [reopenDialogId, setReopenDialogId] = useState<string|null>(null);

  // 分页和搜索状态
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const isAdmin = user.role === 'ADMIN';
  const isReviewer = user.role === 'REVIEWER';
  const isStudent = user.role === 'STUDENT';

  // 添加调试日志
  console.log('[ApplicationList] 渲染 - page:', page, 'pageSize:', pageSize, 'searchKeyword:', searchKeyword, 'statusFilter:', statusFilter);

  const mapBackendApp = (a:any): Application => {
    const content = a.content? (()=>{try{return JSON.parse(a.content);}catch{return {};}})():{};
    const basic = content.basicInfo || {};
    return {
      id: String(a.id),
      studentId: a.userStudentId || basic.studentId || '未知',
      studentName: basic.name || a.userStudentId || '未知',
      activityId: String(a.activityId || ''),
      activityName: a.activityName || a.activity?.name || '未知活动',
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

  // 使用 useEffect 直接处理加载逻辑
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        let url = '';
        let usePagination = false;

        if (isStudent) {
          // 学生查看自己的申请，不需要分页
          url = '/api/applications/mine';
        } else if (isAdmin || isReviewer) {
          // 管理员和审核员使用分页API
          url = '/api/applications/page';
          usePagination = true;
        }

        if (usePagination) {
          // 构建分页查询参数
          const params = new URLSearchParams({
            page: page.toString(),
            size: pageSize.toString(),
            sortBy: 'id',
            sortDirection: 'DESC'
          });

          if (searchKeyword) {
            params.append('search', searchKeyword);
          }

          if (statusFilter.length > 0) {
            statusFilter.forEach(s => params.append('statuses', s));
          }

          url += '?' + params.toString();
        }

        const res = await fetch(url, { credentials:'include' });
        if (!res.ok) throw new Error('加载失败');
        const data = await res.json();

        if (usePagination && data.content) {
          // 分页响应
          setApplications(data.content.map(mapBackendApp));
          setTotalElements(data.totalElements || 0);
          setTotalPages(data.totalPages || 0);
        } else {
          // 非分页响应
          const arr = Array.isArray(data) ? data : [data];
          setApplications(arr.map(mapBackendApp));
          setTotalElements(arr.length);
          setTotalPages(1);
        }
      } catch (e:any) {
        setError(e.message || '获取申请失败');
      } finally {
        setLoading(false);
      }
    };

    load();
    // 注意：不依赖 isAdmin, isReviewer, isStudent，因为它们来自 user.role，不会在组件生命周期内改变
  }, [page, pageSize, searchKeyword, statusFilter]);

  // 保存 load 函数的引用供其他地方调用
  const loadRef = useRef<() => Promise<void>>();
  useEffect(() => {
    loadRef.current = async () => {
      setLoading(true); setError('');
      try {
        let url = '';
        let usePagination = false;

        if (isStudent) {
          url = '/api/applications/mine';
        } else if (isAdmin || isReviewer) {
          url = '/api/applications/page';
          usePagination = true;
        }

        if (usePagination) {
          const params = new URLSearchParams({
            page: page.toString(),
            size: pageSize.toString(),
            sortBy: 'id',
            sortDirection: 'DESC'
          });
          if (searchKeyword) params.append('search', searchKeyword);
          if (statusFilter.length > 0) statusFilter.forEach(s => params.append('statuses', s));
          url += '?' + params.toString();
        }

        const res = await fetch(url, { credentials:'include' });
        if (!res.ok) throw new Error('加载失败');
        const data = await res.json();

        if (usePagination && data.content) {
          setApplications(data.content.map(mapBackendApp));
          setTotalElements(data.totalElements || 0);
          setTotalPages(data.totalPages || 0);
        } else {
          const arr = Array.isArray(data) ? data : [data];
          setApplications(arr.map(mapBackendApp));
          setTotalElements(arr.length);
          setTotalPages(1);
        }
      } catch (e:any) {
        setError(e.message || '获取申请失败');
      } finally {
        setLoading(false);
      }
    };
  });

  const handleSearch = useCallback((keyword: string) => {
    console.log('[ApplicationList] handleSearch 调用:', keyword);
    setSearchKeyword(keyword);
    setPage(0); // 搜索时重置到第一页
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    console.log('[ApplicationList] handlePageChange 调用 - 从', page, '到', newPage);
    setPage(newPage);
  }, [page]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    console.log('[ApplicationList] handlePageSizeChange 调用:', newSize);
    setPageSize(newSize);
    setPage(0); // 改变每页大小时重置到第一页
  }, []);

  const handleStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setPage(0); // 筛选时重置到第一页
  }, []);

  const action = async (id:string, endpoint:string, body?:any) => {
    const res = await fetch(`/api/applications/${id}/${endpoint}`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: body? JSON.stringify(body): undefined });
    if (!res.ok) { const err= await res.json().catch(()=>({})); throw new Error(err.error||'操作失败'); }
    if (loadRef.current) await loadRef.current();
  };

  const handleAdminStart = (id:string)=> action(id,'admin-start').catch(e=>toast.error(e.message));
  const handleAdminApprove = (id:string)=> action(id,'admin-review', { approve:true, comment: reviewComments[id]||'' }).catch(e=>toast.error(e.message));
  const handleAdminReject = (id:string)=> {
    const rc = reviewComments[id]||'';
    if (!rc) { toast.error('请输入拒绝理由'); return; }
    action(id,'admin-review',{ approve:false, comment: rc }).catch(e=>toast.error(e.message));
  };
  const handleCancel = (id:string) => { setPendingCancelId(id); };
  const confirmCancel = () => {
    if(!pendingCancelId) return;
    action(pendingCancelId,'cancel')
      .then(()=> { toast.success('已取消，可重新申请'); })
      .catch(e=>toast.error(e.message))
      .finally(()=> setPendingCancelId(null));
  };
  const submitReopen = (id:string, reason:string) => {
    action(id,'admin-reopen', reason.trim()? { reason: reason.trim() }: undefined)
      .then(()=> { toast.success('已重新进入人工审核'); })
      .catch(e=>toast.error(e.message))
      .finally(()=> setReopenDialogId(null));
  };

  const getStatusInfo = (status: Application['status']) => {
    switch (status) {
      case 'pending': return { color: 'secondary', icon: Clock, text: '待系统审核', className: '' };
      case 'system_reviewing': return { color: 'default', icon: AlertTriangle, text: '系统审核中', className: '' };
      case 'system_approved': return { color: 'default', icon: Eye, text: '待管理员审核', className: 'bg-blue-100 text-blue-800' };
      case 'system_rejected': return { color: 'destructive', icon: XCircle, text: '系统未通过', className: '' };
      case 'admin_reviewing': return { color: 'default', icon: Eye, text: '人工审核中', className: '' };
      case 'approved': return { color: 'default', icon: CheckCircle, text: '审核通过', className: 'bg-green-100 text-green-800' };
      case 'rejected': return { color: 'destructive', icon: XCircle, text: '审核未通过', className: '' };
      case 'cancelled': return { color: 'outline', icon: XCircle, text: '已取消', className: 'bg-gray-200 text-gray-600' };
      default: return { color: 'secondary', icon: Clock, text: '未知状态', className: '' };
    }
  };

  const allStatuses = [
    { key: 'SYSTEM_REVIEWING', label: '系统审核中', color: 'bg-blue-500 hover:bg-blue-600' },
    { key: 'ADMIN_REVIEWING', label: '人工审核中', color: 'bg-blue-500 hover:bg-blue-600' },
    { key: 'APPROVED', label: '已通过', color: 'bg-green-500 hover:bg-green-600' },
    { key: 'REJECTED', label: '已拒绝', color: 'bg-red-500 hover:bg-red-600' }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 overflow-x-hidden p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">
            {user.role === 'ADMIN' ? '推免申请审核' : (user.role==='STUDENT'? '我的推免申请':'审核队列')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 break-words">
            {user.role === 'ADMIN' ? '厦门大学信息学院推免申请管理' : '查看申请状态和详细信息'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            {loading ? '加载中...' : `共 ${totalElements} 个申请`}
          </span>
          {isAdmin && applications.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => exportApplicationsExcel(applications)}>
              <span className="text-xs sm:text-sm">导出Excel</span>
            </Button>
          )}
        </div>
      </div>

      {/* 搜索和筛选 - 仅管理员和审核员可见 */}
      {(isAdmin || isReviewer) && (
        <div className="flex flex-col gap-4">
          <SearchBox
            placeholder="搜索学号、姓名或活动..."
            onSearch={handleSearch}
            defaultValue={searchKeyword}
          />

          {/* 状态筛选 */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 self-center">筛选状态:</span>
            {allStatuses.map(status => (
              <Button
                key={status.key}
                variant={statusFilter.includes(status.key) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilterChange(status.key)}
                className={statusFilter.includes(status.key) ? `${status.color} text-white` : ''}
              >
                {status.label}
              </Button>
            ))}
            {statusFilter.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter([])}
              >
                清除筛选
              </Button>
            )}
          </div>
        </div>
      )}

      {isAdmin && applications.length > 0 && (
        <div className="text-xs text-gray-500 pb-1">
          显示列：学业综合(0-80) / 学术专长(0-15) / 综合表现(0-5) / 总成绩(0-100)
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-3 sm:space-y-4">
        {applications.map(application => {
          const statusInfo = getStatusInfo(application.status);
          const StatusIcon = statusInfo.icon;
          return (
            <Card key={application.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className="text-sm sm:text-base font-medium break-words">{application.activityName}</h3>
                        {application.specialAcademicTalent?.isApplying && (
                          <Badge variant="secondary" className="text-xs">特殊学术专长</Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="text-xs text-gray-500 mb-2">
                          <p>申请人：{application.studentName} ({application.studentId})</p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 flex-shrink-0" /><span className="break-words">{application.submittedAt? `提交于 ${application.submittedAt}`:'未提交'}</span></span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3 flex-shrink-0" /><span>状态: {statusInfo.text}</span></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Badge variant={statusInfo.color as any} className={`${statusInfo.className} text-[10px] sm:text-xs`}>{statusInfo.text}</Badge>
                      <Button size="sm" variant="outline" onClick={()=> onReview && onReview(application)}><span className="text-xs sm:text-sm">详情</span></Button>
                      {(isAdmin || isReviewer) && (application.status==='approved' || application.status==='rejected') && (
                        <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={()=> setReopenDialogId(application.id)}>重新审核</Button>
                      )}
                      {isStudent && application.status!=='cancelled' && application.status!=='approved' && (
                        <Button size="sm" variant="destructive" onClick={()=>handleCancel(application.id)}>取消</Button>
                      )}
                      {isStudent && application.status==='cancelled' && application.activityId && (
                        <Button size="sm" variant="outline" onClick={()=> navigate(`/apply/${application.activityId}`)}>重新编辑</Button>
                      )}
                    </div>
                  </div>
                  {(isAdmin || isReviewer) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                      {application.status==='system_approved' && <Button size="sm" variant="outline" onClick={()=>handleAdminStart(application.id)}><span className="text-xs sm:text-sm">进入人工审核</span></Button>}
                      {application.status==='admin_reviewing' && (
                        <>
                          <Input placeholder="审核意见(拒绝必填)" value={reviewComments[application.id]||''} onChange={e=> setReviewComments(m=>({...m,[application.id]:e.target.value}))} className="h-8 text-xs sm:text-sm w-full sm:w-52" />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="min-w-[64px] flex-1 sm:flex-initial"
                              onClick={()=>handleAdminApprove(application.id)}
                            ><span className="text-xs sm:text-sm">通过</span></Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              aria-label="拒绝申请"
                              className="min-w-[64px] flex-1 sm:flex-initial"
                              onClick={()=>handleAdminReject(application.id)}
                            ><span className="text-xs sm:text-sm">拒绝</span></Button>
                          </div>
                        </>
                      )}
                      {isAdmin && application.status!=='approved' && application.status!=='cancelled' && application.status!=='admin_reviewing' && application.status!=='system_reviewing' && application.status!=='system_approved' && application.status!=='rejected' && <Button size="xs" variant="outline" onClick={()=>handleCancel(application.id, (application as any).activityId)}>取消</Button>}
                      {isAdmin && application.status==='cancelled' && application.activityId && <Button size="xs" variant="outline" onClick={()=> navigate(`/apply/${application.activityId}`)}>重新编辑</Button>}
                    </div>
                  )}
                  {(isAdmin || isReviewer) && (
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
        {!loading && applications.length === 0 && (
          <div className="text-sm text-gray-500">
            {searchKeyword || statusFilter.length > 0 ? '没有找到匹配的申请' : '暂无申请'}
          </div>
        )}
      </div>

      {/* 分页控件 - 仅管理员和审核员可见 */}
      {(isAdmin || isReviewer) && totalPages > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalElements={totalElements}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <ConfirmDialog open={!!pendingCancelId} onOpenChange={o=>{ if(!o) setPendingCancelId(null); }} title="确认取消申请" description={<div>取消后该记录状态将变为“已取消”，可重新发起新的申请草稿。<br/>确定继续？</div>} confirmText="确认取消" destructive onConfirm={confirmCancel} />
      <InputDialog open={!!reopenDialogId} onOpenChange={o=>{ if(!o) setReopenDialogId(null); }} title="重新审核" placeholder="复核理由(可选)" confirmText="发起复核" onConfirm={(val)=> reopenDialogId && submitReopen(reopenDialogId, val)} />
    </div>
  );
};

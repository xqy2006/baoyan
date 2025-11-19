import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Application, User } from '../App';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  FileText, 
  User as UserIcon, 
  Download,
  Eye,
  AlertTriangle,
  Calculator,
  Star,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ui/confirm-dialog';

interface ApplicationReviewProps {
  application: Application;
  user: User;
  onBack: () => void;
}

export const ApplicationReview: React.FC<ApplicationReviewProps> = ({ application, user, onBack }) => {
  // Parse initial content to extract uploadedFiles if present
  let initialApp: any = application;
  try {
    if ((application as any).content) {
      const parsed = JSON.parse((application as any).content);
      if (parsed.uploadedFiles) {
        initialApp = { ...application, uploadedFiles: parsed.uploadedFiles, basicInfo: parsed.basicInfo || application.basicInfo || {}, languageScores: parsed.languageScores || application.languageScores || {}, academicAchievements: parsed.academicAchievements || application.academicAchievements || {}, comprehensivePerformance: parsed.comprehensivePerformance || application.comprehensivePerformance || {}, specialAcademicTalent: parsed.specialAcademicTalent || application.specialAcademicTalent };
      }
    }
  } catch { /* ignore parse error */ }
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appState, setAppState] = useState<Application>(initialApp);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN';
  const isReviewer = user.role === 'REVIEWER';
  const isStudent = user.role === 'STUDENT';

  const downloadPdf = async () => {
    try {
      const res = await fetch(`/api/applications/${appState.id}/export/pdf`, { credentials:'include' });
      if(!res.ok){ const err = await res.json().catch(()=>({})); throw new Error(err.error||'导出失败'); }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `application-${appState.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
      toast.success('PDF 导出成功');
    } catch(e:any){ toast.error(e.message); }
  };

  const viewFile = (id?:number) => { if(!id) return; window.open(`/api/files/${id}/raw`, '_blank'); };
  const downloadFile = (id?:number) => { if(!id) return; window.open(`/api/files/${id}/download`, '_blank'); };

  // 新增：空值保护，防止 map 调用 undefined
  const uploadedFiles = appState.uploadedFiles || { languageCertificates:[], academicDocuments:[], transcripts:[], recommendationLetters:[] } as any;
  const academic = appState.academicAchievements || { publications:[], competitions:[], patents:[] } as any;
  const compPerf = appState.comprehensivePerformance || { volunteerService:{hours:0,totalScore:0}, socialWork:[], honors:[] } as any;

  const refresh = async (id: string) => {
    try {
      const res = await fetch(`/api/applications/${id}`, { credentials:'include' });
      if (res.ok) {
        const data = await res.json();
        const content = data.content? (()=>{ try { return JSON.parse(data.content);} catch { return {}; } })(): {};
        const map: Record<string, Application['status']> = {
          DRAFT: 'pending',
          SYSTEM_REVIEWING: 'system_reviewing',
          SYSTEM_APPROVED: 'system_approved',
          SYSTEM_REJECTED: 'system_rejected',
          ADMIN_REVIEWING: 'admin_reviewing',
          FIRST_REVIEW_PENDING: 'first_review_pending',
          FIRST_REVIEW_APPROVED: 'first_review_approved',
          FIRST_REVIEW_REJECTED: 'first_review_rejected',
          SECOND_REVIEW_PENDING: 'second_review_pending',
          APPROVED: 'approved',
          REJECTED: 'rejected'
        };
        setAppState(prev=> ({
          ...prev,
          status: map[data.status]||prev.status,
          systemReviewComment: data.systemReviewComment || prev.systemReviewComment,
          adminReviewComment: data.adminReviewComment || prev.adminReviewComment,
          firstReviewerName: data.firstReviewerName || prev.firstReviewerName,
          firstReviewedAt: data.firstReviewedAt || prev.firstReviewedAt,
          firstReviewComment: data.firstReviewComment || prev.firstReviewComment,
          secondReviewerName: data.secondReviewerName || prev.secondReviewerName,
          secondReviewedAt: data.secondReviewedAt || prev.secondReviewedAt,
          secondReviewComment: data.secondReviewComment || prev.secondReviewComment,
          calculatedScores: content.calculatedScores || { academicScore:data.academicScore||0, academicAchievementScore:data.achievementScore||0, performanceScore:data.performanceScore||0, totalScore:data.totalScore||0 },
          calculatedRaw: content.calculatedRaw || prev.calculatedRaw,
          specialAcademicTalent: content.specialAcademicTalent || prev.specialAcademicTalent,
          uploadedFiles: content.uploadedFiles || prev.uploadedFiles,
          basicInfo: content.basicInfo || prev.basicInfo,
          languageScores: content.languageScores || prev.languageScores,
          academicAchievements: content.academicAchievements || prev.academicAchievements,
          comprehensivePerformance: content.comprehensivePerformance || prev.comprehensivePerformance
        } as any));
      }
    } catch{/* ignore */}
  };

  const call = async (endpoint: string, body?: any) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${appState.id}/${endpoint}`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: body? JSON.stringify(body): undefined });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || '操作失败');
      }
      await refresh(appState.id);
      toast.success('操作成功');
    } catch (e:any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleApprove = () => {
    if (!reviewComment) { setConfirmApproveOpen(true); return; }
    call('admin-review', { approve:true, comment: reviewComment });
  };
  const confirmApproveNoComment = () => { call('admin-review', { approve:true, comment: reviewComment }); };
  const handleReject = () => {
    if (!reviewComment) { toast.error('请填写拒绝理由'); return; }
    call('admin-review', { approve:false, comment: reviewComment });
  };

  // 第一审核员审核
  const handleFirstReviewApprove = () => {
    call('first-review', { approve: true, comment: reviewComment });
  };
  const handleFirstReviewReject = () => {
    if (!reviewComment) { toast.error('拒绝操作必须填写审核意见'); return; }
    call('first-review', { approve: false, comment: reviewComment });
  };

  // 第二审核员审核
  const handleSecondReviewApprove = () => {
    // 前端校验：避免同一审核员进行一审和二审
    if (appState.firstReviewerName && appState.firstReviewerName === (user.name || user.username || user.studentId)) {
      toast.error('当前账号已执行过第一次审核，不能再次进行第二次审核。');
      return;
    }
    call('second-review', { approve: true, comment: reviewComment });
  };
  const handleSecondReviewReject = () => {
    if (appState.firstReviewerName && appState.firstReviewerName === (user.name || user.username || user.studentId)) {
      toast.error('当前账号已执行过第一次审核，不能再次进行第二次审核。');
      return;
    }
    if (!reviewComment) { toast.error('拒绝操作必须填写审核意见'); return; }
    call('second-review', { approve: false, comment: reviewComment });
  };

  // 后端分值：academicScore 0-80; academicAchievementScore 0-15; performanceScore 0-5; total = sum
  const academicScore = appState.calculatedScores?.academicScore ?? 0; // 0-80
  const specScore = appState.calculatedScores?.academicAchievementScore ?? 0; // 0-15
  const perfScore = appState.calculatedScores?.performanceScore ?? 0; // 0-5
  const totalScore = appState.calculatedScores?.totalScore ?? (academicScore + specScore + perfScore);

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'system_approved': return 'bg-blue-100 text-blue-800';
      case 'first_review_pending': return 'bg-yellow-100 text-yellow-800';
      case 'first_review_approved': return 'bg-blue-100 text-blue-800';
      case 'first_review_rejected': return 'bg-red-100 text-red-800';
      case 'second_review_pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'system_rejected': return 'bg-red-100 text-red-800';
      case 'admin_reviewing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Application['status']) => {
    switch (status) {
      case 'system_approved': return '待管理员审核';
      case 'first_review_pending': return '等待第一次审核';
      case 'first_review_approved': return '等待第二次审核';
      case 'first_review_rejected': return '第一次审核未通过';
      case 'second_review_pending': return '等待第二次审核';
      case 'approved': return '已通过';
      case 'rejected': return '已拒绝';
      case 'system_rejected': return '系统拒绝';
      case 'admin_reviewing': return '审核中';
      default: return '审核中';
    }
  };

  // 通用的证明材料缩略卡片组件，供多个区域复用
  const FileThumb: React.FC<{file:any}> = ({ file }) => {
    if (!file || !file.id) return null;
    const isImg = file.contentType?.startsWith('image/');
    return (
      <div className="border rounded p-2 bg-white shadow-sm" key={file.id}>
        <div className="text-[11px] text-gray-500 mb-1 break-all">{file.originalFilename || file.name || '附件'}</div>
        {isImg ? (
          <img
            src={`/api/files/${file.id}/raw`}
            alt={file.originalFilename || 'proof'}
            className="max-h-48 object-contain mx-auto cursor-pointer"
            onClick={() => viewFile(file.id)}
          />
        ) : (
          <div className="flex gap-2 flex-wrap text-[11px]">
            <Button size="xs" variant="outline" onClick={()=>viewFile(file.id)}>查看</Button>
            <Button size="xs" variant="outline" onClick={()=>downloadFile(file.id)}>下载</Button>
          </div>
        )}
      </div>
    );
  };

  // 从条目对象上提取 proofFile（单个或数组）
  const getProofFiles = (item: any) => {
    const files: any[] = [];
    if (!item?.proofFile) return files;
    const src = item.proofFile;
    if (Array.isArray(src)) {
      src.forEach(f => { if (f && f.id) files.push(f); });
    } else if (src.id) {
      files.push(src);
    }
    return files;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 overflow-x-hidden p-3 sm:p-4 md:p-6">
      {/* 头部信息 */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg md:text-xl font-semibold break-words">申请审核详情</h1>
          <p className="text-xs sm:text-sm text-gray-600 break-words">{(appState as any).activityName}</p>
        </div>
        {(isAdmin || isReviewer || isStudent) && (
          <Button variant="outline" size="sm" onClick={downloadPdf} title="导出PDF">
            <Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span className="text-xs sm:text-sm">导出</span>
          </Button>
        )}
        <Badge className={getStatusColor(appState.status)}>
          {getStatusText(appState.status)}
        </Badge>
      </div>

      {/* 学生基本信息概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserIcon className="w-5 h-5" />
            <span>申请人信息</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">姓名：</span>
              <span className="block sm:inline font-medium break-words">{appState.basicInfo.name}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">学号：</span>
              <span className="block sm:inline font-medium break-words">{appState.basicInfo.studentId}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">系别：</span>
              <span className="block sm:inline font-medium break-words">{appState.basicInfo.department}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">专业：</span>
              <span className="block sm:inline font-medium break-words">{appState.basicInfo.major}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">GPA：</span>
              <span className="block sm:inline text-blue-600 font-medium">{appState.basicInfo.gpa}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-600 block sm:inline">学业排名：</span>
              <span className="block sm:inline text-blue-600 font-medium">
                {appState.basicInfo.academicRanking}/{appState.basicInfo.totalStudents}
              </span>
            </div>
            {appState.basicInfo.convertedScore && (
              <div className="min-w-0">
                <span className="text-gray-600 block sm:inline">换算后的成绩：</span>
                <span className="block sm:inline text-green-600 font-medium">
                  {appState.basicInfo.convertedScore}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 成绩计算与总分概览（原 scores Tab） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            <span>成绩计算与总分概览</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            条例要点：学业综合 0-80 分；学术专长 0-15 分（特殊学术专长答辩通过直接记满 15）；综合表现 0-5 分；总分 = 三部分相加 (满分100)。论文：共同一作各 50%；C 类论文最多 2 篇；创新/创业项目加分封顶 2；志愿服务：≥200 小时后每 +2 小时 +0.05 (至 1 分上限) + 表彰(≤1)；社会工作 / 荣誉 / 体育及其它单项各按封顶规则；国际组织实习≤1分；参军服役≤2分；综合表现合计封顶 5 分。
          </p>
          {(() => {
            const raw = appState.calculatedRaw || {} as any;
            const academicPct = raw.academicConvertedScore;
            const gpaPart = raw.academicGpaScore;
            const rankPart = raw.academicRankScore;
            const baseUsed = raw.academicBaseUsed;
            return academicPct !== undefined ? (
              <div className="p-3 bg-white/60 rounded border border-gray-200 text-[11px] text-gray-600 leading-relaxed">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>原始百分制学业: <span className="text-blue-600 font-medium">{academicPct.toFixed(4)}</span></span>
                  {gpaPart!==undefined && <span>GPA折算80制: {gpaPart.toFixed(2)}</span>}
                  {rankPart!==undefined && <span>排名折算80制: {rankPart.toFixed(2)}</span>}
                  {baseUsed!==undefined && <span>采用学业(0-80): <span className="font-medium">{baseUsed.toFixed(2)}</span></span>}
                  <span>逻辑: 百分制 = (GPA% + 排名%) / 2；(百分制×0.8→0-80)</span>
                </div>
              </div>
            ) : null;
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="flex justify-between p-3 bg-gray-50 rounded text-sm">
              <span>学业综合 (0-80)</span>
              <span className="font-medium">{academicScore.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded text-sm">
              <span>学术专长 (0-15)</span>
              <span className="font-medium text-blue-600">{specScore.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded text-sm">
              <span>综合表现 (0-5)</span>
              <span className="font-medium text-green-600">{perfScore.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded text-sm">
              <span className="font-semibold">推免综合成绩 (0-100)</span>
              <span className="text-blue-600 text-lg font-semibold">{totalScore.toFixed(2)}</span>
            </div>
          </div>
          {appState.specialAcademicTalent?.isApplying && (
            <div className={`mt-2 p-3 rounded border text-xs ${appState.specialAcademicTalent.defensePassed? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              特殊学术专长：{appState.specialAcademicTalent.defensePassed? '答辩通过（学术专长直接记 15 分）':'待答辩 / 尚未通过（按实际计算）'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 外语成绩（原 language Tab 展开） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">外语成绩</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appState.languageScores.cet4Score && (
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>英语四级成绩</span>
              <span className={
                appState.languageScores.cet4Score >= 500 ? 'text-green-600' : 'text-red-600'
              }>
                {appState.languageScores.cet4Score}分
                {appState.languageScores.cet4Score >= 500 && ' ✓'}
              </span>
            </div>
          )}

          {appState.languageScores.cet6Score && (
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>英语六级成绩</span>
              <span className={
                appState.languageScores.cet6Score >= 425 ? 'text-green-600' : 'text-red-600'
              }>
                {appState.languageScores.cet6Score}分
                {appState.languageScores.cet6Score >= 425 && ' ✓'}
              </span>
            </div>
          )}

          {appState.languageScores.toeflScore && (
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>TOEFL成绩</span>
              <span className={
                appState.languageScores.toeflScore >= 90 ? 'text-green-600' : 'text-red-600'
              }>
                {appState.languageScores.toeflScore}分
                {appState.languageScores.toeflScore >= 90 && ' ✓'}
              </span>
            </div>
          )}

          {appState.languageScores.ieltsScore && (
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>IELTS成绩</span>
              <span className={
                appState.languageScores.ieltsScore >= 6.0 ? 'text-green-600' : 'text-red-600'
              }>
                {appState.languageScores.ieltsScore}分
                {appState.languageScores.ieltsScore >= 6.0 && ' ✓'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 学术专长 + 对应材料证明（原 academic Tab + files 中学术部分，整合为一个纵向区域） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">学术专长与证明材料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {appState.specialAcademicTalent?.isApplying && (
            <div className="p-4 border rounded bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-600" />
                <h4 className="text-sm font-medium text-yellow-800">特殊学术专长申请</h4>
                <Badge variant={appState.specialAcademicTalent.defensePassed? 'default':'secondary'} className="text-xs">
                  {appState.specialAcademicTalent.defensePassed? '答辩通过':'待答辩'}
                </Badge>
              </div>
              {appState.specialAcademicTalent.description && <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line mb-2">{appState.specialAcademicTalent.description}</p>}
              {appState.specialAcademicTalent.achievements && (
                <div className="text-[11px] text-gray-600 whitespace-pre-line bg-white/60 rounded p-2 border border-yellow-100">
                  <strong className="text-gray-700">代表性成果：</strong>
                  {appState.specialAcademicTalent.achievements}
                </div>
              )}
              {appState.specialAcademicTalent.professors && appState.specialAcademicTalent.professors.length>0 && (
                <div className="mt-2 text-[11px] text-gray-600 flex flex-wrap gap-2">
                  {appState.specialAcademicTalent.professors.filter(p=>p.name).map((p,i)=>(
                    <span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                      {p.name}{p.title? `·${p.title}`:''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 论文发表 + 其证明 */}
          {academic.publications.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm mb-1">论文发表</h4>
              {academic.publications.map((pub:any, index:number) => {
                const proofs = getProofFiles(pub);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2 space-y-2">
                    <div>
                      <h5 className="text-sm">{pub.title || '（未填写标题）'}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        {pub.journal} ({pub.publishYear}) - {pub.type}类
                      </p>
                      <p className="text-xs text-gray-600">
                        作者排名：第{pub.authorRank}作者（共{pub.totalAuthors}人）
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{pub.score}分
                      </p>
                    </div>
                    {proofs.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">证明材料：</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {proofs.map(f => <FileThumb key={f.id} file={f} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 学科竞赛 + 证明 */}
          {academic.competitions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm mb-1">学科竞赛</h4>
              {academic.competitions.map((comp:any, index:number) => {
                const proofs = getProofFiles(comp);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2 space-y-2">
                    <div>
                      <h5 className="text-sm">{comp.name}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        {comp.level} - {comp.award} ({comp.year}年)
                      </p>
                      {comp.isTeam && (
                        <p className="text-xs text-gray-600">
                          团队竞赛，排名第{comp.teamRank}（共{comp.totalTeamMembers}人）
                        </p>
                      )}
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{comp.score}分
                      </p>
                    </div>
                    {proofs.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">证明材料：</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {proofs.map(f => <FileThumb key={f.id} file={f} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 专利 + 证明 */}
          {academic.patents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm mb-1">专利授权</h4>
              {academic.patents.map((patent:any, index:number) => {
                const proofs = getProofFiles(patent);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2 space-y-2">
                    <div>
                      <h5 className="text-sm">{patent.title}</h5>
                      <p className="text-xs text-gray-600 mt-1">专利号：{patent.patentNumber}</p>
                      <p className="text-xs text-gray-600">授权年份：{patent.grantYear}</p>
                      <p className="text-xs text-blue-600 mt-1">系统计算加分：{patent.score}分</p>
                    </div>
                    {proofs.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">证明材料：</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {proofs.map(f => <FileThumb key={f.id} file={f} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 科创/创新项目 + 证明 */}
          {academic.innovationProjects && academic.innovationProjects.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm mb-1">科创 / 创新项目</h4>
              {academic.innovationProjects.map((ip:any, index:number) => {
                const proofs = getProofFiles(ip);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2 space-y-2">
                    <div>
                      <h5 className="text-sm">{ip.name || ip.title || '（未填写）'}</h5>
                      <p className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {ip.role && <span>角色:{ip.role}</span>}
                        {ip.level && <span>级别:{ip.level}</span>}
                        {ip.year && <span>年份:{ip.year}</span>}
                        {ip.score!=null && <span className="text-blue-600">加分:{ip.score}</span>}
                      </p>
                    </div>
                    {proofs.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">证明材料：</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {proofs.map(f => <FileThumb key={f.id} file={f} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 综合表现 + 相关证明（志愿服务/社会工作/荣誉） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">综合表现与证明材料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 志愿服务块保持原有结构，无独立证明文件字段，沿用原展示 */}
          <div>
            <h4 className="text-sm font-medium mb-3">志愿服务</h4>
            <div className="space-y-3">
              {/* 志愿服务总时长 */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm">总时长</span>
                  <span className="text-sm font-semibold">{compPerf.volunteerService?.hours || 0} 小时</span>
                </div>
              </div>

              {/* 志愿服务分段记录 */}
              {compPerf.volunteerService?.segments && compPerf.volunteerService.segments.length > 0 && (
                <div className="p-3 bg-gray-50 rounded">
                  <h5 className="text-xs font-medium mb-2 text-gray-700">时长分段明细</h5>
                  <div className="space-y-2">
                    {compPerf.volunteerService.segments.map((seg: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          {seg.type === 'normal' ? '普通志愿服务' :
                           seg.type === 'large_event' ? '大型赛会（折半）' :
                           '支教活动（折半）'}
                        </span>
                        <span>{seg.hours} 小时</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 志愿服务表彰 */}
              {compPerf.volunteerService?.awards && compPerf.volunteerService.awards.length > 0 && (
                <div className="p-3 bg-gray-50 rounded">
                  <h5 className="text-xs font-medium mb-2 text-gray-700">志愿服务表彰</h5>
                  <div className="space-y-2">
                    {compPerf.volunteerService.awards.map((award: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          {award.level} - {
                            award.role === 'PERSONAL' ? '个人' :
                            award.role === 'TEAM_LEADER' ? '队长' :
                            '队员（减半）'
                          }
                        </span>
                        <span className="text-blue-600">
                          {award.level === '国家级' ? '1.0分' :
                           award.level === '省级' ? '0.5分' : '0.25分'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 志愿服务总分 - 使用前端计算逻辑 */}
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800">志愿服务总分</span>
                  <span className="text-sm font-semibold text-green-600">
                    {(() => {
                      // 使用与后端相同的计算逻辑
                      const hours = parseFloat(compPerf.volunteerService?.hours || '0') || 0;
                      const segments = compPerf.volunteerService?.segments || [];
                      const awards = compPerf.volunteerService?.awards || [];

                      // 计算工时积分
                      let effectiveHours = 0;
                      if (segments.length > 0) {
                        // 如果有分段，使用分段计算
                        segments.forEach((seg: any) => {
                          const segHours = parseFloat(seg.hours || '0') || 0;
                          if (seg.type === 'large_event' || seg.type === 'support') {
                            effectiveHours += segHours * 0.5; // 大型赛会和支教折半
                          } else {
                            effectiveHours += segHours;
                          }
                        });
                      } else {
                        // 如果没有分段，全部按普通志愿服务计算
                        effectiveHours = hours;
                      }

                      let hourScore = 0;
                      if (effectiveHours >= 200) {
                        // ≥200小时后，每2小时加0.05分，上限1分
                        const extraHours = effectiveHours - 200;
                        hourScore = Math.min(1.0, extraHours / 2 * 0.05);
                      }

                      // 计算表彰加分（取最高）
                      let awardScore = 0;
                      awards.forEach((award: any) => {
                        let baseScore = 0;
                        if (award.level === '国家级') baseScore = 1.0;
                        else if (award.level === '省级') baseScore = 0.5;
                        else if (award.level === '校级') baseScore = 0.25;

                        // 队员减半
                        if (award.role === 'TEAM_MEMBER') {
                          baseScore *= 0.5;
                        }

                        awardScore = Math.max(awardScore, baseScore);
                      });

                      const totalScore = Math.min(1.0, hourScore + awardScore);
                      return totalScore.toFixed(2) + ' 分';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 社会工作块保持原展示 */}
          {compPerf.socialWork && compPerf.socialWork.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">社会工作</h4>
              <div className="space-y-2">
                {compPerf.socialWork.map((work: any, index: number) => (
                  <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="text-sm font-medium">{work.position || '未填写职务'}</h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {work.year}年 · {work.duration || '未填写时长'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {work.level === 'EXEC' ? '执行主席（2.0）' :
                         work.level === 'PRESIDIUM' ? '主席团（1.5）' :
                         work.level === 'HEAD' ? '部长级（1.0）' :
                         work.level === 'DEPUTY' ? '副部长（0.75）' :
                         '委员（0.5）'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">评分：{work.rating || 0}/100</span>
                      <span className="text-blue-600 font-medium">
                        加分：{work.score?.toFixed(2) || '0.00'} 分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 荣誉称号 + 证明 */}
          {compPerf.honors && compPerf.honors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm mb-1">荣誉称号</h4>
              {compPerf.honors.map((honor:any, index:number) => {
                const proofs = getProofFiles(honor);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2 space-y-2">
                    <div>
                      <p className="text-sm">{honor.title}</p>
                      <p className="text-xs text-gray-600">{honor.level} ({honor.year}年)</p>
                      <p className="text-xs text-blue-600 mt-1">加分：{honor.score}分</p>
                    </div>
                    {proofs.length > 0 && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-500 mb-1">证明材料：</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {proofs.map(f => <FileThumb key={f.id} file={f} />)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 成绩单等通用文件：从原 files Tab 中保留“成绩单”区域，单独作为一个小块 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">成绩单等通用材料</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadedFiles.transcripts && uploadedFiles.transcripts.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {uploadedFiles.transcripts.map((f:any) => <FileThumb key={f.id} file={f} />)}
            </div>
          ) : (
            <div className="text-xs text-gray-400">暂无成绩单</div>
          )}
        </CardContent>
      </Card>

      {/* 个人陈述 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>个人陈述</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded max-h-40 overflow-y-auto">
            <p className="text-sm leading-relaxed whitespace-pre-line">{appState.personalStatement}</p>
          </div>
        </CardContent>
      </Card>

      {/* 双审核员信息显示 */}
      {(appState.firstReviewerName || appState.secondReviewerName) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">审核记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 第一审核员信息 */}
            {appState.firstReviewerName && (
              <div className="border-l-4 border-blue-500 pl-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">第一审核员：{appState.firstReviewerName}</span>
                  <Badge variant={appState.status === 'first_review_rejected' ? 'destructive' : 'default'}>
                    {appState.status === 'first_review_rejected' ? '已拒绝' : '已通过'}
                  </Badge>
                </div>
                {appState.firstReviewedAt && (
                  <p className="text-xs text-gray-600 mb-1">
                    审核时间：{new Date(appState.firstReviewedAt).toLocaleString('zh-CN')}
                  </p>
                )}
                {appState.firstReviewComment && (
                  <p className="text-sm bg-gray-50 p-2 rounded mt-2">
                    审核意见：{appState.firstReviewComment}
                  </p>
                )}
              </div>
            )}

            {/* 第二审核员信息 */}
            {appState.secondReviewerName && (
              <div className="border-l-4 border-green-500 pl-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">第二审核员：{appState.secondReviewerName}</span>
                  <Badge variant={appState.status === 'rejected' ? 'destructive' : 'default'}>
                    {appState.status === 'rejected' ? '已拒绝' : '已通过'}
                  </Badge>
                </div>
                {appState.secondReviewedAt && (
                  <p className="text-xs text-gray-600 mb-1">
                    审核时间：{new Date(appState.secondReviewedAt).toLocaleString('zh-CN')}
                  </p>
                )}
                {appState.secondReviewComment && (
                  <p className="text-sm bg-gray-50 p-2 rounded mt-2">
                    审核意见：{appState.secondReviewComment}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 审核操作 */}

      {/* 第一审核员审核 */}
      {(isAdmin || isReviewer) && appState.status === 'first_review_pending' && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base">第一审核员审核</CardTitle>
            <p className="text-sm text-gray-600">通过后将进入第二次审核流程</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="请填写审核意见（拒绝时必填）"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                onClick={() => call('first-review', { approve: true, comment: reviewComment })}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                通过
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!reviewComment) {
                    toast.error('拒绝操作必须填写审核意见');
                    return;
                  }
                  call('first-review', { approve: false, comment: reviewComment });
                }}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                <XCircle className="w-4 h-4 mr-2" />
                拒绝
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 第二审核员审核 */}
      {(isAdmin || isReviewer) && (appState.status === 'first_review_approved' || appState.status === 'second_review_pending') && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-base">第二审核员审核</CardTitle>
            <p className="text-sm text-yellow-700 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              注意：您不能是第一审核员本人
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="请填写审核意见（拒绝时必填）"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                onClick={() => call('second-review', { approve: true, comment: reviewComment })}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                通过（最终通过）
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!reviewComment) {
                    toast.error('拒绝操作必须填写审核意见');
                    return;
                  }
                  call('second-review', { approve: false, comment: reviewComment });
                }}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                <XCircle className="w-4 h-4 mr-2" />
                拒绝（最终拒绝）
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(isAdmin || isReviewer) && appState.status === 'admin_reviewing' && (
        <Card>
          <CardHeader><CardTitle>审核操作</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm mb-2 block">审核意见（拒绝时必填）</label>
              <Textarea rows={4} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="请输入审核意见" />
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleApprove} disabled={isSubmitting} className="flex-1 min-w-[120px]"><CheckCircle className="w-4 h-4 mr-1" />{isSubmitting? '处理中...':'通过'}</Button>
              <Button onClick={handleReject} disabled={isSubmitting} variant="destructive" className="flex-1 min-w-[120px]"><XCircle className="w-4 h-4 mr-1" />{isSubmitting? '处理中...':'拒绝'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(isAdmin || isReviewer) && appState.status==='approved' && appState.adminReviewComment && (
        <Card><CardHeader><CardTitle>审核结果</CardTitle></CardHeader><CardContent><div className="text-sm text-green-700">审核意见：{appState.adminReviewComment}</div></CardContent></Card>
      )}
      {(isAdmin || isReviewer) && appState.status==='rejected' && appState.adminReviewComment && (
        <Card><CardHeader><CardTitle>审核结果</CardTitle></CardHeader><CardContent><div className="text-sm text-red-700">审核意见：{appState.adminReviewComment}</div></CardContent></Card>
      )}

      <ConfirmDialog open={confirmApproveOpen} onOpenChange={o=> setConfirmApproveOpen(o)} title="确认通过?" description="当前未填写审核意见，确定直接通过该申请？" confirmText="确认通过" onConfirm={confirmApproveNoComment} />
    </div>
  );
};

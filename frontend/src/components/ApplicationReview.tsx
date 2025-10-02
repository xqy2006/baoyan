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
        const map: Record<string, Application['status']> = { DRAFT: 'pending', SYSTEM_REVIEWING: 'system_reviewing', SYSTEM_APPROVED: 'system_approved', SYSTEM_REJECTED: 'system_rejected', ADMIN_REVIEWING: 'admin_reviewing', APPROVED: 'approved', REJECTED: 'rejected' };
        setAppState(prev=> ({
          ...prev,
          status: map[data.status]||prev.status,
          systemReviewComment: data.systemReviewComment || prev.systemReviewComment,
            adminReviewComment: data.adminReviewComment || prev.adminReviewComment,
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

  // 后端分值：academicScore 0-80; academicAchievementScore 0-15; performanceScore 0-5; total = sum
  const academicScore = appState.calculatedScores?.academicScore ?? 0; // 0-80
  const specScore = appState.calculatedScores?.academicAchievementScore ?? 0; // 0-15
  const perfScore = appState.calculatedScores?.performanceScore ?? 0; // 0-5
  const totalScore = appState.calculatedScores?.totalScore ?? (academicScore + specScore + perfScore);

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'system_approved': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'system_rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
          {appState.status === 'system_approved' ? '待管理员审核' :
           appState.status === 'approved' ? '已通过' :
           appState.status === 'rejected' ? '已拒绝' :
           appState.status === 'system_rejected' ? '系统拒绝' : '审核中'}
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
          </div>
        </CardContent>
      </Card>

      {/* 详细信息选项卡 */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="scores" className="text-xs">成绩计算</TabsTrigger>
              <TabsTrigger value="language" className="text-xs">外语成绩</TabsTrigger>
              <TabsTrigger value="academic" className="text-xs">学术专长</TabsTrigger>
              <TabsTrigger value="comprehensive" className="text-xs">综合表现</TabsTrigger>
              <TabsTrigger value="files" className="text-xs">材料证明</TabsTrigger>
            </TabsList>

            {/* 成绩计算 */}
            <TabsContent value="scores" className="p-4 space-y-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calculator className="w-5 h-5" />
                <h3 className="text-lg">推免综合成绩（后台计算）</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                条例要点：学业综合 0-80 分；学术专长 0-15 分（特殊学术专长答辩通过直接记满 15）；综合表现 0-5 分；总分 = 三部分相加 (满分100)。论文：共同一作各 50%；C 类论文最多 2 篇；创新/创业项目加分封顶 2；志愿服务：≥200 小时后每 +2 小时 +0.05 (至 1 分上限) + 表彰(≤1)；社会工作 / 荣誉 / 体育及其它单项各按封顶规则；国际组织实习≤1分；参军服役≤2分；综合表现合计封顶 5 分。
              </p>
              <div className="space-y-2">
                {(() => {
                  const raw = appState.calculatedRaw || {} as any;
                  const academicPct = raw.academicConvertedScore; // 0-100
                  const gpaPart = raw.academicGpaScore; // 0-80 (component before 0.8 factor baked in)
                  const rankPart = raw.academicRankScore; // 0-80
                  const baseUsed = raw.academicBaseUsed; // 0-80
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
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>学业综合成绩 (0-80)</span>
                  <span className="font-medium">{academicScore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>学术专长 (0-15)</span>
                  <div className="text-right">
                    <p className="font-medium text-blue-600">{specScore.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>综合表现 (0-5)</span>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{perfScore.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span className="font-semibold">推免综合成绩 (0-100)</span>
                  <span className="text-blue-600 text-lg font-semibold">{totalScore.toFixed(2)}</span>
                </div>
              </div>
              {appState.specialAcademicTalent?.isApplying && (
                <div className={`mt-3 p-3 rounded border text-xs ${appState.specialAcademicTalent.defensePassed? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>特殊学术专长：{appState.specialAcademicTalent.defensePassed? '答辩通过（学术专长直接记 15 分）':'待答辩 / 尚未通过（按实际计算）'}</div>
              )}
            </TabsContent>

            {/* 外语成绩 */}
            <TabsContent value="language" className="p-4 space-y-4">
              <div className="space-y-3">
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
              </div>
            </TabsContent>

            {/* 学术专长 */}
            <TabsContent value="academic" className="p-4 space-y-4">
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
              {/* 论文发表 */}
              {academic.publications.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">论文发表</h4>
                  {academic.publications.map((pub, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <h5 className="text-sm">{pub.title}</h5>
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
                  ))}
                </div>
              )}

              {/* 学科竞赛 */}
              {academic.competitions.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">学科竞赛</h4>
                  {academic.competitions.map((comp, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
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
                  ))}
                </div>
              )}

              {/* 专利 */}
              {academic.patents.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">专利授权</h4>
                  {academic.patents.map((patent, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <h5 className="text-sm">{patent.title}</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        专利号：{patent.patentNumber}
                      </p>
                      <p className="text-xs text-gray-600">
                        授权年份：{patent.grantYear}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        系统计算加分：{patent.score}分
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 综合表现 */}
            <TabsContent value="comprehensive" className="p-4 space-y-4">
              {/* 志愿服务 */}
              <div>
                <h4 className="text-sm mb-3">志愿服务</h4>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm">
                    志愿服务时长：{compPerf.volunteerService.hours}小时
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    加分：{compPerf.volunteerService.totalScore}分
                  </p>
                </div>
              </div>

              {/* 社会工作 */}
              {compPerf.socialWork.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">社会工作</h4>
                  {compPerf.socialWork.map((work, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <p className="text-sm">{work.position}</p>
                      <p className="text-xs text-gray-600">任职时长：{work.duration}</p>
                      <p className="text-xs text-blue-600 mt-1">加分：{work.score}分</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 荣誉称号 */}
              {compPerf.honors.length > 0 && (
                <div>
                  <h4 className="text-sm mb-3">荣誉称号</h4>
                  {compPerf.honors.map((honor, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <p className="text-sm">{honor.title}</p>
                      <p className="text-xs text-gray-600">{honor.level} ({honor.year}年)</p>
                      <p className="text-xs text-blue-600 mt-1">加分：{honor.score}分</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 材料证明 */}
            <TabsContent value="files" className="p-4 space-y-5">
              {(() => {
                const uf: any = (appState as any).uploadedFiles || {};
                const pubs = academic.publications || [];
                const comps = academic.competitions || [];
                const pats = academic.patents || [];
                const honors = (compPerf.honors || []);
                const innovations = (academic.innovationProjects || []);
                const transcripts = uf.transcripts || [];

                // 简化的文件获取函数 - 直接从item.proofFile获取
                const getProofFiles = (item: any) => {
                  const files = [];

                  // 直接检查item.proofFile - 支持单个文件和文件数组
                  if (item?.proofFile) {
                    if (Array.isArray(item.proofFile)) {
                      // 如果是数组，添加所有有效文件
                      item.proofFile.forEach((file: any) => {
                        if (file && file.id) {
                          files.push(file);
                        }
                      });
                    } else if (item.proofFile.id) {
                      // 如果是单个文件对象
                      files.push(item.proofFile);
                    }
                  }

                  return files;
                };

                // 简单缩略文件卡片
                const FileThumb: React.FC<{file:any}> = ({ file }) => {
                  if(!file || !file.id) return null;
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

                const Section: React.FC<{title:string; children:React.ReactNode}> = ({title,children}) => (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{title}</h4>
                    {children}
                  </div>
                );

                const Empty = <div className="text-xs text-gray-400">暂无</div>;

                return (
                  <div className="space-y-6">
                    <Section title="成绩单">
                      {transcripts.length? <div className="grid gap-3 md:grid-cols-3">{transcripts.map((f:any)=><FileThumb key={f.id} file={f} />)}</div>: Empty}
                    </Section>
                    <Section title="论文发表">
                      {pubs.length? pubs.map((p:any,i:number)=>{
                        const proofs = getProofFiles(p);
                        return <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                          <div className="text-sm font-medium break-all">{p.title||'（未填写标题）'}</div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>类别:{p.type||'-'}</span>
                            <span>期刊:{p.journal||'-'}</span>
                            <span>年份:{p.publishYear||'-'}</span>
                            <span>作者:{p.authorRank}/{p.totalAuthors||'?'}{p.isCoFirst&&' (共同一作)'} </span>
                            {p.score!=null && <span className="text-blue-600">加分:{p.score}</span>}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {proofs.length? proofs.map(f=> <FileThumb key={f.id} file={f} />): <div className="text-[11px] text-gray-400">无证明材料</div>}
                          </div>
                        </div>;
                      }): Empty}
                    </Section>
                    <Section title="学科竞赛">
                      {comps.length? comps.map((c:any,i:number)=>{
                        const proofs = getProofFiles(c);
                        return <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                          <div className="text-sm font-medium break-all">{c.name||'（未填写名称）'}</div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>级别:{c.level||'-'}</span>
                            <span>奖项:{c.award||'-'}</span>
                            <span>年份:{c.year||'-'}</span>
                            {c.isTeam && <span>团队:{c.teamRank}/{c.totalTeamMembers}</span>}
                            {c.score!=null && <span className="text-blue-600">加分:{c.score}</span>}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {proofs.length? proofs.map(f=> <FileThumb key={f.id} file={f} />): <div className="text-[11px] text-gray-400">无证明材料</div>}
                          </div>
                        </div>;
                      }): Empty}
                    </Section>
                    <Section title="专利授权">
                      {pats.length? pats.map((p:any,i:number)=>{
                        const proofs = getProofFiles(p);
                        return <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                          <div className="text-sm font-medium break-all">{p.title||'（未填写标题）'}</div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>专利号:{p.patentNumber||'-'}</span>
                            <span>年份:{p.grantYear||'-'}</span>
                            {p.score!=null && <span className="text-blue-600">加分:{p.score}</span>}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">{proofs.length? proofs.map(f=> <FileThumb key={f.id} file={f} />): <div className="text-[11px] text-gray-400">无证明材料</div>}</div>
                        </div>;
                      }): Empty}
                    </Section>
                    <Section title="荣誉称号">
                      {honors.length? honors.map((h:any,i:number)=>{
                        const proofs = getProofFiles(h);
                        return <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                          <div className="text-sm font-medium break-all">{h.title||'（未填写）'}</div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>等级:{h.level||'-'}</span><span>年份:{h.year||'-'}</span>
                            {h.score!=null && <span className="text-blue-600">加分:{h.score}</span>}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">{proofs.length? proofs.map(f=> <FileThumb key={f.id} file={f} />): <div className="text-[11px] text-gray-400">无证明材料</div>}</div>
                        </div>;
                      }): Empty}
                    </Section>
                    <Section title="科创 / 创新项目">
                      {innovations.length? innovations.map((ip:any,i:number)=>{
                        const proofs = getProofFiles(ip);
                        return <div key={i} className="border rounded p-3 bg-gray-50 space-y-2">
                          <div className="text-sm font-medium break-all">{ip.name||ip.title||'（未填写）'}</div>
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            {ip.role && <span>角色:{ip.role}</span>}
                            {ip.level && <span>级别:{ip.level}</span>}
                            {ip.year && <span>年份:{ip.year}</span>}
                            {ip.score!=null && <span className="text-blue-600">加分:{ip.score}</span>}
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">{proofs.length? proofs.map(f=> <FileThumb key={f.id} file={f} />): <div className="text-[11px] text-gray-400">无证明材料</div>}</div>
                        </div>;
                      }): Empty}
                    </Section>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
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

      {/* 审核操作 */}

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

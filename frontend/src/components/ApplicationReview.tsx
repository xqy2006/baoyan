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
    } catch(e:any){ alert(e.message); }
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
    } catch (e:any) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSystemReview = () => call('system-review');
  const handleStartAdmin = () => call('admin-start');
  const handleApprove = () => {
    if (!reviewComment) { if(!confirm('无审核意见，确定通过?')) return; }
    call('admin-review', { approve:true, comment: reviewComment });
  };
  const handleReject = () => {
    if (!reviewComment) { alert('请填写拒绝理由'); return; }
    call('admin-review', { approve:false, comment: reviewComment });
  };

  // 后端分值（加权）与原始值（calculatedRaw）
  const academicScore = appState.calculatedScores?.academicScore ?? 0; // 0-80
  const specWeighted = appState.calculatedScores?.academicAchievementScore ?? (appState.calculatedScores? 0:0); // 0-12
  const perfWeighted = appState.calculatedScores?.performanceScore ?? 0; // 0-8
  const specRaw = appState.calculatedRaw?.specRaw ?? (specWeighted? (specWeighted/12)*15 : 0); // 0-15 (推导兜底)
  const perfRaw = appState.calculatedRaw?.perfRaw ?? (perfWeighted? (perfWeighted/8)*5 : 0); // 0-5
  const assessWeighted = specWeighted + perfWeighted; // 0-20
  const totalScore = appState.calculatedScores?.totalScore ?? (academicScore + assessWeighted);

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
    <div className="p-4 space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg">申请审核详情</h1>
          <p className="text-sm text-gray-600">{(appState as any).activityName}</p>
        </div>
        {(isAdmin || isReviewer || isStudent) && (
          <Button variant="outline" size="sm" onClick={downloadPdf} title="导出PDF">
            <Printer className="w-4 h-4 mr-1" />导出
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">姓名：</span>
              <span>{appState.basicInfo.name}</span>
            </div>
            <div>
              <span className="text-gray-600">学号：</span>
              <span>{appState.basicInfo.studentId}</span>
            </div>
            <div>
              <span className="text-gray-600">系别：</span>
              <span>{appState.basicInfo.department}</span>
            </div>
            <div>
              <span className="text-gray-600">专业：</span>
              <span>{appState.basicInfo.major}</span>
            </div>
            <div>
              <span className="text-gray-600">GPA：</span>
              <span className="text-blue-600">{appState.basicInfo.gpa}</span>
            </div>
            <div>
              <span className="text-gray-600">学业排名：</span>
              <span className="text-blue-600">
                {appState.basicInfo.academicRanking}/{appState.basicInfo.totalStudents}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统审核结果 */}
      {appState.systemReviewComment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>系统审核结果</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">{appState.systemReviewComment}</p>
              <p className="text-xs text-blue-600 mt-1">
                审核时间：{appState.systemReviewedAt}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 详细信息选项卡 */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="scores">成绩计算</TabsTrigger>
              <TabsTrigger value="language">外语成绩</TabsTrigger>
              <TabsTrigger value="academic">学术专长</TabsTrigger>
              <TabsTrigger value="comprehensive">综合表现</TabsTrigger>
              <TabsTrigger value="files">材料证明</TabsTrigger>
            </TabsList>

            {/* 成绩计算 */}
            <TabsContent value="scores" className="p-4 space-y-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calculator className="w-5 h-5" />
                <h3 className="text-lg">推免综合成绩（后台计算）</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                条例要点：学业综合占 80 分；学术专长原始 15 分折算 12%；综合表现原始 5 分折算 8%；总分 = 学业(≤80)+12+8。
                共同一作各 50%；C 类论文最多 2 篇；创新/创业项目加分封顶 2；志愿服务工时≥200 后每 2 小时 +0.05 (至 1) + 表彰(≤1)；社会工作/荣誉/体育各自按条例封顶。
              </p>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>学业综合成绩 (0-80)</span>
                  <span className="font-medium">{academicScore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>学术专长（加权 12%）</span>
                  <div className="text-right">
                    <p className="font-medium text-blue-600">{specWeighted.toFixed(2)}</p>
                    <p className="text-[11px] text-gray-500">原始 {specRaw.toFixed(2)} /15 → ×12/15</p>
                  </div>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span>综合表现（加权 8%）</span>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{perfWeighted.toFixed(2)}</p>
                    <p className="text-[11px] text-gray-500">原始 {perfRaw.toFixed(2)} /5 → ×8/5</p>
                  </div>
                </div>
                <div className="flex justify-between p-3 bg-indigo-50 rounded">
                  <span className="font-medium">考核加权小计</span>
                  <span className="text-indigo-600 font-medium">{assessWeighted.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span className="font-semibold">推免综合成绩 (0-100)</span>
                  <span className="text-blue-600 text-lg font-semibold">{totalScore.toFixed(2)}</span>
                </div>
              </div>
              {appState.specialAcademicTalent?.isApplying && (
                <div className={`mt-3 p-3 rounded border text-xs ${appState.specialAcademicTalent.defensePassed? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>特殊学术专长：{appState.specialAcademicTalent.defensePassed? '答辩通过（专长加分按满分 15 记入 12%）':'待答辩 / 尚未通过（按实际计算）'}</div>
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
              {(() => { const uf:any = (appState as any).uploadedFiles || {}; const Section = ({title, list}:{title:string; list:any[]}) => list && list.length>0 ? (
                <div>
                  <h4 className="text-sm mb-3">{title}</h4>
                  {list.map((file,i)=>(
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded mb-2">
                      <div>
                        <p className="text-sm">{file.originalFilename || file.name || file.title || '文件'}{file.contentType? ` (${file.contentType})`:''}</p>
                        <p className="text-xs text-gray-500">上传：{file.uploadedAt || file.uploadDate || '-'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={()=>viewFile(file.id)} disabled={!file.id}><Eye className="w-3 h-3 mr-1" />查看</Button>
                        <Button size="sm" variant="outline" onClick={()=>downloadFile(file.id)} disabled={!file.id}><Download className="w-3 h-3 mr-1" />下载</Button>
                      </div>
                    </div>
                  ))}
                </div>) : null;
                return <>
                  <Section title="成绩单" list={uf.transcripts||[]} />
                  <Section title="论文证明" list={uf.publicationProofs||[]} />
                  <Section title="竞赛证明" list={uf.competitionProofs||[]} />
                  <Section title="专利证明" list={uf.patentProofs||[]} />
                  <Section title="荣誉证明" list={uf.honorProofs||[]} />
                  <Section title="科创项目证明" list={uf.innovationProofs||[]} />
                  {!( (uf.transcripts||[]).length + (uf.publicationProofs||[]).length + (uf.competitionProofs||[]).length + (uf.patentProofs||[]).length + (uf.honorProofs||[]).length + (uf.innovationProofs||[]).length ) && <div className="text-xs text-gray-400">暂无已上传的证明文件</div>}
                </> })()}
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
            <p className="text-sm leading-relaxed">{appState.personalStatement}</p>
          </div>
        </CardContent>
      </Card>

      {/* 审核操作 */}
      {isAdmin && appState.status === 'system_approved' && (
        <Card>
          <CardHeader>
            <CardTitle>管理员审核</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm mb-2 block">审核意见</label>
              <Textarea
                placeholder="请输入详细的审核意见..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button 
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isSubmitting ? '处理中...' : '通过申请'}
              </Button>
              <Button 
                onClick={handleReject}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {isSubmitting ? '处理中...' : '拒绝申请'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>管理员操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {appState.status === 'system_reviewing' && (
              <Button size="sm" onClick={handleSystemReview} disabled={isSubmitting}>执行系统审核</Button>
            )}
            {appState.status === 'system_approved' && (
              <Button size="sm" onClick={handleStartAdmin} disabled={isSubmitting}>进入人工审核</Button>
            )}
            {appState.status === 'admin_reviewing' && (
              <div className="space-y-2">
                <Textarea rows={3} placeholder="审核意见" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApprove} disabled={isSubmitting}>通过</Button>
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={isSubmitting}>拒绝</Button>
                </div>
              </div>
            )}
            {appState.status === 'approved' && appState.adminReviewComment && (
              <div className="text-sm text-green-700">审核意见：{appState.adminReviewComment}</div>
            )}
            {appState.status === 'rejected' && appState.adminReviewComment && (
              <div className="text-sm text-red-700">审核意见：{appState.adminReviewComment}</div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && appState.specialAcademicTalent?.isApplying && !appState.specialAcademicTalent.defensePassed && (
        <Card>
          <CardHeader><CardTitle>特殊学术专长答辩</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">通过后后端重算：学术专长原始分直接记为 15（折算 12%).</p>
            <Button size="sm" onClick={async()=>{
              try {
                const res = await fetch(`/api/applications/${appState.id}/special-talent/pass`, { method:'POST', credentials:'include' });
                if(!res.ok){ const e= await res.json().catch(()=>({})); console.warn('标记失败', e); }
              } catch {/* ignore */}
              await refresh(appState.id);
            }}>标记“答辩通过”并刷新</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


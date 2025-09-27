import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Activity, User } from '../App';
import { ArrowLeft, Plus, Trash2, User as UserIcon, Award, FileText, BookOpen, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload, UploadedMeta } from './hooks/useFileUpload';
import { useAuth } from '../context/AuthContext';
import { TranscriptUploader } from './TranscriptUploader';
import { Badge } from './ui/badge';
import jsPDF from 'jspdf';
import { useLocalTempFile } from './hooks/useLocalTempFile';
import { ProofFileUploader } from './ProofFileUploader';
import { ZH_FONT_NAME, ZH_FONT_FILE, ZH_FONT_BASE64 } from './fonts/zhFont';

interface ApplicationFormProps {
  activity: Activity;
  user: User;
  onSubmit: () => void;
  onCancel: () => void;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ activity, user, onSubmit, onCancel }) => {
  const { fetchWithAuth } = useAuth();
  // 本地草稿 key （仅在提交前使用，不创建后端记录）
  const localDraftKey = React.useMemo(()=> `appDraft:${user.id||user.studentId}:${activity.id}`, [user.id, user.studentId, activity.id]);
  // 学业基础信息（动态可编辑）
  const [basicInfo, setBasicInfo] = useState(()=>({
    name: user.name || '',
    studentId: user.studentId || '-',
    gender: '男' as '男' | '女',
    department: user.department || '',
    major: '',
    gpa: '',
    academicRanking: '',
    totalStudents: ''
  }));
  const [languageScores, setLanguageScores] = useState({ cet4Score:'', cet6Score:'', toeflScore:'', ieltsScore:'', greScore:'', otherLanguage:'', otherScore:'' });
  // 学术相关初始为空，用户自行添加；空则不参与校验
  const [publications, setPublications] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [patents, setPatents] = useState<any[]>([]);
  const [innovationProjects, setInnovationProjects] = useState<any[]>([]);
  const [volunteerHours, setVolunteerHours] = useState('');
  const [volunteerSegments, setVolunteerSegments] = useState<{id:number; hours:string; type:'normal'|'large_event'|'support'}[]>([]);
  const [socialWork, setSocialWork] = useState([{ position:'', duration:'', year:2024, level:'MEMBER' as 'EXEC'|'PRESIDIUM'|'HEAD'|'DEPUTY'|'MEMBER', rating:80 }]);
  const [honors, setHonors] = useState<any[]>([]);
  // 新增状态变量
  const [volunteerAwards, setVolunteerAwards] = useState<{ level:'国家级'|'省级'|'校级'; role:'TEAM_LEADER'|'TEAM_MEMBER'|'PERSONAL'; id:number }[]>([]);
  const [sports, setSports] = useState<{ id:number; name:string; scope:'国际级'|'国家级'; result:'冠军'|'亚军'|'季军'|'四至八名'; isTeam:boolean; teamSize:number }[]>([]);
  const [internshipDuration, setInternshipDuration] = useState<'NONE'|'SEMESTER'|'YEAR'>('NONE');
  const [militaryYears, setMilitaryYears] = useState<number>(0);
  // 特殊学术专长申请相关状态
  const [specialTalentApplying, setSpecialTalentApplying] = useState(false);
  const [specialTalentDesc, setSpecialTalentDesc] = useState('');
  const [specialTalentAchievements, setSpecialTalentAchievements] = useState('');
  const [specialTalentProfessors, setSpecialTalentProfessors] = useState([{ name:'', title:'', department:'' }]);
  const [personalStatement, setPersonalStatement] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // ===== 缺失的核心申请状态补充（防止 applicationId 未定义） =====
  const [applicationId, setApplicationId] = useState<number|null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [submittedAt, setSubmittedAt] = useState<string|null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [backendScores, setBackendScores] = useState<{academic:number; specWeighted:number; perfWeighted:number; total:number}>({academic:0,specWeighted:0,perfWeighted:0,total:0});
  const [transcriptFile, setTranscriptFile] = useState<any>(null);
  const [autoSaveMsg, setAutoSaveMsg] = useState('');
  const [dirtyCounter, setDirtyCounter] = useState(0);
  const isEditable = (!submittedAt) && (applicationId==null || (status==='DRAFT' || status==='SYSTEM_REVIEWING'));

  // 本地文件工具
  const isLocalMeta = (m:any)=> !!(m && (m.isLocal || m.localId));
  const isImageMeta = (m:any)=> !!m && (m.contentType?.startsWith('image/') || m.dataUrl?.startsWith('data:image') || m.previewDataUrl?.startsWith('data:image'));
  const { uploadFile } = useFileUpload();
  const { readAsDataUrl } = useLocalTempFile();
  const dataUrlToFile = async (meta:any):Promise<File> => { const res = await fetch(meta.dataUrl); const blob = await res.blob(); return new File([blob], meta.name||'file', { type: meta.contentType||blob.type }); };
  const uploadLocalMeta = async (meta:any) => { const f = await dataUrlToFile(meta); return await uploadFile(f); };
  const autoSaveTimer = useRef<number | null>(null);
  const ensureRemoteFiles = async () => {
    if(!applicationId) return; // 本地模式不上传
    if(transcriptFile && isLocalMeta(transcriptFile)){
      try { const meta = await uploadLocalMeta(transcriptFile); setTranscriptFile({ ...meta, previewDataUrl: transcriptFile.dataUrl||transcriptFile.previewDataUrl }); } catch(e:any){ toast.error('成绩单上传失败'); throw e; }
    }
    const procList: { kind:'pub'|'comp'|'pat'|'hon'|'innov'; index:number }[]=[];
    publications.forEach((p,i)=>{ if(p.proofFile && isLocalMeta(p.proofFile)) procList.push({kind:'pub',index:i}); });
    competitions.forEach((c,i)=>{ if(c.proofFile && isLocalMeta(c.proofFile)) procList.push({kind:'comp',index:i}); });
    patents.forEach((p,i)=>{ if(p.proofFile && isLocalMeta(p.proofFile)) procList.push({kind:'pat',index:i}); });
    honors.forEach((h,i)=>{ if(h.proofFile && isLocalMeta(h.proofFile)) procList.push({kind:'hon',index:i}); });
    innovationProjects.forEach((p,i)=>{ if(p.proofFile && isLocalMeta(p.proofFile)) procList.push({kind:'innov',index:i}); });
    for(const item of procList){
      let meta:any;
      if(item.kind==='pub') meta = publications[item.index].proofFile;
      if(item.kind==='comp') meta = competitions[item.index].proofFile;
      if(item.kind==='pat') meta = patents[item.index].proofFile;
      if(item.kind==='hon') meta = honors[item.index].proofFile;
      if(item.kind==='innov') meta = innovationProjects[item.index].proofFile;
      if(meta && isLocalMeta(meta)){
        try {
          const remote = await uploadLocalMeta(meta);
          const merged = { ...remote, previewDataUrl: meta.dataUrl||meta.previewDataUrl };
          if(item.kind==='pub') setPublications(list=> list.map((x,i)=> i===item.index? { ...x, proofFile: merged }: x));
          if(item.kind==='comp') setCompetitions(list=> list.map((x,i)=> i===item.index? { ...x, proofFile: merged }: x));
          if(item.kind==='pat') setPatents(list=> list.map((x,i)=> i===item.index? { ...x, proofFile: merged }: x));
          if(item.kind==='hon') setHonors(list=> list.map((x,i)=> i===item.index? { ...x, proofFile: merged }: x));
          if(item.kind==='innov') setInnovationProjects(list=> list.map((x,i)=> i===item.index? { ...x, proofFile: merged }: x));
        } catch(e:any){ toast.error('文件上传失败'); throw e; }
      }
    }
  };
  const handleBasicChange = (field: keyof typeof basicInfo, value: string) => {
    if (!isEditable) return;
    setBasicInfo(prev => ({ ...prev, [field]: value }));
    setDirtyCounter(c => c + 1);
  };

  // 读取后端已提交的申请（如果存在）
  const loadOrCreate = async () => {
    setLoadingApp(true);
    try {
      const r = await fetchWithAuth(`/api/applications/activity/${activity.id}/mine`);
      if (r.ok) {
        const a = await r.json();
        setApplicationId(a.id);
        setHasExisting(true);
        setStatus(a.status||'SYSTEM_REVIEWING');
        setSubmittedAt(a.submittedAt || a.status!== 'DRAFT'? (a.submittedAt||'已提交'): null);
        if (a.content) {
          try { const json = JSON.parse(a.content);
            if(json.basicInfo) setBasicInfo(b=>({...b, ...json.basicInfo}));
            if(json.languageScores) setLanguageScores(json.languageScores);
            if(json.academicAchievements){
              if(json.academicAchievements.publications) setPublications(json.academicAchievements.publications);
              if(json.academicAchievements.competitions) setCompetitions(json.academicAchievements.competitions);
              if(json.academicAchievements.patents) setPatents(json.academicAchievements.patents);
              if(json.academicAchievements.innovationProjects) setInnovationProjects(json.academicAchievements.innovationProjects);
            }
            if(json.comprehensivePerformance){
              const cp = json.comprehensivePerformance;
              if(cp.volunteerService){ setVolunteerHours(cp.volunteerService.hours||''); setVolunteerSegments((cp.volunteerService.segments||[]).map((s:any,i:number)=>({id:i+1,hours:String(s.hours||''),type:s.type||'normal'}))); setVolunteerAwards(cp.volunteerService.awards||[]); }
              if(cp.socialWork) setSocialWork(cp.socialWork);
              if(cp.honors) setHonors(cp.honors);
              if(cp.sports) setSports(cp.sports);
              if(cp.internship) setInternshipDuration(cp.internship);
              if(cp.militaryYears!=null) setMilitaryYears(cp.militaryYears);
            }
            if(json.specialAcademicTalent){
              setSpecialTalentApplying(!!json.specialAcademicTalent.isApplying);
              setSpecialTalentDesc(json.specialAcademicTalent.description||'');
              setSpecialTalentAchievements(json.specialAcademicTalent.achievements||'');
              setSpecialTalentProfessors(json.specialAcademicTalent.professors||[{name:'',title:'',department:''}]);
            }
            if(json.personalStatement) setPersonalStatement(json.personalStatement);
            if(json.uploadedFiles){
              if(json.uploadedFiles.transcripts && json.uploadedFiles.transcripts[0]) setTranscriptFile(json.uploadedFiles.transcripts[0]);
            }
          } catch {/* ignore */}
        }
      } else if (r.status===404) {
        setApplicationId(null);
        setHasExisting(false);
        setStatus('DRAFT');
        setSubmittedAt(null);
      }
    } catch {/* ignore */}
    finally { setLoadingApp(false); }
  };
  useEffect(()=>{ loadOrCreate(); }, [activity.id, fetchWithAuth]);

  // 加载本地草稿（仅当还没有后端记录）
  useEffect(()=>{
    if(hasExisting || applicationId!=null) return;
    try {
      const raw = localStorage.getItem(localDraftKey);
      if(raw){
        const data = JSON.parse(raw);
        const p = data.payload || {};
        if(p.basicInfo) setBasicInfo(b=>({...b, ...p.basicInfo}));
        if(p.languageScores) setLanguageScores(p.languageScores);
        if(p.academicAchievements){
          if(p.academicAchievements.publications) setPublications(p.academicAchievements.publications);
          if(p.academicAchievements.competitions) setCompetitions(p.academicAchievements.competitions);
          if(p.academicAchievements.patents) setPatents(p.academicAchievements.patents);
          if(p.academicAchievements.innovationProjects) setInnovationProjects(p.academicAchievements.innovationProjects);
        }
        if(p.comprehensivePerformance){
          const cp = p.comprehensivePerformance;
          if(cp.volunteerService){ setVolunteerHours(cp.volunteerService.hours||''); setVolunteerSegments((cp.volunteerService.segments||[]).map((s:any,i:number)=>({id:i+1,hours:String(s.hours||''),type:s.type||'normal'}))); setVolunteerAwards(cp.volunteerService.awards||[]); }
          if(cp.socialWork) setSocialWork(cp.socialWork);
          if(cp.honors) setHonors(cp.honors);
          if(cp.sports) setSports(cp.sports);
          if(cp.internship) setInternshipDuration(cp.internship);
          if(cp.militaryYears!=null) setMilitaryYears(cp.militaryYears);
        }
        if(p.specialAcademicTalent){
          setSpecialTalentApplying(!!p.specialAcademicTalent.isApplying);
          setSpecialTalentDesc(p.specialAcademicTalent.description||'');
            setSpecialTalentAchievements(p.specialAcademicTalent.achievements||'');
            setSpecialTalentProfessors(p.specialAcademicTalent.professors||[{name:'',title:'',department:''}]);
        }
        if(p.personalStatement) setPersonalStatement(p.personalStatement);
        const lf = data.localFiles;
        if(lf){
          if(lf.transcript) setTranscriptFile(lf.transcript);
          setPublications(list=> list.map((x,i)=> lf.publications && lf.publications[i]? { ...x, proofFile: lf.publications[i] }: x));
          setCompetitions(list=> list.map((x,i)=> lf.competitions && lf.competitions[i]? { ...x, proofFile: lf.competitions[i] }: x));
          setPatents(list=> list.map((x,i)=> lf.patents && lf.patents[i]? { ...x, proofFile: lf.patents[i] }: x));
          setHonors(list=> list.map((x,i)=> lf.honors && lf.honors[i]? { ...x, proofFile: lf.honors[i] }: x));
          if(lf.innovation) setInnovationProjects(list=> list.map((x,i)=> lf.innovation[i]? { ...x, proofFile: lf.innovation[i] }: x));
        }
        setAutoSaveMsg('已加载本地草稿');
      }
    } catch {/* ignore */}
  }, [applicationId, hasExisting, localDraftKey]);

  const saveLocalDraft = (silent=true) => {
    try {
      const payload = buildPayload(false); // 本地包含 local metas
      const localFiles = {
        transcript: isLocalMeta(transcriptFile)? transcriptFile : null,
        publications: publications.map(p=> isLocalMeta(p.proofFile)? p.proofFile: null),
        competitions: competitions.map(c=> isLocalMeta(c.proofFile)? c.proofFile: null),
        patents: patents.map(p=> isLocalMeta(p.proofFile)? p.proofFile: null),
        honors: honors.map(h=> isLocalMeta(h.proofFile)? h.proofFile: null),
        innovation: innovationProjects.map(p=> isLocalMeta(p.proofFile)? p.proofFile: null)
      };
      localStorage.setItem(localDraftKey, JSON.stringify({ payload, localFiles, savedAt: Date.now() }));
      if(!silent) setSaveMsg('本地草稿已保存');
      setAutoSaveMsg('已本地保存');
    } catch(e:any){ if(!silent) setErrorMsg('本地保存失败'); }
  };
  const clearLocalDraft = () => { if(window.confirm('确定清除本地草稿?')){ localStorage.removeItem(localDraftKey); toast.success('已清除本地草稿'); } };

  const saveDraftRemote = async (silent=false) => {
    if(!applicationId) { // 没有后端 id -> 本地保存
      saveLocalDraft(true);
      return;
    }
    try { await ensureRemoteFiles(); } catch { if(!silent) setErrorMsg('文件上传失败，草稿未保存'); return; }
    const payload = JSON.stringify(buildPayload(true));
    const r = await fetchWithAuth(`/api/applications/${applicationId}/draft`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: payload });
    if(r.ok){ if(!silent) setSaveMsg('草稿已保存'); }
    else if(!silent){ setErrorMsg('草稿保存失败'); }
  };

  // 删除仅适用于已有后端记录（通常已提交不可删除）
  const deleteDraft = async () => {
    if(!applicationId){ clearLocalDraft(); return; }
    if(!window.confirm('确定删除此申请记录? 操作不可恢复')) return;
    try {
      const r = await fetchWithAuth(`/api/applications/${applicationId}`, { method:'DELETE' });
      if(!r.ok){ const err = await r.json().catch(()=>({})); toast.error(err.error||'删除失败'); return; }
      setApplicationId(null);
      toast.success('已删除');
      await loadOrCreate();
    } catch(e:any){ toast.error(e.message); }
  };

  const validateBeforeSubmit = ():boolean => {
    const errs:string[]=[];
    const nonEmptyPubs = publications.filter(p=> (p.title||'').trim() || p.journal || p.authors || p.proofFile);
    nonEmptyPubs.forEach((p,i)=>{ if(!p.title.trim()) errs.push(`论文${i+1} 标题为空`); if(p.authorRank && p.authorRank<1) errs.push(`论文${i+1} 作者排名应>=1`); if(p.totalAuthors && p.authorRank && p.totalAuthors<p.authorRank) errs.push(`论文${i+1} 作者排名大于总作者数`); });
    const nonEmptyComps = competitions.filter(c=> (c.name||'').trim() || c.award || c.proofFile);
    nonEmptyComps.forEach((c,i)=>{ if(!c.name.trim()) errs.push(`竞赛${i+1} 名称为空`); if(c.isTeam){ if(c.totalTeamMembers && c.totalTeamMembers<1) errs.push(`竞赛${i+1} 团队人数无效`); if(c.teamRank && c.teamRank<1) errs.push(`竞赛${i+1} 团队排名无效`);} });
    sports.forEach((s,i)=>{ if((s.name||'').trim() && s.isTeam && (!s.teamSize || s.teamSize<1)) errs.push(`体育比赛${i+1} 团队人数无效`); });
    volunteerSegments.forEach((seg,i)=>{ const h=+seg.hours; if(seg.hours && (isNaN(h)||h<0)) errs.push(`志愿分段${i+1} 工时无效`); });
    if(volunteerHours && (isNaN(+volunteerHours)|| +volunteerHours<0)) errs.push('志愿服务总时长无效');
    if(!personalStatement.trim()) errs.push('个人陈述不能为空');
    if(errs.length){ setErrorMsg(errs.slice(0,5).join('\n')); toast.error('请先修正数据: '+errs[0]); return false;
    }
    return true;
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    if(!isEditable){ toast.error('当前状态不可提交'); return; }
    if(!validateBeforeSubmit()) return;
    if(submitting) return;
    if(!transcriptFile){ setErrorMsg('请上传成绩单'); return; }
    setSubmitting(true);
    let newId = applicationId;
    try {
      // 创建后端记录
      if(!newId){
        const create = await fetchWithAuth(`/api/applications/draft?activityId=${activity.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
        if(!create.ok){ const err = await create.json().catch(()=>({})); const msg = err.error||'创建申请失败'; setErrorMsg(msg); toast.error(msg); return; }
        const ca = await create.json();
        newId = ca.id; setApplicationId(ca.id);
      }
      // 确保本地文件全部上传
      try { await ensureRemoteFiles(); } catch(e:any){ setErrorMsg('文件上传失败，提交中止'); setSubmitting(false); return; }
      await saveDraftRemote(true);
      await patchAcademicIfNeeded();
      const r = await fetchWithAuth(`/api/applications/${newId}/submit`, { method:'POST' });
      if(!r.ok){ const err = await r.json().catch(()=>({})); const msg = err.error||'提交失败'; setErrorMsg(msg); toast.error(msg); return; }
      toast.success('提交成功');
      localStorage.removeItem(localDraftKey);
      const latest = await fetchWithAuth(`/api/applications/activity/${activity.id}/mine`);
      if(latest.ok){ const a = await latest.json(); setStatus(a.status||'SYSTEM_REVIEWING'); setSubmittedAt(a.submittedAt||'已提交'); }
      await fetchBackendScores();
      onSubmit();
    } catch(e:any){ setErrorMsg(e.message); toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const markDirty = () => setDirtyCounter(c=>c+1);

  const patchAcademicIfNeeded = async () => {
    const payload:any = {};
    if (basicInfo.name) payload.name = basicInfo.name;
    if (basicInfo.department) payload.department = basicInfo.department;
    if (basicInfo.major) payload.major = basicInfo.major;
    if (basicInfo.gpa) payload.gpa = parseFloat(basicInfo.gpa);
    if (basicInfo.academicRanking) payload.academicRank = parseInt(basicInfo.academicRanking);
    if (basicInfo.totalStudents) payload.majorTotal = parseInt(basicInfo.totalStudents);
    // 简单策略：始终尝试 patch，后端忽略已存在的
    try { await fetchWithAuth('/api/users/me/academic', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); } catch {}
  };

  const buildPayload = (forRemote:boolean) => {
    const sanitizeProof = (meta:any)=> (forRemote? (isLocalMeta(meta)? null: meta) : meta);
    const mapWithProof = <T extends { proofFile:any }>(arr:T[]) => arr.map(item=> ({ ...item, proofFile: sanitizeProof(item.proofFile) }));
    return {
      basicInfo,
      languageScores,
      academicAchievements: { publications: mapWithProof(publications), patents: mapWithProof(patents), competitions: mapWithProof(competitions), innovationProjects: mapWithProof(innovationProjects) },
      comprehensivePerformance: { volunteerService:{ hours: volunteerHours, segments: volunteerSegments.map(s=>({hours:+s.hours||0,type:s.type})), awards: volunteerAwards }, socialWork, honors: mapWithProof(honors), sports, internship: internshipDuration, militaryYears },
      personalStatement,
      specialAcademicTalent: specialTalentApplying? { isApplying:true, description:specialTalentDesc, achievements:specialTalentAchievements, professors: specialTalentProfessors }: undefined,
      uploadedFiles: {
        transcripts: transcriptFile && !isLocalMeta(transcriptFile)? [transcriptFile]: [],
        publicationProofs: publications.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
        competitionProofs: competitions.filter(c=>c.proofFile && !isLocalMeta(c.proofFile)).map(c=>c.proofFile),
        patentProofs: patents.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
        honorProofs: honors.filter(h=>h.proofFile && !isLocalMeta(h.proofFile)).map(h=>h.proofFile),
        innovationProofs: innovationProjects.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile)
      }
    };
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    // 注册中文字体
    try { doc.addFileToVFS(ZH_FONT_FILE, ZH_FONT_BASE64); doc.addFont(ZH_FONT_FILE, ZH_FONT_NAME, 'normal'); doc.setFont(ZH_FONT_NAME); } catch { /* ignore font errors */ }
    const lineHeight = 16; const marginX = 40; let y = 50; const pageH = doc.internal.pageSize.getHeight(); const pageW = doc.internal.pageSize.getWidth();
    const addLine = (text:string, bold=false) => { const lines = doc.splitTextToSize(text, pageW - marginX*2); lines.forEach(l=>{ if(y > pageH - 60){ doc.addPage(); y = 50; } doc.setFont(ZH_FONT_NAME,'normal'); if(bold) doc.setFontSize(14); else doc.setFontSize(12); doc.text(l, marginX, y); if(bold) doc.setFontSize(12); y += lineHeight; }); };
    const addImageBlock = (label:string, dataUrl:string) => { try { const img = new Image(); img.src = dataUrl; const maxW = pageW - marginX*2; const maxH = 280; const add = () => { const w = img.width||1; const h = img.height||1; const scale = Math.min(maxW / w, maxH / h, 1); const drawW = w * scale; const drawH = h * scale; if(y + drawH + 40 > pageH){ doc.addPage(); y = 50; } doc.setFont(undefined,'bold'); doc.text(label, marginX, y); y += 14; doc.addImage(img, dataUrl.startsWith('data:image/png')? 'PNG':'JPEG', marginX, y, drawW, drawH); y += drawH + 18; }; if(img.complete) add(); else img.onload = add; } catch {/* ignore */} };
    // 文本部分
    addLine(`推免申请导出 - ${activity.name}`, true);
    addLine(`姓名: ${basicInfo.name}  学号: ${basicInfo.studentId}`);
    addLine(`系别: ${basicInfo.department}  专业: ${basicInfo.major}`);
    addLine(`GPA: ${basicInfo.gpa} 排名: ${basicInfo.academicRanking}/${basicInfo.totalStudents}`);
    addLine(''); addLine('【个人陈述】', true); addLine(personalStatement||'(未填写)');
    addLine(''); addLine('【论文发表】', true); publications.forEach((p,i)=> addLine(`${i+1}. ${p.title||'(未填)'} / ${p.type} / 作者排名 ${p.authorRank}/${p.totalAuthors}${p.isCoFirst?' (共同一作)':''}`));
    addLine(''); addLine('【竞赛】', true); competitions.forEach((c,i)=> addLine(`${i+1}. ${c.name||'(未填)'} / ${c.level} / ${c.award}${c.isTeam?` 团队(${c.teamRank||'-'}/${c.totalTeamMembers||'-'})`:''}`));
    addLine(''); addLine('【专利/软著】', true); patents.forEach((p,i)=> addLine(`${i+1}. ${p.title||'(未填)'} / ${p.patentNumber||''} / 排名${p.authorRank}`));
    addLine(''); addLine('【科创项目】', true); innovationProjects.forEach((p,i)=> addLine(`${i+1}. ${p.name||'(未填)'} / ${p.level} / ${p.role} / ${p.status}`));
    addLine(''); addLine('【荣誉称号】', true); honors.forEach((h,i)=> addLine(`${i+1}. ${h.title||'(未填)'} / ${h.level} / ${h.year}${h.isCollective?' 集体':''}`));
    addLine(''); addLine('【社会工作】', true); socialWork.forEach((s,i)=> addLine(`${i+1}. ${s.position||'(未填)'} / ${s.level} / ${s.year} / 评分${s.rating}`));
    addLine(''); addLine('【志愿服务】', true); addLine(`总时长: ${volunteerHours||'(未填)'} 小时; 分段:${volunteerSegments.length}条`);
    addLine(''); addLine('【体育比赛】', true); sports.forEach((sp,i)=> addLine(`${i+1}. ${sp.name||'(未填)'} / ${sp.scope} / ${sp.result}${sp.isTeam?` 团队人数${sp.teamSize}`:''}`));
    if(specialTalentApplying){ addLine(''); addLine('【特殊学术专长申请】', true); addLine('简介: '+(specialTalentDesc||'(未填)')); addLine('成果: '+(specialTalentAchievements||'(未填)')); }
    // 图片附件汇总
    const images: { label:string; dataUrl:string }[] = [];
    if(transcriptFile && isImageMeta(transcriptFile)) images.push({ label:'成绩单', dataUrl: transcriptFile.dataUrl||transcriptFile.previewDataUrl });
    publications.forEach((p,i)=>{ if(p.proofFile && isImageMeta(p.proofFile)) images.push({ label:`论文证明${i+1}`, dataUrl: p.proofFile.dataUrl||p.proofFile.previewDataUrl }); });
    competitions.forEach((c,i)=>{ if(c.proofFile && isImageMeta(c.proofFile)) images.push({ label:`竞赛证明${i+1}`, dataUrl: c.proofFile.dataUrl||c.proofFile.previewDataUrl }); });
    patents.forEach((p,i)=>{ if(p.proofFile && isImageMeta(p.proofFile)) images.push({ label:`专利证明${i+1}`, dataUrl: p.proofFile.dataUrl||p.proofFile.previewDataUrl }); });
    honors.forEach((h,i)=>{ if(h.proofFile && isImageMeta(h.proofFile)) images.push({ label:`荣誉证明${i+1}`, dataUrl: h.proofFile.dataUrl||h.proofFile.previewDataUrl }); });
    innovationProjects.forEach((p,i)=>{ if(p.proofFile && isImageMeta(p.proofFile)) images.push({ label:`科创项目证明${i+1}`, dataUrl: p.proofFile.dataUrl||p.proofFile.previewDataUrl }); });
    if(images.length){ addLine(''); addLine('【图片附件】', true); images.forEach(img=> img.dataUrl && addImageBlock(img.label, img.dataUrl)); }
    const fileName = `推免申请_${basicInfo.name||'未命名'}_${activity.id}.pdf`;
    setTimeout(()=>{ doc.save(fileName); toast.success('已导出 PDF'); }, 400);
  };

  // 更新 saveDraft 逻辑：本地或后端
  const saveDraft = async () => {
    setSaveMsg(''); setErrorMsg('');
    if(applicationId){ setSaving(true); try { await saveDraftRemote(false); } finally { setSaving(false); } }
    else { saveLocalDraft(false); }
  };

  // 后端成绩刷新函数（补充原缺失）
  const fetchBackendScores = async () => {
    if(!applicationId) return;
    try {
      const r = await fetchWithAuth(`/api/applications/${applicationId}`);
      if(r.ok){
        const a = await r.json();
        setBackendScores(prev=>({
          academic: a.academicScore ?? prev.academic,
          specWeighted: a.achievementScore ?? prev.specWeighted,
          perfWeighted: a.performanceScore ?? prev.perfWeighted,
          total: a.totalScore ?? prev.total,
          specRaw: prev.specRaw,
          perfRaw: prev.perfRaw
        }));
        if(a.submittedAt) setSubmittedAt(a.submittedAt);
        if(a.status) setStatus(a.status);
      }
    } catch {/* ignore */}
  };

  // 自动保存修改：保持原逻辑（仅在可编辑且已有applicationId 时）
  useEffect(()=>{
    if(!isEditable) return;
    if(autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(()=>{ if(applicationId){ saveDraftRemote(true).then(()=> setAutoSaveMsg('已自动保存')); } else { saveLocalDraft(true); } }, 4000);
    return ()=>{ if(autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current); };
  },[dirtyCounter, applicationId, isEditable]);

  // UI 修改：去掉“创建草稿并开始填写”步骤，直接显示表单（若后端无记录即本地草稿模式）
  if (loadingApp) return <div className="p-4 text-sm text-gray-500">加载中...</div>;


  return (
    <div className="p-4 space-y-6 pb-safe-bottom md:pb-0">
      {/* 顶部返回与标题 - 小屏压缩按钮文字 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-base md:text-lg font-semibold truncate max-w-[40vw] md:max-w-none">推免申请</h1>
        <p className="text-xs md:text-sm text-gray-600 truncate max-w-[30vw] md:max-w-none">{activity.name}</p>
        <Badge variant={isEditable? 'secondary':'outline'} className="text-[10px] md:text-xs shrink-0">{submittedAt? status : '本地草稿'}</Badge>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {isEditable && <Button type="button" size="icon" variant="outline" onClick={exportPdf} className="md:px-2" title="导出PDF"><FileText className="w-4 h-4" /><span className="hidden md:inline ml-1">导出</span></Button>}
          {isEditable && <Button variant="destructive" size="icon" onClick={deleteDraft} title={applicationId? '删除申请记录':'清除本地草稿'}><Trash2 className="w-4 h-4" /><span className="hidden md:inline ml-1">{applicationId? '删除':'清除'}</span></Button>}
          {!isEditable && applicationId && <Button variant="outline" size="icon" onClick={fetchBackendScores} title="刷新成绩"><ArrowLeft className="rotate-180 w-4 h-4" /><span className="hidden md:inline ml-1">刷新</span></Button>}
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 grid grid-cols-4 gap-4 text-center text-xs md:text-sm">
          <div><p className="text-gray-600">学业(80%)</p><p className="text-sm md:text-lg text-blue-600">{backendScores.academic.toFixed(2)}</p></div>
          <div><p className="text-gray-600">专长(12%)</p><p className="text-sm md:text-lg text-indigo-600">{backendScores.specWeighted.toFixed(2)}</p></div>
          <div><p className="text-gray-600">综合(8%)</p><p className="text-sm md:text-lg text-green-600">{backendScores.perfWeighted.toFixed(2)}</p></div>
          <div><p className="text-gray-600">总分</p><p className="text-sm md:text-lg">{backendScores.total.toFixed(2)}</p></div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={!isEditable} className={isEditable? '' : 'opacity-80 pointer-events-none'}>
          {/* 基本信息 */}
          <Card><CardHeader><CardTitle className="flex items-center space-x-2"><UserIcon className="w-5 h-5" /><span>基本信息</span></CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div><Label>姓名</Label><Input value={basicInfo.name} disabled /></div><div><Label>学号</Label><Input value={basicInfo.studentId} disabled /></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>系别</Label><Input value={basicInfo.department} onChange={e=>handleBasicChange('department', e.target.value)} /></div>
              <div><Label>专业</Label><Input value={basicInfo.major} onChange={e=>handleBasicChange('major', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>GPA</Label><Input value={basicInfo.gpa} onChange={e=>handleBasicChange('gpa', e.target.value)} /></div>
              <div><Label>学业排名</Label><Input value={basicInfo.academicRanking} onChange={e=>handleBasicChange('academicRanking', e.target.value)} /></div>
              <div><Label>专业总人数</Label><Input value={basicInfo.totalStudents} onChange={e=>handleBasicChange('totalStudents', e.target.value)} /></div>
            </div>
            <div>
              <Label>成绩单 *</Label>
              <TranscriptUploader onFile={(meta)=>{ setTranscriptFile(meta); markDirty(); }} existing={transcriptFile} disabled={!isEditable} localMode={!applicationId} />
            </div>
          </CardContent></Card>

          {/* 外语成绩 */}
          <Card><CardHeader><CardTitle>外语成绩</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div><Label>CET4</Label><Input value={languageScores.cet4Score} onChange={e=>{setLanguageScores(s=>({...s,cet4Score:e.target.value})); markDirty();}} /></div><div><Label>CET6</Label><Input value={languageScores.cet6Score} onChange={e=>{setLanguageScores(s=>({...s,cet6Score:e.target.value})); markDirty();}} /></div></div>
            <div className="grid grid-cols-3 gap-4"><div><Label>TOEFL</Label><Input value={languageScores.toeflScore} onChange={e=>{setLanguageScores(s=>({...s,toeflScore:e.target.value})); markDirty();}} /></div><div><Label>IELTS</Label><Input value={languageScores.ieltsScore} onChange={e=>{setLanguageScores(s=>({...s,ieltsScore:e.target.value})); markDirty();}} /></div><div><Label>GRE</Label><Input value={languageScores.greScore} onChange={e=>{setLanguageScores(s=>({...s,greScore:e.target.value})); markDirty();}} /></div></div>
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs flex space-x-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span>外语成绩需在有效期内。</span></div>
          </CardContent></Card>

          {/* 论文发表 (可选) */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>论文发表 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setPublications(p=>[...p,{ title:'', type:'A类', authors:'', authorRank:1, totalAuthors:1, isCoFirst:false, journal:'', publishYear:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{publications.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{publications.map((pub,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">论文 {i+1}</h4>{publications.length>=1 && <Button type="button" size="sm" variant="destructive" onClick={()=>{setPublications(p=>p.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            <Input placeholder="标题 (留空则忽略)" value={pub.title} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-2 gap-4"><Select value={pub.type} onValueChange={v=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,type:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A类">A类</SelectItem><SelectItem value="B类">B类</SelectItem><SelectItem value="C类">C类</SelectItem><SelectItem value="高水平中文">高水平中文</SelectItem><SelectItem value="信息通信工程">信息通信工程</SelectItem></SelectContent></Select><Input type="number" value={pub.publishYear} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,publishYear:+e.target.value}:x)); markDirty();}} /></div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <Input type="number" value={pub.authorRank} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,authorRank:+e.target.value}:x)); markDirty();}} placeholder="作者排名" />
              <Input type="number" value={pub.totalAuthors} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,totalAuthors:+e.target.value}:x)); markDirty();}} placeholder="总作者数" />
              <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                <div className="flex items-center space-x-2">
                  <Checkbox checked={pub.isCoFirst} onCheckedChange={v=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,isCoFirst:!!v}:x)); markDirty();}} disabled={!(pub.authorRank===1||pub.authorRank===2)} />
                  <span>共同一作</span>
                </div>
                <span>说明: 第一/第二作者且勾选=各 50%</span>
              </div>
            </div>
            <div><Label>证明材料</Label><ProofFileUploader meta={pub.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setPublications(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 学科竞赛 (可选) */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><Trophy className="w-5 h-5" /><span>学科竞赛 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setCompetitions(c=>[...c,{ name:'', level:'A+类', award:'国家级一等奖及以上', year:new Date().getFullYear(), isTeam:false, teamRank:1, totalTeamMembers:1, isExternal:false, workKey:'', proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{competitions.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{competitions.map((comp,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">竞赛 {i+1}</h4>{competitions.length>=1 && <Button type="button" size="sm" variant="destructive" onClick={()=>{setCompetitions(c=>c.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            <Input placeholder="竞赛名称 (留空忽略)" value={comp.name} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-2 gap-4"><Select value={comp.level} onValueChange={v=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A+类">A+类</SelectItem><SelectItem value="A类">A类</SelectItem><SelectItem value="A-类">A-类</SelectItem></SelectContent></Select><Select value={comp.award} onValueChange={v=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,award:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国家级一等奖及以上">国家级一等奖及以上</SelectItem><SelectItem value="国家级二等奖">国家级二等奖</SelectItem><SelectItem value="国家级三等奖">国家级三等奖</SelectItem><SelectItem value="省级一等奖及以上">省级一等奖及以上</SelectItem><SelectItem value="省级二等奖">省级二等奖</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-4 gap-4 items-end"><Input type="number" value={comp.year} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} placeholder="年份" />
              <div className="flex items-center space-x-2"><Checkbox checked={comp.isTeam} onCheckedChange={chk=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,isTeam:!!chk}:x)); markDirty();}} /><Label>团体</Label></div>
              {comp.isTeam && <Input type="number" value={comp.teamRank} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,teamRank:+e.target.value}:x)); markDirty();}} placeholder="团队排名" />}
              {comp.isTeam && <Input type="number" value={comp.totalTeamMembers} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,totalTeamMembers:+e.target.value}:x)); markDirty();}} placeholder="团队人数" />}
            </div>
            {comp.isTeam && <p className="text-[11px] text-gray-500 -mt-2">若为团队赛：填写团队排名与总人数用于折算</p>}
          </Card>)}</CardContent></Card>

          {/* 专利 / 软件著作权 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>专利 / 软件著作权 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setPatents(p=>[...p,{ title:'', patentNumber:'', authorRank:1, grantYear:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{patents.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{patents.map((p,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">专利 {i+1}</h4>{patents.length>=1 && <Button size="sm" variant="destructive" type="button" onClick={()=>{setPatents(list=>list.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            <Input placeholder="标题/名称 (留空忽略)" value={p.title} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-3 gap-4"><Input placeholder="授权号" value={p.patentNumber} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,patentNumber:e.target.value}:x)); markDirty();}} /><Input type="number" value={p.authorRank} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,authorRank:+e.target.value}:x)); markDirty();}} placeholder="作者排名" /><Input type="number" value={p.grantYear} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,grantYear:+e.target.value}:x)); markDirty();}} placeholder="年份" /></div>
            <div><Label>证明</Label><ProofFileUploader meta={p.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setPatents(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 创新项目 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>创新 / 科创项目 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setInnovationProjects(p=>[...p,{ name:'', level:'国家级', role:'组长', status:'已结项', year:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{innovationProjects.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{innovationProjects.map((p,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">项目 {i+1}</h4>{innovationProjects.length>=1 && <Button size="sm" variant="destructive" type="button" onClick={()=>{setInnovationProjects(list=>list.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            <Input placeholder="项目名称 (留空忽略)" value={p.name} onChange={e=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-3 gap-4"><Select value={p.level} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国家级">国家级</SelectItem><SelectItem value="省级">省级</SelectItem><SelectItem value="校级">校级</SelectItem></SelectContent></Select><Select value={p.role} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,role:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="组长">组长</SelectItem><SelectItem value="成员">成员</SelectItem></SelectContent></Select><Select value={p.status} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,status:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="已结项">已结项</SelectItem><SelectItem value="在研">在研</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4"><Input type="number" value={p.year} onChange={e=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} placeholder="年份" /></div>
            <div><Label>证明</Label><ProofFileUploader meta={p.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setInnovationProjects(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 荣誉称号 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><Award className="w-5 h-5" /><span>荣誉称号 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setHonors(h=>[...h,{ title:'', level:'国家级', year:new Date().getFullYear(), isCollective:false, proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-3">{honors.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{honors.map((h,i)=> <div key={i} className="grid md:grid-cols-7 grid-cols-3 gap-2 items-end p-3 border rounded">
            <Input placeholder="名称 (留空忽略)" value={h.title} onChange={e=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} />
            <Select value={h.level} onValueChange={v=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国家级">国家级</SelectItem><SelectItem value="省级">省级</SelectItem><SelectItem value="校级">校级</SelectItem></SelectContent></Select>
            <Input type="number" value={h.year} onChange={e=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} />
            <div className="flex items-center gap-2 text-xs"><Checkbox checked={h.isCollective} onCheckedChange={v=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,isCollective:!!v}:x)); markDirty();}} />集体</div>
            <div className="col-span-2 md:col-span-1"><ProofFileUploader meta={h.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setHonors(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
            <Button type="button" size="sm" variant="destructive" onClick={()=>{setHonors(s=>s.filter((_,idx)=>idx!==i)); markDirty();}}>删</Button>
            {i===honors.length-1 && <Button type="button" size="sm" onClick={()=>{setHonors(s=>[...s,{ title:'', level:'国家级', year:new Date().getFullYear(), isCollective:false, proofFile:null }]);}}>+</Button>}
          </div>)}</CardContent></Card>

          {/* 体育比赛 */}
          <Card><CardHeader><CardTitle className="flex items-center space-x-2"><Trophy className="w-5 h-5" /><span>体育比赛 (可选)</span></CardTitle></CardHeader><CardContent className="space-y-3">{sports.length===0 && <div className="text-xs text-gray-500">暂无记录，点击下方添加</div>}{sports.map((sp,i)=> <Card key={sp.id} className="p-4 space-y-3">
            <div className="flex justify-between items-center"><h4 className="text-sm">赛事 {i+1}</h4><Button type="button" size="sm" variant="destructive" onClick={()=>{setSports(list=>list.filter(x=>x.id!==sp.id)); markDirty();}}>删</Button></div>
            <Input placeholder="赛事名称 (留空忽略)" value={sp.name} onChange={e=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid md:grid-cols-5 grid-cols-2 gap-3 items-end text-xs">
              <Select value={sp.scope} onValueChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,scope:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国际级">国际级</SelectItem><SelectItem value="国家级">国家级</SelectItem></SelectContent></Select>
              <Select value={sp.result} onValueChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,result:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="冠军">冠军</SelectItem><SelectItem value="亚军">亚军</SelectItem><SelectItem value="季军">季军</SelectItem><SelectItem value="四至八名">四至八名</SelectItem></SelectContent></Select>
              <div className="flex items-center gap-2"><Checkbox checked={sp.isTeam} onCheckedChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,isTeam:!!v}:x)); markDirty();}} />团队</div>
              {sp.isTeam && <Input type="number" min={1} value={sp.teamSize} onChange={e=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,teamSize:+e.target.value}:x)); markDirty();}} placeholder="人数" />}
              {!sp.isTeam && <div className="text-gray-500">个人赛</div>}
            </div>
          </Card>)}
          <Button type="button" size="sm" onClick={()=>{setSports(list=>[...list,{ id:Date.now(), name:'', scope:'国家级', result:'冠军', isTeam:false, teamSize:1 }]); markDirty();}}>+新增体育比赛</Button>
          <p className="text-[10px] text-gray-500">国际/国家级计分按规则折算，计入综合表现上限。</p>
          </CardContent></Card>

          {/* 特殊学术专长 */}
          <Card>
            <CardHeader><CardTitle className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>特殊学术专长申请 (可选)</span></CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2"><Checkbox checked={specialTalentApplying} onCheckedChange={v=>{setSpecialTalentApplying(!!v); markDirty();}} />我申请特殊学术专长</div>
              {specialTalentApplying && <div className="space-y-3">
                <div><Label>专长简介</Label><Textarea rows={3} value={specialTalentDesc} onChange={e=>{setSpecialTalentDesc(e.target.value); markDirty();}} /></div>
                <div><Label>代表性成果</Label><Textarea rows={4} value={specialTalentAchievements} onChange={e=>{setSpecialTalentAchievements(e.target.value); markDirty();}} placeholder="按 1) 2) 3) 列出" /></div>
                <div><Label>推荐导师</Label>{specialTalentProfessors.map((p,i)=><div key={i} className="grid grid-cols-3 gap-2 mb-2"><Input placeholder="姓名" value={p.name} onChange={e=>{setSpecialTalentProfessors(list=>list.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)); markDirty();}} /><Input placeholder="职称" value={p.title} onChange={e=>{setSpecialTalentProfessors(list=>list.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} /><Input placeholder="单位" value={p.department} onChange={e=>{setSpecialTalentProfessors(list=>list.map((x,idx)=>idx===i?{...x,department:e.target.value}:x)); markDirty();}} /></div>)}<Button type="button" size="sm" onClick={()=>{setSpecialTalentProfessors(p=>[...p,{name:'',title:'',department:''}]);}}>+导师</Button></div>
              </div>}
            </CardContent>
          </Card>

          {/* 个人陈述 */}
          <Card><CardHeader><CardTitle className="flex items-center space-x-2"><FileText className="w-5 h-5" /><span>个人陈述 *</span></CardTitle></CardHeader><CardContent><Textarea rows={8} value={personalStatement} onChange={e=>{setPersonalStatement(e.target.value); markDirty();}} placeholder="请描述学术背景、研究兴趣与推免动机（必填）" /></CardContent></Card>
        </fieldset>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 flex-wrap text-xs md:text-sm">
          {isEditable && <Button type="button" variant="outline" onClick={saveDraft} disabled={saving}>{saving? '保存中...' : (applicationId? '保存草稿':'保存本地草稿')}</Button>}
          {isEditable && <Button type="submit" disabled={submitting}>{submitting? '提交中...' : '提交申请'}</Button>}
          {!isEditable && <span className="text-xs text-gray-500">已提交（只读）</span>}
          {saveMsg && <span className="text-green-600">{saveMsg}</span>}
          {autoSaveMsg && <span className="text-gray-500">{autoSaveMsg}</span>}
          {errorMsg && <span className="text-red-600 whitespace-pre-line">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
};

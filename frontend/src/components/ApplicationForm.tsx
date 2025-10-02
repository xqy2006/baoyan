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
import { useLocalTempFile } from './hooks/useLocalTempFile';
import { ProofFileUploader } from './ProofFileUploader';
import { ConfirmDialog } from './ui/confirm-dialog';

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
  const [revivedFromStatus, setRevivedFromStatus] = useState<string|null>(null);
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
        // 只有进行中/已通过才标记 submitted; 已取消/驳回允许重新编辑
        const readonlyStatuses = ['SYSTEM_REVIEWING','SYSTEM_APPROVED','ADMIN_REVIEWING','APPROVED'];
        if (readonlyStatuses.includes(a.status)) {
          setSubmittedAt(a.submittedAt || '已提交');
        } else {
          setSubmittedAt(null);
        }
        // 若已取消或驳回，调用 createDraft 复活为草稿
        const reopenable = ['CANCELLED','REJECTED','SYSTEM_REJECTED'];
        if (reopenable.includes(a.status)) {
          try {
            const revive = await fetchWithAuth(`/api/applications/draft?activityId=${activity.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
            if (revive.ok) {
              const revived = await revive.json();
              setApplicationId(revived.id);
              setStatus('DRAFT');
              setSubmittedAt(null);
              setRevivedFromStatus(a.status);
              toast.info('已从 '+a.status+' 状态恢复为草稿，可重新提交');
            }
          } catch {/* ignore revive errors */}
        }
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
  const clearLocalDraft = () => { setConfirmClearOpen(true); };

  // 按 id 上传本地文件（提交或显式保存时使用）
  const ensureRemoteFilesById = async (id:number) => {
    if(!id) return { failures: [] as string[], snapshot: null as any };
    const failures:string[] = [];
    const snapshot = { transcripts: [] as any[], publicationProofs: [] as any[], competitionProofs: [] as any[], patentProofs: [] as any[], honorProofs: [] as any[], innovationProofs: [] as any[] };
    const uploadOne = async (local:any, assign:(remote:any)=>void, label:string, collect:(m:any)=>void) => {
      if(!local) return; if(!isLocalMeta(local)) { if(!collect && !isLocalMeta(local)) {/* ignore */} else if(!isLocalMeta(local)) collect(local); return; }
      try {
        const meta = await uploadLocalMeta(local);
        const merged = { ...meta, previewDataUrl: local.dataUrl||local.previewDataUrl };
        assign(merged); collect(merged);
      } catch(e:any){ failures.push(label+':'+(e?.message||'上传失败')); }
    };
    await uploadOne(transcriptFile, (m)=>setTranscriptFile(m), '成绩单', (m)=>snapshot.transcripts=[m]);
    // helpers for arrays
    const batch = async (arr:any[], setter:(updater:(old:any[])=>any[])=>void, labelPrefix:string, collect:(m:any)=>void) => {
      await Promise.all(arr.map(async (item,idx)=>{
        if(!item?.proofFile){ return; }
        if(isLocalMeta(item.proofFile)){
          try {
            const meta = await uploadLocalMeta(item.proofFile);
            const merged = { ...meta, previewDataUrl: item.proofFile.dataUrl||item.proofFile.previewDataUrl };
            setter(list=> list.map((x,i)=> i===idx? { ...x, proofFile: merged }: x));
            collect(merged);
          } catch(e:any){ failures.push(`${labelPrefix}${idx+1}`); }
        } else {
            collect(item.proofFile);
        }
      }));
    };
    await batch(publications, setPublications, '论文', (m)=>snapshot.publicationProofs.push(m));
    await batch(competitions, setCompetitions, '竞赛', (m)=>snapshot.competitionProofs.push(m));
    await batch(patents, setPatents, '专利', (m)=>snapshot.patentProofs.push(m));
    await batch(honors, setHonors, '荣誉', (m)=>snapshot.honorProofs.push(m));
    await batch(innovationProjects, setInnovationProjects, '科创', (m)=>snapshot.innovationProofs.push(m));
    // 如果 transcript 之前就是远程的（非本地）且本次没有重新上传，需要补进 snapshot
    if(snapshot.transcripts.length===0 && transcriptFile && !isLocalMeta(transcriptFile)) snapshot.transcripts=[transcriptFile];
    return { failures, snapshot };
  };

  const saveDraftRemoteById = async (id:number, silent=false) => {
    if(!id){ saveLocalDraft(true); return; }
    let uploadFailures: string[] = [];
    let snapshot:any = null;
    try { const r = await ensureRemoteFilesById(id); uploadFailures = r.failures; snapshot = r.snapshot; } catch(e:any){ uploadFailures.push('文件批量上传过程异常'); }
    const payloadObj = buildPayload(true, snapshot); // 只包含已成功上传（有 id）的文件
    if(!silent) console.debug('[APPLICATION][SAVE_DRAFT] id=', id, 'snapshot=', snapshot, 'payload.uploadedFiles=', payloadObj.uploadedFiles);
    let payload: string; try { payload = JSON.stringify(payloadObj); } catch { if(!silent) setErrorMsg('序列化失败'); return; }
    const r = await fetchWithAuth(`/api/applications/${id}/draft`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: payload });
    if(r.ok){
      if(!silent){
        if(uploadFailures.length>0) setSaveMsg(`草稿已保存（${uploadFailures.length} 个文件未成功: ${uploadFailures.slice(0,3).join(',')}...)`);
        else setSaveMsg('草稿已保存');
      }
    } else if(!silent){
      setErrorMsg('草稿保存失败');
    }
  };

  const saveDraftRemote = async (silent=false) => {
    if(!applicationId){ saveLocalDraft(true); return; }
    return saveDraftRemoteById(applicationId, silent);
  };

  // 删除仅适用于已有后端记录（通常已提交不可删除）
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteDraft = async () => {
    if(!applicationId){ setConfirmClearOpen(true); return; }
    setConfirmDeleteOpen(true);
  };
  const doDeleteDraft = async () => {
    if(!applicationId){ localStorage.removeItem(localDraftKey); toast.success('已清除本地草稿'); return; }
    try {
      const r = await fetchWithAuth(`/api/applications/${applicationId}`, { method:'DELETE' });
      if(!r.ok){ const err = await r.json().catch(()=>({})); toast.error(err.error||'删除失败'); return; }
      setApplicationId(null); toast.success('已删除'); await loadOrCreate();
    } catch(e:any){ toast.error(e.message); }
  };
  const doClearLocal = () => { localStorage.removeItem(localDraftKey); toast.success('已清除本地草稿'); };

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
      if(!newId){
        const create = await fetchWithAuth(`/api/applications/draft?activityId=${activity.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
        if(!create.ok){ const err = await create.json().catch(()=>({})); const msg = err.error||'创建申请失败'; setErrorMsg(msg); toast.error(msg); return; }
        const ca = await create.json();
        newId = ca.id; setApplicationId(ca.id);
      }
      // 先保存草稿（含首次上传）
      await saveDraftRemoteById(newId!, true);
      // 第二次强制抓取最新文件快照（防止提交前刚上传）
      const { snapshot } = await ensureRemoteFilesById(newId!);
      await patchAcademicIfNeeded();
      const finalPayloadObj = buildPayload(true, snapshot);
      const finalPayload = JSON.stringify(finalPayloadObj);
      console.debug('[APPLICATION][SUBMIT] id=', newId, 'files snapshot=', snapshot, 'payloadUploadedFiles=', finalPayloadObj.uploadedFiles);
      const r = await fetchWithAuth(`/api/applications/${newId}/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: finalPayload });
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

  const buildPayload = (forRemote:boolean, snapshot?:any) => {
    const sanitizeProof = (meta:any)=> (forRemote? (isLocalMeta(meta)? null: meta) : meta);
    const mapWithProof = <T extends { proofFile:any }>(arr:T[]) => arr.map(item=> ({ ...item, proofFile: sanitizeProof(item.proofFile) }));
    const uploadedFiles = (()=>{
      const remoteTranscript = (transcriptFile && !isLocalMeta(transcriptFile))? [transcriptFile] : [];
      if(!forRemote){
        return {
          transcripts: remoteTranscript,
          publicationProofs: publications.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
          competitionProofs: competitions.filter(c=>c.proofFile && !isLocalMeta(c.proofFile)).map(c=>c.proofFile),
          patentProofs: patents.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
          honorProofs: honors.filter(h=>h.proofFile && !isLocalMeta(h.proofFile)).map(h=>h.proofFile),
          innovationProofs: innovationProjects.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile)
        };
      }
      if(snapshot){
        // 如果 snapshot 没有捕获到成绩单但 state 中已有远程成绩单，则补进去
        const snapTrans = (snapshot.transcripts||[]).filter((f:any)=>f && f.id);
        const finalTrans = snapTrans.length>0? snapTrans : remoteTranscript;
        return {
          transcripts: finalTrans,
          publicationProofs: (snapshot.publicationProofs||[]).filter((f:any)=>f && f.id),
          competitionProofs: (snapshot.competitionProofs||[]).filter((f:any)=>f && f.id),
          patentProofs: (snapshot.patentProofs||[]).filter((f:any)=>f && f.id),
          honorProofs: (snapshot.honorProofs||[]).filter((f:any)=>f && f.id),
          innovationProofs: (snapshot.innovationProofs||[]).filter((f:any)=>f && f.id)
        };
      }
      // fallback 原实现
      return {
        transcripts: remoteTranscript,
        publicationProofs: publications.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
        competitionProofs: competitions.filter(c=>c.proofFile && !isLocalMeta(c.proofFile)).map(c=>c.proofFile),
        patentProofs: patents.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile),
        honorProofs: honors.filter(h=>h.proofFile && !isLocalMeta(h.proofFile)).map(h=>h.proofFile),
        innovationProofs: innovationProjects.filter(p=>p.proofFile && !isLocalMeta(p.proofFile)).map(p=>p.proofFile)
      };
    })();
    return {
      basicInfo,
      languageScores,
      academicAchievements: { publications: mapWithProof(publications), patents: mapWithProof(patents), competitions: mapWithProof(competitions), innovationProjects: mapWithProof(innovationProjects) },
      comprehensivePerformance: { volunteerService:{ hours: volunteerHours, segments: volunteerSegments.map(s=>({hours:+s.hours||0,type:s.type})), awards: volunteerAwards }, socialWork, honors: mapWithProof(honors), sports, internship: internshipDuration, militaryYears },
      personalStatement,
      specialAcademicTalent: specialTalentApplying? { isApplying:true, description:specialTalentDesc, achievements:specialTalentAchievements, professors: specialTalentProfessors }: undefined,
      uploadedFiles
    };
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
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-5 md:p-6 space-y-6 pb-safe-bottom md:pb-0">
      {/* 顶部返回与标题 - 小屏压缩按钮文字 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-base md:text-lg font-semibold truncate max-w-[40vw] md:max-w-none">推免申请</h1>
        <p className="text-xs md:text-sm text-gray-600 truncate max-w-[30vw] md:max-w-none">{activity.name}</p>
        <Badge variant={isEditable? 'secondary':'outline'} className="text-[10px] md:text-xs shrink-0">{submittedAt? status : (revivedFromStatus? '重新申请草稿':'本地草稿')}</Badge>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* 已移除导出按钮 */}
          {isEditable && !applicationId && (
            <Button
              variant="destructive"
              size="icon"
              onClick={deleteDraft}
              title="清除本地草稿"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline ml-1">清除</span>
            </Button>
          )}
          {!isEditable && applicationId && <Button variant="outline" size="icon" onClick={fetchBackendScores} title="刷新成绩"><ArrowLeft className="rotate-180 w-4 h-4" /><span className="hidden md:inline ml-1">刷新</span></Button>}
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-2.5 sm:p-3 md:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 text-center">
          <div><p className="text-[10px] sm:text-xs text-gray-600 truncate">学业(0-80)</p><p className="text-sm sm:text-base md:text-lg text-blue-600 font-semibold">{backendScores.academic.toFixed(2)}</p></div>
          <div><p className="text-[10px] sm:text-xs text-gray-600 truncate">学术专长(0-15)</p><p className="text-sm sm:text-base md:text-lg text-indigo-600 font-semibold">{backendScores.specWeighted.toFixed(2)}</p></div>
          <div><p className="text-[10px] sm:text-xs text-gray-600 truncate">综合表现(0-5)</p><p className="text-sm sm:text-base md:text-lg text-green-600 font-semibold">{backendScores.perfWeighted.toFixed(2)}</p></div>
          <div><p className="text-[10px] sm:text-xs text-gray-600 truncate">总分(0-100)</p><p className="text-sm sm:text-base md:text-lg font-bold">{backendScores.total.toFixed(2)}</p></div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={!isEditable} className={isEditable? '' : 'opacity-80 pointer-events-none'}>
          {/* 基本信息 */}
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><UserIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /><span>基本信息</span></CardTitle></CardHeader><CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"><div><Label className="text-xs sm:text-sm">姓名</Label><Input value={basicInfo.name} disabled /></div><div><Label className="text-xs sm:text-sm">学号</Label><Input value={basicInfo.studentId} disabled /></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div><Label>系别</Label><Input value={basicInfo.department} onChange={e=>handleBasicChange('department', e.target.value)} /></div>
              <div><Label>专业</Label><Input value={basicInfo.major} onChange={e=>handleBasicChange('major', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div><Label className="text-xs sm:text-sm">GPA</Label><Input value={basicInfo.gpa} onChange={e=>handleBasicChange('gpa', e.target.value)} /></div>
              <div><Label className="text-xs sm:text-sm">学业排名</Label><Input value={basicInfo.academicRanking} onChange={e=>handleBasicChange('academicRanking', e.target.value)} /></div>
              <div><Label className="text-xs sm:text-sm">专业总人数</Label><Input value={basicInfo.totalStudents} onChange={e=>handleBasicChange('totalStudents', e.target.value)} /></div>
            </div>
            <div>
              <Label>成绩单 *</Label>
              <TranscriptUploader onFile={(meta)=>{ setTranscriptFile(meta); markDirty(); }} existing={transcriptFile} disabled={!isEditable} localMode={!applicationId} />
            </div>
          </CardContent></Card>

          {/* 外语成绩 */}
          <Card><CardHeader><CardTitle className="text-base sm:text-lg">外语成绩</CardTitle></CardHeader><CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"><div><Label className="text-xs sm:text-sm">CET4</Label><Input value={languageScores.cet4Score} onChange={e=>{setLanguageScores(s=>({...s,cet4Score:e.target.value})); markDirty();}} /></div><div><Label className="text-xs sm:text-sm">CET6</Label><Input value={languageScores.cet6Score} onChange={e=>{setLanguageScores(s=>({...s,cet6Score:e.target.value})); markDirty();}} /></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"><div><Label className="text-xs sm:text-sm">TOEFL</Label><Input value={languageScores.toeflScore} onChange={e=>{setLanguageScores(s=>({...s,toeflScore:e.target.value})); markDirty();}} /></div><div><Label className="text-xs sm:text-sm">IELTS</Label><Input value={languageScores.ieltsScore} onChange={e=>{setLanguageScores(s=>({...s,ieltsScore:e.target.value})); markDirty();}} /></div><div><Label className="text-xs sm:text-sm">GRE</Label><Input value={languageScores.greScore} onChange={e=>{setLanguageScores(s=>({...s,greScore:e.target.value})); markDirty();}} /></div></div>
            <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded text-[10px] sm:text-xs flex items-start gap-2"><AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 flex-shrink-0 mt-0.5" /><span className="break-words">外语成绩需在有效期内。</span></div>
          </CardContent></Card>

          {/* 论文发表 (可选) */}
          <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base sm:text-lg"><span className="flex items-center gap-2"><BookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /><span>论文发表 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setPublications(p=>[...p,{ title:'', type:'A类', authors:'', authorRank:1, totalAuthors:1, isCoFirst:false, journal:'', publishYear:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-3 h-3 sm:w-4 sm:h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-3 sm:space-y-4">{publications.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{publications.map((pub,i)=> <Card key={i} className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2"><h4 className="text-xs sm:text-sm font-medium">论文 {i+1}</h4>{publications.length>=1 && <Button type="button" size="sm" variant="destructive" onClick={()=>{setPublications(p=>p.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" /><span className="hidden sm:inline ml-1">删除</span></Button>}</div>
            {/* Publications (论文发表) */}
            {/* 删除原先的描述行，改为显式标签 */}
            <Label className="text-xs">论文标题</Label>
            <Input placeholder="示例: A Study on ..." value={pub.title} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">类别</Label>
                <Select value={pub.type} onValueChange={v=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,type:v as any}:x)); markDirty();}}>
                  <SelectTrigger><SelectValue placeholder="选择类别" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A类">A类</SelectItem>
                    <SelectItem value="B类">B类</SelectItem>
                    <SelectItem value="C类">C类</SelectItem>
                    <SelectItem value="高水平中文">高水平中文</SelectItem>
                    <SelectItem value="信息通信工程">信息通信工程</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">发表年份</Label>
                <Input type="number" value={pub.publishYear} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,publishYear:+e.target.value}:x)); markDirty();}} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4 items-start">
              <div>
                <Label className="text-xs sm:text-sm">作者排名</Label>
                <Input type="number" value={pub.authorRank} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,authorRank:+e.target.value}:x)); markDirty();}} />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">总作者数</Label>
                <Input type="number" value={pub.totalAuthors} onChange={e=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,totalAuthors:+e.target.value}:x)); markDirty();}} />
              </div>
              <div className="flex flex-col gap-1 text-[10px] sm:text-[11px] text-gray-500">
                <div className="flex items-center gap-2">
                  <Checkbox checked={pub.isCoFirst} onCheckedChange={v=>{setPublications(p=>p.map((x,idx)=>idx===i?{...x,isCoFirst:!!v}:x)); markDirty();}} disabled={!(pub.authorRank===1||pub.authorRank===2)} />
                  <span className="break-words">共同一作</span>
                </div>
                <span className="break-words">说明: 第一/第二作者勾选=各 50%</span>
              </div>
            </div>
            <div><Label>证明材料</Label><ProofFileUploader meta={pub.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setPublications(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 学科竞赛 (可选) */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><Trophy className="w-5 h-5" /><span>学科竞赛 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setCompetitions(c=>[...c,{ name:'', level:'A+类', award:'国家级一等奖及以上', year:new Date().getFullYear(), isTeam:false, teamRank:1, totalTeamMembers:1, isExternal:false, workKey:'', proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{competitions.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{competitions.map((comp,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">竞赛 {i+1}</h4>{competitions.length>=1 && <Button type="button" size="sm" variant="destructive" onClick={()=>{setCompetitions(c=>c.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            {/* Competition (学科竞赛) */}
            <Label className="text-xs">竞赛名称</Label>
            <Input placeholder="示例: 蓝桥杯" value={comp.name} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">级别</Label>
                <Select value={comp.level} onValueChange={v=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}>
                  <SelectTrigger><SelectValue placeholder="选择级别" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+类">A+类</SelectItem>
                    <SelectItem value="A类">A类</SelectItem>
                    <SelectItem value="A-类">A-类</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">获奖等级</Label>
                <Select value={comp.award} onValueChange={v=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,award:v as any}:x)); markDirty();}}>
                  <SelectTrigger><SelectValue placeholder="选择奖项" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="国家级一等奖及以上">国家级一等奖及以上</SelectItem>
                    <SelectItem value="国家级二等奖">国家级二等奖</SelectItem>
                    <SelectItem value="国家级三等奖">国家级三等奖</SelectItem>
                    <SelectItem value="省级一等奖及以上">省级一等奖及以上</SelectItem>
                    <SelectItem value="省级二等奖">省级二等奖</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 items-end">
              <div className="col-span-1"><Label className="text-xs">获奖年份</Label><Input type="number" value={comp.year} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} /></div>
              <div className="flex items-center space-x-2 col-span-1 mt-4"><Checkbox checked={comp.isTeam} onCheckedChange={chk=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,isTeam:!!chk}:x)); markDirty();}} /><Label className="text-xs m-0">团体赛</Label></div>
              {comp.isTeam && <div><Label className="text-xs">团队排名</Label><Input type="number" value={comp.teamRank} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,teamRank:+e.target.value}:x)); markDirty();}} /></div>}
              {comp.isTeam && <div><Label className="text-xs">团队人数</Label><Input type="number" value={comp.totalTeamMembers} onChange={e=>{setCompetitions(c=>c.map((x,idx)=>idx===i?{...x,totalTeamMembers:+e.target.value}:x)); markDirty();}} /></div>}
            </div>
            {comp.isTeam && <p className="text-[11px] text-gray-500 -mt-2">若为团队赛：填写团队排名与总人数用于折算</p>}
          </Card>)}</CardContent></Card>

          {/* 专利 / 软件著作权 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>专利 / 软件著作权 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setPatents(p=>[...p,{ title:'', patentNumber:'', authorRank:1, grantYear:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{patents.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{patents.map((p,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">专利 {i+1}</h4>{patents.length>=1 && <Button size="sm" variant="destructive" type="button" onClick={()=>{setPatents(list=>list.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            {/* Patents / Software copyrights */}
            <Label className="text-xs">名称</Label>
            <Input placeholder="示例: 一种xxx系统" value={p.title} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs">授权号</Label><Input value={p.patentNumber} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,patentNumber:e.target.value}:x)); markDirty();}} /></div>
              <div><Label className="text-xs">作者排名</Label><Input type="number" value={p.authorRank} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,authorRank:+e.target.value}:x)); markDirty();}} /></div>
              <div><Label className="text-xs">授权年份</Label><Input type="number" value={p.grantYear} onChange={e=>{setPatents(list=>list.map((x,idx)=>idx===i?{...x,grantYear:+e.target.value}:x)); markDirty();}} /></div>
            </div>
            <div><Label>证明</Label><ProofFileUploader meta={p.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setPatents(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 创新项目 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><BookOpen className="w-5 h-5" /><span>创新 / 科创项目 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setInnovationProjects(p=>[...p,{ name:'', level:'国家级', role:'组长', status:'已结项', year:new Date().getFullYear(), proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-4">{innovationProjects.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{innovationProjects.map((p,i)=> <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between"><h4 className="text-sm">项目 {i+1}</h4>{innovationProjects.length>=1 && <Button size="sm" variant="destructive" type="button" onClick={()=>{setInnovationProjects(list=>list.filter((_,x)=>x!==i)); markDirty();}}><Trash2 className="w-3 h-3" />删除</Button>}</div>
            {/* Innovation / Sci-Tech Project */}
            <Label className="text-xs">项目名称</Label>
            <Input placeholder="示例: 智能终端..." value={p.name} onChange={e=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs">级别</Label><Select value={p.level} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue placeholder="级别" /></SelectTrigger><SelectContent><SelectItem value="国家级">国家级</SelectItem><SelectItem value="省级">省级</SelectItem><SelectItem value="校级">校级</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">角色</Label><Select value={p.role} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,role:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue placeholder="角色" /></SelectTrigger><SelectContent><SelectItem value="组长">组长</SelectItem><SelectItem value="成员">成员</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">状态</Label><Select value={p.status} onValueChange={v=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,status:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="已结项">已结项</SelectItem><SelectItem value="在研">在研</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4"><div><Label className="text-xs">年份</Label><Input type="number" value={p.year} onChange={e=>{setInnovationProjects(list=>list.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} /></div></div>
            <div><Label>证明</Label><ProofFileUploader meta={p.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setInnovationProjects(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
          </Card>)}</CardContent></Card>

          {/* 荣誉称号 */}
          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><Award className="w-5 h-5" /><span>荣誉称号 (可选)</span></span><Button type="button" size="sm" onClick={()=>{setHonors(h=>[...h,{ title:'', level:'国家级', year:new Date().getFullYear(), isCollective:false, proofFile:null }]); markDirty();}}><Plus className="w-4 h-4" /></Button></CardTitle></CardHeader><CardContent className="space-y-3">{honors.length===0 && <div className="text-xs text-gray-500">暂无记录，点击 + 添加</div>}{honors.map((h,i)=> <div key={i} className="p-3 border rounded space-y-3">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div><Label className="text-xs">荣誉名称</Label><Input value={h.title} onChange={e=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,title:e.target.value}:x)); markDirty();}} placeholder="如: 三好学生" /></div>
    <div><Label className="text-xs">等级</Label><Select value={h.level} onValueChange={v=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,level:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国家级">国家级</SelectItem><SelectItem value="省级">省级</SelectItem><SelectItem value="校级">校级</SelectItem></SelectContent></Select></div>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
    <div><Label className="text-xs">年份</Label><Input type="number" value={h.year} onChange={e=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,year:+e.target.value}:x)); markDirty();}} /></div>
    <div className="flex items-center gap-2"><Checkbox checked={h.isCollective} onCheckedChange={v=>{setHonors(s=>s.map((x,idx)=>idx===i?{...x,isCollective:!!v}:x)); markDirty();}} /><Label className="text-xs m-0">集体荣誉</Label></div>
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="destructive" onClick={()=>{setHonors(s=>s.filter((_,idx)=>idx!==i)); markDirty();}}>删除</Button>
    </div>
  </div>
  <div><Label className="text-xs">证明材料</Label><ProofFileUploader meta={h.proofFile as any} applicationId={applicationId} disabled={!isEditable} onChange={(m)=>{ setHonors(list=> list.map((x,idx)=> idx===i? { ...x, proofFile: m as any }: x)); markDirty(); }} /></div>
</div>)}</CardContent></Card>

          {/* 体育比赛 */}
          <Card><CardHeader><CardTitle className="flex items-center space-x-2"><Trophy className="w-5 h-5" /><span>体育比赛 (可选)</span></CardTitle></CardHeader><CardContent className="space-y-3">{sports.length===0 && <div className="text-xs text-gray-500">暂无记录，点击下方添加</div>}{sports.map((sp,i)=> <Card key={sp.id} className="p-4 space-y-3">
            <div className="flex justify-between items-center"><h4 className="text-sm">赛事 {i+1}</h4><Button type="button" size="sm" variant="destructive" onClick={()=>{setSports(list=>list.filter(x=>x.id!==sp.id)); markDirty();}}>删</Button></div>
            <Label className="text-xs">赛事名称</Label>
            <Input placeholder="示例: 全国大学生田径锦标赛" value={sp.name} onChange={e=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,name:e.target.value}:x)); markDirty();}} />
            <div className="grid md:grid-cols-5 grid-cols-2 gap-3 items-end text-xs">
              <div><Label>级别</Label><Select value={sp.scope} onValueChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,scope:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="国际级">国际级</SelectItem><SelectItem value="国家级">国家级</SelectItem></SelectContent></Select></div>
              <div><Label>成绩</Label><Select value={sp.result} onValueChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,result:v as any}:x)); markDirty();}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="冠军">冠军</SelectItem><SelectItem value="亚军">亚军</SelectItem><SelectItem value="季军">季军</SelectItem><SelectItem value="四至八名">四至八名</SelectItem></SelectContent></Select></div>
              <div className="flex items-center gap-2 mt-5"><Checkbox checked={sp.isTeam} onCheckedChange={v=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,isTeam:!!v}:x)); markDirty();}} />团队</div>
              {sp.isTeam && <div><Label>团队人数</Label><Input type="number" min={1} value={sp.teamSize} onChange={e=>{setSports(list=>list.map(x=>x.id===sp.id?{...x,teamSize:+e.target.value}:x)); markDirty();}} /></div>}
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

      <ConfirmDialog open={confirmClearOpen} onOpenChange={o=> setConfirmClearOpen(o)} title="清除本地草稿" description="此操作仅移除浏览器本地未提交草稿，确定继续？" confirmText="清除" destructive onConfirm={doClearLocal} />
      <ConfirmDialog open={confirmDeleteOpen} onOpenChange={o=> setConfirmDeleteOpen(o)} title="删除申请记录" description="删除后不可恢复，建议改用取消功能。仍要继续？" confirmText="删除" destructive onConfirm={doDeleteDraft} />
    </div>
  );
};

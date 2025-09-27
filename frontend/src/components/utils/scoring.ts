// Ordinance-based scoring utilities
// NOTE: This module centralizes all scoring logic so UI can stay thin.

export interface PublicationInput { category?:'A'|'B'|'C'; journal?:string; title?:string; authorRank:number; totalAuthors:number; isIndependent?:boolean; isTopJournal?:boolean; isHighLevelChinese?:boolean; isInfoComm?:boolean; isCoFirst?:boolean; }
export interface PatentInput { authorRank:number; totalAuthors?:number; }
export interface CompetitionInput { name:string; level:'A+类'|'A类'|'A-类'; award:string; isTeam:boolean; teamRank?:number; totalTeamMembers?:number; isPersonalProject?:boolean; isExternal?:boolean; workKey?:string; }
export interface InnovationProjectInput { level:'国家级'|'省级'|'校级'; role:'组长'|'成员'; status:'已结项'|'在研'; }
export interface VolunteerInfo { hours?:number; segments?:Array<{ hours:number; type:'normal'|'large_event'|'support'; }>; awards?: Array<{ level:'国家级'|'省级'|'校级'; role:'TEAM_LEADER'|'TEAM_MEMBER'|'PERSONAL'; }>; }
export interface HonorInput { level:'国家级'|'省级'|'校级'; year:number; isCollective?:boolean; }
export interface SocialWorkInput { year:number; level:'EXEC'|'PRESIDIUM'|'HEAD'|'DEPUTY'|'MEMBER'; rating:number; }
export interface InternshipInput { duration:'SEMESTER'|'YEAR'|'NONE'; } // international org
export interface MilitaryServiceInput { years:number; } // full years in service
export interface SportCompetitionInput { scope:'国际级'|'国家级'; result:'冠军'|'亚军'|'季军'|'四至八名'; isTeam:boolean; teamSize?:number; isPersonal?:boolean; }

export interface AcademicInputs {
  publications: PublicationInput[];
  patents: PatentInput[];
  competitions: CompetitionInput[];
  innovation: InnovationProjectInput[];
  specialTalentPassed?:boolean;
}
export interface PerformanceInputs {
  internship?: InternshipInput;
  military?: MilitaryServiceInput;
  volunteer: VolunteerInfo;
  honors: HonorInput[];
  socialWork: SocialWorkInput[];
  sports: SportCompetitionInput[];
}

export interface AcademicScoreResult { publications:number; patents:number; competitions:number; innovation:number; total:number; capped:number; }
export interface PerformanceScoreResult { internship:number; military:number; volunteer:number; honors:number; socialWork:number; sports:number; total:number; capped:number; }

// ----- Academic Achievement Scoring -----
export function scoreAcademic(inputs:AcademicInputs): AcademicScoreResult {
  // Publications
  let pubScore = 0; let cCount=0;
  inputs.publications.forEach(p=>{
    if(!p.title) return;
    let base=0;
    if(p.isTopJournal) base=20; else if(p.isHighLevelChinese) base=6; else if(p.isInfoComm) base=10; else {
      switch(p.category){case 'A':base=10;break;case 'B':base=6;break;case 'C': if(cCount<2){ base=1; cCount++; } break;}
    }
    if(!base) return;
    let ratio=0;
    if(p.isIndependent || p.totalAuthors<=1) ratio=1; else if(p.isCoFirst && (p.authorRank===1 || p.authorRank===2)) ratio=0.5; else if(p.authorRank===1) ratio=0.8; else if(p.authorRank===2) ratio=0.2; else ratio=0; // co-first 50/50 not distinguished here
    pubScore += base*ratio;
  });

  // Patents
  let patentScore=0; inputs.patents.forEach(pt=>{ if(pt.authorRank===1){ const independent = (pt.totalAuthors||1)<=1; patentScore += independent?2: (2*0.8); } });

  // Competitions
  const COMP_BASE: Record<string, Record<string, number>> = { 'A+类': {'国家级一等奖及以上':30,'国家级二等奖':15,'国家级三等奖':10,'省级一等奖及以上':5,'省级二等奖':2}, 'A类': {'国家级一等奖及以上':15,'国家级二等奖':10,'国家级三等奖':5,'省级一等奖及以上':2,'省级二等奖':1}, 'A-类': {'国家级一等奖及以上':10,'国家级二等奖':5,'国家级三等奖':2,'省级一等奖及以上':1,'省级二等奖':0.5} };
  const SPECIAL_TEAM = ['中国国际大学生创新大赛','挑战杯'];
  // Pre-group by workKey to enforce rule (5)
  const grouped: Record<string, CompetitionInput[]> = {};
  inputs.competitions.forEach(c=>{ const key = c.workKey||`__${Math.random()}`; (grouped[key]||(grouped[key]=[])).push(c); });
  const reduced: CompetitionInput[] = Object.values(grouped).map(list=>{
    if(list.length===1) return list[0];
    // pick highest potential score
    let best = list[0]; let bestScore = -1;
    list.forEach(c=>{ const map=COMP_BASE[c.level]; if(!map) return; const base=map[c.award]||0; if(base>bestScore){ bestScore=base; best=c; } });
    return best;
  });
  const compCandidates = reduced.map(c=>{
    const map = COMP_BASE[c.level]; if(!map) return { raw:0, comp:c }; const base = map[c.award]||0; if(!base) return { raw:0, comp:c };
    if(!c.isTeam || c.isPersonalProject) return { raw: base/3, comp:c };
    const special = SPECIAL_TEAM.some(n=> c.name.includes(n));
    const size = c.totalTeamMembers||0; const pos=c.teamRank||0;
    let val=0;
    if(special){ if(pos===1) val= base/3; else if(pos===2||pos===3) val= base/4; else if(pos===4||pos===5) val= base/5; }
    else if(size<=1) val= base/3; else if(size===2) val= base/3; else if(size>=3 && size<=5) val= base/size; else if(size>5){ if(pos>=1 && pos<=5) val= base/5; }
    return { raw: val, comp:c };
  });
  // sort by score desc
  compCandidates.sort((a,b)=> b.raw - a.raw);
  let externalUsed=false; let selected: number[] = [];
  for(const item of compCandidates){
    if(selected.length>=3) break;
    if(item.comp.isExternal){ if(externalUsed) continue; externalUsed=true; }
    selected.push(item.raw);
  }
  let compScore = selected.reduce((s,x)=>s+x,0);

  // Innovation
  let innovScore=0; inputs.innovation.forEach(p=>{ if(p.status!=='已结项') return; let add=0; switch(p.level){ case '国家级': add=p.role==='组长'?1:0.3; break; case '省级': add=p.role==='组长'?0.5:0.2; break; case '校级': add=p.role==='组长'?0.1:0.05; break;} innovScore+=add; }); if(innovScore>2) innovScore=2;

  let total = pubScore + patentScore + compScore + innovScore;
  if(inputs.specialTalentPassed) total = 15; // override full
  const capped = Math.min(total,15);
  return { publications:pubScore, patents:patentScore, competitions:compScore, innovation:innovScore, total, capped };
}

// ----- Comprehensive Performance Scoring -----
export function scorePerformance(inputs:PerformanceInputs): PerformanceScoreResult {
  // Internship
  let internship=0; if(inputs.internship){ if(inputs.internship.duration==='YEAR') internship=1; else if(inputs.internship.duration==='SEMESTER') internship=0.5; }
  // Military
  let military=0; if(inputs.military){ if(inputs.military.years>=2) military=2; else if(inputs.military.years>=1) military=1; }
  // Volunteer hours: if segments provided, compute effective hours
  let volunteerHours = inputs.volunteer?.hours || 0;
  if(inputs.volunteer?.segments?.length){
    volunteerHours = inputs.volunteer.segments.reduce((sum,s)=> sum + (s.type==='normal'? s.hours : s.hours/2), 0);
  }
  let volunteerHoursScore=0; if(volunteerHours>=200){ volunteerHoursScore = ((volunteerHours-200)/2)*0.05; if(volunteerHoursScore>1) volunteerHoursScore=1; }
  // Volunteer awards – role affects? Table gives values independent of role except TEAM_MEMBER reduced. We'll map.
  const VOL_AWARD_MAP: Record<string, Record<string, number>> = {
    TEAM_LEADER: { '国家级':1, '省级':0.5, '校级':0.25 },
    PERSONAL: { '国家级':1, '省级':0.5, '校级':0.25 },
    TEAM_MEMBER: { '国家级':0.5, '省级':0.25, '校级':0.1 }
  };
  let volunteerAwardScore = 0;
  (inputs.volunteer.awards||[]).forEach(a=>{ const m = VOL_AWARD_MAP[a.role]; if(!m) return; volunteerAwardScore = Math.max(volunteerAwardScore, m[a.level]); });
  if(volunteerAwardScore>1) volunteerAwardScore=1; // per subpoint cap
  const volunteer = Math.min(2, volunteerHoursScore + volunteerAwardScore);
  // Honors
  const honorsByYear: Record<string, number> = {};
  inputs.honors.forEach(h=>{ let val=0; switch(h.level){ case '国家级': val=2; break; case '省级': val=1; break; case '校级': val=0.2; break; } if(h.isCollective) val/=2; const key=String(h.year); if(!honorsByYear[key]||val>honorsByYear[key]) honorsByYear[key]=val; });
  let honors = Object.values(honorsByYear).reduce((s,x)=>s+x,0); if(honors>2) honors=2;
  // Social work
  const SW_COEF: Record<string, number> = { EXEC:2, PRESIDIUM:1.5, HEAD:1, DEPUTY:0.75, MEMBER:0.5 };
  const swYear: Record<string, number> = {};
  inputs.socialWork.forEach(sw=>{ const coef = SW_COEF[sw.level]||0; const val = coef * (sw.rating/100); const key=String(sw.year); if(!swYear[key]||val>swYear[key]) swYear[key]=val; });
  let socialWork = Object.values(swYear).reduce((s,x)=>s+x,0); if(socialWork>2) socialWork=2;
  // Sports
  let sports=0; inputs.sports.forEach(sp=>{ let base=0; if(sp.scope==='国际级'){ switch(sp.result){ case '冠军': base=8; break; case '亚军': base=6.5; break; case '季军': base=5; break; case '四至八名': base=3.5; break; } } else { switch(sp.result){ case '冠军': base=5; break; case '亚军': base=3.5; break; case '季军': base=2; break; case '四至八名': base=1; break; } } if(sp.isTeam){ const size=sp.teamSize||0; if(size>0) sports += base/size; } else sports += base/3; });
  let total = internship + military + volunteer + honors + socialWork + sports;
  const capped = Math.min(total,5);
  return { internship, military, volunteer, honors, socialWork, sports, total, capped };
}

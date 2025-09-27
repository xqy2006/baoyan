// 重建：根据后台成绩（academicScore 0-80，achievementScore 0-12，performanceScore 0-8）及 content.calculatedRaw(specRaw/perfRaw)
import type { Application } from '../../App';

interface AcademicItem { title:string; year?:string|number; level:string; personal:boolean; teamPos?:string; selfScore:number; basis:string; }
interface PerformanceItem { title:string; year?:string|number; level:string; personal:boolean; teamPos?:string; selfScore:number; basis:string; }

function buildAcademicItems(app:Application): AcademicItem[] {
  const items: AcademicItem[] = [];
  (app.academicAchievements?.publications||[]).forEach((p:any)=>{ if(!p.title) return; let base=0; switch(p.type){case 'A类':base=10;break;case 'B类':base=6;break;case 'C类':base=1;break;case '高水平中文':base=6;break;case '信息通信工程':base=10;break;} let ratio=0; if(p.totalAuthors<=1) ratio=1; else if(p.authorRank===1) ratio=0.8; else if(p.authorRank===2) ratio=0.2; else ratio=0; const score=+(base*ratio).toFixed(4); items.push({ title:p.title, year:p.publishYear, level:p.type, personal: ratio>=1, teamPos:p.authorRank?`第${p.authorRank}`:'', selfScore:score, basis:`${p.type}论文` }); });
  // 比赛加分逻辑拆分为多行，避免单行过长及解析混淆
  (app.academicAchievements?.competitions||[]).forEach((c:any)=>{
    if(!c.name) return;
    const scoreMap: Record<string, Record<string, number>> = {
      'A+类': {
        '国家级一等奖及以上': 30,
        '国家级二等奖': 15,
        '国家级三等奖': 10,
        '省级一等奖及以上': 5,
        '省级二等奖': 2
      },
      'A类': {
        '国家级一等奖及以上': 15,
        '国家级二等奖': 10,
        '国家级三等奖': 5,
        '省级一等奖及以上': 2,
        '省级二等奖': 1
      },
      'A-类': {
        '国家级一等奖及以上': 10,
        '国家级二等奖': 5,
        '国家级三等奖': 2,
        '省级一等奖及以上': 1,
        '省级二等奖': 0.5
      }
    };
    const base = scoreMap[c.level]?.[c.award] || 0;
    let sc = 0;
    if (base) {
      if (!c.isTeam) {
        sc = base / 3; // 个人直接折算
      } else {
        const size = c.totalTeamMembers || 0;
        if (size === 2) sc = base / 3; // 两人组同个人
        else if (size >= 3 && size <= 5) sc = base / size; // 3-5 人平分
        else if (size > 5 && (c.teamRank || 0) <= 5) sc = base / 5; // 大团队取前 5 名均分
        else if (size <= 1) sc = base / 3; // 容错兜底
      }
    }
    sc = +sc.toFixed(4);
    items.push({
      title: c.name,
      year: c.year,
      level: `${c.level} ${c.award}`,
      personal: !c.isTeam,
      teamPos: c.teamRank ? `第${c.teamRank}` : '',
      selfScore: sc,
      basis: `${c.level} ${c.award}`
    });
  });
  (app.academicAchievements?.patents||[]).forEach((pt:any)=>{ if(!pt.title) return; let sc=2; if(pt.authorRank===1 && pt.totalAuthors>1) sc=1.6; else if(pt.authorRank!==1 && pt.totalAuthors>1) sc=0; items.push({ title:pt.title, year:pt.grantYear, level:'专利授权', personal: pt.totalAuthors<=1, teamPos: pt.authorRank?`第${pt.authorRank}`:'', selfScore:+sc.toFixed(4), basis:'专利授权' }); });
  (app.academicAchievements?.innovationProjects||[]).forEach((ip:any)=>{ if(!ip.name || ip.status!=='已结项') return; let add=0; switch(ip.level){case '国家级': add= ip.role==='组长'?1:0.3; break; case '省级': add= ip.role==='组长'?0.5:0.2; break; case '校级': add= ip.role==='组长'?0.1:0.05; break;} items.push({ title:ip.name, year:ip.year, level:`${ip.level} ${ip.role}`, personal: ip.role==='组长', teamPos: ip.role, selfScore:+add.toFixed(4), basis:`${ip.level} ${ip.role}` }); });
  return items.sort((a,b)=> b.selfScore - a.selfScore || String(a.title).localeCompare(b.title));
}

function buildPerformanceItems(app:Application): PerformanceItem[] {
  const items: PerformanceItem[] = [];
  (app.comprehensivePerformance?.honors||[]).forEach((h:any)=>{ if(!h.title) return; let v=0; switch(h.level){case '国家级':v=2;break;case '省级':v=1;break;case '校级':v=0.2;break;} if(h.isCollective) v/=2; items.push({ title:h.title, year:h.year, level:h.level, personal:!h.isCollective, teamPos:h.isCollective?'集体':'', selfScore:+v.toFixed(4), basis:h.level }); });
  (app.comprehensivePerformance?.socialWork||[]).forEach((sw:any)=>{ if(!sw.position) return; const v=+(sw.score||0).toFixed(4); items.push({ title:sw.position, year:sw.year, level:'社会工作', personal:true, selfScore:v, basis:'社会工作' }); });
  const vs = app.comprehensivePerformance?.volunteerService; if(vs && vs.hours){ let hoursScore=0; if(vs.hours>=200){ hoursScore=Math.min(1, ((vs.hours-200)/2)*0.05); } items.push({ title:`志愿服务 ${vs.hours}h`, year:'', level:'志愿服务', personal:true, selfScore:+hoursScore.toFixed(4), basis:'≥200小时计算' }); }
  (app.comprehensivePerformance as any)?.sports?.forEach((sp:any)=>{ if(!sp.name) return; let base=0; if(sp.scope==='国际级'){ switch(sp.result){case '冠军':base=8;break;case '亚军':base=6.5;break;case '季军':base=5;break;case '四至八名':base=3.5;break;} } else { switch(sp.result){case '冠军':base=5;break;case '亚军':base=3.5;break;case '季军':base=2;break;case '四至八名':base=1;break;} } if(sp.isTeam){ const size=sp.teamSize||0; if(size>0) base/=size; } else base/=3; items.push({ title:sp.name, year:sp.year||'', level:`${sp.scope}${sp.result}`, personal:!sp.isTeam, teamPos: sp.isTeam? '团队':'', selfScore:+base.toFixed(4), basis:`${sp.scope}${sp.result}` }); });
  return items.sort((a,b)=> b.selfScore - a.selfScore || String(a.title).localeCompare(b.title));
}

function buildHeader(){
  const acadCols=['项目（请填写全称，勿用简称）','获奖时间（奖状或公示材料落款时间）','奖项级别','个人或集体奖项','集体奖项中第几作者/参赛者','自评加分','加分依据','学院核定加分','学院核定总分'];
  const perfCols=[...acadCols];
  const row1=['序号','系','所在专业','学号','姓名','性别','CET4成绩','CET6成绩','推免绩点(满分4分)','换算后的成绩(满分100分)','学业综合成绩（80%）','考核综合成绩（20%）','综合成绩','专业成绩排名','排名人数','学术专长成绩（12%）','','','','','','','','','综合表现加分（8%）','','','','','','','',''];
  const row2=new Array(row1.length).fill('');
  const row3=['序号','系','所在专业','学号','姓名','性别','CET4成绩','CET6成绩','推免绩点(满分4分)','换算后的成绩(满分100分)','学业综合成绩（80%）','考核综合成绩（20%）','综合成绩','专业成绩排名','排名人数',...acadCols,...perfCols];
  const merges:any[]=[]; for(let c=0;c<15;c++) merges.push({s:{r:0,c},e:{r:2,c}}); merges.push({s:{r:0,c:15},e:{r:0,c:23}}); merges.push({s:{r:0,c:24},e:{r:0,c:32}});
  return {data:[row1,row2,row3],merges};
}

export async function exportApplicationsExcel(applications:Application[]){
  const approved=(applications||[]).filter(a=>a.status==='approved'); if(!approved.length){ alert('暂无已审核通过的申请'); return; }
  const XLSX= await import('xlsx');
  const {data,merges}=buildHeader();
  approved.forEach((app,idx)=>{
    const b=app.basicInfo||{}; const lang=app.languageScores||{}; const gpa=parseFloat(b.gpa)||0; const gpa100=(gpa/4)*100; const rank=b.academicRanking||''; const total=b.totalStudents||'';
    const rawAcad=app.calculatedScores?.academicScore||0; // 0-80
    const specRaw=app.calculatedRaw?.specRaw??0; const perfRaw=app.calculatedRaw?.perfRaw??0; // 原始分
    const specWeighted=specRaw/15*12; const perfWeighted=perfRaw/5*8; const assessTotal=+(specWeighted+perfWeighted).toFixed(4); const composite=+(rawAcad+assessTotal).toFixed(5);
    const academicItems=buildAcademicItems(app); const performanceItems=buildPerformanceItems(app); const rc=Math.max(academicItems.length||1, performanceItems.length||1);
    let acadCum=0, perfCum=0;
    for(let i=0;i<rc;i++){ const row:any[]=new Array(33).fill(''); if(i===0){row[0]=idx+1;row[1]=b.department||'';row[2]=b.major||'';row[3]=b.studentId||app.studentId||'';row[4]=b.name||app.studentName||'';row[5]=b.gender||'';row[6]=lang.cet4Score||'';row[7]=lang.cet6Score||'';row[8]=gpa?gpa.toFixed(6):'';row[9]=gpa?gpa100.toFixed(2):'';row[10]=rawAcad.toFixed(6);row[11]=assessTotal.toFixed(4);row[12]=composite;row[13]=rank;row[14]=total; }
      if(i<academicItems.length){ const a=academicItems[i]; acadCum+=a.selfScore; row[15]=a.title;row[16]=a.year||'';row[17]=a.level;row[18]=a.personal?'个人':'集体';row[19]=a.teamPos||'';row[20]=a.selfScore;row[21]=a.basis;row[22]=a.selfScore;row[23]=acadCum.toFixed(4); }
      if(i<performanceItems.length){ const p=performanceItems[i]; perfCum+=p.selfScore; row[24]=p.title;row[25]=p.year||'';row[26]=p.level;row[27]=p.personal?'个人':'集体';row[28]=p.teamPos||'';row[29]=p.selfScore;row[30]=p.basis;row[31]=p.selfScore;row[32]=perfCum.toFixed(4); }
      data.push(row); }
    data.push(['','','','','','','','','','','(原始专长)',specRaw.toFixed(4),'(原始综合)',perfRaw.toFixed(4),'(加权合计)',assessTotal.toFixed(4),'','','条例：学术专长满分15折算12%，综合表现满分5折算8% → 总分=学业(80)+12+8','','','','','','','','','','','','','','']);
  });
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!merges']=merges; ws['!cols']=data[2].map(()=>({wch:18}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'推免汇总'); XLSX.writeFile(wb,'推免通过学生汇总.xlsx');
}

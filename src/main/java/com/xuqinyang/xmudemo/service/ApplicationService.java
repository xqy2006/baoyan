package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ApplicationService {

    @Autowired
    private ApplicationRepository applicationRepository;
    @Autowired
    private ActivityRepository activityRepository;
    @Autowired
    private UserRepository userRepository;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public List<Application> getAllApplications() { return applicationRepository.findAll(); }
    public Optional<Application> getApplicationById(Long id) { return applicationRepository.findById(id); }
    public List<Application> getApplicationsByUserId(Long userId) { return applicationRepository.findByUser_Id(userId); }
    public Application createApplication(Application application) { return applicationRepository.save(application); }
    public Application updateApplication(Application application) { return applicationRepository.save(application); }
    public void deleteApplication(Long id) { applicationRepository.deleteById(id); }

    public Application createDraft(Long activityId, String content) {
        User user = currentUserEntity();
        Optional<Application> existing = applicationRepository.findByUser_IdAndActivity_Id(user.getId(), activityId);
        if (existing.isPresent()) return existing.get();
        Activity activity = activityRepository.findById(activityId)
                .orElseThrow(() -> new IllegalArgumentException("活动不存在"));
        Application app = new Application();
        app.setUser(user);
        app.setActivity(activity);
        app.setContent(content);
        app.setStatus(ApplicationStatus.DRAFT);
        return applicationRepository.save(app);
    }

    public Optional<Application> findMineByActivity(Long activityId){
        User user = currentUserEntity();
        return applicationRepository.findByUser_IdAndActivity_Id(user.getId(), activityId);
    }

    public void deleteOwnedOrAdmin(Long id){
        Application app = applicationRepository.findById(id).orElseThrow();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = auth.getAuthorities().contains(new SimpleGrantedAuthority("ADMIN"));
        if (!admin) {
            User me = currentUserEntity();
            if (!app.getUser().getId().equals(me.getId())) {
                throw new IllegalStateException("无权删除此申请");
            }
            // 学生可以删除 草稿 或 已提交待系统审核 的申请
            if (app.getStatus() != ApplicationStatus.DRAFT && app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                throw new IllegalStateException("该状态不允许删除");
            }
        }
        applicationRepository.delete(app);
    }

    public List<Application> listMine() {
        User user = currentUserEntity();
        return applicationRepository.findByUser_Id(user.getId());
    }

    public Application updateDraft(Long id, String content) {
        Application app = owned(id);
        if (app.getStatus() != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("只能在草稿状态修改");
        }
        String merged = mergeContent(app.getContent(), content);
        app.setContent(merged);
        recalcScores(app);
        app.setLastUpdateDate(java.time.LocalDateTime.now());
        return applicationRepository.save(app);
    }

    public Application submit(Long id) {
        Application app = owned(id);
        if (app.getStatus() != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("当前状态不能提交");
        }
        JsonNode root = parseContent(app.getContent());
        if(root.path("basicInfo").isMissingNode() || !root.path("basicInfo").has("name")){
            var o = root.isObject()? (com.fasterxml.jackson.databind.node.ObjectNode) root : MAPPER.createObjectNode();
            var basic = MAPPER.createObjectNode();
            User u = app.getUser();
            basic.put("name", Optional.ofNullable(u.getName()).orElse(""));
            basic.put("studentId", u.getStudentId());
            basic.put("department", Optional.ofNullable(u.getDepartment()).orElse(""));
            basic.put("major", Optional.ofNullable(u.getMajor()).orElse(""));
            o.set("basicInfo", basic);
            try { app.setContent(MAPPER.writeValueAsString(o)); } catch(Exception ignored){}
        }
        recalcScores(app);
        app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
        app.setSubmittedAt(LocalDateTime.now());
        return applicationRepository.save(app);
    }

    public Application systemReview(Long id) {
        Application app = applicationRepository.findById(id).orElseThrow();
        if (app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
            throw new IllegalStateException("非系统审核中");
        }
        recalcScores(app); // compute scores from content (academic based on GPA/rank)
        // 简单规则: academicScore(0-80) >= 48 (即 60%*80) 通过
        double academic = app.getAcademicScore()==null?0: app.getAcademicScore();
        if (academic >= 48) {
            app.setStatus(ApplicationStatus.SYSTEM_APPROVED);
            app.setSystemReviewComment("系统初审通过，学业得分=" + academic);
        } else {
            app.setStatus(ApplicationStatus.SYSTEM_REJECTED);
            app.setSystemReviewComment("系统初审不通过，学业得分=" + academic);
        }
        app.setSystemReviewedAt(LocalDateTime.now());
        return applicationRepository.save(app);
    }

    public Application startAdminReview(Long id) {
        Application app = applicationRepository.findById(id).orElseThrow();
        if (app.getStatus() != ApplicationStatus.SYSTEM_APPROVED) {
            throw new IllegalStateException("必须是系统通过状态");
        }
        app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
        return applicationRepository.save(app);
    }

    public Application adminReview(Long id, boolean approve, String comment) {
        Application app = applicationRepository.findById(id).orElseThrow();
        if (app.getStatus() != ApplicationStatus.ADMIN_REVIEWING) {
            throw new IllegalStateException("非人工审核中");
        }
        recalcScores(app); // ensure latest scores
        app.setStatus(approve ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED);
        app.setAdminReviewComment(comment);
        app.setAdminReviewedAt(LocalDateTime.now());
        return applicationRepository.save(app);
    }

    public List<Application> reviewQueue() {
        // 审核队列：系统审核中 + 待人工开始(SYSTEM_APPROVED) + 人工审核中
        return applicationRepository.findByStatusIn(List.of(
                ApplicationStatus.SYSTEM_REVIEWING,
                ApplicationStatus.SYSTEM_APPROVED,
                ApplicationStatus.ADMIN_REVIEWING
        ));
    }

    public Application specialTalentPass(Long id){
        Application app = applicationRepository.findById(id).orElseThrow();
        // Update content JSON: set specialAcademicTalent.defensePassed = true
        try {
            JsonNode root = app.getContent()==null? MAPPER.createObjectNode(): MAPPER.readTree(app.getContent());
            var obj = (root.isObject()? root : MAPPER.createObjectNode());
            JsonNode talent = obj.get("specialAcademicTalent");
            if (talent==null || !talent.isObject()) {
                var talentObj = MAPPER.createObjectNode();
                talentObj.put("isApplying", true);
                talentObj.put("defensePassed", true);
                ((com.fasterxml.jackson.databind.node.ObjectNode)obj).set("specialAcademicTalent", talentObj);
            } else {
                ((com.fasterxml.jackson.databind.node.ObjectNode)talent).put("defensePassed", true);
            }
            app.setContent(MAPPER.writeValueAsString(obj));
        } catch(Exception ignored) {}
        recalcScores(app); // override to full 15 when defensePassed
        return applicationRepository.save(app);
    }

    public Application recalc(Long id){
        Application app = applicationRepository.findById(id).orElseThrow();
        recalcScores(app);
        return applicationRepository.save(app);
    }

    // === PDF 导出 ===
    public byte[] exportPdf(Long id){
        Application app = applicationRepository.findById(id).orElseThrow();
        recalcScores(app);
        applicationRepository.save(app);
        try(PDDocument doc = new PDDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()){
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDType0Font font0 = null; boolean fontLoaded=false;
            try(InputStream is = getClass().getResourceAsStream("/fonts/NotoSansSC-Regular.ttf")){
                if(is!=null){ font0 = PDType0Font.load(doc, is, true); fontLoaded=true; }
            } catch(Exception ignore){}
            if(!fontLoaded){
                try(InputStream is = ApplicationService.class.getResourceAsStream("/fonts/DejaVuSans.ttf")){
                    if(is!=null){ font0 = PDType0Font.load(doc, is, true); fontLoaded=true; }
                } catch(Exception ignore){}
            }
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            float margin = 40; float y = page.getMediaBox().getHeight() - 50; float lh = 16; float width = page.getMediaBox().getWidth() - margin*2;
            if(fontLoaded){ cs.setFont(font0, 14); y = writeWrap(cs, font0, 14, "推免申请导出 - "+ (app.getActivityName()==null?"活动":app.getActivityName()), margin, y, lh, width); cs.setFont(font0, 12);} else { cs.setFont(PDType1Font.HELVETICA_BOLD,14); y = writeWrap(cs, null,14,"推免申请导出 - "+(app.getActivityName()==null?"活动":app.getActivityName()), margin,y,lh,width); cs.setFont(PDType1Font.HELVETICA,12);}
            JsonNode root = parseContent(app.getContent()); JsonNode basic = root.path("basicInfo");
            line(cs,font0,12,String.format("姓名: %s 学号: %s", basic.path("name").asText("-"), basic.path("studentId").asText("-")), margin,y); y-=lh;
            line(cs,font0,12,String.format("系别: %s 专业: %s", basic.path("department").asText("-"), basic.path("major").asText("-")), margin,y); y-=lh;
            line(cs,font0,12,String.format("GPA: %s 排名: %s/%s", basic.path("gpa").asText(""), basic.path("academicRanking").asText(""), basic.path("totalStudents").asText("")), margin,y); y-=lh*1.5;
            y = section(cs,font0,"个人陈述", root.path("personalStatement").asText("(未填写)"), margin,y,lh,width);
            y = listSection(cs,font0,"论文发表", root.path("academicAchievements").path("publications"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / 作者 %d/%d%s", i+1,opt(p,"title"),opt(p,"type"),p.path("authorRank").asInt(0),p.path("totalAuthors").asInt(0),p.path("isCoFirst").asBoolean(false)?" (共同一作)":""));
            y = listSection(cs,font0,"学科竞赛", root.path("academicAchievements").path("competitions"), margin,y,lh,width,(c,i)-> String.format("%d. %s / %s / %s%s", i+1,opt(c,"name"),opt(c,"level"),opt(c,"award"), c.path("isTeam").asBoolean(false)? String.format(" 团队(%d/%d)",c.path("teamRank").asInt(0),c.path("totalTeamMembers").asInt(0)):""));
            y = listSection(cs,font0,"专利/软著", root.path("academicAchievements").path("patents"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / 排名%d", i+1,opt(p,"title"),opt(p,"patentNumber"),p.path("authorRank").asInt(0)));
            y = listSection(cs,font0,"科创项目", root.path("academicAchievements").path("innovationProjects"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s / %s", i+1,opt(p,"name"),opt(p,"level"),opt(p,"role"),opt(p,"status")));
            y = listSection(cs,font0,"荣誉称号", root.path("comprehensivePerformance").path("honors"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s%s", i+1,opt(p,"title"),opt(p,"level"),opt(p,"year"), p.path("isCollective").asBoolean(false)?" 集体":""));
            y = listSection(cs,font0,"社会工作", root.path("comprehensivePerformance").path("socialWork"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s / 评分%s", i+1,opt(p,"position"),opt(p,"level"),opt(p,"year"),opt(p,"rating")));
            JsonNode vs = root.path("comprehensivePerformance").path("volunteerService");
            y = section(cs,font0,"志愿服务", String.format("总时长: %s 小时; 分段: %d", vs.path("hours").asText(""), vs.path("segments").isArray()? vs.path("segments").size():0), margin,y,lh,width);
            y = listSection(cs,font0,"体育比赛", root.path("comprehensivePerformance").path("sports"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s%s", i+1,opt(p,"name"),opt(p,"scope"),opt(p,"result"), p.path("isTeam").asBoolean(false)?" 团队":""));
            JsonNode talent = root.path("specialAcademicTalent"); if(talent.path("isApplying").asBoolean(false)){ y = section(cs,font0,"特殊学术专长申请", "简介:"+talent.path("description").asText("(未填)")+"\n成果:"+talent.path("achievements").asText("(未填)"), margin,y,lh,width); }
            if(y<60){ cs.close(); page = new PDPage(PDRectangle.A4); doc.addPage(page); cs = new PDPageContentStream(doc,page); y= page.getMediaBox().getHeight()-50; }
            y-=lh;
            line(cs,font0,10,String.format("学业: %.2f 专长(加权): %.2f 综合(加权): %.2f 总分: %.2f", nz(app.getAcademicScore()), nz(app.getAchievementScore()), nz(app.getPerformanceScore()), nz(app.getTotalScore())), margin,y);
            cs.close(); doc.save(bos); return bos.toByteArray();
        } catch(Exception e){ throw new RuntimeException("生成PDF失败: "+e.getMessage(), e);} }

    private double nz(Double d){ return d==null?0d:d; }

    private void line(PDPageContentStream cs, PDType0Font font, int size, String text, float x, float y) throws Exception {
        if(font!=null){ cs.setFont(font,size); } else { cs.setFont(PDType1Font.HELVETICA,size); }
        cs.beginText(); cs.newLineAtOffset(x,y); cs.showText(text==null?"":text); cs.endText(); }

    private float writeWrap(PDPageContentStream cs, PDType0Font font, int size, String text, float x, float y, float lh, float width) throws Exception {
        if(font!=null) cs.setFont(font,size); else cs.setFont(PDType1Font.HELVETICA,size);
        String[] lines = text.replace("\r","\n").split("\n");
        for(String line: lines){
            List<String> wrapped = (font!=null)? wrapLine(line,font,size,width) : naiveWrap(line,size,width);
            for(String w: wrapped){
                if(y<60){ y += 700; }
                cs.beginText(); cs.newLineAtOffset(x,y); cs.showText(w); cs.endText(); y -= lh;
            }
        }
        return y;
    }

    private List<String> naiveWrap(String line, int size, float width){
        List<String> out = new ArrayList<>(); if(line.isEmpty()){ out.add(""); return out; }
        double charW = size * 0.6; int maxChars = (int)Math.max(1, Math.floor(width/charW));
        for(int i=0;i<line.length();i+=maxChars){ out.add(line.substring(i, Math.min(line.length(), i+maxChars))); }
        return out;
    }

    private void recalcScores(Application app){
        double academicBase = computeAcademicBaseFromApp(app); // updated fallback
        double specRaw = 0; double perfRaw = 0; boolean defensePassed = false;
        try {
            JsonNode root = app.getContent()==null? MAPPER.createObjectNode(): MAPPER.readTree(app.getContent());
            JsonNode talent = root.path("specialAcademicTalent");
            defensePassed = talent.path("defensePassed").asBoolean(false);
            JsonNode acad = root.path("academicAchievements");
            int cCount=0; double publicationScore=0.0;
            for(JsonNode p: acad.path("publications")){
                if(!p.hasNonNull("title")) continue;
                String type=p.path("type").asText("");
                String journal = p.path("journal").asText("");
                String full = (journal+" "+p.path("title").asText("")).toLowerCase();
                boolean top = full.contains("nature") || full.contains("science") || full.contains("cell ") || full.equals("cell") || journal.equalsIgnoreCase("Cell");
                double base=0;
                if(top) base=20; else switch(type){ case "A类": base=10; break; case "B类": base=6; break; case "C类": if(cCount<2){ base=1; cCount++; } break; case "高水平中文": base=6; break; case "信息通信工程": base=10; break; default: base=0; }
                if(base==0) continue;
                int totalAuthors = p.path("totalAuthors").asInt(1);
                int authorRank = p.path("authorRank").asInt(1);
                boolean coFirst = p.path("isCoFirst").asBoolean(false);
                double ratio;
                if(totalAuthors<=1) ratio=1; else if(coFirst && (authorRank==1||authorRank==2)) ratio=0.5; else if(authorRank==1) ratio=0.8; else if(authorRank==2) ratio=0.2; else ratio=0;
                publicationScore += base*ratio;
            }
            double patentScore=0.0;
            for(JsonNode pt: acad.path("patents")){
                if(!pt.hasNonNull("title")) continue; int rank= pt.path("authorRank").asInt(1); int total=pt.path("totalAuthors").asInt(1); if(rank==1){ patentScore += (total<=1)?2:1.6; }
            }
            double competitionScore = computeCompetitionScore(acad.path("competitions"));
            double innovationScore=0.0; for(JsonNode ip: acad.path("innovationProjects")){ if(!"已结项".equals(ip.path("status").asText())) continue; String level=ip.path("level").asText(""); String role=ip.path("role").asText(""); double add=0; switch(level){case "国家级": add="组长".equals(role)?1:0.3; break; case "省级": add="组长".equals(role)?0.5:0.2; break; case "校级": add="组长".equals(role)?0.1:0.05; break; default: add=0;} innovationScore+=add; }
            if(innovationScore>2) innovationScore=2;
            specRaw = defensePassed? 15 : Math.min(15, publicationScore + patentScore + competitionScore + innovationScore);
            JsonNode comp = root.path("comprehensivePerformance");
            double volunteerHours = comp.path("volunteerService").path("hours").asDouble(0);
            JsonNode segments = comp.path("volunteerService").path("segments");
            if(segments.isArray() && segments.size()>0){ double effective=0; for(JsonNode seg: segments){ double h= seg.path("hours").asDouble(0); String t= seg.path("type").asText("normal"); effective += ("normal".equals(t)? h: h/2.0); } volunteerHours = effective; }
            double hoursScore=0; if(volunteerHours>=200){ hoursScore = Math.min(1, ((volunteerHours-200)/2.0)*0.05); }
            double awardScore=0; for(JsonNode aw: comp.path("volunteerService").path("awards")){ String lvl=aw.path("level").asText(""); String role=aw.path("role").asText("PERSONAL"); double val=0; if("国家级".equals(lvl)) val=1; else if("省级".equals(lvl)) val=0.5; else if("校级".equals(lvl)) val=0.25; if("TEAM_MEMBER".equals(role)) val = val/2; awardScore = Math.max(awardScore, val); } if(awardScore>1) awardScore=1; double volunteerScore = Math.min(2, hoursScore+awardScore);
            HashMap<Integer, Double> honorYear = new HashMap<>(); for(JsonNode h: comp.path("honors")){ String lvl=h.path("level").asText(""); int y=h.path("year").asInt(0); double v=0; if("国家级".equals(lvl)) v=2; else if("省级".equals(lvl)) v=1; else if("校级".equals(lvl)) v=0.2; if(h.path("isCollective").asBoolean(false)) v/=2; honorYear.merge(y, v, Math::max); } double honorScore = honorYear.values().stream().mapToDouble(Double::doubleValue).sum(); if(honorScore>2) honorScore=2;
            HashMap<Integer, Double> swYear = new HashMap<>(); for(JsonNode sw: comp.path("socialWork")){ String lvl= sw.path("level").asText("MEMBER"); double coef= switch(lvl){ case "EXEC"->2; case "PRESIDIUM"->1.5; case "HEAD"->1; case "DEPUTY"->0.75; default->0.5; }; double rating= sw.path("rating").asDouble(0); double val = coef * (rating/100.0); int y= sw.path("year").asInt(0); swYear.merge(y, val, Math::max); } double socialScore = swYear.values().stream().mapToDouble(Double::doubleValue).sum(); if(socialScore>2) socialScore=2;
            double sportsScore=0; for(JsonNode sp: comp.path("sports")){ String scope=sp.path("scope").asText(""); String result=sp.path("result").asText(""); double base=0; if("国际级".equals(scope)){ base = switch(result){ case "冠军"->8; case "亚军"->6.5; case "季军"->5; case "四至八名"->3.5; default->0; }; } else if("国家级".equals(scope)){ base = switch(result){ case "冠军"->5; case "亚军"->3.5; case "季军"->2; case "四至八名"->1; default->0; }; } boolean team= sp.path("isTeam").asBoolean(false); if(team){ int size= sp.path("teamSize").asInt(0); if(size>0) base/=size; } else base/=3.0; sportsScore += base; }
            double perfTotal = volunteerScore + honorScore + socialScore + sportsScore; if(perfTotal>5) perfTotal=5; perfRaw = perfTotal;
            try { com.fasterxml.jackson.databind.node.ObjectNode obj = root.isObject()? (com.fasterxml.jackson.databind.node.ObjectNode)root : MAPPER.createObjectNode(); com.fasterxml.jackson.databind.node.ObjectNode raw = obj.with("calculatedRaw"); raw.put("specRaw", specRaw); raw.put("perfRaw", perfRaw); app.setContent(MAPPER.writeValueAsString(obj)); } catch (Exception ignoreInner) {}
        } catch (Exception ignored){ }
        double specWeighted = (specRaw/15.0)*12.0; double perfWeighted = (perfRaw/5.0)*8.0; app.setAcademicScore(academicBase); app.setAchievementScore(specWeighted); app.setPerformanceScore(perfWeighted); app.setTotalScore(academicBase + specWeighted + perfWeighted);
    }

    private double computeAcademicBaseFromApp(Application app){
        // Prefer user entity values; fallback to content.basicInfo
        User u = app.getUser();
        Double gpa = u.getGpa(); Integer rank = u.getAcademicRank(); Integer total = u.getMajorTotal();
        if(gpa==null || rank==null || total==null){
            try { JsonNode root = parseContent(app.getContent()); JsonNode b = root.path("basicInfo"); if(gpa==null && b.hasNonNull("gpa")) gpa = b.path("gpa").asDouble(); if(rank==null && b.hasNonNull("academicRanking")) rank = b.path("academicRanking").asInt(); if(total==null && b.hasNonNull("totalStudents")) total = b.path("totalStudents").asInt(); } catch(Exception ignored){}
        }
        double rankScore = 0; if(rank!=null && total!=null && total>0){ rankScore = ((double)(total - rank +1)/ total)*80.0; }
        double gpaScore = 0; if(gpa!=null){ double factor = Math.min(gpa/4.0,1.0); gpaScore = factor*80.0; }
        double base = (rankScore>0 && gpaScore>0)? (rankScore+gpaScore)/2.0 : (rankScore>0? rankScore: gpaScore);
        if(base>80) base=80; if(base<0) base=0; return base;
    }

    private double computeCompetitionScore(JsonNode competitions){
        if(competitions==null || !competitions.isArray()) return 0d;
        // Build base map
        java.util.Map<String, java.util.Map<String, Double>> baseMap = new java.util.HashMap<>();
        baseMap.put("A+类", java.util.Map.of("国家级一等奖及以上",30d,"国家级二等奖",15d,"国家级三等奖",10d,"省级一等奖及以上",5d,"省级二等奖",2d));
        baseMap.put("A类", java.util.Map.of("国家级一等奖及以上",15d,"国家级二等奖",10d,"国家级三等奖",5d,"省级一等奖及以上",2d,"省级二等奖",1d));
        baseMap.put("A-类", java.util.Map.of("国家级一等奖及以上",10d,"国家级二等奖",5d,"国家级三等奖",2d,"省级一等奖及以上",1d,"省级二等奖",0.5d));
        java.util.Set<String> specialNames = java.util.Set.of("中国国际大学生创新大赛","挑战杯");
        // Group by workKey if present (rule: same work only highest)
        java.util.Map<String, java.util.List<JsonNode>> grouped = new java.util.HashMap<>();
        for(JsonNode c: competitions){
            String key = c.path("workKey").asText("").trim();
            if(key.isEmpty()) key = "__"+System.identityHashCode(c);
            grouped.computeIfAbsent(key,k-> new java.util.ArrayList<>()).add(c);
        }
        java.util.List<JsonNode> reduced = new java.util.ArrayList<>();
        grouped.values().forEach(list->{
            if(list.size()==1){ reduced.add(list.get(0)); return; }
            JsonNode best = null; double bestBase=-1;
            for(JsonNode c: list){
                String level = c.path("level").asText("");
                String award = c.path("award").asText("");
                double b = baseMap.getOrDefault(level, java.util.Map.of()).getOrDefault(award,0d);
                if(b>bestBase){ bestBase=b; best=c; }
            }
            if(best!=null) reduced.add(best);
        });
        // Calculate raw distributed scores
        class CompScore { double raw; boolean external; JsonNode node; }
        java.util.List<CompScore> candidates = new java.util.ArrayList<>();
        for(JsonNode c: reduced){
            String level = c.path("level").asText("");
            String award = c.path("award").asText("");
            double base = baseMap.getOrDefault(level, java.util.Map.of()).getOrDefault(award,0d);
            if(base<=0) continue;
            boolean isTeam = c.path("isTeam").asBoolean(false);
            boolean isExternal = c.path("isExternal").asBoolean(false);
            double val=0d;
            if(!isTeam){
                val = base/3d; // personal project
            } else {
                boolean special = specialNames.stream().anyMatch(n-> c.path("name").asText("").contains(n));
                int size = c.path("totalTeamMembers").asInt(0);
                int pos = c.path("teamRank").asInt(0);
                if(special){
                    if(pos==1) val = base/3d; else if(pos==2 || pos==3) val = base/4d; else if(pos==4 || pos==5) val = base/5d; else val=0d;
                } else {
                    if(size<=1) val=base/3d; else if(size==2) val=base/3d; else if(size>=3 && size<=5) val= base/size; else if(size>5){ if(pos>=1 && pos<=5) val= base/5d; }
                }
            }
            CompScore cs = new CompScore(); cs.raw=val; cs.external=isExternal; cs.node=c; candidates.add(cs);
        }
        candidates.sort((a,b)-> Double.compare(b.raw,a.raw));
        double sum=0d; boolean externalUsed=false; int picked=0;
        for(CompScore cs: candidates){
            if(picked>=3) break;
            if(cs.external){ if(externalUsed) continue; externalUsed=true; }
            sum+=cs.raw; picked++;
        }
        return sum; // already capped by pick count
    }

    private User currentUserEntity() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String sid = auth.getName();
        return userRepository.findByStudentId(sid).orElseThrow();
    }

    private Application owned(Long id) {
        Application app = applicationRepository.findById(id).orElseThrow();
        User me = currentUserEntity();
        if (!app.getUser().getId().equals(me.getId())) {
            throw new IllegalStateException("无权访问此申请");
        }
        return app;
    }

    // 添加缺失的辅助方法与合并逻辑
    private JsonNode parseContent(String content){
        try { return (content==null || content.isBlank())? MAPPER.createObjectNode(): MAPPER.readTree(content); }
        catch(Exception e){ return MAPPER.createObjectNode(); }
    }
    @FunctionalInterface private interface ListFormatter { String format(JsonNode node, int index); }
    private float section(PDPageContentStream cs, PDType0Font font, String title, String body, float x, float y, float lh, float width) throws Exception {
        y = writeWrap(cs, font, 12, "【"+title+"】", x, y, lh, width);
        return writeWrap(cs, font, 12, body==null?"":body, x, y, lh, width);
    }
    private float listSection(PDPageContentStream cs, PDType0Font font, String title, JsonNode arr, float x, float y, float lh, float width, ListFormatter f) throws Exception {
        if(arr==null || !arr.isArray() || arr.size()==0) return y; y = writeWrap(cs,font,12,"【"+title+"】",x,y,lh,width);
        for(int i=0;i<arr.size();i++){ y = writeWrap(cs,font,12,f.format(arr.get(i), i), x,y,lh,width); }
        return y; }
    private List<String> wrapLine(String line, PDType0Font font, int size, float width) throws Exception {
        List<String> out = new ArrayList<>(); if(line==null){ out.add(""); return out;} if(line.isEmpty()){ out.add(""); return out; }
        StringBuilder cur = new StringBuilder();
        for(int i=0;i<line.length();i++){
            cur.append(line.charAt(i));
            if(font.getStringWidth(cur.toString())/1000*size > width){
                cur.setLength(cur.length()-1);
                if(cur.length()>0) out.add(cur.toString());
                cur = new StringBuilder().append(line.charAt(i));
            }
        }
        if(cur.length()>0) out.add(cur.toString());
        return out; }

    // 合并前后端 content，防止前端未传某块时被清空
    private String mergeContent(String oldContent, String newContent){
        JsonNode oldRoot = parseContent(oldContent);
        JsonNode newRoot = parseContent(newContent);
        var merged = MAPPER.createObjectNode();
        // 需要的顶层键
        String[] keys = {"basicInfo","languageScores","academicAchievements","comprehensivePerformance","specialAcademicTalent","personalStatement","uploadedFiles","calculatedRaw","calculatedScores"};
        for(String k: keys){
            JsonNode candidate = newRoot.path(k);
            if(!candidate.isMissingNode() && !(candidate.isObject() && candidate.size()==0)){
                merged.set(k, candidate);
            } else if(oldRoot.has(k)){
                merged.set(k, oldRoot.get(k));
            }
        }
        // 保留其余未知字段
        oldRoot.fieldNames().forEachRemaining(fn->{ if(!merged.has(fn)) merged.set(fn, oldRoot.get(fn)); });
        newRoot.fieldNames().forEachRemaining(fn->{ if(!merged.has(fn)) merged.set(fn, newRoot.get(fn)); });
        try { return MAPPER.writeValueAsString(merged); } catch(Exception e){ return newContent!=null? newContent: oldContent; }
    }

    private static String opt(JsonNode node, String field){
        if(node==null) return "";
        JsonNode v = node.get(field);
        if(v==null || v.isNull()) return "";
        return v.asText("");
    }

    public Application submitDirect(Long activityId, String contentJson){
        User user = currentUserEntity();
        Optional<Application> opt = applicationRepository.findByUser_IdAndActivity_Id(user.getId(), activityId);
        Application app;
        if(opt.isEmpty()){
            Activity activity = activityRepository.findById(activityId).orElseThrow(()-> new IllegalArgumentException("活动不存在"));
            app = new Application();
            app.setUser(user); app.setActivity(activity); app.setStatus(ApplicationStatus.DRAFT); app.setContent("{}");
        } else {
            app = opt.get();
        }
        if(app.getStatus()!= ApplicationStatus.DRAFT){
            throw new IllegalStateException("该申请已提交，不能再次提交 (status="+app.getStatus()+")");
        }
        // 合并内容
        String merged = mergeContent(app.getContent(), contentJson==null?"{}":contentJson);
        app.setContent(merged);
        recalcScores(app);
        app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
        app.setSubmittedAt(LocalDateTime.now());
        return applicationRepository.save(app);
    }
}

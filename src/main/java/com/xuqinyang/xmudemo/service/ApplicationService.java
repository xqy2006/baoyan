package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.dto.ApplicationCacheDTO;
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
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    @Autowired
    private FileService fileService;
    @Autowired
    private DistributedLockService distributedLockService;
    @Autowired
    private CacheService cacheService;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * 获取所有申请 - 带缓存和降级机制
     */
    public List<Application> getAllApplications() {
        // 尝试从缓存获取
        try {
            Object cached = cacheService.getActivitiesListFromCache("applications_all");
            if (cached instanceof List<?>) {
                @SuppressWarnings("unchecked")
                List<ApplicationCacheDTO> dtoList = (List<ApplicationCacheDTO>) cached;
                return dtoList.stream()
                    .map(ApplicationCacheDTO::toEntity)
                    .collect(java.util.stream.Collectors.toList());
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to get applications from cache, falling back to database: " + e.getMessage());
        }

        // 从数据库查询
        List<Application> applications;
        try {
            // 尝试使用预加载查询
            applications = applicationRepository.findAllWithUserAndActivity();
        } catch (Exception e) {
            System.err.println("Warning: Failed to use eager loading, using fallback query: " + e.getMessage());
            applications = applicationRepository.findAll();
        }

        // 初始化懒加载关系并转换为DTO进行缓存
        List<ApplicationCacheDTO> dtoList = new ArrayList<>();
        for (Application app : applications) {
            try {
                // 在事务内初始化关系
                if (app.getUser() != null) {
                    app.getUser().getStudentId(); // 触发初始化
                }
                if (app.getActivity() != null) {
                    app.getActivity().getName(); // 触发初始化
                }
                dtoList.add(ApplicationCacheDTO.fromEntity(app));
            } catch (Exception e) {
                System.err.println("Warning: Failed to initialize relationships for application " + app.getId() + ": " + e.getMessage());
                // 即使关系初始化失败，也要添加基本信息
                dtoList.add(ApplicationCacheDTO.fromEntity(app));
            }
        }

        // 缓存DTO列表
        try {
            cacheService.putActivitiesListToCache("applications_all", dtoList, 5, java.util.concurrent.TimeUnit.MINUTES);
        } catch (Exception e) {
            System.err.println("Warning: Failed to cache applications: " + e.getMessage());
        }

        return applications;
    }

    /**
     * 根据ID获取申请 - 带缓存和降级机制
     */
    @Transactional(readOnly = true)
    public Optional<Application> getApplicationById(Long id) {
        // 尝试从缓存获取
        try {
            Object cached = cacheService.getActivityFromCache(id);
            if (cached instanceof ApplicationCacheDTO) {
                ApplicationCacheDTO dto = (ApplicationCacheDTO) cached;
                // 从数据库重新查询以获取完整的关联对象
                Optional<Application> fullApp = applicationRepository.findByIdWithUserAndActivity(id);
                if (fullApp.isPresent()) {
                    return fullApp;
                } else {
                    // 如果数据库中找不到，返回缓存的实体（但关联对象可能不完整）
                    return Optional.of(dto.toEntity());
                }
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to get application from cache, querying database: " + e.getMessage());
        }

        // 从数据库查询
        Optional<Application> result;
        try {
            result = applicationRepository.findByIdWithUserAndActivity(id);
        } catch (Exception e) {
            System.err.println("Warning: Failed to use eager loading, using fallback query: " + e.getMessage());
            result = applicationRepository.findById(id);
        }

        // 如果找到，缓存DTO
        if (result.isPresent()) {
            try {
                Application app = result.get();
                // 初始化关系
                if (app.getUser() != null) {
                    app.getUser().getStudentId();
                }
                if (app.getActivity() != null) {
                    app.getActivity().getName();
                }

                ApplicationCacheDTO dto = ApplicationCacheDTO.fromEntity(app);
                cacheService.putActivityToCache(id, dto, 10, java.util.concurrent.TimeUnit.MINUTES);
            } catch (Exception e) {
                System.err.println("Warning: Failed to cache application " + id + ": " + e.getMessage());
            }
        }

        return result;
    }

    @Cacheable(value = "applications", key = "'user_' + #userId")
    public List<Application> getApplicationsByUserId(Long userId) { return applicationRepository.findByUser_Id(userId); }

    @Transactional
    @CacheEvict(value = "applications", allEntries = true)
    public Application createApplication(Application application) {
        // 使用用户ID和活动ID作为锁键，确保相同用户+活动的并发申请被串行化
        Long userId = application.getUser().getId();
        Long activityId = application.getActivity().getId();
        String lockKey = "application:create:" + userId + ":" + activityId;

        return distributedLockService.executeWithLockAndRetry(lockKey,
            () -> {
                try {
                    // 检查用户是否已经有申请存在（业务逻辑检查）
                    Optional<Application> existing = applicationRepository
                        .findByUser_IdAndActivity_Id(userId, activityId);

                    if (existing.isPresent()) {
                        throw new IllegalArgumentException("用户已存在申请，无法重复申请");
                    }

                    return applicationRepository.save(application);

                } catch (org.springframework.dao.DataIntegrityViolationException e) {
                    // 处理数据库唯一约束冲突
                    if (e.getMessage() != null && e.getMessage().contains("UKt67makixmd4asv0kk1qy1f24e")) {
                        throw new IllegalArgumentException("用户已存在申请，无法重复申请");
                    } else {
                        throw new RuntimeException("数据完整性违反: " + e.getMessage(), e);
                    }
                } catch (org.hibernate.exception.ConstraintViolationException e) {
                    // 处理Hibernate约束违反异常
                    if (e.getConstraintName() != null && e.getConstraintName().contains("UKt67makixmd4asv0kk1qy1f24e")) {
                        throw new IllegalArgumentException("用户已存在申请，无法重复申请");
                    } else {
                        throw new RuntimeException("约束违反: " + e.getMessage(), e);
                    }
                } catch (IllegalArgumentException e) {
                    // 重新抛出业务逻辑异常
                    throw e;
                } catch (Exception e) {
                    // 处理其他未预期的异常
                    throw new RuntimeException("创建申请失败: " + e.getMessage(), e);
                }
            }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#application.id")
    public Application updateApplication(Application application) {
        return distributedLockService.executeWithLockAndRetry("application:update:" + application.getId(),
            () -> {
                try {
                    // 重新加载最新版本以避免乐观锁冲突
                    Application existing = applicationRepository.findById(application.getId())
                        .orElseThrow(() -> new IllegalArgumentException("申请不存在"));

                    // 保留版本号和时间戳
                    application.setVersion(existing.getVersion());
                    application.setCreatedAt(existing.getCreatedAt());

                    return applicationRepository.save(application);
                } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
                    // 重新抛出乐观锁异常，让分布式锁服务处理重试
                    throw e;
                } catch (org.springframework.dao.OptimisticLockingFailureException e) {
                    // 处理另一种乐观锁异常
                    throw new org.springframework.orm.ObjectOptimisticLockingFailureException(
                        Application.class, application.getId(), e);
                }
            }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public void deleteApplication(Long id) {
        distributedLockService.executeWithLockAndRetry("application:delete:" + id,
            () -> {
                applicationRepository.deleteById(id);
                return null;
            }, 3);
    }

    @Transactional
    @CacheEvict(value = "applications", allEntries = true)
    public Application createDraft(Long activityId, String content) {
        User user = currentUserEntity();
        return distributedLockService.executeWithLockAndRetry("draft:create:" + user.getId() + ":" + activityId, () -> {
            Optional<Application> existing = applicationRepository.findByUser_IdAndActivity_Id(user.getId(), activityId);
            if (existing.isPresent()) {
                Application ex = existing.get();
                if (ex.getStatus()==ApplicationStatus.CANCELLED || ex.getStatus()==ApplicationStatus.REJECTED || ex.getStatus()==ApplicationStatus.SYSTEM_REJECTED) {
                    // 重新激活为草稿
                    ex.setStatus(ApplicationStatus.DRAFT);
                    ex.setSubmittedAt(null);
                    ex.setSystemReviewedAt(null);
                    ex.setAdminReviewedAt(null);
                    ex.setSystemReviewComment(null);
                    ex.setAdminReviewComment(null);
                    return applicationRepository.save(ex);
                }
                return ex;
            }
            Activity activity = activityRepository.findById(activityId)
                    .orElseThrow(() -> new IllegalArgumentException("活动不存在"));
            Application app = new Application();
            app.setUser(user);
            app.setActivity(activity);
            app.setContent(content);
            app.setStatus(ApplicationStatus.DRAFT);
            return applicationRepository.save(app);
        }, 5);
    }

    public Optional<Application> findMineByActivity(Long activityId){
        User user = currentUserEntity();
        return applicationRepository.findByUser_IdAndActivity_Id(user.getId(), activityId);
    }

    @Transactional
    public void deleteOwnedOrAdmin(Long id){
        distributedLockService.executeWithLockAndRetry("application:deleteOwned:" + id, () -> {
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
            return null;
        }, 3);
    }

    public List<Application> listMine() {
        User user = currentUserEntity();
        // Use preloading query to ensure activity is loaded to avoid lazy initialization when serializing
        try {
            return applicationRepository.findByUser_IdWithActivity(user.getId());
        } catch (Exception e) {
            // fallback to safer simple query
            return applicationRepository.findByUser_Id(user.getId());
        }
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application updateDraft(Long id, String content) {
        return distributedLockService.executeWithLockAndRetry("application:updateDraft:" + id, () -> {
            Application app = owned(id);
            if (app.getStatus() != ApplicationStatus.DRAFT) {
                throw new IllegalStateException("只能在草稿状态修改");
            }
            String merged = mergeContent(app.getContent(), content);
            app.setContent(merged);
            recalcScores(app);
            app.setLastUpdateDate(java.time.LocalDateTime.now());
            return applicationRepository.save(app);
        }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application submit(Long id) {
        return distributedLockService.executeWithLockAndRetry("application:submit:" + id, () -> {
            Application app = owned(id);
            if (app.getStatus() != ApplicationStatus.DRAFT) {
                throw new IllegalStateException("当前状态不能提交");
            }
            JsonNode root = parseContent(app.getContent());

            // 从User表获取权威的学业数据，覆盖前端提交的数据
            User u = app.getUser();
            if (u != null) {
                if(root.path("basicInfo").isMissingNode() || !root.path("basicInfo").has("name")){
                    var o = root.isObject()? (com.fasterxml.jackson.databind.node.ObjectNode) root : MAPPER.createObjectNode();
                    var basic = MAPPER.createObjectNode();
                    basic.put("name", Optional.ofNullable(u.getName()).orElse(""));
                    basic.put("studentId", u.getStudentId());
                    basic.put("department", Optional.ofNullable(u.getDepartment()).orElse(""));
                    basic.put("major", Optional.ofNullable(u.getMajor()).orElse(""));
                    o.set("basicInfo", basic);
                    try { app.setContent(MAPPER.writeValueAsString(o)); } catch(Exception ignored){}
                    root = parseContent(app.getContent());
                }

                // 强制覆盖学业数据：如果User表中有管理员提供的数据，使用User表的数据
                var o = root.isObject()? (com.fasterxml.jackson.databind.node.ObjectNode) root : MAPPER.createObjectNode();
                var basic = o.has("basicInfo") && o.get("basicInfo").isObject() ?
                    (com.fasterxml.jackson.databind.node.ObjectNode) o.get("basicInfo") : MAPPER.createObjectNode();

                // 确保基本信息存在
                if (!basic.has("name")) basic.put("name", Optional.ofNullable(u.getName()).orElse(""));
                if (!basic.has("studentId")) basic.put("studentId", u.getStudentId());
                if (!basic.has("department")) basic.put("department", Optional.ofNullable(u.getDepartment()).orElse(""));
                if (!basic.has("major")) basic.put("major", Optional.ofNullable(u.getMajor()).orElse(""));

                // 如果管理员已设置学业数据，强制使用User表的数据（不信任前端）
                if (u.getGpa() != null) {
                    basic.put("gpa", u.getGpa().toString());
                }
                if (u.getAcademicRank() != null) {
                    basic.put("academicRanking", u.getAcademicRank().toString());
                }
                if (u.getMajorTotal() != null) {
                    basic.put("totalStudents", u.getMajorTotal().toString());
                }
                if (u.getConvertedScore() != null) {
                    basic.put("convertedScore", u.getConvertedScore().toString());
                }

                o.set("basicInfo", basic);
                try { app.setContent(MAPPER.writeValueAsString(o)); } catch(Exception ignored){}
            }

            recalcScores(app);

            // 修复：提交后进入系统审核状态，而不是直接通过
            app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
            app.setSubmittedAt(LocalDateTime.now());
            // 清空之前的审核信息
            app.setSystemReviewedAt(null);
            app.setSystemReviewComment(null);
            app.setAdminReviewedAt(null);
            app.setAdminReviewComment(null);

            return applicationRepository.save(app);
        }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application systemReview(Long id) {
        return distributedLockService.executeWithLockAndRetry("application:systemReview:" + id, () -> {
            ensureAdminOrReviewer();
            Application app = applicationRepository.findById(id).orElseThrow();
            if (app.getStatus() != ApplicationStatus.SYSTEM_REVIEWING) {
                throw new IllegalStateException("非系统审核中");
            }
            recalcScores(app); // compute scores from content (academic based on GPA/rank)
            double academic = app.getAcademicScore()==null?0: app.getAcademicScore();
            if (academic >= 48) {
                // 直接进入人工审核状态，而不是停留在system_approved
                app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
                app.setSystemReviewComment("系统初审通过，学业得分=" + academic + "，已进入人工审核");
            } else {
                app.setStatus(ApplicationStatus.SYSTEM_REJECTED);
                app.setSystemReviewComment("系统初审不通过，学业得分=" + academic);
            }
            app.setSystemReviewedAt(LocalDateTime.now());
            return applicationRepository.save(app);
        }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application startAdminReview(Long id) {
        return distributedLockService.executeWithLockAndRetry("application:startAdminReview:" + id, () -> {
            ensureAdminOrReviewer();
            Application app = applicationRepository.findById(id).orElseThrow();
            if (app.getStatus() != ApplicationStatus.SYSTEM_APPROVED) {
                throw new IllegalStateException("必须是系统通过状态");
            }
            app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
            return applicationRepository.save(app);
        }, 5);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application adminReview(Long id, boolean approve, String comment) {
        return distributedLockService.executeWithLockAndRetry("application:adminReview:" + id, () -> {
            ensureAdminOrReviewer();
            Application app = applicationRepository.findById(id).orElseThrow();
            if (app.getStatus() != ApplicationStatus.ADMIN_REVIEWING) {
                throw new IllegalStateException("非人工审核中");
            }
            if(!approve && (comment==null || comment.isBlank())){
                throw new IllegalStateException("拒绝操作必须填写审核意见");
            }
            recalcScores(app); // ensure latest scores
            app.setStatus(approve ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED);
            app.setAdminReviewComment(comment);
            app.setAdminReviewedAt(LocalDateTime.now());
            Application saved = applicationRepository.save(app);

            // 清除缓存确保状态更新
            cacheService.evictCache("applications", id.toString());
            cacheService.evictAllApplications();

            return saved;
        }, 5);
    }

    public List<Application> reviewQueue() {
        // 审核队列：包含所有待/在审核及已出管理员结论（允许复核）
        return applicationRepository.findByStatusIn(List.of(
                ApplicationStatus.SYSTEM_REVIEWING,
                ApplicationStatus.SYSTEM_APPROVED,
                ApplicationStatus.ADMIN_REVIEWING,
                ApplicationStatus.APPROVED,
                ApplicationStatus.REJECTED
        ));
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application specialTalentPass(Long id){
        return distributedLockService.executeWithLockAndRetry("application:specialTalent:" + id, () -> {
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
        }, 3);
    }

    @Transactional
    @CacheEvict(value = "applications", key = "#id")
    public Application recalc(Long id){
        return distributedLockService.executeWithLockAndRetry("application:recalc:" + id, () -> {
            Application app = applicationRepository.findById(id).orElseThrow();
            recalcScores(app);
            return applicationRepository.save(app);
        }, 3);
    }

    // === PDF 导出 ===
    @Transactional(readOnly = true)  // Add transaction to handle lazy loading
    public byte[] exportPdf(Long id){
        // Use the proper method to fetch with eager loading to avoid lazy initialization issues
        Application app = applicationRepository.findByIdWithUserAndActivity(id)
            .orElseThrow(() -> new RuntimeException("Application not found"));

        // Ensure lazy-loaded relationships are initialized within transaction
        if (app.getUser() != null) {
            app.getUser().getStudentId(); // Force initialization
            app.getUser().getRoles().size(); // Force roles initialization to prevent JSON serialization issues
        }
        if (app.getActivity() != null) {
            app.getActivity().getName(); // Force initialization
        }

        recalcScores(app);
        applicationRepository.save(app);

        try(PDDocument doc = new PDDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()){
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDType0Font font0 = null; boolean fontLoaded=false;
            // 1) 尝试加载资源目录内字体（建议放置 NotoSansSC-Regular.ttf 或 DejaVuSans.ttf 于 resources/fonts）
            try(InputStream is = getClass().getResourceAsStream("/fonts/NotoSansSC-Regular.ttf")){
                if(is!=null){ font0 = PDType0Font.load(doc, is, true); fontLoaded=true; }
            } catch(Exception ignore){}
            if(!fontLoaded){
                try(InputStream is = ApplicationService.class.getResourceAsStream("/fonts/DejaVuSans.ttf")){
                    if(is!=null){ font0 = PDType0Font.load(doc, is, true); fontLoaded=true; }
                } catch(Exception ignore){}
            }
            // 2) 尝试系统字体（Windows / Linux 常用中文字体）
            if(!fontLoaded){
                String[] candidates = new String[]{
                        "C:/Windows/Fonts/msyh.ttc","C:/Windows/Fonts/msyh.ttf","C:/Windows/Fonts/msyhbd.ttc","C:/Windows/Fonts/simsun.ttc","C:/Windows/Fonts/simhei.ttf",
                        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc","/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc","/usr/share/fonts/truetype/arphic/ukai.ttc"
                };
                for(String path: candidates){
                    try(java.io.FileInputStream fis = new java.io.FileInputStream(path)){
                        font0 = PDType0Font.load(doc, fis, true); fontLoaded=true; break;
                    } catch(Exception ignore){}
                }
            }
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            float margin = 40; float y = page.getMediaBox().getHeight() - 50; float lh = 16; float width = page.getMediaBox().getWidth() - margin*2;
            if(fontLoaded){ cs.setFont(font0, 14); y = writeWrap(cs, font0, 14, "推免申请导出 - "+ (app.getActivityName()==null?"活动":app.getActivityName()), margin, y, lh, width); cs.setFont(font0, 12);} else { cs.setFont(PDType1Font.HELVETICA_BOLD,14); y = writeWrap(cs, null,14,"推免申请导出 - "+(app.getActivityName()==null?"活动":app.getActivityName()), margin,y,lh,width); cs.setFont(PDType1Font.HELVETICA,12);}
            JsonNode root = parseContent(app.getContent()); JsonNode basic = root.path("basicInfo");
            line(cs,font0,12,String.format("姓名: %s 学号: %s", basic.path("name").asText("-"), basic.path("studentId").asText("-")), margin,y); y-=lh;
            line(cs,font0,12,String.format("系别: %s 专业: %s", basic.path("department").asText("-"), basic.path("major").asText("-")), margin,y); y-=lh;
            line(cs,font0,12,String.format("GPA: %s 排名: %s/%s", basic.path("gpa").asText(""), basic.path("academicRanking").asText(""), basic.path("totalStudents").asText("")), margin,y); y-=lh;
            // Add converted score if present
            if (basic.has("convertedScore") && !basic.path("convertedScore").asText("").isEmpty()) {
                line(cs,font0,12,String.format("换算后的成绩: %s", basic.path("convertedScore").asText("-")), margin,y); y-=lh;
            }
            y-=lh*0.5;
            y = section(cs,font0,"个人陈述", root.path("personalStatement").asText("(未填写)"), margin,y,lh,width);

            // ==== 重写：使用可变上下文对象避免 lambda 修改局部变量导致的编译错误 ====
            JsonNode uploaded = root.path("uploadedFiles");
            JsonNode pubProofs = uploaded.path("publicationProofs");
            JsonNode compProofs = uploaded.path("competitionProofs");
            JsonNode patentProofs = uploaded.path("patentProofs");
            JsonNode honorProofs = uploaded.path("honorProofs");
            JsonNode innovProofs = uploaded.path("innovationProofs");

            final float bottom = 60f;
            // 上下文
            class PdfCtx { PDPage pageRef; PDPageContentStream csRef; float yRef; }
            final PdfCtx ctx = new PdfCtx();
            ctx.pageRef = page; ctx.csRef = cs; ctx.yRef = y;
            final PDType0Font fFinal = font0; final boolean fontLoadedFinal = fontLoaded; // 供 lambda 捕获

            java.util.function.Consumer<Float> ensureSpace = (need) -> {
                try {
                    if (ctx.yRef - need < bottom) {
                        ctx.csRef.close();
                        ctx.pageRef = new PDPage(PDRectangle.A4);
                        doc.addPage(ctx.pageRef);
                        ctx.csRef = new PDPageContentStream(doc, ctx.pageRef);
                        if (fontLoadedFinal && fFinal!=null) ctx.csRef.setFont(fFinal, 12); else ctx.csRef.setFont(PDType1Font.HELVETICA, 12);
                        ctx.yRef = ctx.pageRef.getMediaBox().getHeight() - 50;
                    }
                } catch (Exception ignored) {}
            };

            java.util.function.Consumer<String> writeSectionTitle = (title) -> {
                try { ensureSpace.accept(30f); ctx.yRef = writeWrap(ctx.csRef, fFinal, 12, "【"+title+"】", margin, ctx.yRef, lh, width); } catch(Exception ignored){}
            };

            java.util.function.BiFunction<JsonNode, JsonNode, java.util.List<JsonNode>> matchProofs = (item, proofs) -> {
                java.util.List<JsonNode> list = new java.util.ArrayList<>();
                if (proofs==null || !proofs.isArray() || proofs.size()==0 || item==null) return list;
                if (item.has("proofFileIds") && item.get("proofFileIds").isArray()) {
                    for (JsonNode idNode: item.get("proofFileIds")) {
                        long fid = idNode.asLong(-1);
                        for (JsonNode p: proofs) { if (p.path("id").asLong(-2)==fid) { list.add(p); break; } }
                    }
                } else if (item.has("proofFileId")) {
                    long fid = item.path("proofFileId").asLong(-1);
                    for (JsonNode p: proofs) { if (p.path("id").asLong(-2)==fid) { list.add(p); break; } }
                }
                return list;
            };

            java.util.function.BiFunction<Integer, JsonNode, JsonNode> fallbackByIndex = (idx, proofs) -> {
                if (proofs!=null && proofs.isArray() && proofs.size()>idx) return proofs.get(idx); return null; };

            // Improved image drawing function with better spacing calculation
            java.util.function.BiFunction<byte[], String, Float> drawImage = (bytes, caption) -> {
                try {
                    org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject img = org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject.createFromByteArray(doc, bytes, caption);
                    float maxW = width * 0.8f; // Limit image width to 80% of page width
                    float maxH = 200f; // Maximum height for images to prevent them from being too large
                    float imgW = img.getWidth();
                    float imgH = img.getHeight();

                    // Calculate scale to fit both width and height constraints
                    float scaleW = maxW / imgW;
                    float scaleH = maxH / imgH;
                    float scale = Math.min(Math.min(scaleW, scaleH), 1f);

                    float drawW = imgW * scale;
                    float drawH = imgH * scale;

                    // Calculate total space needed: caption + spacing + image + bottom spacing
                    float captionHeight = 15f;
                    float spacingBefore = 8f;
                    float spacingAfter = 12f;
                    float totalNeeded = captionHeight + spacingBefore + drawH + spacingAfter;

                    ensureSpace.accept(totalNeeded);

                    // Draw caption with proper spacing
                    ctx.yRef = writeWrap(ctx.csRef, fFinal, 10, caption, margin, ctx.yRef, 12, width);
                    ctx.yRef -= spacingBefore;

                    // Draw image with proper positioning
                    ctx.csRef.drawImage(img, margin, ctx.yRef - drawH, drawW, drawH);
                    ctx.yRef -= (drawH + spacingAfter);

                } catch (Exception ex) {
                    try {
                        ctx.yRef = writeWrap(ctx.csRef, fFinal, 10, caption + " (图片加载失败)", margin, ctx.yRef, 12, width) - 4;
                    } catch (Exception ignore) {}
                }
                return ctx.yRef;
            };

            java.util.function.BiConsumer<String, JsonNode> outputArray = (title, arr) -> {
                if (arr==null || !arr.isArray() || arr.size()==0) return;
                writeSectionTitle.accept(title);
                for (int i=0;i<arr.size();i++) {
                    JsonNode node = arr.get(i);
                    ensureSpace.accept(40f);
                    String lineTxt;
                    switch (title) {
                        case "论文发表":
                            lineTxt = String.format("%d. %s / %s / 作者 %d/%d%s", i+1, opt(node,"title"), opt(node,"type"), node.path("authorRank").asInt(0), node.path("totalAuthors").asInt(0), node.path("isCoFirst").asBoolean(false)?" (共同一作)":"");
                            break;
                        case "学科竞赛":
                            lineTxt = String.format("%d. %s / %s / %s%s", i+1,opt(node,"name"),opt(node,"level"),opt(node,"award"), node.path("isTeam").asBoolean(false)? String.format(" 团队(%d/%d)",node.path("teamRank").asInt(0),node.path("totalTeamMembers").asInt(0)):"");
                            break;
                        case "专利/软著":
                            lineTxt = String.format("%d. %s / %s / 排名%d", i+1,opt(node,"title"),opt(node,"patentNumber"), node.path("authorRank").asInt(0));
                            break;
                        case "科创项目":
                            lineTxt = String.format("%d. %s / %s / %s / %s", i+1,opt(node,"name"),opt(node,"level"),opt(node,"role"),opt(node,"status"));
                            break;
                        case "荣誉称号":
                            lineTxt = String.format("%d. %s / %s / %s%s", i+1,opt(node,"title"),opt(node,"level"),opt(node,"year"), node.path("isCollective").asBoolean(false)?" 集体":"");
                            break;
                        default:
                            lineTxt = (i+1)+". "+ node.toString();
                    }
                    try { ctx.yRef = writeWrap(ctx.csRef, fFinal, 11, lineTxt, margin, ctx.yRef, 14, width); } catch (Exception ignored) {}
                    JsonNode proofsSet = switch (title) {
                        case "论文发表" -> pubProofs;
                        case "学科竞赛" -> compProofs;
                        case "专利/软著" -> patentProofs;
                        case "科创项目" -> innovProofs;
                        case "荣誉称号" -> honorProofs;
                        default -> null;
                    };
                    java.util.List<JsonNode> matched = matchProofs.apply(node, proofsSet);
                    if (matched.isEmpty() && proofsSet!=null && proofsSet.isArray() && proofsSet.size()==arr.size()) {
                        JsonNode fb = fallbackByIndex.apply(i, proofsSet);
                        if (fb!=null) matched = java.util.List.of(fb);
                    }
                    for (JsonNode pf : matched) {
                        long fid = pf.path("id").asLong(-1);
                        if (fid > 0) {
                            fileService.find(fid).ifPresent(meta -> {
                                try { byte[] bytes = fileService.read(meta); drawImage.apply(bytes, "  证明: " + meta.getOriginalFilename()); } catch (Exception ignored) {}
                            });
                        }
                    }
                }
            };

            JsonNode acad = root.path("academicAchievements");
            outputArray.accept("论文发表", acad.path("publications"));
            outputArray.accept("学科竞赛", acad.path("competitions"));
            outputArray.accept("专利/软著", acad.path("patents"));
            outputArray.accept("科创项目", acad.path("innovationProjects"));
            outputArray.accept("荣誉称号", root.path("comprehensivePerformance").path("honors"));

            // 同步回局部变量供后续旧逻辑复用
            cs = ctx.csRef; page = ctx.pageRef; y = ctx.yRef;

            // 继续其它部分（社会工作 / 志愿 / 体育 / 特殊学术专长）
            y = listSection(cs,font0,"社会工作", root.path("comprehensivePerformance").path("socialWork"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s / 评分%s", i+1,opt(p,"position"),opt(p,"level"),opt(p,"year"),opt(p,"rating")));
            JsonNode vs = root.path("comprehensivePerformance").path("volunteerService");
            y = section(cs,font0,"志愿服务", String.format("总时长: %s 小时; 分段: %d", vs.path("hours").asText(""), vs.path("segments").isArray()? vs.path("segments").size():0), margin,y,lh,width);
            y = listSection(cs,font0,"体育比赛", root.path("comprehensivePerformance").path("sports"), margin,y,lh,width,(p,i)-> String.format("%d. %s / %s / %s%s", i+1,opt(p,"name"),opt(p,"scope"),opt(p,"result"), p.path("isTeam").asBoolean(false)?" 团队":""));
            JsonNode talent = root.path("specialAcademicTalent"); if(talent.path("isApplying").asBoolean(false)){ y = section(cs,font0,"特殊学术专长申请", "简介:"+talent.path("description").asText("(未填)")+"\n成果:"+talent.path("achievements").asText("(未填)"), margin,y,lh,width); }
            if(y<60){ cs.close(); page = new PDPage(PDRectangle.A4); doc.addPage(page); cs = new PDPageContentStream(doc,page); y= page.getMediaBox().getHeight()-50; if(fontLoaded) cs.setFont(font0,12); else cs.setFont(PDType1Font.HELVETICA,12); }
            y-=lh;
            line(cs,font0,10,String.format("学业: %.2f 学术专长: %.2f 综合表现: %.2f 总分: %.2f", nz(app.getAcademicScore()), nz(app.getAchievementScore()), nz(app.getPerformanceScore()), nz(app.getTotalScore())), margin,y);
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
        // 推免综合成绩 = 学业综合成绩×80% + 学术专长成绩(15分) + 综合表现成绩(5分)
        double academicBase = computeAcademicBaseFromApp(app); // 学业综合成绩×80% = 0-80分
        double specRaw = 0; // 学术专长成绩 0-15分
        double perfRaw = 0; // 综合表现成绩 0-5分
        boolean defensePassed = false;
        Double rankScoreDetail=null,gpaScoreDetail=null,convertedDetail=null;

        try {
            JsonNode root = app.getContent()==null? MAPPER.createObjectNode(): MAPPER.readTree(app.getContent());
            JsonNode basicInfo = root.path("basicInfo");

            // 获取换算后的成绩详情
            if(basicInfo.hasNonNull("convertedScore")) convertedDetail = basicInfo.path("convertedScore").asDouble();
            else if(basicInfo.hasNonNull("percentageScore")) convertedDetail = basicInfo.path("percentageScore").asDouble();
            else if(basicInfo.hasNonNull("averageScore100")) convertedDetail = basicInfo.path("averageScore100").asDouble();

            if(convertedDetail==null){
                // 从GPA和排名推导详情
                Double gpa=null; Integer rank=null,total=null;
                if(basicInfo.hasNonNull("gpa")) gpa = basicInfo.path("gpa").asDouble();
                if(basicInfo.hasNonNull("academicRanking")) rank = basicInfo.path("academicRanking").asInt();
                if(basicInfo.hasNonNull("totalStudents")) total = basicInfo.path("totalStudents").asInt();
                if(rank!=null && total!=null && total>0){ rankScoreDetail = ((double)(total - rank +1)/ total)*80.0; }
                if(gpa!=null){ gpaScoreDetail = Math.min(gpa/4.0,1.0)*80.0; }
            }

            // ========== 学术专长成绩计算 (满分15分) ==========
            JsonNode talent = root.path("specialAcademicTalent");
            defensePassed = talent.path("defensePassed").asBoolean(false);

            JsonNode acad = root.path("academicAchievements");

            // 1. 科研成果 - 论文
            int cCount=0;
            double publicationScore=0.0;
            for(JsonNode p: acad.path("publications")){
                if(!p.hasNonNull("title")) continue;
                String type=p.path("type").asText("");
                String journal = p.path("journal").asText("");
                String full = (journal+" "+p.path("title").asText("")).toLowerCase();

                // 判断顶级期刊
                boolean top = full.contains("nature") || full.contains("science") ||
                             full.contains("cell ") || full.equals("cell") || journal.equalsIgnoreCase("Cell");

                double base=0;
                if(top) {
                    base=20; // Nature/Science/Cell及子刊(IF≥10)
                } else {
                    switch(type){
                        case "A类": base=10; break;
                        case "B类": base=6; break;
                        case "C类":
                            if(cCount<2){ // C类最多2篇
                                base=1;
                                cCount++;
                            }
                            break;
                        case "高水平中文": base=6; break;
                        case "信息通信工程": base=10; break;
                        default: base=0;
                    }
                }

                if(base==0) continue;

                // 作者排名系数计算
                int totalAuthors = p.path("totalAuthors").asInt(1);
                int authorRank = p.path("authorRank").asInt(1);
                boolean coFirst = p.path("isCoFirst").asBoolean(false);

                double ratio;
                if(totalAuthors<=1) {
                    ratio=1; // 独立作者100%
                } else if(coFirst && (authorRank==1||authorRank==2)) {
                    ratio=0.5; // 共同第一各50%
                } else if(authorRank==1) {
                    ratio=0.8; // 除导师外第一作者80%
                } else if(authorRank==2) {
                    ratio=0.2; // 除导师外第二作者20%
                } else {
                    ratio=0; // 其他不计分
                }

                publicationScore += base*ratio;
            }

            // 2. 科研成果 - 专利 (每项2分)
            double patentScore=0.0;
            for(JsonNode pt: acad.path("patents")){
                if(!pt.hasNonNull("title")) continue;
                int rank= pt.path("authorRank").asInt(1);
                int total=pt.path("totalAuthors").asInt(1);
                if(rank==1){
                    patentScore += (total<=1)?2:1.6; // 独立作者100%(2分)，第一作者80%(1.6分)
                }
            }

            // 3. 学业竞赛 (最多取3项)
            double competitionScore = computeCompetitionScore(acad.path("competitions"));

            // 4. 创新创业训练 (最多2分)
            double innovationScore=0.0;
            for(JsonNode ip: acad.path("innovationProjects")){
                if(!"已结项".equals(ip.path("status").asText())) continue; // 必须结项
                String level=ip.path("level").asText("");
                String role=ip.path("role").asText("");
                double add=0;
                switch(level){
                    case "国家级": add="组长".equals(role)?1:0.3; break;
                    case "省级": add="组长".equals(role)?0.5:0.2; break;
                    case "校级": add="组长".equals(role)?0.1:0.05; break;
                    default: add=0;
                }
                innovationScore+=add;
            }
            if(innovationScore>2) innovationScore=2; // 创新创业最多2分

            // 学术专长总分：特殊学术专长答辩通过给满分15分，否则累加各项(上限15分)
            specRaw = defensePassed? 15 : Math.min(15, publicationScore + patentScore + competitionScore + innovationScore);

            // ========== 综合表现成绩计算 (满分5分) ==========
            JsonNode comp = root.path("comprehensivePerformance");

            // 1. 志愿服务 (最多1分，包含工时和表彰)
            double volunteerHours = comp.path("volunteerService").path("hours").asDouble(0);

            // 处理志愿服务时长分段(大型赛会和支教工时减半)
            JsonNode segments = comp.path("volunteerService").path("segments");
            if(segments.isArray() && segments.size()>0){
                double effective=0;
                for(JsonNode seg: segments){
                    double h= seg.path("hours").asDouble(0);
                    String t= seg.path("type").asText("normal");
                    effective += ("normal".equals(t)? h: h/2.0); // 大型赛会/支教减半
                }
                volunteerHours = effective;
            }

            // 工时积分：≥200小时后，每2小时0.05分
            double hoursScore=0;
            if(volunteerHours>=200){
                hoursScore = Math.min(1, ((volunteerHours-200)/2.0)*0.05);
            }

            // 志愿服务表彰
            double awardScore=0;
            for(JsonNode aw: comp.path("volunteerService").path("awards")){
                String lvl=aw.path("level").asText("");
                String role=aw.path("role").asText("PERSONAL");
                double val=0;
                if("国家级".equals(lvl)) val=1;
                else if("省级".equals(lvl)) val=0.5;
                else if("校级".equals(lvl)) val=0.25;
                if("TEAM_MEMBER".equals(role)) val = val/2; // 队员减半
                awardScore = Math.max(awardScore, val); // 多个表彰取最高
            }
            if(awardScore>1) awardScore=1;

            double volunteerScore = Math.min(1, hoursScore+awardScore); // 志愿服务总分上限1分

            // 2. 荣誉称号 (最多2分，同一学年取最高，不同学年累加)
            HashMap<Integer, Double> honorYear = new HashMap<>();
            for(JsonNode h: comp.path("honors")){
                String lvl=h.path("level").asText("");
                int y=h.path("year").asInt(0);
                double v=0;
                if("国家级".equals(lvl)) v=2;
                else if("省级".equals(lvl)) v=1;
                else if("校级".equals(lvl)) v=0.2;
                if(h.path("isCollective").asBoolean(false)) v/=2; // 集体荣誉减半
                honorYear.merge(y, v, Math::max); // 同一年取最高
            }
            double honorScore = honorYear.values().stream().mapToDouble(Double::doubleValue).sum();
            if(honorScore>2) honorScore=2; // 荣誉称号上限2分

            // 3. 社会工作 (最多2分，同一学年取最高，不同学年累加)
            HashMap<Integer, Double> swYear = new HashMap<>();
            for(JsonNode sw: comp.path("socialWork")){
                String lvl= sw.path("level").asText("MEMBER");
                double coef= switch(lvl){
                    case "EXEC"->2;        // 执行主席、团总支书记
                    case "PRESIDIUM"->1.5; // 主席团、副书记
                    case "HEAD"->1;        // 部长、党支部书记、班长、团支书
                    case "DEPUTY"->0.75;   // 副部长、系团总支书记、社团社长
                    default->0.5;          // 委员、班委等
                };
                double rating= sw.path("rating").asDouble(0); // 评分0-100
                double val = coef * (rating/100.0);
                int y= sw.path("year").asInt(0);
                swYear.merge(y, val, Math::max); // 同一年取最高
            }
            double socialScore = swYear.values().stream().mapToDouble(Double::doubleValue).sum();
            if(socialScore>2) socialScore=2; // 社会工作上限2分

            // 4. 体育比赛
            double sportsScore = 0;
            for(JsonNode sp: comp.path("sports")){
                String scope=sp.path("scope").asText("");
                String result=sp.path("result").asText("");
                double base=0;

                if("国际级".equals(scope)){
                    base = switch(result){
                        case "冠军"->8;
                        case "亚军"->6.5;
                        case "季军"->5;
                        case "四至八名"->3.5;
                        default->0;
                    };
                } else if("国家级".equals(scope)){
                    base = switch(result){
                        case "冠军"->5;
                        case "亚军"->3.5;
                        case "季军"->2;
                        case "四至八名"->1;
                        default->0;
                    };
                }

                boolean team= sp.path("isTeam").asBoolean(false);
                if(team){
                    int size= sp.path("teamSize").asInt(0);
                    if(size>0) base/=size; // 团队项目按人数平均
                } else {
                    base/=3.0; // 个人或二人项目 ÷ 3
                }
                sportsScore += base;
            }

            double perfTotal = volunteerScore + honorScore + socialScore + sportsScore;

            // 5. 国际组织实习 (最多1分)
            double internshipScore = 0;
            if(comp.has("internshipMonths")){
                double m = comp.path("internshipMonths").asDouble(0);
                if(m >= 12) internshipScore = 1;
                else if(m > 6) internshipScore = 0.5;
                else internshipScore = 0;
            } else {
                String internshipFlag = comp.path("military").asText("").toUpperCase(Locale.ROOT);
                if(internshipFlag.contains("FULL") || internshipFlag.contains("YEAR")) internshipScore = 1;
                else if(internshipFlag.contains("HALF") || internshipFlag.contains("SEMESTER")) internshipScore = 0.5;
            }

            // 6. 参军入伍服兵役 (最多2分)
            double militaryScore = 0;
            int ms = comp.path("militaryYears").asInt(0);
            if(ms >= 2) militaryScore = 2;
            else if(ms >=1) militaryScore = 1;

            perfTotal += internshipScore + militaryScore;
            if(perfTotal>5) perfTotal=5; // 综合表现上限5分

            perfRaw = perfTotal;

            // 保存计算详情到content中
            try {
                com.fasterxml.jackson.databind.node.ObjectNode obj = root.isObject()?
                    (com.fasterxml.jackson.databind.node.ObjectNode)root : MAPPER.createObjectNode();

                // 原始分数详情
                com.fasterxml.jackson.databind.node.ObjectNode raw = obj.with("calculatedRaw");
                raw.put("publicationScore", publicationScore);
                raw.put("patentScore", patentScore);
                raw.put("competitionScore", competitionScore);
                raw.put("innovationScore", innovationScore);
                raw.put("specRaw", specRaw);
                raw.put("volunteerHoursScore", hoursScore);
                raw.put("volunteerAwardScore", awardScore);
                raw.put("volunteerScore", volunteerScore);
                raw.put("honorScore", honorScore);
                raw.put("socialScore", socialScore);
                raw.put("sportsScore", sportsScore);
                raw.put("perfRaw", perfRaw);
                raw.put("internshipScore", internshipScore);
                raw.put("militaryScore", militaryScore);

                if(rankScoreDetail!=null) raw.put("academicRankScore", rankScoreDetail);
                if(gpaScoreDetail!=null) raw.put("academicGpaScore", gpaScoreDetail);
                if(convertedDetail!=null) raw.put("academicConvertedScore", convertedDetail);
                raw.put("academicBaseUsed", academicBase);

                if(!raw.has("academicConvertedScore")) {
                    double est = academicBase/0.8;
                    if(est<0) est=0;
                    if(est>100) est=100;
                    raw.put("academicConvertedScore", est);
                }

                // 最终成绩
                com.fasterxml.jackson.databind.node.ObjectNode scores = obj.with("calculatedScores");
                scores.put("academicScore", academicBase); // 学业综合成绩×80%
                scores.put("academicAchievementScore", specRaw); // 学术专长0-15分
                scores.put("performanceScore", perfRaw); // 综合表现0-5分
                scores.put("totalScore", academicBase + specRaw + perfRaw); // 推免综合成绩(满分100)

                app.setContent(MAPPER.writeValueAsString(obj));
            } catch (Exception ignoreInner) {}

        } catch (Exception ignored){ }

        // 设置Application实体的分数字段
        app.setAcademicScore(academicBase); // 0-80
        app.setAchievementScore(specRaw); // 0-15
        app.setPerformanceScore(perfRaw); // 0-5
        app.setTotalScore(academicBase + specRaw + perfRaw); // 满分100
    }

    private double computeAcademicBaseFromApp(Application app){
        // 优先使用用户表中的换算后成绩（convertedScore）
        User u = app.getUser();
        if(u != null && u.getConvertedScore() != null) {
            // 换算后的成绩是百分制（0-100），需要转换为 0-80 分制
            double baseFromConverted = u.getConvertedScore() * 0.8;
            return Math.min(80, Math.max(0, baseFromConverted));
        }

        // 其次，尝试从申请内容中获取 converted score
        JsonNode rootNode = parseContent(app.getContent());
        JsonNode bNode = rootNode.path("basicInfo");
        Double converted = null;
        if(bNode.hasNonNull("convertedScore")) converted = bNode.path("convertedScore").asDouble();
        else if(bNode.hasNonNull("percentageScore")) converted = bNode.path("percentageScore").asDouble();
        else if(bNode.hasNonNull("averageScore100")) converted = bNode.path("averageScore100").asDouble();
        if(converted!=null){ double baseFromPct = Math.max(0, Math.min(100, converted)) * 0.8; return Math.min(80, baseFromPct); }

        // 最后，使用 GPA & rank 的计算方式作为兜底
        Double gpa = u.getGpa(); Integer rank = u.getAcademicRank(); Integer total = u.getMajorTotal();
        if(gpa==null || rank==null || total==null){
            try { JsonNode b = bNode; if(gpa==null && b.hasNonNull("gpa")) gpa = b.path("gpa").asDouble(); if(rank==null && b.hasNonNull("academicRanking")) rank = b.path("academicRanking").asInt(); if(total==null && b.hasNonNull("totalStudents")) total = b.path("totalStudents").asInt(); } catch(Exception ignored){}
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
                    if(pos==1) val = base/3d; else if(pos==2 || pos==3) val = base/4d; else if(pos==4 || pos==5) val= base/5d; else val=0d;
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

    @Transactional(readOnly = true)  // 添加事务支持
    protected Application owned(Long id) { // 改为protected以支持事务注解
        Application app;

        // 首先尝试使用预加载查询
        try {
            app = applicationRepository.findByIdWithUserAndActivity(id).orElseThrow(() -> new RuntimeException("Application not found"));

            // 确保用户关系已加载
            if (app.getUser() != null) {
                app.getUser().getStudentId(); // 触发加载
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to use eager loading in owned() method, falling back to regular query: " + e.getMessage());
            // 降级处理：使用普通查询但在事务内
            app = applicationRepository.findById(id).orElseThrow(() -> new RuntimeException("Application not found"));
        }

        User me = currentUserEntity();

        try {
            if (!app.getUser().getId().equals(me.getId())) {
                throw new IllegalStateException("无权访问此申请");
            }
        } catch (Exception e) {
            // 如果懒加载失败，使用原生查询验证权限
            System.err.println("Warning: Failed to check ownership via lazy loading, using native query fallback: " + e.getMessage());
            try {
                Optional<Object[]> result = applicationRepository.findApplicationWithUserByIdNative(id);
                if (result.isPresent()) {
                    Object[] row = result.get();
                    String ownerStudentId = row[row.length-5].toString(); // student_id位置
                    if (!me.getStudentId().equals(ownerStudentId)) {
                        throw new IllegalStateException("无权访问此申请");
                    }
                } else {
                    throw new IllegalStateException("无法验证申请所有权");
                }
            } catch (Exception fallbackException) {
                System.err.println("Error: Native query fallback也失败了: " + fallbackException.getMessage());
                throw new IllegalStateException("无法验证申请所有权");
            }
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
        app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
        app.setSubmittedAt(LocalDateTime.now());
        app.setSystemReviewedAt(LocalDateTime.now());
        app.setSystemReviewComment(null);
        return applicationRepository.save(app);
    }

    private boolean hasAuthority(String role){
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if(auth==null) return false;
            return auth.getAuthorities().stream().anyMatch(a-> role.equals(a.getAuthority()));
        } catch(Exception e){ return false; }
    }
    private void ensureAdminOrReviewer(){
        if(!(hasAuthority("ADMIN") || hasAuthority("REVIEWER"))){
            throw new IllegalStateException("无权执行该操作");
        }
    }

    public Application cancel(Long id){
        Application app = null;

        // 首先尝试使用预加载查询
        try {
            app = applicationRepository.findByIdWithUserAndActivity(id).orElseThrow(() -> new RuntimeException("Application not found"));

            // 确保用户关系已加载
            if (app.getUser() != null) {
                app.getUser().getStudentId(); // 触发加载
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to use eager loading in cancel() method, falling back to regular query: " + e.getMessage());
            // 降级处理：使用普通查询但在事务内
            app = applicationRepository.findById(id).orElseThrow(() -> new RuntimeException("Application not found"));
        }

        // 只有管理员或本人可取消；审核员(REVIEWER)不再具备取消权限
        boolean admin = hasAuthority("ADMIN");
        if(!admin){
            User me = currentUserEntity();

            try {
                if(!app.getUser().getId().equals(me.getId())){
                    throw new IllegalStateException("无权取消该申请");
                }
            } catch (Exception e) {
                // 如果懒加载失败，使用原生查询验证权限
                System.err.println("Warning: Failed to check ownership via lazy loading in cancel(), using native query fallback: " + e.getMessage());
                try {
                    Optional<Object[]> result = applicationRepository.findApplicationWithUserByIdNative(id);
                    if (result.isPresent()) {
                        Object[] row = result.get();
                        String ownerStudentId = row[row.length-5].toString(); // student_id位置
                        if (!me.getStudentId().equals(ownerStudentId)) {
                            throw new IllegalStateException("无权取消该申请");
                        }
                    } else {
                        throw new IllegalStateException("无法验证申请所有权");
                    }
                } catch (Exception fallbackException) {
                    System.err.println("Error: Native query fallback也失败了: " + fallbackException.getMessage());
                    throw new IllegalStateException("无法验证申请所有权");
                }
            }
        }

        if(app.getStatus()==ApplicationStatus.APPROVED){
            throw new IllegalStateException("已通过的申请不能取消");
        }
        if(app.getStatus()==ApplicationStatus.CANCELLED){
            return app; // 幂等
        }
        app.setStatus(ApplicationStatus.CANCELLED);
        return applicationRepository.save(app);
    }

    public Application reopenAdminReview(Long id, String reason){
        ensureAdminOrReviewer();
        Application app = applicationRepository.findById(id).orElseThrow();
        if(app.getStatus()!=ApplicationStatus.APPROVED && app.getStatus()!=ApplicationStatus.REJECTED){
            throw new IllegalStateException("仅已通过或已拒绝的申请可重新审核");
        }
        String prev = app.getAdminReviewComment();
        String marker = "【复核发起"+LocalDateTime.now()+"】"+(reason==null||reason.isBlank()?"":" "+reason.trim());
        app.setAdminReviewComment((prev==null?"":prev+"\n")+marker);
        app.setStatus(ApplicationStatus.ADMIN_REVIEWING);
        Application saved = applicationRepository.save(app);

        // 清除缓存确保状态更新
        cacheService.evictCache("applications", id.toString());
        cacheService.evictAllApplications();

        return saved;
    }
}

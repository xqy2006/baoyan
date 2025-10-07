package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.service.ApplicationService;
import com.xuqinyang.xmudemo.service.CacheService;
import com.xuqinyang.xmudemo.service.MessageQueueService;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import com.xuqinyang.xmudemo.service.DistributedLockService;  // 添加这个依赖
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private CacheService cacheService;

    @Autowired
    private MessageQueueService messageQueueService;

    @Autowired
    private PerformanceMonitorService performanceMonitorService;

    @Autowired
    private DistributedLockService distributedLockService;  // 添加分布式锁服务

    @Autowired
    private UserRepository userRepository;  // 添加UserRepository依赖

    @Autowired
    private com.xuqinyang.xmudemo.repository.ApplicationRepository applicationRepository;  // 添加ApplicationRepository依赖

    private final ObjectMapper mapper = new ObjectMapper();
    private static final Logger log = LoggerFactory.getLogger(ApplicationController.class);

    @PersistenceContext
    private EntityManager entityManager;

    @GetMapping
    public ResponseEntity<?> getAllApplications() {
        log.debug("Fetching all applications from database");
        try {
            var apps = applicationService.getAllApplications();
            // 参考mine API的实现，返回包含activityId和activityName的Map列表
            var out = apps.stream().map(a -> {
                var m = new java.util.HashMap<String, Object>();
                m.put("id", a.getId());
                m.put("status", a.getStatus() == null ? null : a.getStatus().name());
                m.put("createdAt", a.getCreatedAt());
                m.put("lastUpdateDate", a.getLastUpdateDate());
                m.put("submittedAt", a.getSubmittedAt());
                m.put("systemReviewedAt", a.getSystemReviewedAt());
                m.put("adminReviewedAt", a.getAdminReviewedAt());
                m.put("systemReviewComment", a.getSystemReviewComment());
                m.put("adminReviewComment", a.getAdminReviewComment());
                m.put("academicScore", a.getAcademicScore());
                m.put("achievementScore", a.getAchievementScore());
                m.put("performanceScore", a.getPerformanceScore());
                m.put("totalScore", a.getTotalScore());
                m.put("version", a.getVersion());

                // 确保activity信息存在，即使懒加载可能阻止它
                Long actId = null;
                String actName = null;
                try {
                    if (a.getActivity() != null) {
                        actId = a.getActivity().getId();
                        actName = a.getActivity().getName();
                    }
                } catch (Exception ignored) {}
                if (actId == null) actId = a.getActivityId();
                if (actName == null) actName = a.getActivityName();
                m.put("activityId", actId);
                m.put("activityName", actName);

                // 用户信息
                Long userId = null;
                String userStudentId = null;
                String userName = null;
                try {
                    if (a.getUser() != null) {
                        userId = a.getUser().getId();
                        userStudentId = a.getUser().getStudentId();
                        userName = a.getUser().getName();
                    }
                } catch (Exception ignored) {}
                if (userId == null) userId = a.getUserId();
                if (userStudentId == null) userStudentId = a.getUserStudentId();
                if (userName == null) userName = a.getUserName();
                m.put("userId", userId);
                m.put("userStudentId", userStudentId);
                m.put("userName", userName);

                // 包含内容摘要
                m.put("content", a.getContent());
                return m;
            }).toList();
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            log.error("Error getting all applications: {}", e.getMessage(), e);
            // 降级处理：如果缓存反序列化失败，尝试清除缓存重试
            if (e.getCause() instanceof com.fasterxml.jackson.databind.exc.InvalidDefinitionException ||
                e instanceof org.springframework.data.redis.serializer.SerializationException) {

                log.warn("Cache serialization issue detected for all applications, clearing cache: {}", e.getMessage());
                try {
                    cacheService.evictAllApplications();
                    // 重试一次
                    var apps = applicationService.getAllApplications();
                    var out = apps.stream().map(a -> {
                        var m = new java.util.HashMap<String, Object>();
                        m.put("id", a.getId());
                        m.put("status", a.getStatus() == null ? null : a.getStatus().name());
                        m.put("createdAt", a.getCreatedAt());
                        m.put("lastUpdateDate", a.getLastUpdateDate());
                        m.put("submittedAt", a.getSubmittedAt());
                        m.put("systemReviewedAt", a.getSystemReviewedAt());
                        m.put("adminReviewedAt", a.getAdminReviewedAt());
                        m.put("systemReviewComment", a.getSystemReviewComment());
                        m.put("adminReviewComment", a.getAdminReviewComment());
                        m.put("academicScore", a.getAcademicScore());
                        m.put("achievementScore", a.getAchievementScore());
                        m.put("performanceScore", a.getPerformanceScore());
                        m.put("totalScore", a.getTotalScore());
                        m.put("version", a.getVersion());

                        // 活动信息
                        Long actId = null;
                        String actName = null;
                        try {
                            if (a.getActivity() != null) {
                                actId = a.getActivity().getId();
                                actName = a.getActivity().getName();
                            }
                        } catch (Exception ignored) {}
                        if (actId == null) actId = a.getActivityId();
                        if (actName == null) actName = a.getActivityName();
                        m.put("activityId", actId);
                        m.put("activityName", actName);

                        // 用户信息
                        Long userId = null;
                        String userStudentId = null;
                        String userName = null;
                        try {
                            if (a.getUser() != null) {
                                userId = a.getUser().getId();
                                userStudentId = a.getUser().getStudentId();
                                userName = a.getUser().getName();
                            }
                        } catch (Exception ignored) {}
                        if (userId == null) userId = a.getUserId();
                        if (userStudentId == null) userStudentId = a.getUserStudentId();
                        if (userName == null) userName = a.getUserName();
                        m.put("userId", userId);
                        m.put("userStudentId", userStudentId);
                        m.put("userName", userName);

                        m.put("content", a.getContent());
                        return m;
                    }).toList();
                    return ResponseEntity.ok(out);
                } catch (Exception retryException) {
                    log.error("Retry also failed for all applications: {}", retryException.getMessage());
                    return ResponseEntity.internalServerError()
                        .body(java.util.Map.of("error", "Failed to load applications: " + retryException.getMessage()));
                }
            }
            return ResponseEntity.internalServerError()
                .body(java.util.Map.of("error", "Failed to load applications: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Application> getApplicationById(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isStudent = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("STUDENT"));
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("ADMIN"));
        boolean isReviewer = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("REVIEWER"));

        try {
            var opt = applicationService.getApplicationById(id);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();
            Application a = opt.get();

            if (isStudent && !isAdmin && !isReviewer) {
                String currentUserStudentId = auth.getName();

                // 首先尝试从Application对象直接获取用户学号
                String applicationOwnerStudentId = null;
                try {
                    applicationOwnerStudentId = a.getUserStudentId();
                    log.debug("Current user: {}, Application owner: {}, Application ID: {}",
                             currentUserStudentId, applicationOwnerStudentId, id);
                } catch (Exception userLoadException) {
                    log.warn("Failed to load user from application relationship for application {}: {}",
                            id, userLoadException.getMessage());

                    // 回退策略：直接查询数据库获取user_id并查找对应的student_id
                    try {
                        // 重新查询application以确保获取完整的用户信息
                        var freshOpt = applicationService.getApplicationById(id);
                        if (freshOpt.isPresent()) {
                            Application freshApp = freshOpt.get();
                            if (freshApp.getUser() != null) {
                                applicationOwnerStudentId = freshApp.getUser().getStudentId();
                                a = freshApp; // 使用新查询的结果
                                log.info("Successfully retrieved user information on retry for application {}", id);
                            }
                        }
                    } catch (Exception retryException) {
                        log.error("Retry failed to load user information for application {}: {}",
                                 id, retryException.getMessage());
                    }
                }

                // 如果仍然无法获取用户信息，使用原生SQL查询作为最后的fallback
                if (applicationOwnerStudentId == null) {
                    log.warn("All JPA attempts failed for application {}, trying native SQL fallback", id);
                    applicationOwnerStudentId = getApplicationOwnerByNativeQuery(id);
                    if (applicationOwnerStudentId != null) {
                        log.info("Native SQL fallback succeeded for application {}: owner={}", id, applicationOwnerStudentId);
                    }
                }

                if (applicationOwnerStudentId == null) {
                    log.warn("Application {} has no owner information after all attempts", id);
                    messageQueueService.sendDataStatisticsMessage("SYSTEM", "ERROR",
                        Map.of("applicationId", id, "userId", currentUserStudentId, "error", "no_owner_info"));
                    return ResponseEntity.status(403).build();
                }

                if (!currentUserStudentId.equals(applicationOwnerStudentId)) {
                    log.warn("Access denied: User {} tried to access application {} owned by {}",
                             currentUserStudentId, id, applicationOwnerStudentId);
                    messageQueueService.sendDataStatisticsMessage("SYSTEM", "ERROR",
                        Map.of("applicationId", id, "userId", currentUserStudentId, "ownerId", applicationOwnerStudentId, "error", "access_denied"));
                    return ResponseEntity.status(403).build();
                }
            }

            // Cache the application data
            cacheService.cacheApplication(id, a);

            return ResponseEntity.ok(a);
        } catch (Exception e) {
            log.error("Error getting application {}: {}", id, e.getMessage(), e);

            // If there's a serialization issue with cached data, clear the cache and try again
            if (e.getCause() instanceof com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException ||
                e instanceof org.springframework.data.redis.serializer.SerializationException) {

                log.warn("Cache serialization issue detected for application {}, clearing cache: {}", id, e.getMessage());
                cacheService.evictApplication(id);

                // Retry without cache
                var opt = applicationService.getApplicationById(id);
                if (opt.isEmpty()) return ResponseEntity.notFound().build();
                Application a = opt.get();
                if (isStudent && !isAdmin && !isReviewer) {
                    String sid = auth.getName();
                    String ownerStudentId = null;
                    try {
                        ownerStudentId = a.getUserStudentId();
                    } catch (Exception ex) {
                        log.error("Failed to get user student ID even after cache clear for application {}: {}",
                                 id, ex.getMessage());
                        return ResponseEntity.status(403).build();
                    }
                    if (ownerStudentId == null || !sid.equals(ownerStudentId)) {
                        return ResponseEntity.status(403).build();
                    }
                }
                return ResponseEntity.ok(a);
            }
            throw e; // Re-throw if it's not a serialization issue
        }
    }

    // === PDF Export with async processing ===
    @GetMapping("/{id}/export/pdf")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> exportPdf(@PathVariable Long id){
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean isAdmin = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("ADMIN"));
            boolean isReviewer = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("REVIEWER"));

            // 使用带缓存降级处理的方法获取应用
            Application app = null;

            try {
                // 首先尝试从缓存/服务层获取
                Optional<Application> optApp = applicationService.getApplicationById(id);
                app = optApp.orElse(null);
            } catch (Exception cacheException) {
                // 如果缓存反序列化失败（Redis懒加载问题），直接从数据库查询
                log.warn("Cache deserialization failed for application {}, falling back to direct database query: {}",
                         id, cacheException.getMessage());

                try {
                    // 清除可能损坏的缓存
                    cacheService.evictApplication(id);

                    // 直接使用预加载查询绕过缓存
                    app = applicationRepository.findByIdWithUserAndActivity(id).orElse(null);

                    if (app != null) {
                        // 在事务内强制初始化懒加载关系
                        try {
                            if (app.getUser() != null) {
                                app.getUser().getStudentId(); // 强制初始化User
                                app.getUser().getRoles().size(); // 强制初始化roles集合
                            }
                            if (app.getActivity() != null) {
                                app.getActivity().getName(); // 强制初始化Activity
                            }
                        } catch (Exception initException) {
                            log.warn("Failed to initialize lazy relationships for application {}: {}",
                                     id, initException.getMessage());
                        }
                    }
                } catch (Exception dbException) {
                    log.error("Database fallback also failed for application {}: {}", id, dbException.getMessage());
                    return ResponseEntity.internalServerError()
                        .body(Map.of("error", "Failed to load application data: " + dbException.getMessage()));
                }
            }

            if(app==null) return ResponseEntity.notFound().build();

            // 权限检查 - 添加懒加载降级处理
            if(!isAdmin && !isReviewer) { // only owner student
                String currentUserStudentId = auth.getName();
                String ownerStudentId = null;

                try {
                    // 首先尝试直接获取用户学号
                    ownerStudentId = app.getUserStudentId();
                } catch (Exception e) {
                    log.warn("Failed to get user student ID for PDF export permission check, application {}: {}",
                             id, e.getMessage());

                    // 降级处理：使用原生查询获取所有者信息
                    try {
                        ownerStudentId = getApplicationOwnerByNativeQuery(id);
                        if (ownerStudentId != null) {
                            log.info("Native query fallback succeeded for PDF export permission check, application {}: owner={}",
                                     id, ownerStudentId);
                        }
                    } catch (Exception fallbackException) {
                        log.error("All permission check methods failed for PDF export, application {}: {}",
                                  id, fallbackException.getMessage());
                        return ResponseEntity.status(403).body(Map.of("error", "Permission check failed - unable to verify application owner"));
                    }
                }

                if (ownerStudentId == null || !currentUserStudentId.equals(ownerStudentId)) {
                    return ResponseEntity.status(403).body(Map.of("error","Unauthorized to export this application"));
                }
            }

            // Send async message for PDF generation
            messageQueueService.sendApplicationProcessMessage(id, "EXPORT");

            byte[] pdf = applicationService.exportPdf(id);
            String filename = URLEncoder.encode("application-"+id+".pdf", StandardCharsets.UTF_8).replace("+","%20");
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''"+filename)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdf.length)
                    .body(pdf);
        } catch (Exception e){
            log.error("Error exporting PDF for application {}", id, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}")
    public List<Application> getApplicationsByUserId(@PathVariable Long userId) {
        log.debug("Fetching applications for user {}", userId);
        return applicationService.getApplicationsByUserId(userId);
    }

    @PostMapping
    @CacheEvict(value = "applications", allEntries = true)
    public ResponseEntity<Application> createApplication(@RequestBody Application application) {
        String lockKey = "application:create:controller:" + System.currentTimeMillis();

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            try {
                Application created = applicationService.createApplication(application);

                // Send async notification - use user object to get ID
                messageQueueService.sendApplicationProcessMessage(created.getId(), "CREATE");
                if (created.getUser() != null) {
                    messageQueueService.sendNotificationMessage(
                        created.getUser().getId(),
                        "Application Created",
                        "Your application has been created successfully",
                        "APPLICATION_CREATE"
                    );
                }

                // Cache the new application
                cacheService.cacheApplication(created.getId(), created);

                return ResponseEntity.ok(created);
            } catch (Exception e) {
                log.error("Error creating application", e);
                return ResponseEntity.internalServerError().build();
            }
        }, 5);
    }

    @PutMapping("/{id}")
    @CacheEvict(value = "applications", key = "#id")
    public ResponseEntity<Application> updateApplication(@PathVariable Long id, @RequestBody Application applicationDetails) {
        String lockKey = "application:update:controller:" + id;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            return applicationService.getApplicationById(id)
                    .map(application -> {
                        application.setContent(applicationDetails.getContent());
                        application.setStatus(applicationDetails.getStatus());
                        application.setLastUpdateDate(java.time.LocalDateTime.now());

                        Application updated = applicationService.updateApplication(application);

                        // Send async message for update
                        messageQueueService.sendApplicationProcessMessage(id, "UPDATE");

                        // Update cache
                        cacheService.updateApplicationCache(id, updated);

                        return ResponseEntity.ok(updated);
                    })
                    .orElse(ResponseEntity.notFound().build());
        }, 5);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('STUDENT','ADMIN')")
    public ResponseEntity<?> deleteApplication(@PathVariable Long id) {
        // Delete function disabled, suggest using cancel
        return ResponseEntity.badRequest().body(Map.of("error","Delete function disabled, please use cancel endpoint /api/applications/"+id+"/cancel"));
    }

    @PreAuthorize("hasAnyAuthority('STUDENT','ADMIN')")
    @PostMapping("/draft")
    public ResponseEntity<?> createDraft(@RequestParam Long activityId, @RequestBody(required = false) String content){
        String lockKey = "application:draft:create:" + activityId + ":" + SecurityContextHolder.getContext().getAuthentication().getName();

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            return ResponseEntity.ok(applicationService.createDraft(activityId, content==null?"{}":content));
        }, 5);
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @GetMapping("/mine")
    public ResponseEntity<?> myApplications(){
        // Return a list of simple maps so frontend reliably gets activityId and activityName
        var apps = applicationService.listMine();
        var out = apps.stream().map(a -> {
            var m = new java.util.HashMap<String, Object>();
            m.put("id", a.getId());
            m.put("status", a.getStatus()==null?null: a.getStatus().name());
            m.put("createdAt", a.getCreatedAt());
            m.put("submittedAt", a.getSubmittedAt());
            // Ensure activity info is present even if lazy-loading would otherwise prevent it
            Long actId = null; String actName = null;
            try { if (a.getActivity() != null) { actId = a.getActivity().getId(); actName = a.getActivity().getName(); } } catch (Exception ignored) {}
            if (actId==null) actId = a.getActivityId();
            if (actName==null) actName = a.getActivityName();
            m.put("activityId", actId);
            m.put("activityName", actName);
            // include minimal content summary if available
            m.put("content", a.getContent());
            return m;
        }).toList();
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @PutMapping("/{id}/draft")
    public ResponseEntity<?> updateDraft(@PathVariable Long id, @RequestBody(required = false) JsonNode body){
        String lockKey = "application:draft:update:" + id;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            try {
                String json = body==null?"{}": body.toString();
                var app = applicationService.updateDraft(id, json);
                return ResponseEntity.ok(Map.of("id", app.getId(), "status", app.getStatus(), "contentLength", json.length()));
            } catch (Exception e){
                log.warn("[DRAFT][UPDATE] fail id={} msg={}", id, e.getMessage());
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }, 5);
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable Long id, @RequestBody(required = false) JsonNode maybeContent, HttpServletRequest request){
        String lockKey = "application:submit:" + id;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            long startTime = System.currentTimeMillis();
            String clientIp = getClientIp(request);
            String userId = SecurityContextHolder.getContext().getAuthentication().getName();

            try {
                if(maybeContent!=null){
                    // 前端直接携带最终内容，先合并一次
                    applicationService.updateDraft(id, maybeContent.toString());
                }
                var app = applicationService.submit(id);

                // 异步处理申请提交事件
                messageQueueService.sendApplicationProcessMessage(id, "SUBMIT");

                // 发送审计日志
                messageQueueService.sendAuditLogMessage(
                    userId,
                    "APPLICATION_SUBMIT",
                    "APPLICATION",
                    String.format("Application %d submitted from IP: %s", id, clientIp)
                );

                // 发送数据统计
                messageQueueService.sendDataStatisticsMessage(
                    "APPLICATION",
                    "SUBMIT",
                    Map.of("applicationId", id, "userId", userId, "ip", clientIp)
                );

                // 发送通知
                if (app.getUser() != null) {
                    messageQueueService.sendNotificationMessage(
                        app.getUser().getId(),
                        "申请已提交",
                        "您的申请已成功提交，正在等待系统审核",
                        "APPLICATION_SUBMIT"
                    );
                }

                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/submit", 200, duration);

                log.info("[SUBMIT] Success applicationId={}, userId={}, duration={}ms", id, userId, duration);
                return ResponseEntity.ok(app);

            } catch (Exception e) {
                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/submit", 400, duration);

                log.error("[SUBMIT] Error applicationId={}, userId={}, duration={}ms", id, userId, duration, e);
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }, 5);
    }

    // 已废弃：手动系统审核功能已被自动系统审核取代
    // 保留代码以供参考，但不再对外暴露API
    /*
    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @PostMapping("/{id}/system-review")
    public ResponseEntity<?> systemReview(@PathVariable Long id, HttpServletRequest request){
        String lockKey = "application:systemReview:" + id;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            long startTime = System.currentTimeMillis();
            String clientIp = getClientIp(request);
            String userId = SecurityContextHolder.getContext().getAuthentication().getName();

            try {
                var app = applicationService.systemReview(id);

                // 异步处理系统审核事件
                messageQueueService.sendApplicationProcessMessage(id, "REVIEW");

                // 发送审计日志
                messageQueueService.sendAuditLogMessage(
                    userId,
                    "SYSTEM_REVIEW",
                    "APPLICATION",
                    String.format("System review started for application %d from IP: %s", id, clientIp)
                );

                // 发送数据统计
                messageQueueService.sendDataStatisticsMessage(
                    "APPLICATION",
                    "SYSTEM_REVIEW",
                    Map.of("applicationId", id, "reviewerId", userId, "ip", clientIp)
                );

                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/system-review", 200, duration);

                log.info("[SYSTEM_REVIEW] Success applicationId={}, reviewerId={}, duration={}ms", id, userId, duration);
                return ResponseEntity.ok(app);

            } catch (Exception e) {
                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/system-review", 400, duration);

                log.error("[SYSTEM_REVIEW] Error applicationId={}, reviewerId={}, duration={}ms", id, userId, duration, e);
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }, 5);
    }
    */

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @PostMapping("/{id}/admin-review")
    public ResponseEntity<?> adminReview(@PathVariable Long id, @RequestBody AdminDecision decision, HttpServletRequest request){
        String lockKey = "application:adminReview:" + id;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            long startTime = System.currentTimeMillis();
            String clientIp = getClientIp(request);
            String userId = SecurityContextHolder.getContext().getAuthentication().getName();

            try {
                var app = applicationService.adminReview(id, decision.approve(), decision.comment());

                // 异步处理管理员审核事件
                String action = decision.approve() ? "APPROVE" : "REJECT";
                messageQueueService.sendApplicationProcessMessage(id, action);

                // 发送审计日志
                messageQueueService.sendAuditLogMessage(
                    userId,
                    "ADMIN_REVIEW_" + action,
                    "APPLICATION",
                    String.format("Admin %s application %d from IP: %s, comment: %s",
                        action.toLowerCase(), id, clientIp, decision.comment())
                );

                // 发送数据统计
                messageQueueService.sendDataStatisticsMessage(
                    "APPLICATION",
                    action,
                    Map.of("applicationId", id, "reviewerId", userId, "approved", decision.approve())
                );


                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/admin-review", 200, duration);

                log.info("[ADMIN_REVIEW] Success applicationId={}, action={}, reviewerId={}, duration={}ms",
                    id, action, userId, duration);
                return ResponseEntity.ok(app);

            } catch (Exception e) {
                long duration = System.currentTimeMillis() - startTime;
                performanceMonitorService.recordRequest("POST", "/api/applications/" + id + "/admin-review", 400, duration);

                log.error("[ADMIN_REVIEW] Error applicationId={}, reviewerId={}, duration={}ms", id, userId, duration, e);
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }, 5);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @GetMapping("/review-queue")
    public ResponseEntity<?> reviewQueue() {
        try {
            var apps = applicationService.reviewQueue();
            // 参考mine API的实现，返回包含activityId和activityName的Map列表
            var out = apps.stream().map(a -> {
                var m = new java.util.HashMap<String, Object>();
                m.put("id", a.getId());
                m.put("status", a.getStatus() == null ? null : a.getStatus().name());
                m.put("createdAt", a.getCreatedAt());
                m.put("lastUpdateDate", a.getLastUpdateDate());
                m.put("submittedAt", a.getSubmittedAt());
                m.put("systemReviewedAt", a.getSystemReviewedAt());
                m.put("adminReviewedAt", a.getAdminReviewedAt());
                m.put("systemReviewComment", a.getSystemReviewComment());
                m.put("adminReviewComment", a.getAdminReviewComment());
                m.put("academicScore", a.getAcademicScore());
                m.put("achievementScore", a.getAchievementScore());
                m.put("performanceScore", a.getPerformanceScore());
                m.put("totalScore", a.getTotalScore());
                m.put("version", a.getVersion());

                // 确保activity信息存在，即使懒加载可能阻止它
                Long actId = null;
                String actName = null;
                try {
                    if (a.getActivity() != null) {
                        actId = a.getActivity().getId();
                        actName = a.getActivity().getName();
                    }
                } catch (Exception ignored) {}
                if (actId == null) actId = a.getActivityId();
                if (actName == null) actName = a.getActivityName();
                m.put("activityId", actId);
                m.put("activityName", actName);

                // 用户信息
                Long userId = null;
                String userStudentId = null;
                String userName = null;
                try {
                    if (a.getUser() != null) {
                        userId = a.getUser().getId();
                        userStudentId = a.getUser().getStudentId();
                        userName = a.getUser().getName();
                    }
                } catch (Exception ignored) {}
                if (userId == null) userId = a.getUserId();
                if (userStudentId == null) userStudentId = a.getUserStudentId();
                if (userName == null) userName = a.getUserName();
                m.put("userId", userId);
                m.put("userStudentId", userStudentId);
                m.put("userName", userName);

                // 包含内容摘要
                m.put("content", a.getContent());
                return m;
            }).toList();
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            log.error("Error getting review queue: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                .body(java.util.Map.of("error", "Failed to load review queue: " + e.getMessage()));
        }
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @GetMapping("/activity/{activityId}/mine")
    public ResponseEntity<?> myApplicationForActivity(@PathVariable Long activityId){
        return applicationService.findMineByActivity(activityId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body(Map.of("message","NOT_FOUND")));
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/special-talent/pass")
    public ResponseEntity<?> specialTalentPass(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.specialTalentPass(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/recalc")
    public ResponseEntity<?> recalc(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.recalc(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @GetMapping("/summary")
    public Map<String,Object> summary(){
        // 优化：使用数据库聚合查询，避免加载所有数据到内存
        List<Object[]> statusCounts = applicationRepository.countByStatusGrouped();
        Map<ApplicationStatus, Long> statusMap = new HashMap<>();

        // 初始化所有状态为0
        for (ApplicationStatus status : ApplicationStatus.values()) {
            statusMap.put(status, 0L);
        }

        // 填充实际统计数据
        for (Object[] row : statusCounts) {
            ApplicationStatus status = (ApplicationStatus) row[0];
            Long count = (Long) row[1];
            statusMap.put(status, count);
        }

        return Map.of(
                "draft", statusMap.get(ApplicationStatus.DRAFT),
                "systemReviewing", statusMap.get(ApplicationStatus.SYSTEM_REVIEWING),
                "systemApproved", statusMap.get(ApplicationStatus.SYSTEM_APPROVED),
                "systemRejected", statusMap.get(ApplicationStatus.SYSTEM_REJECTED),
                "adminReviewing", statusMap.get(ApplicationStatus.ADMIN_REVIEWING),
                "finalApproved", statusMap.get(ApplicationStatus.APPROVED),
                "finalRejected", statusMap.get(ApplicationStatus.REJECTED)
        );
    }

    @PreAuthorize("hasAnyAuthority('STUDENT','ADMIN')")
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.cancel(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @PostMapping("/{id}/admin-reopen")
    public ResponseEntity<?> reopen(@PathVariable Long id, @RequestBody(required = false) ReopenRequest body){
        try { return ResponseEntity.ok(applicationService.reopenAdminReview(id, body==null? null: body.reason())); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    /**
     * 分页查询申请列表（支持搜索和状态过滤）
     */
    @GetMapping("/page")
    public ResponseEntity<?> getApplicationsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> statuses) {
        try {
            // 强制限制最大分页大小
            size = Math.min(size, com.xuqinyang.xmudemo.dto.PageRequest.MAX_PAGE_SIZE);

            // 转换状态参数
            List<ApplicationStatus> statusList = null;
            if (statuses != null && !statuses.isEmpty()) {
                statusList = new ArrayList<>();
                for (String s : statuses) {
                    try {
                        statusList.add(ApplicationStatus.valueOf(s));
                    } catch (Exception e) {
                        log.warn("Invalid status: {}", s);
                    }
                }
            }

            org.springframework.data.domain.Page<Application> appPage =
                applicationService.getApplicationsPage(page, size, sortBy, sortDirection, search, statusList);

            // 转换为前端需要的格式
            List<Map<String, Object>> content = new ArrayList<>();
            for (Application a : appPage.getContent()) {
                var m = new java.util.HashMap<String, Object>();
                m.put("id", a.getId());
                m.put("status", a.getStatus() == null ? null : a.getStatus().name());
                m.put("createdAt", a.getCreatedAt());
                m.put("lastUpdateDate", a.getLastUpdateDate());
                m.put("submittedAt", a.getSubmittedAt());
                m.put("systemReviewedAt", a.getSystemReviewedAt());
                m.put("adminReviewedAt", a.getAdminReviewedAt());
                m.put("systemReviewComment", a.getSystemReviewComment());
                m.put("adminReviewComment", a.getAdminReviewComment());
                m.put("academicScore", a.getAcademicScore());
                m.put("achievementScore", a.getAchievementScore());
                m.put("performanceScore", a.getPerformanceScore());
                m.put("totalScore", a.getTotalScore());
                m.put("version", a.getVersion());

                // Activity信息
                Long actId = null;
                String actName = null;
                try {
                    if (a.getActivity() != null) {
                        actId = a.getActivity().getId();
                        actName = a.getActivity().getName();
                    }
                } catch (Exception ignored) {}
                if (actId == null) actId = a.getActivityId();
                if (actName == null) actName = a.getActivityName();
                m.put("activityId", actId);
                m.put("activityName", actName);

                // 用户信息
                Long userId = null;
                String userStudentId = null;
                String userName = null;
                try {
                    if (a.getUser() != null) {
                        userId = a.getUser().getId();
                        userStudentId = a.getUser().getStudentId();
                        userName = a.getUser().getName();
                    }
                } catch (Exception ignored) {}
                if (userId == null) userId = a.getUserId();
                if (userStudentId == null) userStudentId = a.getUserStudentId();
                if (userName == null) userName = a.getUserName();
                m.put("userId", userId);
                m.put("userStudentId", userStudentId);
                m.put("userName", userName);

                m.put("content", a.getContent());
                content.add(m);
            }

            // 构建分页响应
            com.xuqinyang.xmudemo.dto.PageResponse<Map<String, Object>> response =
                new com.xuqinyang.xmudemo.dto.PageResponse<>(
                    content,
                    appPage.getNumber(),
                    appPage.getSize(),
                    appPage.getTotalElements(),
                    appPage.getTotalPages(),
                    appPage.isFirst(),
                    appPage.isLast(),
                    appPage.isEmpty()
                );

            log.info("[APPLICATION][LIST_PAGE] page={} size={} total={} search={} statuses={}",
                page, size, appPage.getTotalElements(), search, statuses);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[APPLICATION][LIST_PAGE] error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "查询失败: " + e.getMessage()));
        }
    }

    // 记录类定义
    public record AdminDecision(boolean approve, String comment){}
    public record ReopenRequest(String reason){}

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    /**
     * 清除所有应用缓存 - 管理员接口，用于解决缓存序列化问题
     */
    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/clear-cache")
    public ResponseEntity<?> clearAllApplicationCache() {
        try {
            cacheService.evictAllApplications();
            log.info("All application caches cleared successfully");
            return ResponseEntity.ok(Map.of("message", "All application caches cleared successfully"));
        } catch (Exception e) {
            log.error("Failed to clear application caches", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to clear caches: " + e.getMessage()));
        }
    }

    private String getApplicationOwnerByNativeQuery(Long applicationId) {
        try {
            // 使用原生SQL查询应用的所有者学号，使用位置参数
            String sql = "SELECT u.student_id FROM users u " +
                         "JOIN application a ON u.id = a.user_id " +
                         "WHERE a.id = ?1";
            return entityManager.createNativeQuery(sql)
                       .setParameter(1, applicationId)
                       .getSingleResult()
                       .toString();
        } catch (Exception e) {
            log.error("Error executing native query for application owner: {}", e.getMessage());
            return null;
        }
    }
}

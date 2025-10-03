package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.dto.CreateUserRequest;
import com.xuqinyang.xmudemo.dto.ImportResult;
import com.xuqinyang.xmudemo.dto.ImportRecord;
import com.xuqinyang.xmudemo.dto.ChangePasswordRequest;
import com.xuqinyang.xmudemo.dto.ResetPasswordRequest;
import com.xuqinyang.xmudemo.dto.AcademicUpdateRequest;
import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.service.UserService;
import com.xuqinyang.xmudemo.service.DistributedLockService;
import com.xuqinyang.xmudemo.repository.ImportHistoryRepository;
import com.xuqinyang.xmudemo.model.ImportHistory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.cache.annotation.CacheEvict;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    @Autowired
    private UserService userService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private DistributedLockService distributedLockService;
    @Autowired
    private ImportHistoryRepository importHistoryRepository;

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/import")
    public ResponseEntity<ImportResult> importUsers(@RequestParam("file") MultipartFile file) {
        String lockKey = "user:import:" + System.currentTimeMillis();

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            log.info("[USER][IMPORT] file={} size={}B", file.getOriginalFilename(), file.getSize());
            try {
                ImportResult result = userService.importUsersFromExcel(file);
                log.info("[USER][IMPORT] completed total={} success={} failed={}",
                    result.getTotal(), result.getSuccess(), result.getFailed());
                return ResponseEntity.ok(result);
            } catch (Exception e) {
                log.error("[USER][IMPORT] failed: {}", e.getMessage(), e);
                return ResponseEntity.badRequest().body(
                    new ImportResult(List.of(new ImportRecord(0, "", "failed", "导入失败: " + e.getMessage())))
                );
            }
        }, 10); // 用户导入可能耗时较长，增加重试次数
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String studentId = auth.getName();
        Optional<User> userOpt = userRepository.findByStudentId(studentId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = userOpt.get();
        Map<String, Object> body = new HashMap<>();
        body.put("studentId", user.getStudentId());
        body.put("roles", user.getRoles());
        // primary role (任意一个)
        body.put("role", user.getRoles().stream().findFirst().orElse(null));
        body.put("name", user.getName());
        body.put("department", user.getDepartment());
        body.put("major", user.getMajor());
        body.put("gpa", user.getGpa());
        body.put("academicRank", user.getAcademicRank());
        body.put("majorTotal", user.getMajorTotal());
        body.put("convertedScore", user.getConvertedScore());
        return ResponseEntity.ok(body);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @GetMapping("")
    public ResponseEntity<List<Map<String,Object>>> listUsers() {
        List<Map<String,Object>> list = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            Map<String,Object> m = new HashMap<>();
            m.put("studentId", u.getStudentId());
            m.put("name", u.getName());
            m.put("department", u.getDepartment());
            m.put("major", u.getMajor());
            m.put("gpa", u.getGpa());
            m.put("academicRank", u.getAcademicRank());
            m.put("majorTotal", u.getMajorTotal());
            m.put("convertedScore", u.getConvertedScore());
            m.put("roles", u.getRoles());
            m.put("role", u.getRoles().stream().findFirst().orElse(null));
            list.add(m);
        }
        log.debug("[USER][LIST] size={}", list.size());
        return ResponseEntity.ok(list);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest req) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            log.info("[USER][CREATE] studentId={} role={}", req.getStudentId(), req.getRole());

            if (req.getStudentId()==null || req.getStudentId().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error","学号不能为空"));
            }
            if (req.getPassword()==null || req.getPassword().length()<4) {
                return ResponseEntity.badRequest().body(Map.of("error","密码至少4位"));
            }

            Role role;
            try {
                role = Role.valueOf(req.getRole().toUpperCase());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error","角色无效"));
            }

            if (role==Role.STUDENT) {
                if (req.getName()==null || req.getName().isBlank() ||
                    req.getDepartment()==null || req.getDepartment().isBlank() ||
                    req.getMajor()==null || req.getMajor().isBlank()) {
                    return ResponseEntity.badRequest().body(Map.of("error","学生必须填写姓名/学院/专业"));
                }
            }

            User u = new User();
            u.setStudentId(req.getStudentId());
            u.setPassword(req.getPassword()); // UserService会处理加密
            u.setRole(role);
            u.setName(req.getName());
            u.setDepartment(req.getDepartment());
            u.setMajor(req.getMajor());

            // 使用UserService而不是直接操作repository
            User savedUser = userService.createUser(u);

            log.info("[USER][CREATE] success studentId={} role={}", savedUser.getStudentId(), role);
            Map<String,Object> resp = new HashMap<>();
            resp.put("studentId", savedUser.getStudentId());
            resp.put("name", savedUser.getName());
            resp.put("department", savedUser.getDepartment());
            resp.put("major", savedUser.getMajor());
            resp.put("gpa", savedUser.getGpa());
            resp.put("academicRank", savedUser.getAcademicRank());
            resp.put("majorTotal", savedUser.getMajorTotal());
            resp.put("convertedScore", savedUser.getConvertedScore());
            resp.put("roles", savedUser.getRoles());
            resp.put("role", role);
            return ResponseEntity.ok(resp);

        } catch (IllegalArgumentException e) {
            log.warn("[USER][CREATE] validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[USER][CREATE] unexpected error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "创建用户失败: " + e.getMessage()));
        }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @DeleteMapping("/{studentId}")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> deleteUser(@PathVariable String studentId) {
        String lockKey = "user:delete:" + studentId;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            log.warn("[USER][DELETE] attempt studentId={}", studentId);
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName().equals(studentId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能删除当前登录用户"));
            }
            return userRepository.findByStudentId(studentId)
                    .map(u -> {
                        userRepository.delete(u);
                        log.warn("[USER][DELETE] success studentId={}", studentId);
                        return ResponseEntity.ok(Map.of("message", "删除成功"));
                    })
                    .orElseGet(() -> {
                        log.warn("[USER][DELETE] not_found studentId={}", studentId);
                        return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
                    });
        }, 3);
    }

    // 修改密码（所有已登录用户）
    @PostMapping("/change-password")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String studentId = auth.getName();
        String lockKey = "user:changePassword:" + studentId;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            Optional<User> opt = userRepository.findByStudentId(studentId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error","用户不存在"));
            User user = opt.get();
            if (req.getOldPassword()==null || req.getNewPassword()==null) {
                return ResponseEntity.badRequest().body(Map.of("error","参数缺失"));
            }
            if (!passwordEncoder.matches(req.getOldPassword(), user.getPassword())) {
                return ResponseEntity.badRequest().body(Map.of("error","原密码不正确"));
            }
            if (req.getNewPassword().length()<4) {
                return ResponseEntity.badRequest().body(Map.of("error","新密码至少4位"));
            }
            user.setPassword(passwordEncoder.encode(req.getNewPassword()));
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("message","密码修改成功"));
        }, 3);
    }

    // 管理员重置任意用户密码
    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{studentId}/reset-password")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> resetPassword(@PathVariable String studentId, @RequestBody ResetPasswordRequest req) {
        String lockKey = "user:resetPassword:" + studentId;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            if (req.getNewPassword()==null || req.getNewPassword().length()<4) {
                return ResponseEntity.badRequest().body(Map.of("error","新密码至少4位"));
            }
            return userRepository.findByStudentId(studentId).map(u -> {
                u.setPassword(passwordEncoder.encode(req.getNewPassword()));
                userRepository.save(u);
                return ResponseEntity.ok(Map.of("message","密码已重置"));
            }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error","用户不存在")));
        }, 3);
    }

    // 管理员更新单个用户学业信息（行内编辑）
    @PreAuthorize("hasAuthority('ADMIN')")
    @PatchMapping("/{studentId}/academic")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> updateAcademic(@PathVariable String studentId, @RequestBody AcademicUpdateRequest req) {
        String lockKey = "user:academic:update:" + studentId;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            return userRepository.findByStudentId(studentId).map(u -> {
                int updates=0; List<String> ignored=new ArrayList<>();
                if (req.getName()!=null && !req.getName().isBlank() && !req.getName().equals(u.getName())) { u.setName(req.getName().trim()); updates++; }
                if (req.getDepartment()!=null && !req.getDepartment().isBlank() && !req.getDepartment().equals(u.getDepartment())) { u.setDepartment(req.getDepartment().trim()); updates++; }
                if (req.getMajor()!=null && !req.getMajor().isBlank() && !req.getMajor().equals(u.getMajor())) { u.setMajor(req.getMajor().trim()); updates++; }
                if (req.getGpa()!=null) { double g=req.getGpa(); if (g>=0 && g<=4) { u.setGpa(g); updates++; } else ignored.add("GPA"); }
                if (req.getAcademicRank()!=null) { int r=req.getAcademicRank(); if (r>0) { u.setAcademicRank(r); updates++; } else ignored.add("学业排名"); }
                if (req.getMajorTotal()!=null) { int t=req.getMajorTotal(); if (t>0) { u.setMajorTotal(t); updates++; } else ignored.add("专业总人数"); }
                if (req.getConvertedScore()!=null) { double c=req.getConvertedScore(); if (c>=0 && c<=100) { u.setConvertedScore(c); updates++; } else ignored.add("换算后成绩"); }
                userRepository.save(u);
                Map<String,Object> body = new HashMap<>();
                body.put("studentId", u.getStudentId());
                body.put("updates", updates);
                body.put("ignored", ignored);
                body.put("gpa", u.getGpa());
                body.put("academicRank", u.getAcademicRank());
                body.put("majorTotal", u.getMajorTotal());
                body.put("convertedScore", u.getConvertedScore());
                body.put("name", u.getName());
                body.put("department", u.getDepartment());
                body.put("major", u.getMajor());
                return ResponseEntity.ok(body);
            }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error","用户不存在")));
        }, 5);
    }

    // 学生自助更新学业信息
    @PatchMapping("/me/academic")
    @CacheEvict(value = "users", allEntries = true)
    public ResponseEntity<?> selfUpdateAcademic(@RequestBody AcademicUpdateRequest req){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String studentId = auth.getName();
        String lockKey = "user:academic:selfUpdate:" + studentId;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            Optional<User> opt = userRepository.findByStudentId(studentId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error","用户不存在"));
            User u = opt.get();
            int updates=0; List<String> ignored = new ArrayList<>();
            if (req.getName()!=null && !req.getName().isBlank() && !req.getName().equals(u.getName())) { u.setName(req.getName().trim()); updates++; }
            if (req.getDepartment()!=null && !req.getDepartment().isBlank() && !req.getDepartment().equals(u.getDepartment())) { u.setDepartment(req.getDepartment().trim()); updates++; }
            if (req.getMajor()!=null && !req.getMajor().isBlank() && !req.getMajor().equals(u.getMajor())) { u.setMajor(req.getMajor().trim()); updates++; }
            if (req.getGpa()!=null) { double g=req.getGpa(); if (g>=0 && g<=4) { if(!Objects.equals(u.getGpa(), g)){ u.setGpa(g); updates++; } } else ignored.add("gpa范围"); }
            if (req.getAcademicRank()!=null) { int r=req.getAcademicRank(); if (r>0) { if(!Objects.equals(u.getAcademicRank(), r)){ u.setAcademicRank(r); updates++; } } else ignored.add("学业排名范围"); }
            if (req.getMajorTotal()!=null) { int t=req.getMajorTotal(); if (t>0) { if(!Objects.equals(u.getMajorTotal(), t)){ u.setMajorTotal(t); updates++; } } else ignored.add("专业总人数范围"); }
            if (req.getConvertedScore()!=null) { double c=req.getConvertedScore(); if (c>=0 && c<=100) { if(!Objects.equals(u.getConvertedScore(), c)){ u.setConvertedScore(c); updates++; } } else ignored.add("换算后成绩范围"); }
            userRepository.save(u);
            Map<String,Object> body = new HashMap<>();
            body.put("updates", updates);
            body.put("ignored", ignored);
            body.put("studentId", u.getStudentId());
            body.put("gpa", u.getGpa());
            body.put("academicRank", u.getAcademicRank());
            body.put("majorTotal", u.getMajorTotal());
            body.put("convertedScore", u.getConvertedScore());
            body.put("name", u.getName());
            body.put("department", u.getDepartment());
            body.put("major", u.getMajor());
            return ResponseEntity.ok(body);
        }, 5);
    }

    // 导出全部用户（含学业）CSV
    @PreAuthorize("hasAuthority('ADMIN')")
    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> exportUsers() {
        StringBuilder sb = new StringBuilder();
        sb.append("学号,姓名,学院,专业,GPA,学业排名,专业总人数,角色\n");
        for (User u: userRepository.findAll()) {
            String role = u.getRoles().stream().findFirst().map(Enum::name).orElse("");
            sb.append(safe(u.getStudentId())).append(',')
              .append(safe(u.getName())).append(',')
              .append(safe(u.getDepartment())).append(',')
              .append(safe(u.getMajor())).append(',')
              .append(u.getGpa()==null?"":u.getGpa()).append(',')
              .append(u.getAcademicRank()==null?"":u.getAcademicRank()).append(',')
              .append(u.getMajorTotal()==null?"":u.getMajorTotal()).append(',')
              .append(role).append('\n');
        }
        byte[] data = ("\uFEFF"+sb.toString()).getBytes();
        ByteArrayResource res = new ByteArrayResource(data);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=users_export.csv")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(data.length)
                .body(res);
    }

    private String safe(String s) { return s==null?"":s.replace("\n"," ").replace(","," "); }

    // 导入历史
    @PreAuthorize("hasAuthority('ADMIN')")
    @GetMapping("/import-history")
    public ResponseEntity<List<Map<String,Object>>> importHistory() {
        List<Map<String,Object>> list = new ArrayList<>();
        for (ImportHistory h : importHistoryRepository.findTop50ByOrderByCreatedAtDesc()) {
            Map<String,Object> m = new HashMap<>();
            m.put("id", h.getId());
            m.put("filename", h.getFilename());
            m.put("mode", h.getMode());
            m.put("totalRecords", h.getTotalRecords());
            m.put("success", h.getSuccess());
            m.put("failed", h.getFailed());
            m.put("warnings", h.getWarnings());
            m.put("createdAt", h.getCreatedAt());
            list.add(m);
        }
        return ResponseEntity.ok(list);
    }
}

package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.FileMetadata;
import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.service.FileService;
import com.xuqinyang.xmudemo.service.MessageQueueService;
import com.xuqinyang.xmudemo.service.PerformanceMonitorService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileService fileService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private MessageQueueService messageQueueService;
    @Autowired
    private PerformanceMonitorService performanceMonitorService;

    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    private User currentUser(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByStudentId(auth.getName()).orElseThrow();
    }

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, HttpServletRequest request){
        long startTime = System.currentTimeMillis();
        String clientIp = getClientIp(request);
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();

        try {
            FileMetadata meta = fileService.store(file);

            // 异步处理文件上传事件
            messageQueueService.sendFileProcessMessage(
                meta.getOriginalFilename(),
                meta.getStoredFilename(), // 修复：使用getStoredFilename()而不是getStoragePath()
                "UPLOAD"
            );

            // 发送审计日志
            messageQueueService.sendAuditLogMessage(
                userId,
                "FILE_UPLOAD",
                "FILE",
                String.format("File uploaded: %s (%d bytes) from IP: %s",
                    meta.getOriginalFilename(), meta.getSize(), clientIp)
            );

            // 发送数据统计
            messageQueueService.sendDataStatisticsMessage(
                "FILE",
                "UPLOAD",
                Map.of(
                    "fileId", meta.getId(),
                    "filename", meta.getOriginalFilename(),
                    "size", meta.getSize(),
                    "contentType", meta.getContentType(),
                    "userId", userId,
                    "ip", clientIp
                )
            );

            // 触发文件病毒扫描
            messageQueueService.sendFileProcessMessage(
                meta.getOriginalFilename(),
                meta.getStoredFilename(), // 修复：使用getStoredFilename()而不是getStoragePath()
                "VIRUS_SCAN"
            );

            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/files/upload", 200, duration);

            log.info("[FILE_UPLOAD] Success fileId={}, filename={}, size={}, userId={}, duration={}ms",
                meta.getId(), meta.getOriginalFilename(), meta.getSize(), userId, duration);

            return ResponseEntity.ok(Map.of(
                    "id", meta.getId(),
                    "originalFilename", meta.getOriginalFilename(),
                    "size", meta.getSize(),
                    "contentType", meta.getContentType(),
                    "uploadedAt", meta.getUploadedAt()
            ));
        } catch (IllegalArgumentException e){
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/files/upload", 400, duration);

            log.warn("[FILE_UPLOAD] Invalid file from userId={}, duration={}ms: {}", userId, duration, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e){
            long duration = System.currentTimeMillis() - startTime;
            performanceMonitorService.recordRequest("POST", "/api/files/upload", 500, duration);

            log.error("[FILE_UPLOAD] Error from userId={}, duration={}ms", userId, duration, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> download(@PathVariable Long id){
        return fileService.find(id).map(meta -> {
            try {
                byte[] data = fileService.read(meta);
                String filename = meta.getOriginalFilename()==null?"file": meta.getOriginalFilename();
                String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+","%20");
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''"+encoded)
                        .contentType(MediaType.parseMediaType(meta.getContentType()==null?"application/octet-stream":meta.getContentType()))
                        .contentLength(data.length)
                        .body(new ByteArrayResource(data));
            } catch (IOException e){
                return ResponseEntity.internalServerError().body(Map.of("error","读取文件失败"));
            }
        }).orElse(ResponseEntity.status(404).body(Map.of("error","文件不存在")));
    }

    // Inline preview endpoint (e.g., images / pdf in browser)
    @GetMapping("/{id}/raw")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> raw(@PathVariable Long id){
        return fileService.find(id).map(meta -> {
            try {
                byte[] data = fileService.read(meta);
                String filename = meta.getOriginalFilename() == null ? "file" : meta.getOriginalFilename();
                // 清理潜在的无效字符 (换行、引号等)
                filename = filename.replaceAll("[\r\n]", " ").replace("\"", "'");
                String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+","%20");
                String asciiFallback = filename.chars().allMatch(c -> c <= 127 && c > 31) ? filename : "file";
                String contentDisposition = "inline; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                        .contentType(MediaType.parseMediaType(meta.getContentType()==null?"application/octet-stream":meta.getContentType()))
                        .contentLength(data.length)
                        .body(new ByteArrayResource(data));
            } catch (IOException e){
                return ResponseEntity.internalServerError().body(Map.of("error","读取文件失败"));
            }
        }).orElse(ResponseEntity.status(404).body(Map.of("error","文件不存在")));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> delete(@PathVariable Long id){
        User me = currentUser();
        return fileService.find(id).map(meta -> {
            boolean isAdmin = me.getRoles().contains(Role.ADMIN);
            if (!isAdmin && !meta.getOwner().getId().equals(me.getId())) {
                return ResponseEntity.status(403).body(Map.of("error","无权删除该文件"));
            }
            try {
                fileService.delete(id); // 修复：传递ID而不是FileMetadata对象
                return ResponseEntity.ok(Map.of("message","已删除"));
            } catch (Exception e){
                return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
            }
        }).orElse(ResponseEntity.status(404).body(Map.of("error","文件不存在")));
    }

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
}

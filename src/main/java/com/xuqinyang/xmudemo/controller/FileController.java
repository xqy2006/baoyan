package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.FileMetadata;
import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.service.FileService;
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

    private User currentUser(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByStudentId(auth.getName()).orElseThrow();
    }

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file){
        try {
            FileMetadata meta = fileService.store(file);
            return ResponseEntity.ok(Map.of(
                    "id", meta.getId(),
                    "originalFilename", meta.getOriginalFilename(),
                    "size", meta.getSize(),
                    "contentType", meta.getContentType(),
                    "uploadedAt", meta.getUploadedAt()
            ));
        } catch (IllegalArgumentException e){
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e){
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
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\""+meta.getOriginalFilename()+"\"")
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
                fileService.delete(meta);
                return ResponseEntity.ok(Map.of("message","已删除"));
            } catch (Exception e){
                return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
            }
        }).orElse(ResponseEntity.status(404).body(Map.of("error","文件不存在")));
    }
}

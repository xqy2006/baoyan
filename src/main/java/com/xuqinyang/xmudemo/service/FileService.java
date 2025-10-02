package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.FileMetadata;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.FileMetadataRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;

@Service
public class FileService {

    private final FileMetadataRepository fileRepo;
    private final UserRepository userRepository;
    private final Path baseDir;

    @Autowired
    private DistributedLockService distributedLockService;

    public FileService(FileMetadataRepository fileRepo,
                       UserRepository userRepository,
                       @Value("${app.upload-dir:uploads}") String uploadDir) throws IOException {
        this.fileRepo = fileRepo;
        this.userRepository = userRepository;
        this.baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.baseDir);
    }

    @Transactional
    public FileMetadata store(MultipartFile file) throws IOException {
        // 使用文件名、大小作为锁键，确保相同用户上传相同文件的并发请求被串行化
        // 这样可以避免重复上传相同文件的问题
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        long fileSize = file.getSize();
        String lockKey = "file:upload:" + ":" + fileName + ":" + fileSize;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            if (file.isEmpty()) throw new IllegalArgumentException("文件为空");

            String original = file.getOriginalFilename();
            String ext = "";
            if (original != null && original.contains(".")) {
                ext = original.substring(original.lastIndexOf('.'));
            }

            String stored = UUID.randomUUID().toString().replace("-", "") + ext;
            Path target = baseDir.resolve(stored);

            try {
                Files.copy(file.getInputStream(), target);
            } catch (IOException e) {
                throw new RuntimeException("文件存储失败", e);
            }

            FileMetadata meta = new FileMetadata();
            meta.setOriginalFilename(original);
            meta.setStoredFilename(stored);
            meta.setContentType(file.getContentType());
            meta.setSize(file.getSize());
            meta.setOwner(currentUser());

            return fileRepo.save(meta);
        }, 5);
    }

    public Optional<FileMetadata> find(Long id) {
        return fileRepo.findById(id);
    }

    public byte[] read(FileMetadata meta) throws IOException {
        Path path = baseDir.resolve(meta.getStoredFilename());
        if (!Files.exists(path)) {
            throw new IOException("文件不存在: " + meta.getStoredFilename());
        }
        return Files.readAllBytes(path);
    }

    @Transactional
    public void delete(Long id) {
        distributedLockService.executeWithLockAndRetry("file:delete:" + id, () -> {
            Optional<FileMetadata> opt = fileRepo.findById(id);
            if (opt.isEmpty()) {
                throw new IllegalArgumentException("文件不存在");
            }

            FileMetadata meta = opt.get();
            User current = currentUser();

            // 检查权限：只有文件所有者或管理员可以删除
            if (!meta.getOwner().getId().equals(current.getId()) &&
                !current.getRole().name().equals("ADMIN")) {
                throw new SecurityException("无权删除此文件");
            }

            try {
                // 删除物理文件
                Path path = baseDir.resolve(meta.getStoredFilename());
                if (Files.exists(path)) {
                    Files.delete(path);
                }
            } catch (IOException e) {
                // 记录日志但不抛出异常，继续删除数据库记录
                System.err.println("删除物理文件失败: " + e.getMessage());
            }

            // 删除数据库记录
            fileRepo.delete(meta);

            return null;
        }, 3);
    }

    @Transactional
    public FileMetadata updateMetadata(Long id, String newOriginalName) {
        return distributedLockService.executeWithLockAndRetry("file:update:" + id, () -> {
            FileMetadata meta = fileRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("文件不存在"));

            User current = currentUser();

            // 检查权限
            if (!meta.getOwner().getId().equals(current.getId()) &&
                !current.getRole().name().equals("ADMIN")) {
                throw new SecurityException("无权修改此文件");
            }

            meta.setOriginalFilename(newOriginalName);
            return fileRepo.save(meta);
        }, 3);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new SecurityException("未认证用户");
        }

        String studentId = auth.getName();
        return userRepository.findByStudentId(studentId)
            .orElseThrow(() -> new SecurityException("用户不存在: " + studentId));
    }
}

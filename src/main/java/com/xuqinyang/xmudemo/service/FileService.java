package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.FileMetadata;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.FileMetadataRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
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

    public FileService(FileMetadataRepository fileRepo,
                       UserRepository userRepository,
                       @Value("${app.upload-dir:uploads}") String uploadDir) throws IOException {
        this.fileRepo = fileRepo;
        this.userRepository = userRepository;
        this.baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.baseDir);
    }

    public FileMetadata store(MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("文件为空");
        String original = file.getOriginalFilename();
        String ext = "";
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf('.'));
        }
        String stored = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = baseDir.resolve(stored);
        Files.copy(file.getInputStream(), target);
        FileMetadata meta = new FileMetadata();
        meta.setOriginalFilename(original);
        meta.setStoredFilename(stored);
        meta.setContentType(file.getContentType());
        meta.setSize(file.getSize());
        meta.setOwner(currentUser());
        return fileRepo.save(meta);
    }

    public Optional<FileMetadata> find(Long id){ return fileRepo.findById(id); }

    public byte[] read(FileMetadata meta) throws IOException {
        Path p = baseDir.resolve(meta.getStoredFilename());
        return Files.readAllBytes(p);
    }

    public void delete(FileMetadata meta) throws IOException {
        Path p = baseDir.resolve(meta.getStoredFilename());
        try { Files.deleteIfExists(p); } catch (Exception ignored) {}
        fileRepo.delete(meta);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String sid = auth.getName();
        return userRepository.findByStudentId(sid).orElseThrow();
    }
}


package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.FileMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {
}


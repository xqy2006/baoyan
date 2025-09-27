package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.ImportHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImportHistoryRepository extends JpaRepository<ImportHistory, Long> {
    List<ImportHistory> findTop50ByOrderByCreatedAtDesc();
}


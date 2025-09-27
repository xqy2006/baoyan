package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.ApplicationDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ApplicationDraftRepository extends JpaRepository<ApplicationDraft, Long> {
    Optional<ApplicationDraft> findByUser_IdAndActivity_Id(Long userId, Long activityId);
    boolean existsByUser_IdAndActivity_Id(Long userId, Long activityId);
}


package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {
    List<Application> findByUser_Id(Long userId);
    List<Application> findByStatusIn(List<ApplicationStatus> statuses);
    long countByStatus(ApplicationStatus status);
    Optional<Application> findByUser_IdAndActivity_Id(Long userId, Long activityId);
    boolean existsByUser_IdAndActivity_Id(Long userId, Long activityId);
}

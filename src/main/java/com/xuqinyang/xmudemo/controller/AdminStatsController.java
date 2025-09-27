package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('ADMIN')")
public class AdminStatsController {

    @Autowired
    private ApplicationRepository applicationRepository;

    @GetMapping("/stats")
    public Map<String,Object> stats(){
        List<Application> all = applicationRepository.findAll();
        long total = all.size();
        long systemReviewing = all.stream().filter(a-> a.getStatus()== ApplicationStatus.SYSTEM_REVIEWING).count();
        long systemApproved = all.stream().filter(a-> a.getStatus()== ApplicationStatus.SYSTEM_APPROVED).count();
        long systemRejected = all.stream().filter(a-> a.getStatus()== ApplicationStatus.SYSTEM_REJECTED).count();
        long adminReviewing = all.stream().filter(a-> a.getStatus()== ApplicationStatus.ADMIN_REVIEWING).count();
        long finalApproved = all.stream().filter(a-> a.getStatus()== ApplicationStatus.APPROVED).count();
        long finalRejected = all.stream().filter(a-> a.getStatus()== ApplicationStatus.REJECTED).count();
        // 简单平均审核时长(系统审核到最终状态) 仅做演示
        List<Long> durations = all.stream()
                .filter(a-> a.getAdminReviewedAt()!=null && a.getSystemReviewedAt()!=null)
                .map(a-> Duration.between(a.getSystemReviewedAt(), a.getAdminReviewedAt()).toMinutes())
                .collect(Collectors.toList());
        double avgMinutes = durations.isEmpty()? 0: durations.stream().mapToLong(Long::longValue).average().orElse(0);
        return Map.of(
                "totalApplications", total,
                "pendingSystemReview", systemReviewing,
                "systemApproved", systemApproved,
                "systemRejected", systemRejected,
                "pendingAdminReview", adminReviewing,
                "finalApproved", finalApproved,
                "finalRejected", finalRejected,
                "averageAdminReviewMinutes", avgMinutes
        );
    }

    @GetMapping("/department-stats")
    public List<Map<String,Object>> departmentStats(){
        List<Application> all = applicationRepository.findAll();
        Map<String, List<Application>> byDept = all.stream().collect(Collectors.groupingBy(a-> Optional.ofNullable(a.getActivity()).map(ac->ac.getDepartment()).orElse("未知")));
        List<Map<String,Object>> list = new ArrayList<>();
        byDept.forEach((dept, apps)->{
            long approved = apps.stream().filter(a-> a.getStatus()== ApplicationStatus.APPROVED).count();
            list.add(Map.of(
                    "department", dept,
                    "total", apps.size(),
                    "approved", approved
            ));
        });
        return list;
    }
}

package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('ADMIN')")
public class AdminStatsController {

    @Autowired
    private ApplicationRepository applicationRepository;

    @GetMapping("/stats")
    public Map<String,Object> stats(){
        // 优化：使用数据库聚合查询，避免加载所有数据到内存
        long total = applicationRepository.countAllApplications();

        // 获取各状态的统计
        List<Object[]> statusCounts = applicationRepository.countByStatusGrouped();
        Map<ApplicationStatus, Long> statusMap = new HashMap<>();
        for (Object[] row : statusCounts) {
            ApplicationStatus status = (ApplicationStatus) row[0];
            Long count = (Long) row[1];
            statusMap.put(status, count);
        }

        // 获取平均审核时长
        Double avgMinutes = applicationRepository.getAverageAdminReviewMinutes();

        return Map.of(
                "totalApplications", total,
                "pendingSystemReview", statusMap.getOrDefault(ApplicationStatus.SYSTEM_REVIEWING, 0L),
                "systemApproved", statusMap.getOrDefault(ApplicationStatus.SYSTEM_APPROVED, 0L),
                "systemRejected", statusMap.getOrDefault(ApplicationStatus.SYSTEM_REJECTED, 0L),
                "pendingAdminReview", statusMap.getOrDefault(ApplicationStatus.ADMIN_REVIEWING, 0L),
                "finalApproved", statusMap.getOrDefault(ApplicationStatus.APPROVED, 0L),
                "finalRejected", statusMap.getOrDefault(ApplicationStatus.REJECTED, 0L),
                "averageAdminReviewMinutes", avgMinutes != null ? avgMinutes : 0.0
        );
    }

    @GetMapping("/department-stats")
    public List<Map<String,Object>> departmentStats(){
        // 优化：使用数据库聚合查询
        List<Object[]> deptStats = applicationRepository.getDepartmentStatistics();
        List<Map<String,Object>> list = new ArrayList<>();

        for (Object[] row : deptStats) {
            String department = (String) row[0];
            Long total = (Long) row[1];
            Long approved = (Long) row[2];

            list.add(Map.of(
                    "department", department != null ? department : "未知",
                    "total", total,
                    "approved", approved
            ));
        }

        return list;
    }
}

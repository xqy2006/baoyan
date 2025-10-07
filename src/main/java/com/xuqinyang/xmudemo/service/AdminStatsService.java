package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class AdminStatsService {
    @Autowired
    private ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)
    public Map<String,Object> overall(){
        // 优化：使用数据库聚合查询，避免加载所有数据到内存
        long total = applicationRepository.countAllApplications();

        // 获取各状态的统计
        List<Object[]> statusCounts = applicationRepository.countByStatusGrouped();
        Map<ApplicationStatus, Long> byStatus = new EnumMap<>(ApplicationStatus.class);
        for (ApplicationStatus s: ApplicationStatus.values()) {
            byStatus.put(s, 0L);
        }
        for (Object[] row : statusCounts) {
            ApplicationStatus status = (ApplicationStatus) row[0];
            Long count = (Long) row[1];
            byStatus.put(status, count);
        }

        // 获取今日申请数量
        long todayCount = applicationRepository.countTodayApplications();

        Map<String,Object> m = new HashMap<>();
        m.put("totalApplications", total);
        m.put("pendingSystemReview", byStatus.get(ApplicationStatus.SYSTEM_REVIEWING));
        m.put("systemApproved", byStatus.get(ApplicationStatus.SYSTEM_APPROVED));
        m.put("systemRejected", byStatus.get(ApplicationStatus.SYSTEM_REJECTED));
        m.put("pendingAdminReview", byStatus.get(ApplicationStatus.ADMIN_REVIEWING));
        m.put("finalApproved", byStatus.get(ApplicationStatus.APPROVED));
        m.put("finalRejected", byStatus.get(ApplicationStatus.REJECTED));
        m.put("todayApplications", todayCount);
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> departmentStats(){
        // 优化：使用数据库聚合查询
        List<Object[]> deptStats = applicationRepository.getDepartmentStatistics();
        List<Map<String,Object>> result = new ArrayList<>();

        for (Object[] row : deptStats) {
            String department = (String) row[0];
            Long total = (Long) row[1];
            Long approved = (Long) row[2];

            Map<String,Object> m = new HashMap<>();
            m.put("department", department != null && !department.isBlank() ? department : "未填写");
            m.put("total", total);
            m.put("approved", approved);
            result.add(m);
        }

        return result;
    }
}

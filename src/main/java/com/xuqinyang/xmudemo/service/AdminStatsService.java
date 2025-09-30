package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminStatsService {
    @Autowired
    private ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)  // 添加事务支持
    public Map<String,Object> overall(){
        List<Application> all = applicationRepository.findAll();
        Map<ApplicationStatus, Long> byStatus = new EnumMap<>(ApplicationStatus.class);
        for (ApplicationStatus s: ApplicationStatus.values()) byStatus.put(s,0L);
        for (Application a: all){
            byStatus.computeIfPresent(a.getStatus(), (k,v)-> v+1);
        }
        long total = all.size();
        LocalDate today = LocalDate.now();
        long todayCount = all.stream().filter(a -> a.getSubmittedAt()!=null && a.getSubmittedAt().toLocalDate().equals(today)).count();
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

    @Transactional(readOnly = true)  // 添加事务支持
    public List<Map<String,Object>> departmentStats(){
        List<Application> all = null;

        // 首先尝试使用预加载查询
        try {
            all = applicationRepository.findAllWithUserAndActivity();
        } catch (Exception e) {
            System.err.println("Warning: Failed to use eager loading query, falling back to regular query: " + e.getMessage());
            // 降级处理：使用普通查询但确保在事务内
            all = applicationRepository.findAll();
        }

        Map<String, Map<String,Object>> agg = new LinkedHashMap<>();
        for (Application a: all){
            String dept = null;

            try {
                // 安全地访问懒加载关系
                if (a.getActivity() != null) {
                    dept = a.getActivity().getDepartment();
                }
                if ((dept == null || dept.isBlank()) && a.getUser() != null) {
                    dept = a.getUser().getDepartment();
                }
            } catch (Exception e) {
                // 如果懒加载失败，记录警告并使用默认值
                System.err.println("Warning: Failed to load department info for application " + a.getId() + ": " + e.getMessage());
                dept = "数据加载异常";
            }

            if (dept == null || dept.isBlank()) dept = "未填写";
            Map<String,Object> row = agg.computeIfAbsent(dept, k -> {
                Map<String,Object> r = new HashMap<>();
                r.put("department", k);
                r.put("total", 0L);
                r.put("approved", 0L);
                return r;
            });
            row.put("total", (Long)row.get("total") + 1L);
            if (a.getStatus()==ApplicationStatus.APPROVED) {
                row.put("approved", (Long)row.get("approved") + 1L);
            }
        }
        return new ArrayList<>(agg.values());
    }
}

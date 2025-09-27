package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminStatsService {
    @Autowired
    private ApplicationRepository applicationRepository;

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

    public List<Map<String,Object>> departmentStats(){
        List<Application> all = applicationRepository.findAll();
        Map<String, Map<String,Object>> agg = new LinkedHashMap<>();
        for (Application a: all){
            String dept = a.getActivity()!=null? a.getActivity().getDepartment(): (a.getUser()!=null? a.getUser().getDepartment():"未填写");
            if (dept==null || dept.isBlank()) dept = "未填写";
            Map<String,Object> row = agg.computeIfAbsent(dept, k -> { Map<String,Object> r = new HashMap<>(); r.put("department", k); r.put("total", 0L); r.put("approved", 0L); return r;});
            row.put("total", (Long)row.get("total") + 1L);
            if (a.getStatus()==ApplicationStatus.APPROVED) {
                row.put("approved", (Long)row.get("approved") + 1L);
            }
        }
        return new ArrayList<>(agg.values());
    }
}


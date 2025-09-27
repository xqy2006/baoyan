package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.service.ApplicationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    @Autowired
    private ApplicationService applicationService;

    @GetMapping
    public List<Application> getAllApplications() {
        return applicationService.getAllApplications();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Application> getApplicationById(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isStudent = auth.getAuthorities().stream().anyMatch(a-> a.getAuthority().equals("STUDENT"));
        var opt = applicationService.getApplicationById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Application a = opt.get();
        if (isStudent) {
            String sid = auth.getName();
            if (!sid.equals(a.getUserStudentId())) return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(a);
    }

    @GetMapping("/user/{userId}")
    public List<Application> getApplicationsByUserId(@PathVariable Long userId) {
        return applicationService.getApplicationsByUserId(userId);
    }

    @PostMapping
    public Application createApplication(@RequestBody Application application) {
        return applicationService.createApplication(application);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Application> updateApplication(@PathVariable Long id, @RequestBody Application applicationDetails) {
        return applicationService.getApplicationById(id)
                .map(application -> {
                    application.setContent(applicationDetails.getContent());
                    application.setStatus(applicationDetails.getStatus());
                    application.setLastUpdateDate(java.time.LocalDateTime.now());
                    return ResponseEntity.ok(applicationService.updateApplication(application));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('STUDENT','ADMIN')")
    public ResponseEntity<?> deleteApplication(@PathVariable Long id) {
        try { applicationService.deleteOwnedOrAdmin(id); return ResponseEntity.noContent().build(); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAnyAuthority('STUDENT','ADMIN')")
    @PostMapping("/draft")
    public ResponseEntity<?> createDraft(@RequestParam Long activityId, @RequestBody(required = false) String content){
        return ResponseEntity.ok(applicationService.createDraft(activityId, content==null?"{}":content));
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @GetMapping("/mine")
    public ResponseEntity<?> myApplications(){
        return ResponseEntity.ok(applicationService.listMine());
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @PutMapping("/{id}/draft")
    public ResponseEntity<?> updateDraft(@PathVariable Long id, @RequestBody String content){
        try { return ResponseEntity.ok(applicationService.updateDraft(id, content)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.submit(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/system-review")
    public ResponseEntity<?> systemReview(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.systemReview(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/admin-start")
    public ResponseEntity<?> startAdminReview(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.startAdminReview(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    public record AdminDecision(boolean approve, String comment){}

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/admin-review")
    public ResponseEntity<?> adminReview(@PathVariable Long id, @RequestBody AdminDecision decision){
        try { return ResponseEntity.ok(applicationService.adminReview(id, decision.approve(), decision.comment())); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @GetMapping("/review-queue")
    public ResponseEntity<?> reviewQueue(){
        return ResponseEntity.ok(applicationService.reviewQueue());
    }

    @PreAuthorize("hasAuthority('STUDENT')")
    @GetMapping("/activity/{activityId}/mine")
    public ResponseEntity<?> myApplicationForActivity(@PathVariable Long activityId){
        return applicationService.findMineByActivity(activityId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body(Map.of("message","NOT_FOUND")));
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/special-talent/pass")
    public ResponseEntity<?> specialTalentPass(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.specialTalentPass(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/recalc")
    public ResponseEntity<?> recalc(@PathVariable Long id){
        try { return ResponseEntity.ok(applicationService.recalc(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @GetMapping("/summary")
    public Map<String,Object> summary(){
        var list = applicationService.getAllApplications();
        long draft = list.stream().filter(a-> a.getStatus()==ApplicationStatus.DRAFT).count();
        long sysRev = list.stream().filter(a-> a.getStatus()==ApplicationStatus.SYSTEM_REVIEWING).count();
        long sysAppr = list.stream().filter(a-> a.getStatus()==ApplicationStatus.SYSTEM_APPROVED).count();
        long sysRej = list.stream().filter(a-> a.getStatus()==ApplicationStatus.SYSTEM_REJECTED).count();
        long admRev = list.stream().filter(a-> a.getStatus()==ApplicationStatus.ADMIN_REVIEWING).count();
        long finalAppr = list.stream().filter(a-> a.getStatus()==ApplicationStatus.APPROVED).count();
        long finalRej = list.stream().filter(a-> a.getStatus()==ApplicationStatus.REJECTED).count();
        return Map.of(
                "draft", draft,
                "systemReviewing", sysRev,
                "systemApproved", sysAppr,
                "systemRejected", sysRej,
                "adminReviewing", admRev,
                "finalApproved", finalAppr,
                "finalRejected", finalRej
        );
    }
}

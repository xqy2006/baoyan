package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Activity;
import com.xuqinyang.xmudemo.service.ActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    @Autowired
    private ActivityService activityService;

    // Return only active activities for student-facing pages
    @GetMapping("/active")
    public List<Activity> active(){ return activityService.listActive(); }

    // New: return all activities including inactive ones (for admin or UI that needs full list)
    @GetMapping("/all")
    public List<Activity> allActivities(){ return activityService.listAll(); }

    @GetMapping
    public List<Activity> all(){ return activityService.listAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Activity> get(@PathVariable Long id){
        return activityService.find(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping
    public Activity create(@RequestBody Activity a){ return activityService.create(a); }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Activity data){
        try { return ResponseEntity.ok(activityService.update(id, data)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id){
        activityService.delete(id); return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long id){
        try { return ResponseEntity.ok(activityService.toggle(id)); }
        catch (Exception e){ return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }
}

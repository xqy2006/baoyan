package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationDraft;
import com.xuqinyang.xmudemo.service.DraftService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/drafts")
@PreAuthorize("hasAuthority('STUDENT')")
public class DraftController {

    @Autowired private DraftService draftService;

    @GetMapping("/{activityId}")
    public ResponseEntity<?> get(@PathVariable Long activityId){
        return draftService.get(activityId)
                .<ResponseEntity<?>>map(d -> ResponseEntity.ok(Map.of(
                        "id", d.getId(),
                        "activityId", d.getActivityId(),
                        "content", d.getContent(),
                        "updatedAt", d.getUpdatedAt()
                )))
                .orElse(ResponseEntity.status(404).body(Map.of("message","NO_DRAFT")));
    }

    @PutMapping("/{activityId}")
    public ResponseEntity<?> save(@PathVariable Long activityId, @RequestBody(required = false) String content){
        ApplicationDraft d = draftService.save(activityId, content==null?"{}":content);
        return ResponseEntity.ok(Map.of(
                "id", d.getId(),
                "activityId", d.getActivityId(),
                "content", d.getContent(),
                "updatedAt", d.getUpdatedAt()
        ));
    }

    @DeleteMapping("/{activityId}")
    public ResponseEntity<?> delete(@PathVariable Long activityId){
        draftService.delete(activityId); return ResponseEntity.noContent().build();
    }

    @PostMapping("/{activityId}/submit")
    public ResponseEntity<?> submit(@PathVariable Long activityId, @RequestBody(required = false) String content){
        try {
            Application app = draftService.submit(activityId, content==null?"{}":content);
            return ResponseEntity.ok(Map.of(
                    "id", app.getId(),
                    "activityId", app.getActivityId(),
                    "status", app.getStatus(),
                    "submittedAt", app.getSubmittedAt()
            ));
        } catch (Exception e){
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}


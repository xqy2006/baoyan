package com.xuqinyang.xmudemo.controller;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.service.DualReviewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 双审核员审核控制器
 */
@RestController
@RequestMapping("/api/applications")
public class DualReviewController {

    @Autowired
    private DualReviewService dualReviewService;

    /**
     * 第一审核员审核
     */
    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @PostMapping("/{id}/first-review")
    public ResponseEntity<?> firstReview(@PathVariable Long id, @RequestBody ReviewDecision decision) {
        try {
            Application app = dualReviewService.firstReview(id, decision.approve(), decision.comment());
            return ResponseEntity.ok(buildApplicationResponse(app));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 第二审核员审核
     */
    @PreAuthorize("hasAnyAuthority('ADMIN','REVIEWER')")
    @PostMapping("/{id}/second-review")
    public ResponseEntity<?> secondReview(@PathVariable Long id, @RequestBody ReviewDecision decision) {
        try {
            Application app = dualReviewService.secondReview(id, decision.approve(), decision.comment());
            return ResponseEntity.ok(buildApplicationResponse(app));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 构建申请响应对象
     */
    private Map<String, Object> buildApplicationResponse(Application app) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", app.getId());
        result.put("status", app.getStatus().name());
        result.put("firstReviewerName", app.getFirstReviewerName());
        result.put("firstReviewedAt", app.getFirstReviewedAt());
        result.put("firstReviewComment", app.getFirstReviewComment());
        result.put("secondReviewerName", app.getSecondReviewerName());
        result.put("secondReviewedAt", app.getSecondReviewedAt());
        result.put("secondReviewComment", app.getSecondReviewComment());
        return result;
    }

    /**
     * 审核决策请求体
     */
    public record ReviewDecision(boolean approve, String comment) {}
}


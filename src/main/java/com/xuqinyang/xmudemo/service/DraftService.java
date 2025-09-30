package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class DraftService {
    @Autowired private ApplicationDraftRepository draftRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private DistributedLockService distributedLockService;

    private User me(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByStudentId(auth.getName()).orElseThrow();
    }

    public Optional<ApplicationDraft> get(Long activityId){
        User u = me();
        return draftRepository.findByUser_IdAndActivity_Id(u.getId(), activityId);
    }

    @Transactional
    public ApplicationDraft save(Long activityId, String content){
        User u = me();
        return distributedLockService.executeWithLockAndRetry("draft:save:" + u.getId() + ":" + activityId, () -> {
            Activity act = activityRepository.findById(activityId).orElseThrow(()-> new IllegalArgumentException("活动不存在"));
            ApplicationDraft draft = draftRepository.findByUser_IdAndActivity_Id(u.getId(), activityId).orElseGet(ApplicationDraft::new);
            draft.setUser(u);
            draft.setActivity(act);
            draft.setContent(content==null?"{}":content);
            return draftRepository.save(draft);
        }, 5);
    }

    @Transactional
    public void delete(Long activityId){
        User u = me(); // ensure auth
        distributedLockService.executeWithLockAndRetry("draft:delete:" + u.getId() + ":" + activityId, () -> {
            draftRepository.findByUser_IdAndActivity_Id(u.getId(), activityId).ifPresent(draftRepository::delete);
            return null;
        }, 3);
    }

    @Transactional
    public Application submit(Long activityId, String content){
        User u = me();
        return distributedLockService.executeWithLockAndRetry("draft:submit:" + u.getId() + ":" + activityId, () -> {
            if (applicationRepository.existsByUser_IdAndActivity_Id(u.getId(), activityId)) {
                throw new IllegalStateException("已提交申请");
            }
            // ensure activity exists
            Activity act = activityRepository.findById(activityId).orElseThrow(()-> new IllegalArgumentException("活动不存在"));
            // persist draft first
            ApplicationDraft draft = save(activityId, content);
            // create application directly with SYSTEM_REVIEWING
            Application app = new Application();
            app.setUser(u);
            app.setActivity(act);
            app.setContent(draft.getContent());
            app.setStatus(ApplicationStatus.SYSTEM_REVIEWING);
            app.setSubmittedAt(LocalDateTime.now());
            applicationRepository.save(app);
            // delete draft after submit
            draftRepository.delete(draft);
            return app;
        }, 5);
    }
}

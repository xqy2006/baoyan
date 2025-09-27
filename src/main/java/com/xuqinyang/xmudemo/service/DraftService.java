package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class DraftService {
    @Autowired private ApplicationDraftRepository draftRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ApplicationRepository applicationRepository;

    private User me(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByStudentId(auth.getName()).orElseThrow();
    }

    public Optional<ApplicationDraft> get(Long activityId){
        User u = me();
        return draftRepository.findByUser_IdAndActivity_Id(u.getId(), activityId);
    }

    public ApplicationDraft save(Long activityId, String content){
        User u = me();
        Activity act = activityRepository.findById(activityId).orElseThrow(()-> new IllegalArgumentException("活动不存在"));
        ApplicationDraft draft = draftRepository.findByUser_IdAndActivity_Id(u.getId(), activityId).orElseGet(ApplicationDraft::new);
        draft.setUser(u); draft.setActivity(act); draft.setContent(content==null?"{}":content); return draftRepository.save(draft);
    }

    public void delete(Long activityId){
        me(); // ensure auth
        draftRepository.findByUser_IdAndActivity_Id(me().getId(), activityId).ifPresent(draftRepository::delete);
    }

    public Application submit(Long activityId, String content){
        User u = me();
        if (applicationRepository.existsByUser_IdAndActivity_Id(u.getId(), activityId)) throw new IllegalStateException("已提交申请");
        // ensure activity exists
        Activity act = activityRepository.findById(activityId).orElseThrow(()-> new IllegalArgumentException("活动不存在"));
        // persist draft first
        ApplicationDraft draft = save(activityId, content);
        // create application directly with SYSTEM_REVIEWING
        Application app = new Application();
        app.setUser(u); app.setActivity(act); app.setContent(draft.getContent());
        app.setStatus(ApplicationStatus.SYSTEM_REVIEWING); app.setSubmittedAt(LocalDateTime.now());
        applicationRepository.save(app);
        // delete draft after submit
        draftRepository.delete(draft);
        return app;
    }
}


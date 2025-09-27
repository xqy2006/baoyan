package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Activity;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ActivityService {
    @Autowired
    private ActivityRepository activityRepository;

    public List<Activity> listActive() { return activityRepository.findByIsActiveTrue(); }
    public List<Activity> listAll() { return activityRepository.findAll(); }
    public Optional<Activity> find(Long id){ return activityRepository.findById(id); }

    public Activity create(Activity a){
        a.setCreatedAt(LocalDateTime.now());
        a.setUpdatedAt(LocalDateTime.now());
        return activityRepository.save(a);
    }
    public Activity update(Long id, Activity data){
        Activity a = activityRepository.findById(id).orElseThrow();
        a.setName(data.getName());
        a.setDepartment(data.getDepartment());
        a.setType(data.getType());
        a.setStartTime(data.getStartTime());
        a.setDeadline(data.getDeadline());
        a.setDescription(data.getDescription());
        a.setMaxApplications(data.getMaxApplications());
        a.setActive(data.isActive());
        return activityRepository.save(a);
    }
    public void delete(Long id){ activityRepository.deleteById(id); }
    public Activity toggle(Long id){ Activity a = activityRepository.findById(id).orElseThrow(); a.setActive(!a.isActive()); return activityRepository.save(a);}
}


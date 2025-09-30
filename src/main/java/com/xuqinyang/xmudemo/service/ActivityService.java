package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Activity;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
public class ActivityService {
    private static final Logger log = LoggerFactory.getLogger(ActivityService.class);

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private DistributedLockService distributedLockService;

    @Autowired
    private MessageQueueService messageQueueService;

    @Autowired
    private CacheService cacheService;

    // 尝试从redis获取活动列表，未命中或redis异常时从DB读取并回写缓存
    public List<Activity> listActive() {
        Object cached = cacheService.getActivitiesListFromCache("active");
        if (cached instanceof List) {
            //noinspection unchecked
            return (List<Activity>) cached;
        }

        List<Activity> fromDb = activityRepository.findByIsActiveTrue();
        // 回写缓存（降级写：失败仅记录）
        cacheService.putActivitiesListToCache("active", fromDb, 60, TimeUnit.SECONDS);
        return fromDb;
    }

    public List<Activity> listAll() {
        Object cached = cacheService.getActivitiesListFromCache("all");
        if (cached instanceof List) {
            //noinspection unchecked
            return (List<Activity>) cached;
        }

        List<Activity> fromDb = activityRepository.findAll();
        cacheService.putActivitiesListToCache("all", fromDb, 60, TimeUnit.SECONDS);
        return fromDb;
    }

    public Optional<Activity> find(Long id){
        Object cached = cacheService.getActivityFromCache(id);
        if (cached instanceof Activity) {
            return Optional.of((Activity) cached);
        }

        Optional<Activity> fromDb = activityRepository.findById(id);
        fromDb.ifPresent(a -> cacheService.putActivityToCache(id, a, 300, TimeUnit.SECONDS));
        return fromDb;
    }

    @Transactional
    @CacheEvict(value = "activities", allEntries = true)
    public Activity create(Activity a){
        try {
            Activity saved = distributedLockService.executeWithLockAndRetry("activity:create:" + System.currentTimeMillis(), () -> {
                a.setCreatedAt(LocalDateTime.now());
                a.setUpdatedAt(LocalDateTime.now());
                Activity s = activityRepository.saveAndFlush(a);
                log.debug("Activity saved (flushed): id={}", s.getId());
                // 异步发送消息队列通知
                try {
                    messageQueueService.sendActivityProcessMessage(s.getId(), "CREATE");
                } catch (Exception me) {
                    log.warn("Failed to send activity CREATE message for id {}: {}", s.getId(), me.getMessage());
                }
                return s;
            }, 3);

            // 清理/更新缓存
            try {
                cacheService.evictAllActivities();
                cacheService.putActivityToCache(saved.getId(), saved, 300, TimeUnit.SECONDS);
                // 回写整个列表缓存，确保 list 立即生效
                try {
                    List<Activity> all = activityRepository.findAll();
                    cacheService.putActivitiesListToCache("all", all, 60, TimeUnit.SECONDS);
                } catch (Exception e) {
                    log.warn("Failed to refresh activities list cache after create: {}", e.getMessage());
                }
            } catch (Exception ignored) {}

            return saved;
        } catch (Exception e) {
            log.error("Failed to create activity: {}", e.getMessage(), e);
            throw e;
        }
    }

    @Transactional
    @CacheEvict(value = "activities", allEntries = true)
    public Activity update(Long id, Activity data){
        try {
            Activity saved = distributedLockService.executeWithLockAndRetry("activity:update:" + id, () -> {
                Activity a = activityRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Activity not found: " + id));
                a.setName(data.getName());
                a.setDepartment(data.getDepartment());
                a.setType(data.getType());
                a.setStartTime(data.getStartTime());
                a.setDeadline(data.getDeadline());
                a.setDescription(data.getDescription());
                a.setMaxApplications(data.getMaxApplications());
                a.setActive(data.isActive());
                a.setUpdatedAt(LocalDateTime.now());

                Activity s = activityRepository.saveAndFlush(a);
                log.debug("Activity updated (flushed): id={}", s.getId());
                try {
                    messageQueueService.sendActivityProcessMessage(s.getId(), "UPDATE");
                } catch (Exception me) {
                    log.warn("Failed to send activity UPDATE message for id {}: {}", s.getId(), me.getMessage());
                }
                return s;
            }, 3);

            // 缓存更新/清理
            try {
                cacheService.evictActivity(id);
                cacheService.evictAllActivities();
                cacheService.putActivityToCache(id, saved, 300, TimeUnit.SECONDS);
                try {
                    List<Activity> all = activityRepository.findAll();
                    cacheService.putActivitiesListToCache("all", all, 60, TimeUnit.SECONDS);
                } catch (Exception e) {
                    log.warn("Failed to refresh activities list cache after update: {}", e.getMessage());
                }
            } catch (Exception ignored) {}

            return saved;
        } catch (Exception e) {
            log.error("Failed to update activity {}: {}", id, e.getMessage(), e);
            throw e;
        }
    }

    @Transactional
    @CacheEvict(value = "activities", allEntries = true)
    public void delete(Long id){
        try {
            distributedLockService.executeWithLockAndRetry("activity:delete:" + id, () -> {
                if (activityRepository.existsById(id)) {
                    activityRepository.deleteById(id);
                    activityRepository.flush();
                    log.debug("Activity deleted and flushed: id={}", id);
                    try {
                        messageQueueService.sendActivityProcessMessage(id, "DELETE");
                    } catch (Exception me) {
                        log.warn("Failed to send activity DELETE message for id {}: {}", id, me.getMessage());
                    }
                } else {
                    log.debug("Delete requested but activity not found: id={}", id);
                }
                return null;
            }, 3);

            // 缓存清理
            try {
                cacheService.evictActivity(id);
                cacheService.evictAllActivities();
                try {
                    List<Activity> all = activityRepository.findAll();
                    cacheService.putActivitiesListToCache("all", all, 60, TimeUnit.SECONDS);
                } catch (Exception e) {
                    log.warn("Failed to refresh activities list cache after delete: {}", e.getMessage());
                }
            } catch (Exception ignored) {}
        } catch (Exception e) {
            log.error("Failed to delete activity {}: {}", id, e.getMessage(), e);
            throw e;
        }
    }

    @Transactional
    @CacheEvict(value = "activities", allEntries = true)
    public Activity toggle(Long id){
        try {
            Activity saved = distributedLockService.executeWithLockAndRetry("activity:toggle:" + id, () -> {
                Activity a = activityRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Activity not found: " + id));
                a.setActive(!a.isActive());
                a.setUpdatedAt(LocalDateTime.now());

                Activity s = activityRepository.saveAndFlush(a);
                log.debug("Activity toggled (flushed): id={}, active={}", s.getId(), s.isActive());
                try {
                    messageQueueService.sendActivityProcessMessage(s.getId(), "TOGGLE");
                } catch (Exception me) {
                    log.warn("Failed to send activity TOGGLE message for id {}: {}", s.getId(), me.getMessage());
                }
                return s;
            }, 3);

            try {
                cacheService.evictActivity(id);
                cacheService.evictAllActivities();
                cacheService.putActivityToCache(id, saved, 300, TimeUnit.SECONDS);
                try {
                    List<Activity> all = activityRepository.findAll();
                    cacheService.putActivitiesListToCache("all", all, 60, TimeUnit.SECONDS);
                } catch (Exception e) {
                    log.warn("Failed to refresh activities list cache after toggle: {}", e.getMessage());
                }
            } catch (Exception ignored) {}

            return saved;
        } catch (Exception e) {
            log.error("Failed to toggle activity {}: {}", id, e.getMessage(), e);
            throw e;
        }
    }
}

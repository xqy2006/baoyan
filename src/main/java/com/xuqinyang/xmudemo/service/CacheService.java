package com.xuqinyang.xmudemo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * 缓存服务
 * 提供Redis缓存操作和管理
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final CacheManager cacheManager;

    // 缓存键前缀
    private static final String USER_CACHE_PREFIX = "user:";
    private static final String APPLICATION_CACHE_PREFIX = "application:";
    private static final String ACTIVITY_CACHE_PREFIX = "activity:";
    private static final String STATS_CACHE_PREFIX = "stats:";

    /**
     * 缓存用户信息
     */
    @Cacheable(value = "users", key = "#userId")
    public Object cacheUser(Long userId, Object user) {
        log.debug("Caching user: {}", userId);
        return user;
    }

    /**
     * 更新用户缓存
     */
    @CachePut(value = "users", key = "#userId")
    public Object updateUserCache(Long userId, Object user) {
        log.debug("Updating user cache: {}", userId);
        return user;
    }

    /**
     * 删除用户缓存
     */
    @CacheEvict(value = "users", key = "#userId")
    public void evictUser(Long userId) {
        log.debug("Evicting user cache: {}", userId);
    }

    /**
     * 缓存应用信息
     */
    @Cacheable(value = "applications", key = "#applicationId")
    public Object cacheApplication(Long applicationId, Object application) {
        log.debug("Caching application: {}", applicationId);
        return application;
    }

    /**
     * 更新应用缓存
     */
    @CachePut(value = "applications", key = "#applicationId")
    public Object updateApplicationCache(Long applicationId, Object application) {
        log.debug("Updating application cache: {}", applicationId);
        return application;
    }

    /**
     * 删除应用缓存
     */
    @CacheEvict(value = "applications", key = "#applicationId")
    public void evictApplication(Long applicationId) {
        log.debug("Evicting application cache: {}", applicationId);
    }

    /**
     * 清除所有应用缓存 - 用于解决序列化兼容性问题
     */
    @CacheEvict(value = "applications", allEntries = true)
    public void evictAllApplications() {
        log.info("Evicting all application caches due to serialization compatibility issues");

        // 也清除Redis中的应用相关缓存
        try {
            Set<String> keys = redisTemplate.keys(APPLICATION_CACHE_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.info("Deleted {} application-related Redis keys", keys.size());
            }
        } catch (Exception e) {
            log.warn("Failed to delete application Redis keys: {}", e.getMessage());
        }

        // 清除应用列表缓存
        try {
            Set<String> listKeys = redisTemplate.keys(ACTIVITY_CACHE_PREFIX + "list:applications*");
            if (listKeys != null && !listKeys.isEmpty()) {
                redisTemplate.delete(listKeys);
                log.info("Deleted {} application list Redis keys", listKeys.size());
            }
        } catch (Exception e) {
            log.warn("Failed to delete application list Redis keys: {}", e.getMessage());
        }
    }

    /**
     * 安全地清除应用缓存，包括Redis和Spring Cache
     */
    public void clearApplicationCachesSafely() {
        // 清除Spring Cache中的applications缓存
        try {
            if (cacheManager != null) {
                var cache = cacheManager.getCache("applications");
                if (cache != null) {
                    cache.clear();
                    log.info("Cleared Spring cache 'applications'");
                }
            }
        } catch (Exception e) {
            log.warn("Failed to clear Spring cache applications: {}", e.getMessage());
        }

        // 清除Redis中以application:开头的所有键
        try {
            Set<String> keys = redisTemplate.keys(APPLICATION_CACHE_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.info("Deleted {} application-related Redis keys", keys.size());
            }
        } catch (Exception e) {
            log.warn("Failed to delete application Redis keys: {}", e.getMessage());
        }

        // 清除应用列表缓存
        try {
            Set<String> listKeys = redisTemplate.keys(ACTIVITY_CACHE_PREFIX + "list:applications*");
            if (listKeys != null && !listKeys.isEmpty()) {
                redisTemplate.delete(listKeys);
                log.info("Deleted {} application list cache keys", listKeys.size());
            }
        } catch (Exception e) {
            log.warn("Failed to delete application list cache keys: {}", e.getMessage());
        }
    }

    /**
     * 缓存活动信息
     */
    @Cacheable(value = "activities", key = "#activityId")
    public Object cacheActivity(Long activityId, Object activity) {
        log.debug("Caching activity: {}", activityId);
        return activity;
    }

    /**
     * 可靠地删除单条活动缓存（同时清理 Spring Cache 的 activities 条目）
     */
    public void evictActivity(Long activityId) {
        String cacheKey = ACTIVITY_CACHE_PREFIX + activityId;
        try {
            redisTemplate.delete(cacheKey);
            log.debug("Deleted redis activity cache key: {}", cacheKey);
        } catch (Exception e) {
            log.warn("Failed to delete redis key {}: {}", cacheKey, e.getMessage());
        }

        // 也尝试移除 Spring Cache 中对应的条目（cache name = "activities", key = id 或 'all' 等）
        try {
            if (cacheManager != null) {
                var cache = cacheManager.getCache("activities");
                if (cache != null) {
                    cache.evict(activityId);
                    log.debug("Evicted Spring cache 'activities' key: {}", activityId);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to evict Spring cache activities[{}]: {}", activityId, e.getMessage());
        }
    }

    /**
     * 可靠地删除活动列表缓存（清空与活动相关的 list 缓存与 Spring cache）
     */
    public void evictAllActivities() {
        // 删除 Redis 中以 activity:list: 开头的缓存，以及 activity:<id> 的短期缓存（谨慎）
        try {
            Set<String> keys = redisTemplate.keys(ACTIVITY_CACHE_PREFIX + "list:*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("Deleted redis activity list keys: {}", keys);
            }
        } catch (Exception e) {
            log.warn("Failed to delete activity list keys from redis: {}", e.getMessage());
        }

        // 也可以选择清理所有 activity:* 键（谨慎使用）
        try {
            Set<String> keysAll = redisTemplate.keys(ACTIVITY_CACHE_PREFIX + "*");
            if (keysAll != null && !keysAll.isEmpty()) {
                redisTemplate.delete(keysAll);
                log.debug("Deleted redis activity keys (all): {}", keysAll);
            }
        } catch (Exception e) {
            log.warn("Failed to delete activity keys from redis: {}", e.getMessage());
        }

        // 清理 Spring Cache 'activities' 的所有条目
        try {
            if (cacheManager != null) {
                var cache = cacheManager.getCache("activities");
                if (cache != null) {
                    cache.clear();
                    log.debug("Cleared Spring cache 'activities'");
                }
            }
        } catch (Exception e) {
            log.warn("Failed to clear Spring cache activities: {}", e.getMessage());
        }
    }

    /**
     * 缓存统计数据
     */
    public void cacheStats(String key, Object value, long timeout, TimeUnit unit) {
        String cacheKey = STATS_CACHE_PREFIX + key;
        redisTemplate.opsForValue().set(cacheKey, value, timeout, unit);
        log.debug("Cached statistics: {}", key);
    }

    /**
     * 获取缓存的统计数据
     */
    public Object getStats(String key) {
        String cacheKey = STATS_CACHE_PREFIX + key;
        return redisTemplate.opsForValue().get(cacheKey);
    }

    /**
     * 缓存会话信息
     */
    public void cacheSession(String sessionId, Object sessionData, long timeout, TimeUnit unit) {
        String cacheKey = "session:" + sessionId;
        redisTemplate.opsForValue().set(cacheKey, sessionData, timeout, unit);
        log.debug("Cached session: {}", sessionId);
    }

    /**
     * 获取会话信息
     */
    public Object getSession(String sessionId) {
        String cacheKey = "session:" + sessionId;
        return redisTemplate.opsForValue().get(cacheKey);
    }

    /**
     * 删除会话信息
     */
    public void evictSession(String sessionId) {
        String cacheKey = "session:" + sessionId;
        redisTemplate.delete(cacheKey);
        log.debug("Evicted session: {}", sessionId);
    }

    /**
     * 缓存令牌黑名单
     */
    public void cacheTokenBlacklist(String token, long timeout, TimeUnit unit) {
        String cacheKey = "token_blacklist:" + token;
        redisTemplate.opsForValue().set(cacheKey, "blacklisted", timeout, unit);
        log.debug("Added token to blacklist: {}", token);
    }

    /**
     * 通用缓存清理方法
     */
    @CacheEvict(value = "#cacheName", key = "#key")
    public void evictCache(String cacheName, String key) {
        log.debug("Evicting cache: {} with key: {}", cacheName, key);
    }

    /**
     * 清理所有指定缓存
     */
    @CacheEvict(value = "#cacheName", allEntries = true)
    public void evictAllCache(String cacheName) {
        log.debug("Evicting all cache entries for: {}", cacheName);
    }

    /**
     * 检查令牌是否在黑名单中
     */
    public boolean isTokenBlacklisted(String token) {
        String cacheKey = "token_blacklist:" + token;
        return redisTemplate.hasKey(cacheKey);
    }

    /**
     * 缓存限流计数
     */
    public void cacheRateLimit(String key, int count, long timeout, TimeUnit unit) {
        String cacheKey = "rate_limit:" + key;
        redisTemplate.opsForValue().set(cacheKey, count, timeout, unit);
        log.debug("Cached rate limit: {}", key);
    }

    /**
     * 增加限流计数
     */
    public void incrementRateLimit(String key) {
        String cacheKey = "rate_limit:" + key;
        redisTemplate.opsForValue().increment(cacheKey);
    }

    /**
     * 获取限流计数
     */
    public Integer getRateLimitCount(String key) {
        String cacheKey = "rate_limit:" + key;
        Object count = redisTemplate.opsForValue().get(cacheKey);
        return count != null ? (Integer) count : null;
    }

    /**
     * 清除所有缓存
     */
    @CacheEvict(value = {"users", "applications", "activities"}, allEntries = true)
    public void clearAllCache() {
        log.info("Cleared all cache");
    }

    /**
     * 从 Redis 中获取单个活动缓存（安全的降级：Redis 异常或未命中时返回 null）
     */
    public Object getActivityFromCache(Long activityId) {
        String cacheKey = ACTIVITY_CACHE_PREFIX + activityId;
        try {
            Object v = redisTemplate.opsForValue().get(cacheKey);
            if (v == null) {
                log.debug("Activity cache miss: {}", activityId);
            } else {
                log.debug("Activity cache hit: {}", activityId);
            }
            return v;
        } catch (Exception e) {
            log.warn("Failed to read activity cache {}, falling back to DB: {}", activityId, e.getMessage());
            return null;
        }
    }

    /**
     * 将单个活动写入 Redis（发生异常则记录但不抛出）
     */
    public void putActivityToCache(Long activityId, Object activity, long timeout, TimeUnit unit) {
        String cacheKey = ACTIVITY_CACHE_PREFIX + activityId;
        try {
            redisTemplate.opsForValue().set(cacheKey, activity, timeout, unit);
            log.debug("Wrote activity to cache: {}", activityId);
        } catch (Exception e) {
            log.warn("Failed to write activity cache {}, ignoring: {}", activityId, e.getMessage());
        }
    }

    /**
     * 从 Redis 中获取活动列表缓存（key 可为 'active' 或 'all' 等标识），降级为 null
     */
    public Object getActivitiesListFromCache(String key) {
        String cacheKey = ACTIVITY_CACHE_PREFIX + "list:" + key;
        try {
            Object v = redisTemplate.opsForValue().get(cacheKey);
            if (v == null) {
                log.debug("Activities list cache miss: {}", key);
            } else {
                log.debug("Activities list cache hit: {}", key);
            }
            return v;
        } catch (Exception e) {
            log.warn("Failed to read activities list cache {}, falling back to DB: {}", key, e.getMessage());
            return null;
        }
    }

    /**
     * 将活动列表写入 Redis（异常时记录但不抛出）
     */
    public void putActivitiesListToCache(String key, Object listObj, long timeout, TimeUnit unit) {
        String cacheKey = ACTIVITY_CACHE_PREFIX + "list:" + key;
        try {
            redisTemplate.opsForValue().set(cacheKey, listObj, timeout, unit);
            log.debug("Wrote activities list to cache: {}", key);
        } catch (Exception e) {
            log.warn("Failed to write activities list cache {}, ignoring: {}", key, e.getMessage());
        }
    }
}

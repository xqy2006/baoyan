package com.xuqinyang.xmudemo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.*;

/**
 * 分布式锁服务
 * 解决高并发场景下的数据一致性问题，支持watch-dog机制和重入锁
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String LOCK_PREFIX = "lock:";
    private static final long DEFAULT_EXPIRE_TIME = 30; // 默认30秒过期
    private static final long WATCH_DOG_INTERVAL = 10; // watch-dog续租间隔10秒

    // 用于存储锁信息，支持watch-dog
    private final Map<String, LockInfo> activeLocks = new ConcurrentHashMap<>();
    // 用于跟踪重入锁计数
    private final ThreadLocal<Map<String, Integer>> threadLockCounts = ThreadLocal.withInitial(ConcurrentHashMap::new);
    private final ScheduledExecutorService watchDogExecutor = Executors.newScheduledThreadPool(2);

    // Lua脚本：原子性释放锁
    private static final String UNLOCK_SCRIPT =
        "if redis.call('get', KEYS[1]) == ARGV[1] then " +
        "    return redis.call('del', KEYS[1]) " +
        "else " +
        "    return 0 " +
        "end";

    // Lua脚本：原子性续租锁
    private static final String RENEW_SCRIPT =
        "if redis.call('get', KEYS[1]) == ARGV[1] then " +
        "    return redis.call('expire', KEYS[1], ARGV[2]) " +
        "else " +
        "    return 0 " +
        "end";

    private static class LockInfo {
        final String lockKey;
        final String lockValue;
        final long expireTime;
        final TimeUnit timeUnit;
        final String threadName;
        ScheduledFuture<?> watchDogTask;

        LockInfo(String lockKey, String lockValue, long expireTime, TimeUnit timeUnit, String threadName) {
            this.lockKey = lockKey;
            this.lockValue = lockValue;
            this.expireTime = expireTime;
            this.timeUnit = timeUnit;
            this.threadName = threadName;
        }
    }

    /**
     * 尝试获取分布式锁（支持watch-dog和重入锁）
     */
    public boolean tryLock(String key, long expireTime, TimeUnit timeUnit, boolean enableWatchDog) {
        String lockKey = LOCK_PREFIX + key;
        String currentThreadName = Thread.currentThread().getName();

        // 检查是否为重入锁
        Map<String, Integer> lockCounts = threadLockCounts.get();
        Integer currentCount = lockCounts.get(lockKey);

        if (currentCount != null && currentCount > 0) {
            // 重入锁情况
            LockInfo existingLock = activeLocks.get(lockKey);
            if (existingLock != null && currentThreadName.equals(existingLock.threadName)) {
                lockCounts.put(lockKey, currentCount + 1);
                log.debug("Re-entrant lock acquired: {}, count: {}", lockKey, currentCount + 1);
                return true;
            }
        }

        String lockValue = currentThreadName + ":" + System.currentTimeMillis();
        Boolean success = redisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, expireTime, timeUnit);

        if (Boolean.TRUE.equals(success)) {
            log.debug("Acquired distributed lock: {}", lockKey);

            // 记录锁计数
            lockCounts.put(lockKey, 1);

            if (enableWatchDog) {
                LockInfo lockInfo = new LockInfo(lockKey, lockValue, expireTime, timeUnit, currentThreadName);
                activeLocks.put(lockKey, lockInfo);
                startWatchDog(lockInfo);
            }

            return true;
        } else {
            log.debug("Failed to acquire distributed lock: {}", lockKey);
            return false;
        }
    }

    /**
     * 尝试获取分布式锁
     */
    public boolean tryLock(String key, long expireTime, TimeUnit timeUnit) {
        return tryLock(key, expireTime, timeUnit, true);
    }

    /**
     * 尝试获取锁（默认30秒过期，启用watch-dog）
     */
    public boolean tryLock(String key) {
        return tryLock(key, DEFAULT_EXPIRE_TIME, TimeUnit.SECONDS, true);
    }

    /**
     * 启动watch-dog定时续租
     */
    private void startWatchDog(LockInfo lockInfo) {
        long intervalSeconds = Math.min(WATCH_DOG_INTERVAL, lockInfo.timeUnit.toSeconds(lockInfo.expireTime) / 3);

        lockInfo.watchDogTask = watchDogExecutor.scheduleAtFixedRate(() -> {
            try {
                if (renewLock(lockInfo)) {
                    log.debug("Watch-dog renewed lock: {}", lockInfo.lockKey);
                } else {
                    log.warn("Watch-dog failed to renew lock: {}, removing from active locks", lockInfo.lockKey);
                    activeLocks.remove(lockInfo.lockKey);
                    if (lockInfo.watchDogTask != null) {
                        lockInfo.watchDogTask.cancel(true);
                    }
                }
            } catch (Exception e) {
                log.error("Watch-dog error for lock: {}", lockInfo.lockKey, e);
            }
        }, intervalSeconds, intervalSeconds, TimeUnit.SECONDS);
    }

    /**
     * 续租锁
     */
    private boolean renewLock(LockInfo lockInfo) {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>(RENEW_SCRIPT, Long.class);
        Long result = redisTemplate.execute(script,
            Collections.singletonList(lockInfo.lockKey),
            lockInfo.lockValue,
            String.valueOf(lockInfo.timeUnit.toSeconds(lockInfo.expireTime)));
        return result != null && result == 1;
    }

    /**
     * 释放分布式锁（支持重入锁）
     */
    public void unlock(String key) {
        String lockKey = LOCK_PREFIX + key;
        String currentThreadName = Thread.currentThread().getName();

        // 检查重入锁计数
        Map<String, Integer> lockCounts = threadLockCounts.get();
        Integer currentCount = lockCounts.get(lockKey);

        if (currentCount != null && currentCount > 1) {
            // 减少重入计数，但不释放实际的Redis锁
            lockCounts.put(lockKey, currentCount - 1);
            log.debug("Re-entrant lock decremented: {}, remaining count: {}", lockKey, currentCount - 1);
            return;
        }

        // 完全释放锁
        if (currentCount != null) {
            lockCounts.remove(lockKey);
        }

        LockInfo lockInfo = activeLocks.remove(lockKey);

        if (lockInfo != null) {
            // 验证是否为同一线程
            if (!currentThreadName.equals(lockInfo.threadName)) {
                log.warn("Attempting to unlock from different thread. Lock thread: {}, Current thread: {}",
                    lockInfo.threadName, currentThreadName);
                return;
            }

            // 停止watch-dog
            if (lockInfo.watchDogTask != null) {
                lockInfo.watchDogTask.cancel(true);
            }

            // 原子性释放锁
            DefaultRedisScript<Long> script = new DefaultRedisScript<>(UNLOCK_SCRIPT, Long.class);
            Long result = redisTemplate.execute(script,
                Collections.singletonList(lockKey),
                lockInfo.lockValue);

            if (result != null && result == 1) {
                log.debug("Released distributed lock: {}", lockKey);
            } else {
                log.warn("Failed to release lock or lock was already expired: {}", lockKey);
            }
        } else {
            // 简单删除
            redisTemplate.delete(lockKey);
            log.debug("Released distributed lock (no watch-dog): {}", lockKey);
        }
    }

    /**
     * 带锁执行操作（支持乐观锁重试）
     */
    public <T> T executeWithLock(String key, long expireTime, TimeUnit timeUnit, LockCallback<T> callback, int maxRetries) {
        int attempts = 0;
        Exception lastException = null;

        while (attempts < maxRetries) {
            attempts++; // 移动到循环开始，确保attempts正确计数

            if (tryLock(key, expireTime, timeUnit)) {
                try {
                    return callback.execute();
                } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
                    lastException = e;
                    log.warn("Optimistic lock failure, attempt {}/{}: {}", attempts, maxRetries, e.getMessage());

                    if (attempts < maxRetries) {
                        try {
                            Thread.sleep(50 + (int)(Math.random() * 100)); // 随机延迟重试
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new RuntimeException("Interrupted during retry", ie);
                        }
                    }
                } catch (Exception e) {
                    throw new RuntimeException("Error executing with lock: " + key, e);
                } finally {
                    unlock(key);
                }
            } else {
                // 获取锁失败，记录并准备重试
                log.warn("Failed to acquire lock: {}, attempt {}/{}", key, attempts, maxRetries);
                lastException = new RuntimeException("Failed to acquire distributed lock");

                if (attempts < maxRetries) {
                    try {
                        // 等待一段时间后重试，时间递增
                        Thread.sleep(100 + attempts * 50 + (int)(Math.random() * 100));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during lock acquisition retry", ie);
                    }
                }
            }
        }

        // 所有重试都失败了
        throw new RuntimeException("Failed to acquire lock: " + key + " after " + attempts + " attempts", lastException);
    }

    /**
     * 带锁执行操作（默认重试3次）
     */
    public <T> T executeWithLock(String key, LockCallback<T> callback) {
        return executeWithLock(key, DEFAULT_EXPIRE_TIME, TimeUnit.SECONDS, callback, 3);
    }

    /**
     * 带锁执行操作（自定义重试次数）
     */
    public <T> T executeWithLockAndRetry(String key, LockCallback<T> callback, int maxRetries) {
        return executeWithLock(key, DEFAULT_EXPIRE_TIME, TimeUnit.SECONDS, callback, maxRetries);
    }

    /**
     * 锁回调接口
     */
    @FunctionalInterface
    public interface LockCallback<T> {
        T execute() throws Exception;
    }
}

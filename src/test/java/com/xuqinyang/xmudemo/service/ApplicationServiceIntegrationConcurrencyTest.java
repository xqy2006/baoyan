package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
import com.xuqinyang.xmudemo.repository.FileMetadataRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 申请服务并发集成测试
 * 测试核心业务逻辑在高并发场景下的正确性和性能
 * 
 * 注意：这是集成测试，需要 Docker Compose 服务运行（MySQL, Redis, RabbitMQ）
 * 请确保在运行测试前执行： docker-compose up -d
 */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationServiceIntegrationConcurrencyTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private FileMetadataRepository fileMetadataRepository;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    private ExecutorService executorService;
    private final AtomicInteger successCount = new AtomicInteger(0);
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicLong totalResponseTime = new AtomicLong(0);

    private User testUser;
    private Activity testActivity;

    @BeforeEach
    @Transactional
    void setUp() {
        // 清理数据（注意顺序：先删除有外键关联的表）
        applicationRepository.deleteAll();
        activityRepository.deleteAll();
        fileMetadataRepository.deleteAll();

        // 手动清理 user_roles 表以避免外键约束问题
        try {
            // 先通过Repository方式清理用户角色关联
            userRepository.findAll().forEach(user -> {
                if (user.getRoles() != null) {
                    user.getRoles().clear();
                    userRepository.save(user);
                }
            });
            userRepository.flush();

            // 然后使用原生SQL确保彻底清理
            entityManager.createNativeQuery("DELETE FROM user_roles").executeUpdate();
            entityManager.flush();
        } catch (Exception e) {
            System.err.println("警告：清理 user_roles 表失败: " + e.getMessage());
        }

        // 现在安全删除用户
        try {
            userRepository.deleteAll();
            userRepository.flush();
        } catch (Exception e) {
            System.err.println("警告：清理 users 表失败: " + e.getMessage());
        }

        // 清空 Redis
        try {
            redisTemplate.getConnectionFactory().getConnection().flushDb();
        } catch (Exception e) {
            System.err.println("警告：无法清空 Redis: " + e.getMessage());
        }

        // 创建测试用户
        testUser = new User();
        testUser.setStudentId("test_" + System.currentTimeMillis());
        testUser.setPassword("password");
        testUser.setName("测试用户");
        testUser.setDepartment("信息学院");
        testUser.setMajor("软件工程");
        testUser.setRole(Role.STUDENT);
        testUser = userRepository.save(testUser);

        // 创建测试活动
        testActivity = new Activity();
        testActivity.setName("测试活动");
        testActivity.setDepartment("信息学院");
        testActivity.setType(ActivityType.ACADEMIC_MASTER);
        testActivity.setDescription("用于并发测试");
        testActivity.setStartTime(LocalDateTime.now());
        testActivity.setDeadline(LocalDateTime.now().plusDays(7));
        testActivity.setMaxApplications(1000);
        testActivity.setActive(true);
        testActivity = activityRepository.save(testActivity);

        executorService = Executors.newFixedThreadPool(30);
        successCount.set(0);
        failureCount.set(0);
        totalResponseTime.set(0);
    }

    @Test
    @DisplayName("测试并发获取所有申请的性能")
    void testConcurrentGetAllApplications() throws InterruptedException {
        // 创建测试数据 - 使用更安全的方式避免并发冲突
        List<User> testUsers = new ArrayList<>();
        List<Application> testApps = new ArrayList<>();

        // 预先创建足够多的唯一用户，避免并发时的重复
        for (int i = 0; i < 20; i++) {
            User user = new User();
            // 使用更强的唯一性保证：当前时间戳 + 线程ID + 随机数
            String uniqueId = System.nanoTime() + "_" + Thread.currentThread().getId() + "_" + (int)(Math.random() * 10000);
            user.setStudentId("test_user_" + i + "_" + uniqueId);
            user.setPassword("password");
            user.setName("测试用户" + i);
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setRole(Role.STUDENT);
            user = userRepository.save(user);
            testUsers.add(user);

            Application app = new Application();
            app.setUser(user);
            app.setActivity(testActivity);
            app.setStatus(ApplicationStatus.DRAFT);
            app.setContent("{\"reason\": \"测试申请 " + i + "\"}");
            app = applicationRepository.save(app);
            testApps.add(app);
        }

        // 确保数据已经持久化
        userRepository.flush();
        applicationRepository.flush();

        int threadCount = 50;
        int queriesPerThread = 10;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(threadCount);

        long startTime = System.currentTimeMillis();

        // 并发查询所有申请
        for (int i = 0; i < threadCount; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < queriesPerThread; j++) {
                        long reqStartTime = System.currentTimeMillis();

                        List<Application> applications = applicationService.getAllApplications();

                        if (applications != null) {
                            successCount.incrementAndGet();
                            long responseTime = System.currentTimeMillis() - reqStartTime;
                            totalResponseTime.addAndGet(responseTime);
                        } else {
                            failureCount.incrementAndGet();
                        }
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                    System.err.println("查询失败: " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = endLatch.await(60, TimeUnit.SECONDS);

        long endTime = System.currentTimeMillis();
        long totalTime = endTime - startTime;

        // 输出结果
        System.out.println("\n========================================");
        System.out.println("并发获取所有申请测试结果:");
        System.out.println("线程数: " + threadCount);
        System.out.println("每线程查询: " + queriesPerThread);
        System.out.println("总请求数: " + (threadCount * queriesPerThread));
        System.out.println("成功数: " + successCount.get());
        System.out.println("失败数: " + failureCount.get());
        System.out.println("平均响应时间: " + (totalResponseTime.get() / successCount.get()) + "ms");
        System.out.println("总耗时: " + totalTime + "ms");
        System.out.println("QPS: " + (successCount.get() * 1000.0 / totalTime));
        System.out.println("========================================\n");

        assertTrue(finished, "测试应在超时时间内完成");
        assertTrue(successCount.get() > 0, "应该有成功的请求");
        assertTrue(failureCount.get() == 0, "不应该有失败的请求");
    }

    @Test
    @DisplayName("测试并发提交申请的正确性")
    void testConcurrentSubmitApplications() throws InterruptedException {
        int threadCount = 50;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(threadCount);
        
        AtomicInteger submittedCount = new AtomicInteger(0);
        AtomicInteger duplicateCount = new AtomicInteger(0);

        // 为每个线程预先创建独立的用户，避免重复申请问题
        List<User> testUsers = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            User user = new User();
            // 使用更强的唯一性保证
            String uniqueId = System.nanoTime() + "_" + Thread.currentThread().getId() + "_" + i;
            user.setStudentId("concurrent_test_" + uniqueId);
            user.setPassword("password");
            user.setName("并发测试用户" + i);
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setRole(Role.STUDENT);
            user = userRepository.save(user);
            testUsers.add(user);
        }

        // 确保用户数据已持久化
        userRepository.flush();

        // 并发提交申请 - 每个线程使用不同的用户
        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            final User threadUser = testUsers.get(i);
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    Application application = new Application();
                    application.setUser(threadUser);
                    application.setActivity(testActivity);
                    application.setStatus(ApplicationStatus.DRAFT);
                    application.setContent("{\"reason\": \"并发测试申请 " + threadId + "\"}");

                    Application saved = applicationService.createApplication(application);
                    if (saved != null) {
                        submittedCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    if (e.getMessage() != null && e.getMessage().contains("已存在")) {
                        duplicateCount.incrementAndGet();
                    }
                    System.err.println("提交失败 (Thread " + threadId + "): " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = endLatch.await(60, TimeUnit.SECONDS);

        // 验证结果
        long actualCount = applicationRepository.count();

        System.out.println("\n========================================");
        System.out.println("并发提交申请测试结果:");
        System.out.println("并发线程数: " + threadCount);
        System.out.println("提交成功: " + submittedCount.get());
        System.out.println("重复拒绝: " + duplicateCount.get());
        System.out.println("数据库实际数量: " + actualCount);
        System.out.println("========================================\n");

        assertTrue(finished, "测试应在超时时间内完成");
        assertTrue(actualCount > 0, "应该有成功保存的申请");
    }

    @Test
    @DisplayName("测试并发更新申请状态")
    void testConcurrentUpdateApplicationStatus() throws InterruptedException {
        // 创建测试申请
        Application application = createTestApplication(1);
        application = applicationRepository.save(application);
        final Long appId = application.getId();

        int threadCount = 30;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(threadCount);
        
        AtomicInteger updateSuccess = new AtomicInteger(0);
        AtomicInteger updateFailed = new AtomicInteger(0);

        // 并发更新状态
        ApplicationStatus[] statuses = {
            ApplicationStatus.DRAFT,
            ApplicationStatus.SYSTEM_REVIEWING,
            ApplicationStatus.APPROVED
        };

        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    ApplicationStatus newStatus = statuses[threadId % statuses.length];

                    // 使用ApplicationService的updateApplication方法，而不是直接使用repository
                    // 这样可以利用分布式锁和乐观锁重试机制
                    Optional<Application> appOpt = applicationRepository.findById(appId);
                    if (appOpt.isPresent()) {
                        Application app = appOpt.get();
                        app.setStatus(newStatus);

                        try {
                            // 使用applicationService.updateApplication方法进行更新
                            applicationService.updateApplication(app);
                            updateSuccess.incrementAndGet();
                        } catch (Exception e) {
                            // 如果是乐观锁冲突或分布式锁获取失败，这是正常的并发控制行为
                            updateFailed.incrementAndGet();
                            if (!e.getMessage().contains("lock") && !e.getMessage().contains("version")) {
                                System.err.println("非预期的更新失败: " + e.getMessage());
                            }
                        }
                    } else {
                        updateFailed.incrementAndGet();
                    }
                } catch (Exception e) {
                    updateFailed.incrementAndGet();
                    System.err.println("线程执行失败: " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = endLatch.await(60, TimeUnit.SECONDS);

        // 验证最终状态
        Application finalApp = applicationRepository.findById(appId).orElse(null);

        System.out.println("\n========================================");
        System.out.println("并发更新状态测试结果:");
        System.out.println("并发线程数: " + threadCount);
        System.out.println("更新成功: " + updateSuccess.get());
        System.out.println("更新失败: " + updateFailed.get());
        System.out.println("最终状态: " + (finalApp != null ? finalApp.getStatus() : "NULL"));
        System.out.println("========================================\n");

        assertTrue(finished, "测试应在超时时间内完成");
        assertNotNull(finalApp, "申请应该存在");
        assertNotNull(finalApp.getStatus(), "申请应该有最终状态");

        // 修改断言：在并发更新测试中，由于分布式锁的保护，应该有更多的成功更新
        // 但允许一些失败（这是正常的并发控制行为）
        assertTrue(updateSuccess.get() > 0, "应该有成功的更新操作");
        assertTrue(updateSuccess.get() + updateFailed.get() == threadCount, "所有线程都应该完成");

        // 在并发控制正确的情况下，成功率应该显著提高
        double successRate = (double) updateSuccess.get() / threadCount;
        System.out.println("成功率: " + String.format("%.2f%%", successRate * 100));

        // 预期成功率应该至少达到50%（之前只有37%）
        assertTrue(successRate >= 0.5, "并发控制优化后成功率应该至少达到50%");
    }

    @Test
    @DisplayName("测试缓存在并发场景下的性能")
    void testCachePerformanceUnderConcurrency() throws InterruptedException {
        // 创建测试数据
        Application application = createTestApplication(1);
        application = applicationRepository.save(application);
        final Long appId = application.getId();

        int threadCount = 100;
        int queriesPerThread = 5;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(threadCount);

        AtomicInteger cacheHits = new AtomicInteger(0);
        AtomicInteger cacheMisses = new AtomicInteger(0);

        // 第一次查询（缓存预热）
        applicationRepository.findById(appId);

        long startTime = System.currentTimeMillis();

        // 并发查询同一个申请
        for (int i = 0; i < threadCount; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < queriesPerThread; j++) {
                        long reqStart = System.currentTimeMillis();
                        Optional<Application> appOpt = applicationRepository.findById(appId);
                        long reqTime = System.currentTimeMillis() - reqStart;

                        if (appOpt.isPresent()) {
                            successCount.incrementAndGet();
                            totalResponseTime.addAndGet(reqTime);
                            
                            // 快速响应表明缓存命中
                            if (reqTime < 10) {
                                cacheHits.incrementAndGet();
                            } else {
                                cacheMisses.incrementAndGet();
                            }
                        }
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = endLatch.await(60, TimeUnit.SECONDS);
        long totalTime = System.currentTimeMillis() - startTime;

        System.out.println("\n========================================");
        System.out.println("缓存并发性能测试结果:");
        System.out.println("并发用户: " + threadCount);
        System.out.println("总请求数: " + (threadCount * queriesPerThread));
        System.out.println("成功请求: " + successCount.get());
        System.out.println("失败请求: " + failureCount.get());
        System.out.println("疑似缓存命中: " + cacheHits.get());
        System.out.println("疑似缓存未命中: " + cacheMisses.get());
        System.out.println("平均响应时间: " + (successCount.get() > 0 ? totalResponseTime.get() / successCount.get() : 0) + "ms");
        System.out.println("QPS: " + (totalTime > 0 ? successCount.get() * 1000.0 / totalTime : 0));
        System.out.println("========================================\n");

        assertTrue(finished, "测试应在超时时间内完成");
        assertTrue(successCount.get() > 0, "应该有成功的请求");
    }

    // 辅助方法
    private Application createTestApplication(int index) {
        Application application = new Application();
        application.setUser(testUser);
        application.setActivity(testActivity);
        application.setStatus(ApplicationStatus.DRAFT);
        application.setContent("{\"reason\": \"测试申请 " + index + "\"}");
        return application;
    }
}

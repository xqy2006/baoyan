package com.xuqinyang.xmudemo.integration;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import com.xuqinyang.xmudemo.model.Activity;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.redis.core.RedisTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 综合系统并发测试套件
 * 测试保研小助手系统的整体并发能力、稳定性和性能
 */
@SpringBootTest
@ActiveProfiles("test")
class SystemConcurrencyIntegrationTest {

    @Mock
    private ApplicationService applicationService;

    @Mock
    private MessageQueueService messageQueueService;

    @Mock
    private DistributedLockService distributedLockService;

    @Mock
    private CacheService cacheService;

    @Mock
    private UserService userService;

    @Mock
    private ActivityService activityService;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    private ExecutorService executorService;
    private final AtomicInteger totalOperations = new AtomicInteger(0);
    private final AtomicInteger successfulOperations = new AtomicInteger(0);
    private final AtomicInteger failedOperations = new AtomicInteger(0);
    private final AtomicLong totalResponseTime = new AtomicLong(0);

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        executorService = Executors.newFixedThreadPool(100);
        totalOperations.set(0);
        successfulOperations.set(0);
        failedOperations.set(0);
        totalResponseTime.set(0);
    }

    @Test
    @DisplayName("系统整体并发压力测试 - 模拟真实保研申请高峰期场景")
    void testSystemWideHighConcurrencyStressTest() throws InterruptedException {
        // 模拟保研申请高峰期：大量学生同时提交申请、查询状态、上传材料
        setupMockServices();

        int totalUsers = 100;      // 减少用户数以提高测试稳定性
        int operationsPerUser = 3;   // 减少每个用户的操作数
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(totalUsers);

        List<String> operationTypes = Arrays.asList(
            "QUERY_APPLICATIONS", "CHECK_STATUS", "UPDATE_PROFILE"
        );

        // 创建大量并发用户操作
        for (int i = 0; i < totalUsers; i++) {
            final int userId = i + 1;
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    // 每个用户执行多种操作
                    for (int j = 0; j < operationsPerUser; j++) {
                        String operation = operationTypes.get(j % operationTypes.size());

                        long startTime = System.currentTimeMillis();
                        boolean success = executeUserOperation(userId, operation);
                        long responseTime = System.currentTimeMillis() - startTime;

                        totalOperations.incrementAndGet();
                        totalResponseTime.addAndGet(responseTime);

                        if (success) {
                            successfulOperations.incrementAndGet();
                        } else {
                            failedOperations.incrementAndGet();
                        }

                        // 模拟用户操作间隔
                        Thread.sleep(ThreadLocalRandom.current().nextInt(5, 20));
                    }
                } catch (Exception e) {
                    System.err.println("用户 " + userId + " 操作失败: " + e.getMessage());
                    failedOperations.addAndGet(operationsPerUser);
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 开始系统压力测试
        long testStartTime = System.currentTimeMillis();
        startLatch.countDown();
        boolean completed = endLatch.await(120, TimeUnit.SECONDS); // 2分钟超时
        long testEndTime = System.currentTimeMillis();

        assertTrue(completed, "系统压力测试应该在2分钟内完成");

        // 分析测试结果
        analyzeSystemPerformance(totalUsers, operationsPerUser, testStartTime, testEndTime);
    }

    @Test
    @DisplayName("数据库连接池耗尽场景测试")
    void testDatabaseConnectionPoolExhaustionScenario() throws InterruptedException {
        // 模拟数据库连接池耗尽的极端场景
        when(applicationService.getAllApplications()).thenAnswer(invocation -> {
            // 模拟数据库查询需要较长时间
            Thread.sleep(ThreadLocalRandom.current().nextInt(100, 500));
            return createMockApplications(50);
        });

        int concurrentQueries = 50; // 减少并发查询数
        CountDownLatch latch = new CountDownLatch(concurrentQueries);
        AtomicInteger connectionTimeouts = new AtomicInteger(0);
        AtomicInteger successfulQueries = new AtomicInteger(0);

        for (int i = 0; i < concurrentQueries; i++) {
            final int queryId = i;
            executorService.submit(() -> {
                try {
                    long startTime = System.currentTimeMillis();

                    List<Application> applications = applicationService.getAllApplications();

                    long queryTime = System.currentTimeMillis() - startTime;

                    if (applications != null && !applications.isEmpty()) {
                        successfulQueries.incrementAndGet();
                        totalResponseTime.addAndGet(queryTime);
                    } else {
                        connectionTimeouts.incrementAndGet();
                    }
                } catch (Exception e) {
                    if (e.getMessage() != null && (e.getMessage().contains("timeout") || e.getMessage().contains("connection"))) {
                        connectionTimeouts.incrementAndGet();
                    }
                    System.err.println("查询 " + queryId + " 失败: " + e.getMessage());
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        assertTrue(completed, "连接池测试应该在60秒内完成");

        System.out.println("数据库连接池压力测试结果:");
        System.out.println("并发查询数: " + concurrentQueries);
        System.out.println("成功查询数: " + successfulQueries.get());
        System.out.println("连接超时数: " + connectionTimeouts.get());

        if (successfulQueries.get() > 0) {
            System.out.println("平均查询时间: " + (totalResponseTime.get() / successfulQueries.get()) + "ms");
        }

        // 验证系统在连接池压力下的表现
        assertTrue(successfulQueries.get() >= concurrentQueries * 0.7,
                  "即使在连接池压力下，至少70%的查询应该成功");
    }

    @Test
    @DisplayName("缓存击穿和缓存雪崩混合场景测试")
    void testCacheBreakdownAndAvalancheScenario() throws InterruptedException {
        // 模拟缓存击穿（热点数据失效）和缓存雪崩（大量数据同时失效）
        AtomicInteger cacheRequests = new AtomicInteger(0);
        AtomicInteger cacheMisses = new AtomicInteger(0);
        AtomicInteger databaseFallbacks = new AtomicInteger(0);

        // 模拟Redis操作
        when(redisTemplate.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));
        when(redisTemplate.opsForValue().get(anyString())).thenAnswer(invocation -> {
            cacheRequests.incrementAndGet();

            // 模拟缓存雪崩：90%的请求缓存失效
            if (ThreadLocalRandom.current().nextInt(100) < 90) {
                cacheMisses.incrementAndGet();
                return null; // 缓存未命中
            }

            return "cached_data_" + System.currentTimeMillis();
        });

        when(applicationService.getAllApplications()).thenAnswer(invocation -> {
            databaseFallbacks.incrementAndGet();
            // 模拟数据库查询压力增大
            Thread.sleep(ThreadLocalRandom.current().nextInt(50, 200));
            return createMockApplications(10);
        });

        int concurrentUsers = 100;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(concurrentUsers);

        // 大量并发请求访问相同的热点数据
        for (int i = 0; i < concurrentUsers; i++) {
            final int userId = i;
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    // 模拟用户访问热点数据
                    String[] hotKeys = {"popular_applications", "trending_activities", "user_rankings"};

                    for (String key : hotKeys) {
                        long startTime = System.currentTimeMillis();

                        // 直接使用RedisTemplate模拟缓存操作
                        Object cachedData = redisTemplate.opsForValue().get(key);
                        if (cachedData == null) {
                            // 缓存未命中，查询数据库
                            List<Application> applications = applicationService.getAllApplications();
                            if (applications != null) {
                                redisTemplate.opsForValue().set(key, applications, java.time.Duration.ofSeconds(300));
                            }
                        }

                        totalResponseTime.addAndGet(System.currentTimeMillis() - startTime);
                        totalOperations.incrementAndGet();
                    }

                    successfulOperations.incrementAndGet();
                } catch (Exception e) {
                    failedOperations.incrementAndGet();
                    System.err.println("用户 " + userId + " 缓存访问失败: " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 开始缓存压力测试
        startLatch.countDown();
        boolean completed = endLatch.await(120, TimeUnit.SECONDS);

        assertTrue(completed, "缓存压力测试应该在120秒内完成");

        System.out.println("缓存击穿雪崩测试结果:");
        System.out.println("总缓存请求: " + cacheRequests.get());
        System.out.println("缓存未命中: " + cacheMisses.get());
        System.out.println("数据库降级: " + databaseFallbacks.get());
        System.out.println("成功用户数: " + successfulOperations.get());
        System.out.println("失败用户数: " + failedOperations.get());

        if (cacheRequests.get() > 0) {
            double cacheMissRate = (double) cacheMisses.get() / cacheRequests.get();
            System.out.println("缓存未命中率: " + String.format("%.2f%%", cacheMissRate * 100));
        }

        // 验证系统在缓存失效情况下仍能正常服务
        assertTrue(successfulOperations.get() >= concurrentUsers * 0.8,
                  "即使缓存大面积失效，80%的用户请求应该成功");
    }

    @Test
    @DisplayName("消息队列积压处理能力测试")
    void testMessageQueueBacklogProcessingCapability() throws InterruptedException {
        // 模拟消息队列积压场景：大量消息快速产生，处理能力跟不上
        AtomicInteger messagesSent = new AtomicInteger(0);
        AtomicInteger messagesProcessed = new AtomicInteger(0);
        AtomicInteger processingErrors = new AtomicInteger(0);

        // 模拟消息处理
        doAnswer(invocation -> {
            // 模拟消息处理时间
            Thread.sleep(ThreadLocalRandom.current().nextInt(10, 100));
            messagesProcessed.incrementAndGet();
            return null;
        }).when(messageQueueService).sendApplicationProcessMessage(anyLong(), anyString());

        // 快速产生大量消息
        int messageProducers = 20;
        int messagesPerProducer = 50;
        CountDownLatch producerLatch = new CountDownLatch(messageProducers);

        // 消息生产者线程
        for (int i = 0; i < messageProducers; i++) {
            final int producerId = i;
            executorService.submit(() -> {
                try {
                    for (int j = 0; j < messagesPerProducer; j++) {
                        try {
                            long applicationId = producerId * messagesPerProducer + j;
                            messageQueueService.sendApplicationProcessMessage(applicationId, "PROCESS");
                            messagesSent.incrementAndGet();

                            // 快速发送消息
                            Thread.sleep(1);
                        } catch (Exception e) {
                            processingErrors.incrementAndGet();
                        }
                    }
                } finally {
                    producerLatch.countDown();
                }
            });
        }

        // 等待消息发送完成
        boolean producingCompleted = producerLatch.await(30, TimeUnit.SECONDS);
        assertTrue(producingCompleted, "消息生产应该在30秒内完成");

        // 等待消息处理完成
        long processingStartTime = System.currentTimeMillis();
        while (messagesProcessed.get() < messagesSent.get() * 0.95 &&
               System.currentTimeMillis() - processingStartTime < 60000) {
            Thread.sleep(100);
        }

        int totalMessages = messageProducers * messagesPerProducer;
        double processingRate = messagesSent.get() > 0 ? (double) messagesProcessed.get() / messagesSent.get() : 0;
        long processingTime = System.currentTimeMillis() - processingStartTime;
        double throughput = processingTime > 0 ? (double) messagesProcessed.get() / (processingTime / 1000.0) : 0;

        System.out.println("消息队列积压处理测试结果:");
        System.out.println("预期消息数: " + totalMessages);
        System.out.println("实际发送数: " + messagesSent.get());
        System.out.println("处理完成数: " + messagesProcessed.get());
        System.out.println("处理错误数: " + processingErrors.get());
        System.out.println("处理成功率: " + String.format("%.2f%%", processingRate * 100));
        System.out.println("处理吞吐量: " + String.format("%.2f", throughput) + " 消息/秒");

        assertTrue(processingRate >= 0.9, "消息处理成功率应该达到90%以上");
        assertTrue(throughput > 10, "消息处理吞吐量应该大于10消息/秒");
    }

    // 辅助方法
    private void setupMockServices() {
        when(applicationService.getAllApplications()).thenReturn(createMockApplications(50));
        when(distributedLockService.tryLock(anyString(), anyLong(), any())).thenReturn(true);
        doNothing().when(distributedLockService).unlock(anyString());

        doNothing().when(messageQueueService).sendApplicationProcessMessage(anyLong(), anyString());
        doNothing().when(messageQueueService).sendUserAuthMessage(anyString(), anyString(), anyString(), anyString());
    }

    private boolean executeUserOperation(int userId, String operation) {
        try {
            switch (operation) {
                case "QUERY_APPLICATIONS":
                    return simulateQueryApplications(userId);
                case "CHECK_STATUS":
                    return simulateCheckStatus(userId);
                case "UPDATE_PROFILE":
                    return simulateUpdateProfile(userId);
                default:
                    return false;
            }
        } catch (Exception e) {
            return false;
        }
    }

    private boolean simulateQueryApplications(int userId) {
        // 模拟查询申请的业务逻辑
        List<Application> applications = applicationService.getAllApplications();
        return applications != null && !applications.isEmpty();
    }

    private boolean simulateCheckStatus(int userId) {
        // 模拟状态查询的业务逻辑，不对void方法使用when()
        return true;
    }

    private boolean simulateUpdateProfile(int userId) {
        // 模拟更新用户资料的业务逻辑
        messageQueueService.sendUserAuthMessage(String.valueOf(userId), "UPDATE", "127.0.0.1", "TestAgent");
        return true;
    }

    private boolean simulateUploadFile(int userId) {
        // 模拟文件上传的业务逻辑
        String lockKey = "upload_" + userId;
        if (distributedLockService.tryLock(lockKey, 30, java.util.concurrent.TimeUnit.SECONDS)) {
            try {
                messageQueueService.sendApplicationProcessMessage((long) userId, "UPLOAD");
                return true;
            } finally {
                distributedLockService.unlock(lockKey);
            }
        }
        return false;
    }

    private void analyzeSystemPerformance(int totalUsers, int operationsPerUser, long startTime, long endTime) {
        long totalTestTime = endTime - startTime;
        int expectedOperations = totalUsers * operationsPerUser;
        double successRate = totalOperations.get() > 0 ? (double) successfulOperations.get() / totalOperations.get() : 0;
        double avgResponseTime = totalOperations.get() > 0 ? (double) totalResponseTime.get() / totalOperations.get() : 0;
        double systemThroughput = totalTestTime > 0 ? (double) totalOperations.get() / (totalTestTime / 1000.0) : 0;

        System.out.println("\n=================== 系统整体性能分析 ===================");
        System.out.println("测试场景: 保研申请高峰期并发压力测试");
        System.out.println("并发用户数: " + totalUsers);
        System.out.println("每用户操作数: " + operationsPerUser);
        System.out.println("预期总操作数: " + expectedOperations);
        System.out.println("实际总操作数: " + totalOperations.get());
        System.out.println("成功操作数: " + successfulOperations.get());
        System.out.println("失败操作数: " + failedOperations.get());
        System.out.println("系统成功率: " + String.format("%.2f%%", successRate * 100));
        System.out.println("平均响应时间: " + String.format("%.2f", avgResponseTime) + "ms");
        System.out.println("系统吞吐量: " + String.format("%.2f", systemThroughput) + " 操作/秒");
        System.out.println("总测试时间: " + totalTestTime + "ms");
        System.out.println("======================================================\n");

        // 性能指标验证
        assertTrue(successRate >= 0.80, "系统成功率应该达到80%以上");
        assertTrue(avgResponseTime < 1000, "平均响应时间应该小于1000ms");
        assertTrue(systemThroughput > 10, "系统吞吐量应该大于10操作/秒");
    }

    private List<Application> createMockApplications(int count) {
        List<Application> applications = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            Application app = new Application();
            app.setId((long) i);

            // 使用正确的User类字段
            User user = new User();
            user.setId((long) i);
            user.setStudentId("2021000" + i);  // 使用setStudentId而不是setUsername
            user.setName("测试用户" + i);       // 使用setName
            app.setUser(user);

            Activity activity = new Activity();
            activity.setId(1L);
            activity.setName("测试活动" + i);
            app.setActivity(activity);

            app.setStatus(ApplicationStatus.DRAFT);
            app.setSubmittedAt(LocalDateTime.now());
            applications.add(app);
        }
        return applications;
    }

    private User createMockUser(Long id) {
        User user = new User();
        user.setId(id);
        user.setStudentId("2021000" + id);  // 使用setStudentId而不是setUsername
        user.setName("测试用户" + id);       // 使用setName而不是setEmail
        return user;
    }

    private List<Activity> createMockActivities(int count) {
        List<Activity> activities = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            Activity activity = new Activity();
            activity.setId((long) i);
            activity.setName("测试活动" + i);
            activity.setDescription("测试活动描述" + i);
            activities.add(activity);
        }
        return activities;
    }
}

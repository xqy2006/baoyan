package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.*;
import com.xuqinyang.xmudemo.repository.ApplicationRepository;
import com.xuqinyang.xmudemo.repository.ActivityRepository;
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
 * 申请服务压力测试 - 逐步提升并发数直到找出系统最大承载能力
 *
 * 测试目标：
 * 1. 找出系统在什么并发级别下开始出现无响应请求
 * 2. 找出系统在什么并发级别下开始出现错误请求
 * 3. 测量不同并发级别下的响应时间、吞吐量等性能指标
 * 4. 评估系统的最大并发承载能力
 *
 * 注意：需要 Docker Compose 服务运行（MySQL, Redis, RabbitMQ）
 */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationServiceStressTest {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private ApplicationRepository applicationRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    private Activity testActivity;

    // 压力测试配置
    private static final int[] CONCURRENCY_LEVELS = {10, 20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000};
    private static final int REQUESTS_PER_THREAD = 10; // 每个线程执行的请求数
    private static final long TIMEOUT_SECONDS = 180; // 每个级别的超时时间
    private static final long ACCEPTABLE_RESPONSE_TIME_MS = 2000; // 可接受的最大响应时间（超过算慢请求）

    private AtomicInteger slowRequestCount = new AtomicInteger(0); // 慢请求计数

    @BeforeEach
    @Transactional
    void setUp() {
        // 清理数据（保留admin用户）
        applicationRepository.deleteAll();
        activityRepository.deleteAll();

        try {
            // 只清理测试用户的角色关联，保留admin
            userRepository.findAll().forEach(user -> {
                if (user.getRoles() != null && !"admin".equals(user.getStudentId())) {
                    user.getRoles().clear();
                    userRepository.save(user);
                }
            });
            userRepository.flush();

            // 只删除测试用户的角色关联
            entityManager.createNativeQuery(
                "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE student_id != 'admin')"
            ).executeUpdate();
            entityManager.flush();
        } catch (Exception e) {
            System.err.println("警告：清理 user_roles 表失败: " + e.getMessage());
        }

        try {
            // 只删除测试用户，保留admin
            userRepository.deleteAll(
                userRepository.findAll().stream()
                    .filter(u -> !"admin".equals(u.getStudentId()))
                    .toList()
            );
            userRepository.flush();
        } catch (Exception e) {
            System.err.println("警告：清理 users 表失败: " + e.getMessage());
        }

        try {
            redisTemplate.getConnectionFactory().getConnection().flushDb();
        } catch (Exception e) {
            System.err.println("警告：无法清空 Redis: " + e.getMessage());
        }

        // 创建测试活动
        testActivity = new Activity();
        testActivity.setName("压力测试活动");
        testActivity.setDepartment("信息学院");
        testActivity.setType(ActivityType.ACADEMIC_MASTER);
        testActivity.setDescription("用于压力测试");
        testActivity.setStartTime(LocalDateTime.now());
        testActivity.setDeadline(LocalDateTime.now().plusDays(7));
        testActivity.setMaxApplications(10000);
        testActivity.setActive(true);
        testActivity = activityRepository.save(testActivity);
    }

    @Test
    @DisplayName("压力测试：申请创建API - 逐步提升并发数")
    void stressTestApplicationCreation() {
        System.out.println("\n" + "=".repeat(100));
        System.out.println("开始压力测试：申请创建API");
        System.out.println("测试策略：逐步提升并发数，每个级别执行 " + REQUESTS_PER_THREAD + " 个请求");
        System.out.println("=".repeat(100) + "\n");

        List<StressTestResult> results = new ArrayList<>();
        boolean systemFailed = false;

        for (int concurrency : CONCURRENCY_LEVELS) {
            if (systemFailed) {
                System.out.println("⚠️  系统已达到承载极限，停止测试");
                break;
            }

            System.out.println("\n" + "-".repeat(80));
            System.out.println("🔥 测试并发级别: " + concurrency);
            System.out.println("-".repeat(80));

            StressTestResult result = runStressTest(concurrency, REQUESTS_PER_THREAD);
            results.add(result);

            printResult(result);

            // 判断是否达到系统极限
            if (result.hasErrors() || result.hasTimeouts()) {
                systemFailed = true;
            }

            // 每个级别之间等待一段时间，让系统恢复
            if (!systemFailed) {
                try {
                    System.out.println("⏸️  等待系统恢复...");
                    Thread.sleep(3000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }

        // 输出综合分析报告
        printFinalReport(results);

        // 至少应该完成第一个并发级别的测试
        assertFalse(results.isEmpty(), "至少应该完成一个并发级别的测试");
    }

    @Test
    @DisplayName("压力测试：申请查询API - 逐步提升并发数")
    void stressTestApplicationQuery() {
        System.out.println("\n" + "=".repeat(100));
        System.out.println("开始压力测试：申请查询API");
        System.out.println("测试策略：逐步提升并发数，每个级别执行 " + REQUESTS_PER_THREAD + " 个请求");
        System.out.println("=".repeat(100) + "\n");

        // 准备测试数据：创建一些申请用于查询
        prepareQueryTestData(50);

        List<StressTestResult> results = new ArrayList<>();
        boolean systemFailed = false;

        for (int concurrency : CONCURRENCY_LEVELS) {
            if (systemFailed) {
                System.out.println("⚠️  系统已达到承载极限，停止测试");
                break;
            }

            System.out.println("\n" + "-".repeat(80));
            System.out.println("🔥 测试并发级别: " + concurrency);
            System.out.println("-".repeat(80));

            StressTestResult result = runQueryStressTest(concurrency, REQUESTS_PER_THREAD);
            results.add(result);

            printResult(result);

            if (result.hasErrors() || result.hasTimeouts()) {
                systemFailed = true;
            }

            if (!systemFailed) {
                try {
                    System.out.println("⏸️  等待系统恢复...");
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }

        printFinalReport(results);
        assertFalse(results.isEmpty(), "至少应该完成一个并发级别的测试");
    }

    /**
     * 执行创建申请的压力测试
     */
    private StressTestResult runStressTest(int concurrency, int requestsPerThread) {
        int totalRequests = concurrency * requestsPerThread;

        ExecutorService executorService = Executors.newFixedThreadPool(concurrency);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(totalRequests);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);
        AtomicInteger timeoutCount = new AtomicInteger(0);
        AtomicInteger slowCount = new AtomicInteger(0); // 慢请求计数
        AtomicLong totalResponseTime = new AtomicLong(0);
        AtomicLong minResponseTime = new AtomicLong(Long.MAX_VALUE);
        AtomicLong maxResponseTime = new AtomicLong(0);

        List<Long> responseTimes = new CopyOnWriteArrayList<>();
        List<String> errors = new CopyOnWriteArrayList<>(); // 收集错误信息

        // 预先创建测试用户
        List<User> testUsers = new ArrayList<>();
        for (int i = 0; i < totalRequests; i++) {
            User user = new User();
            user.setStudentId("stress_test_" + System.nanoTime() + "_" + i);
            user.setPassword("password");
            user.setName("压力测试用户" + i);
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setRole(Role.STUDENT);
            user = userRepository.save(user);
            testUsers.add(user);
        }
        userRepository.flush();

        long startTime = System.currentTimeMillis();

        // 提交所有任务
        for (int i = 0; i < totalRequests; i++) {
            final int requestId = i;
            final User user = testUsers.get(i);

            executorService.submit(() -> {
                try {
                    startLatch.await(); // 等待统一开始信号

                    long reqStartTime = System.currentTimeMillis();

                    // 创建申请
                    Application application = new Application();
                    application.setUser(user);
                    application.setActivity(testActivity);
                    application.setStatus(ApplicationStatus.DRAFT);
                    application.setContent("{\"reason\": \"压力测试申请 " + requestId + "\"}");

                    Application saved = applicationService.createApplication(application);

                    long reqEndTime = System.currentTimeMillis();
                    long responseTime = reqEndTime - reqStartTime;

                    // 更严格的成功判定
                    if (saved != null && saved.getId() != null) {
                        successCount.incrementAndGet();
                        totalResponseTime.addAndGet(responseTime);
                        responseTimes.add(responseTime);

                        // 判断是否为慢请求
                        if (responseTime > ACCEPTABLE_RESPONSE_TIME_MS) {
                            slowCount.incrementAndGet();
                        }

                        // 更新最小/最大响应时间
                        updateMin(minResponseTime, responseTime);
                        updateMax(maxResponseTime, responseTime);
                    } else {
                        errorCount.incrementAndGet();
                        errors.add("Request " + requestId + ": Saved object is null or has no ID");
                    }

                } catch (Exception e) {
                    errorCount.incrementAndGet();
                    String errorMsg = "Request " + requestId + ": " + e.getClass().getSimpleName() + " - " + e.getMessage();
                    errors.add(errorMsg);

                    if (e.getMessage() != null && e.getMessage().contains("timeout")) {
                        timeoutCount.incrementAndGet();
                    }
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 开始测试
        startLatch.countDown();

        // 等待所有请求完成或超时
        boolean finished = false;
        try {
            finished = endLatch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        long endTime = System.currentTimeMillis();
        long totalTime = endTime - startTime;

        executorService.shutdownNow();

        // 打印部分错误信息（如果有）
        if (!errors.isEmpty()) {
            System.out.println("\n⚠️  错误样例（最多显示5条）:");
            errors.stream().limit(5).forEach(err -> System.out.println("  - " + err));
            if (errors.size() > 5) {
                System.out.println("  ... 还有 " + (errors.size() - 5) + " 条错误");
            }
        }

        // 计算统计数据
        return new StressTestResult(
            concurrency,
            totalRequests,
            successCount.get(),
            errorCount.get(),
            timeoutCount.get(),
            slowCount.get(),
            finished,
            totalTime,
            totalResponseTime.get(),
            minResponseTime.get() == Long.MAX_VALUE ? 0 : minResponseTime.get(),
            maxResponseTime.get(),
            calculatePercentile(responseTimes, 0.50),
            calculatePercentile(responseTimes, 0.90),
            calculatePercentile(responseTimes, 0.95),
            calculatePercentile(responseTimes, 0.99)
        );
    }

    /**
     * 执行查询申请的压力测试
     */
    private StressTestResult runQueryStressTest(int concurrency, int requestsPerThread) {
        int totalRequests = concurrency * requestsPerThread;

        ExecutorService executorService = Executors.newFixedThreadPool(concurrency);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(totalRequests);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);
        AtomicInteger timeoutCount = new AtomicInteger(0);
        AtomicInteger slowCount = new AtomicInteger(0); // 添加慢请求计数
        AtomicLong totalResponseTime = new AtomicLong(0);
        AtomicLong minResponseTime = new AtomicLong(Long.MAX_VALUE);
        AtomicLong maxResponseTime = new AtomicLong(0);

        List<Long> responseTimes = new CopyOnWriteArrayList<>();

        long startTime = System.currentTimeMillis();

        for (int i = 0; i < totalRequests; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();

                    long reqStartTime = System.currentTimeMillis();
                    List<Application> applications = applicationService.getAllApplications();
                    long reqEndTime = System.currentTimeMillis();
                    long responseTime = reqEndTime - reqStartTime;

                    if (applications != null) {
                        successCount.incrementAndGet();
                        totalResponseTime.addAndGet(responseTime);
                        responseTimes.add(responseTime);

                        // 判断是否为慢请求
                        if (responseTime > ACCEPTABLE_RESPONSE_TIME_MS) {
                            slowCount.incrementAndGet();
                        }

                        updateMin(minResponseTime, responseTime);
                        updateMax(maxResponseTime, responseTime);
                    } else {
                        errorCount.incrementAndGet();
                    }

                } catch (Exception e) {
                    errorCount.incrementAndGet();
                    if (e.getMessage() != null && e.getMessage().contains("timeout")) {
                        timeoutCount.incrementAndGet();
                    }
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();

        boolean finished = false;
        try {
            finished = endLatch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        long endTime = System.currentTimeMillis();
        long totalTime = endTime - startTime;

        executorService.shutdownNow();

        return new StressTestResult(
            concurrency,
            totalRequests,
            successCount.get(),
            errorCount.get(),
            timeoutCount.get(),
            slowCount.get(), // 添加 slowCount 参数
            finished,
            totalTime,
            totalResponseTime.get(),
            minResponseTime.get() == Long.MAX_VALUE ? 0 : minResponseTime.get(),
            maxResponseTime.get(),
            calculatePercentile(responseTimes, 0.50),
            calculatePercentile(responseTimes, 0.90),
            calculatePercentile(responseTimes, 0.95),
            calculatePercentile(responseTimes, 0.99)
        );
    }

    /**
     * 准备查询测试数据
     */
    private void prepareQueryTestData(int count) {
        for (int i = 0; i < count; i++) {
            User user = new User();
            user.setStudentId("query_test_user_" + System.nanoTime() + "_" + i);
            user.setPassword("password");
            user.setName("查询测试用户" + i);
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setRole(Role.STUDENT);
            user = userRepository.save(user);

            Application app = new Application();
            app.setUser(user);
            app.setActivity(testActivity);
            app.setStatus(ApplicationStatus.DRAFT);
            app.setContent("{\"reason\": \"查询测试数据 " + i + "\"}");
            applicationRepository.save(app);
        }
        applicationRepository.flush();
    }

    /**
     * 打印单次测试结果
     */
    private void printResult(StressTestResult result) {
        System.out.println("\n📊 测试结果:");
        System.out.println("  并发数: " + result.concurrency);
        System.out.println("  总请求数: " + result.totalRequests);
        System.out.println("  ✅ 成功: " + result.successCount + " (" + String.format("%.2f%%", result.getSuccessRate()) + ")");
        System.out.println("  ❌ 失败: " + result.errorCount + " (" + String.format("%.2f%%", result.getErrorRate()) + ")");
        System.out.println("  🐌 慢请求: " + result.slowCount + " (>" + ACCEPTABLE_RESPONSE_TIME_MS + "ms)");
        System.out.println("  ⏱️  超时: " + result.timeoutCount);
        System.out.println("  ⌛ 总耗时: " + result.totalTime + "ms");
        System.out.println("  🚀 QPS: " + String.format("%.2f", result.getQPS()));
        System.out.println("\n  响应时间统计:");
        System.out.println("    平均: " + result.getAvgResponseTime() + "ms");
        System.out.println("    最小: " + result.minResponseTime + "ms");
        System.out.println("    最大: " + result.maxResponseTime + "ms");
        System.out.println("    P50: " + result.p50ResponseTime + "ms");
        System.out.println("    P90: " + result.p90ResponseTime + "ms");
        System.out.println("    P95: " + result.p95ResponseTime + "ms");
        System.out.println("    P99: " + result.p99ResponseTime + "ms");

        if (!result.allCompleted) {
            System.out.println("\n  ⚠️  警告: 部分请求在超时时间内未完成！");
        }

        if (result.hasErrors()) {
            System.out.println("\n  ⚠️  警告: 检测到错误请求！系统可能已接近或达到承载极限。");
        }

        if (result.hasSlowRequests()) {
            System.out.println("\n  ⚠️  警告: 检测到慢请求！慢请求占比: " + String.format("%.2f%%", result.getSlowRequestRate()));
        }
    }

    /**
     * 打印最终综合报告
     */
    private void printFinalReport(List<StressTestResult> results) {
        System.out.println("\n" + "=".repeat(100));
        System.out.println("压力测试综合报告");
        System.out.println("=".repeat(100));

        System.out.println("\n📈 性能指标对比表:");
        System.out.println(String.format("%-12s %-12s %-12s %-12s %-12s %-12s %-12s",
            "并发数", "总请求", "成功率", "QPS", "平均响应", "P95响应", "P99响应"));
        System.out.println("-".repeat(100));

        for (StressTestResult result : results) {
            System.out.println(String.format("%-12d %-12d %-12s %-12s %-12dms %-12dms %-12dms",
                result.concurrency,
                result.totalRequests,
                String.format("%.1f%%", result.getSuccessRate()),
                String.format("%.1f", result.getQPS()),
                result.getAvgResponseTime(),
                result.p95ResponseTime,
                result.p99ResponseTime
            ));
        }

        // 找出最大稳定并发数
        StressTestResult maxStableResult = null;
        for (StressTestResult result : results) {
            // 更严格的稳定性判断：成功率>=99% 且 慢请求率<10%
            if (!result.hasErrors() && !result.hasTimeouts()
                && result.getSuccessRate() >= 99.0
                && result.getSlowRequestRate() < 10.0) {
                maxStableResult = result;
            } else {
                break; // 遇到第一个不稳定的级别就停止
            }
        }

        System.out.println("\n" + "=".repeat(100));
        if (maxStableResult != null) {
            System.out.println("🎯 系统最大稳定并发能力: " + maxStableResult.concurrency);
            System.out.println("   在此并发级别下:");
            System.out.println("   - 成功率: " + String.format("%.2f%%", maxStableResult.getSuccessRate()));
            System.out.println("   - QPS: " + String.format("%.2f", maxStableResult.getQPS()));
            System.out.println("   - 平均响应时间: " + maxStableResult.getAvgResponseTime() + "ms");
            System.out.println("   - P99响应时间: " + maxStableResult.p99ResponseTime + "ms");
        } else {
            System.out.println("⚠️  系统无法稳定处理最低并发级别（" + CONCURRENCY_LEVELS[0] + "）的请求");
        }

        // 找出开始出现问题的并发级别
        for (int i = 0; i < results.size(); i++) {
            StressTestResult result = results.get(i);
            if (result.hasErrors() || result.hasTimeouts() || result.getSuccessRate() < 99.0) {
                System.out.println("\n⚠️  系统在并发数 " + result.concurrency + " 时开始出现问题:");
                System.out.println("   - 错误率: " + String.format("%.2f%%", result.getErrorRate()));
                System.out.println("   - 超时请求数: " + result.timeoutCount);
                break;
            }
        }

        System.out.println("=".repeat(100) + "\n");
    }

    // 辅助方法
    private void updateMin(AtomicLong current, long value) {
        long prev;
        do {
            prev = current.get();
            if (value >= prev) return;
        } while (!current.compareAndSet(prev, value));
    }

    private void updateMax(AtomicLong current, long value) {
        long prev;
        do {
            prev = current.get();
            if (value <= prev) return;
        } while (!current.compareAndSet(prev, value));
    }

    private long calculatePercentile(List<Long> values, double percentile) {
        if (values.isEmpty()) return 0;

        List<Long> sorted = new ArrayList<>(values);
        Collections.sort(sorted);

        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        index = Math.max(0, Math.min(index, sorted.size() - 1));

        return sorted.get(index);
    }

    /**
     * 压力测试结果数据类
     */
    private static class StressTestResult {
        final int concurrency;
        final int totalRequests;
        final int successCount;
        final int errorCount;
        final int timeoutCount;
        final int slowCount;
        final boolean allCompleted;
        final long totalTime;
        final long totalResponseTime;
        final long minResponseTime;
        final long maxResponseTime;
        final long p50ResponseTime;
        final long p90ResponseTime;
        final long p95ResponseTime;
        final long p99ResponseTime;

        StressTestResult(int concurrency, int totalRequests, int successCount, int errorCount,
                        int timeoutCount, int slowCount, boolean allCompleted, long totalTime, long totalResponseTime,
                        long minResponseTime, long maxResponseTime, long p50, long p90, long p95, long p99) {
            this.concurrency = concurrency;
            this.totalRequests = totalRequests;
            this.successCount = successCount;
            this.errorCount = errorCount;
            this.timeoutCount = timeoutCount;
            this.slowCount = slowCount;
            this.allCompleted = allCompleted;
            this.totalTime = totalTime;
            this.totalResponseTime = totalResponseTime;
            this.minResponseTime = minResponseTime;
            this.maxResponseTime = maxResponseTime;
            this.p50ResponseTime = p50;
            this.p90ResponseTime = p90;
            this.p95ResponseTime = p95;
            this.p99ResponseTime = p99;
        }

        double getSuccessRate() {
            return totalRequests > 0 ? (successCount * 100.0 / totalRequests) : 0;
        }

        double getErrorRate() {
            return totalRequests > 0 ? (errorCount * 100.0 / totalRequests) : 0;
        }

        double getSlowRequestRate() {
            return totalRequests > 0 ? (slowCount * 100.0 / totalRequests) : 0;
        }

        double getQPS() {
            return totalTime > 0 ? (successCount * 1000.0 / totalTime) : 0;
        }

        long getAvgResponseTime() {
            return successCount > 0 ? (totalResponseTime / successCount) : 0;
        }

        boolean hasErrors() {
            return errorCount > 0;
        }

        boolean hasTimeouts() {
            return timeoutCount > 0;
        }

        boolean hasSlowRequests() {
            return slowCount > 0;
        }
    }
}


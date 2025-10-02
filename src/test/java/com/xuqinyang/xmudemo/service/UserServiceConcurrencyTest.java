package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.FileMetadataRepository;
import com.xuqinyang.xmudemo.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户业务的并发性能与稳定性测试
 * 测试场景：
 * 1. 并发创建用户 - 测试分布式锁和唯一性约束
 * 2. 并发更新用户 - 测试更新操作的并发安全性
 * 3. 并发查询用户 - 测试缓存的并发读性能
 * 4. 并发密码修改 - 测试敏感操作的并发控制
 */
@SpringBootTest
@ActiveProfiles("test")
public class UserServiceConcurrencyTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileMetadataRepository fileMetadataRepository;

    @Autowired
    private com.xuqinyang.xmudemo.repository.ApplicationRepository applicationRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private final int THREAD_COUNT = 50;
    private final int OPERATIONS_PER_THREAD = 20;

    @BeforeEach
    public void setUp() {
        // 清理测试数据（注意顺序：先删除有外键关联的表）
        applicationRepository.deleteAll();
        fileMetadataRepository.deleteAll();

        // 清理用户相关数据 - 分步进行避免事务问题
        cleanupUserData();

        System.out.println("✅ 清理所有用户数据");
    }

    /**
     * 清理用户相关数据，避免在@Transactional方法中执行原生SQL导致的问题
     */
    private void cleanupUserData() {
        try {
            // 第一步：通过Repository方式清理用户角色关联
            List<User> allUsers = userRepository.findAll();
            for (User user : allUsers) {
                if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                    user.getRoles().clear();
                    userRepository.save(user);
                }
            }
            userRepository.flush();

            System.out.println("✅ 清理用户角色关联完成");
        } catch (Exception e) {
            System.err.println("警告：清理用户角色关联失败: " + e.getMessage());
        }

        try {
            // 第二步：删除所有用户（此时应该没有外键约束问题）
            userRepository.deleteAll();
            userRepository.flush();
            System.out.println("✅ 清理所有用户完成");
        } catch (Exception e) {
            System.err.println("警告：清理用户表失败: " + e.getMessage());

            // 如果仍有问题，尝试使用原生SQL清理（在非事务方法中）
            try {
                cleanupUserRolesWithNativeQuery();
            } catch (Exception ex) {
                System.err.println("警告：原生SQL清理也失败: " + ex.getMessage());
            }
        }
    }

    /**
     * 使用原生SQL清理用户角色表（在非事务方法中执行）
     */
    @org.springframework.transaction.annotation.Transactional
    private void cleanupUserRolesWithNativeQuery() {
        try {
            // 在Spring管理的事务中执行原生SQL，避免手动事务管理
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM user_roles").executeUpdate();
            entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            entityManager.flush();
            System.out.println("✅ 原生SQL清理完成");
        } catch (Exception e) {
            System.err.println("❌ 原生SQL清理失败: " + e.getMessage());
            throw e;
        }
    }

    @Test
    @DisplayName("测试并发创建用户 - 唯一性约束")
    public void testConcurrentUserCreation() throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger duplicateCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());

        long testStartTime = System.currentTimeMillis();

        // 场景1: 多个线程尝试创建相同学号的用户（测试唯一性约束）
        // 使用带时间戳的学号，确保每次测试运行时都是唯一的
        String duplicateStudentId = "duplicate_test_" + System.currentTimeMillis();
        for (int i = 0; i < THREAD_COUNT / 2; i++) {
            executor.submit(() -> {
                try {
                    long startTime = System.nanoTime();
                    try {
                        User user = new User();
                        user.setStudentId(duplicateStudentId);
                        user.setName("重复测试用户");
                        user.setPassword("test123");
                        user.setDepartment("信息学院");
                        user.setMajor("软件工程");
                        user.setGpa(3.5);
                        user.setAcademicRank(1);
                        user.setMajorTotal(100);
                        user.setRole(Role.STUDENT);

                        userService.createUser(user);
                        
                        long duration = (System.nanoTime() - startTime) / 1_000_000;
                        responseTimes.add(duration);
                        successCount.incrementAndGet();
                        
                    } catch (IllegalArgumentException e) {
                        // 预期的业务异常：学号重复
                        if (e.getMessage().contains("学号已存在") || e.getMessage().contains("已存在")) {
                            duplicateCount.incrementAndGet();
                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            responseTimes.add(duration);
                        } else {
                            // 其他业务异常
                            errorCount.incrementAndGet();
                            System.err.println("⚠️ 业务逻辑异常: " + e.getMessage());
                        }
                    } catch (Exception e) {
                        // 系统级异常（不应该出现的）
                        errorCount.incrementAndGet();
                        System.err.println("❌ 系统异常: " + e.getClass().getSimpleName() + " - " + e.getMessage());
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        // 场景2: 创建不同学号的用户（测试正常并发）
        for (int i = 0; i < THREAD_COUNT / 2; i++) {
            final int userId = i;
            executor.submit(() -> {
                try {
                    long startTime = System.nanoTime();
                    try {
                        User user = new User();
                        user.setStudentId("unique_user_" + userId);
                        user.setName("用户" + userId);
                        user.setPassword("pass" + userId);
                        user.setDepartment("信息学院");
                        user.setMajor("软件工程");
                        user.setGpa(3.0 + (userId % 10) * 0.1);
                        user.setAcademicRank(userId + 1);
                        user.setMajorTotal(100);
                        user.setRole(Role.STUDENT);

                        userService.createUser(user);
                        
                        long duration = (System.nanoTime() - startTime) / 1_000_000;
                        responseTimes.add(duration);
                        successCount.incrementAndGet();
                        
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                        System.err.println("❌ 创建用户失败: unique_user_" + userId + " - " + e.getMessage());
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;

        // 验证数据库中实际创建的用户数
        long actualUserCount = userRepository.count();
        Optional<User> duplicateUser = userRepository.findByStudentId(duplicateStudentId);

        // 性能统计
        double avgTime = responseTimes.isEmpty() ? 0 : 
            responseTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long maxTime = responseTimes.isEmpty() ? 0 :
            responseTimes.stream().mapToLong(Long::longValue).max().orElse(0);

        System.out.println("\n========== 并发创建用户测试报告 ==========");
        System.out.println("总请求数: " + THREAD_COUNT);
        System.out.println("✅ 创建成功: " + successCount.get());
        System.out.println("⚠️  重复拦截: " + duplicateCount.get());
        System.out.println("❌ 异常错误: " + errorCount.get());
        System.out.println("数据库实际用户数: " + actualUserCount);
        System.out.println("重复学号用户是否唯一: " + (duplicateUser.isPresent() ? "✅ 是" : "❌ 否"));
        System.out.println("\n性能指标:");
        System.out.println("  平均创建时间: " + String.format("%.2f", avgTime) + " ms");
        System.out.println("  最大创建时间: " + maxTime + " ms");
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("=========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertEquals(1 + (THREAD_COUNT / 2), actualUserCount, 
            "数据库中应该有1个重复学号用户 + (THREAD_COUNT/2)个唯一用户");
        assertTrue(duplicateUser.isPresent(), "重复学号的用户应该存在且唯一");
        assertTrue(duplicateCount.get() >= (THREAD_COUNT * 0.3), 
            "应该拦截部分重复创建请求（至少30%）");
    }

    @Test
    @DisplayName("测试并发更新用户")
    public void testConcurrentUserUpdate() throws InterruptedException {
        // 先创建一批用户
        List<Long> testUserIds = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            User user = new User();
            user.setStudentId("update_test_" + i);
            user.setName("更新测试" + i);
            user.setPassword("pass123");
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setGpa(3.0);
            user.setAcademicRank(i);
            user.setMajorTotal(100);
            user.setRole(Role.STUDENT);
            User saved = userRepository.save(user);
            testUserIds.add(saved.getId()); // 只保存ID，不保存对象引用
        }

        System.out.println("✅ 预创建20个测试用户");

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        List<Long> updateTimes = Collections.synchronizedList(new ArrayList<>());

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    // 每个线程从数据库重新获取用户对象，避免共享内存对象
                    Long targetUserId = testUserIds.get(threadIndex % testUserIds.size());

                    long startTime = System.nanoTime();
                    try {
                        // 从数据库重新获取用户，确保每个线程操作的是独立的对象
                        Optional<User> userOpt = userRepository.findById(targetUserId);
                        if (userOpt.isPresent()) {
                            User targetUser = userOpt.get();

                            // 模拟并发更新同一用户的不同字段
                            targetUser.setGpa(3.0 + (threadIndex % 10) * 0.1);
                            targetUser.setAcademicRank(threadIndex + 1);
                            targetUser.setDepartment("信息学院_" + threadIndex);

                            userService.updateUser(targetUser);

                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            updateTimes.add(duration);
                            successCount.incrementAndGet();
                        } else {
                            failCount.incrementAndGet();
                            System.err.println("❌ 用户不存在: ID=" + targetUserId);
                        }

                    } catch (Exception e) {
                        long duration = (System.nanoTime() - startTime) / 1_000_000;
                        updateTimes.add(duration);
                        failCount.incrementAndGet();

                        // 区分不同类型的异常
                        if (e.getMessage().contains("lock") || e.getMessage().contains("Lock")) {
                            System.err.println("🔒 锁竞争失败: ID=" + targetUserId + " - " + e.getMessage());
                        } else if (e.getMessage().contains("version") || e.getMessage().contains("Optimistic")) {
                            System.err.println("🔄 乐观锁冲突: ID=" + targetUserId + " - " + e.getMessage());
                        } else {
                            System.err.println("❌ 更新用户失败: ID=" + targetUserId + " - " + e.getMessage());
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;

        // 性能统计
        double avgTime = updateTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long maxTime = updateTimes.stream().mapToLong(Long::longValue).max().orElse(0);
        double qps = (successCount.get() * 1000.0) / testDuration;

        System.out.println("\n========== 并发更新用户测试报告 ==========");
        System.out.println("总更新次数: " + THREAD_COUNT);
        System.out.println("✅ 成功: " + successCount.get());
        System.out.println("❌ 失败: " + failCount.get());
        System.out.println("成功率: " + String.format("%.2f%%", (successCount.get() * 100.0 / THREAD_COUNT)));
        System.out.println("\n性能指标:");
        System.out.println("  平均更新时间: " + String.format("%.2f", avgTime) + " ms");
        System.out.println("  最大更新时间: " + maxTime + " ms");
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("  QPS: " + String.format("%.2f", qps));
        System.out.println("=========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(successCount.get() > THREAD_COUNT * 0.95, "更新成功率应大于95%");
    }

    @Test
    @DisplayName("测试并发查询用户 - 缓存性能")
    public void testConcurrentUserQuery() throws InterruptedException {
        // 先创建测试数据
        List<User> testUsers = new ArrayList<>();
        for (int i = 1; i <= 50; i++) {
            User user = new User();
            user.setStudentId("query_test_" + i);
            user.setName("查询测试" + i);
            user.setPassword("pass123");
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setGpa(3.0 + (i % 10) * 0.1);
            user.setAcademicRank(i);
            user.setMajorTotal(100);
            user.setRole(Role.STUDENT);
            testUsers.add(userRepository.save(user));
        }

        System.out.println("✅ 预创建50个测试用户");

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger successfulQueries = new AtomicInteger(0);
        AtomicInteger failedQueries = new AtomicInteger(0);
        List<Long> firstQueryTimes = Collections.synchronizedList(new ArrayList<>());
        List<Long> cachedQueryTimes = Collections.synchronizedList(new ArrayList<>());

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    for (int j = 0; j < OPERATIONS_PER_THREAD; j++) {
                        // 确保查询的studentId与预创建的用户匹配
                        String studentId = "query_test_" + ((threadIndex % 50) + 1);
                        
                        // 第一次查询（可能未缓存）
                        long startTime = System.nanoTime();
                        try {
                            Optional<User> user1 = userService.getUserByStudentId(studentId);
                            long duration1 = (System.nanoTime() - startTime) / 1_000_000;
                            firstQueryTimes.add(duration1);

                            if (user1.isPresent()) {
                                successfulQueries.incrementAndGet();
                            } else {
                                failedQueries.incrementAndGet();
                                System.err.println("⚠️ 用户不存在: " + studentId);
                            }
                        } catch (Exception e) {
                            failedQueries.incrementAndGet();
                            System.err.println("❌ 第一次查询异常 " + studentId + ": " + e.getMessage());
                        }

                        // 第二次查询（应该命中缓存）
                        startTime = System.nanoTime();
                        try {
                            Optional<User> user2 = userService.getUserByStudentId(studentId);
                            long duration2 = (System.nanoTime() - startTime) / 1_000_000;
                            cachedQueryTimes.add(duration2);

                            if (user2.isPresent()) {
                                successfulQueries.incrementAndGet();
                            } else {
                                failedQueries.incrementAndGet();
                                System.err.println("⚠️ 用户不存在 (缓存查询): " + studentId);
                            }
                        } catch (Exception e) {
                            failedQueries.incrementAndGet();
                            System.err.println("❌ 缓存查询异常 " + studentId + ": " + e.getMessage());
                        }

                        try {
                            Thread.sleep(1); // 减少睡眠时间，提高测试效率
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                } catch (Exception e) {
                    System.err.println("❌ 线程执行异常: " + e.getMessage());
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;
        int totalQueries = THREAD_COUNT * OPERATIONS_PER_THREAD * 2;

        // 性能统计
        double avgFirstQuery = firstQueryTimes.isEmpty() ? 0 :
            firstQueryTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        double avgCachedQuery = cachedQueryTimes.isEmpty() ? 0 :
            cachedQueryTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        double speedup = (avgCachedQuery > 0 && avgFirstQuery > 0) ? avgFirstQuery / avgCachedQuery : 0;
        double qps = (successfulQueries.get() * 1000.0) / Math.max(testDuration, 1);

        System.out.println("\n========== 并发查询用户测试报告 ==========");
        System.out.println("总查询次数: " + totalQueries);
        System.out.println("✅ 成功查询: " + successfulQueries.get());
        System.out.println("❌ 失败查询: " + failedQueries.get());
        System.out.println("成功率: " + String.format("%.2f%%", (successfulQueries.get() * 100.0 / totalQueries)));
        System.out.println("\n性能指标:");
        System.out.println("  首次查询平均时间: " + String.format("%.2f", avgFirstQuery) + " ms");
        System.out.println("  缓存查询平均时间: " + String.format("%.2f", avgCachedQuery) + " ms");
        System.out.println("  缓存加速比: " + (speedup > 0 ? String.format("%.2f", speedup) + "x" : "N/A"));
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("  QPS: " + String.format("%.2f", qps));
        System.out.println("=========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(successfulQueries.get() > totalQueries * 0.95, "查询成功率应大于95%");
        if (avgFirstQuery > 0 && avgCachedQuery > 0) {
            assertTrue(avgCachedQuery <= avgFirstQuery, "缓存查询应该不慢于首次查询");
        }
    }

    @Test
    @DisplayName("测试并发修改密码")
    public void testConcurrentPasswordChange() throws InterruptedException {
        // 创建测试用户
        List<User> testUsers = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            User user = new User();
            user.setStudentId("pwd_test_" + i);
            user.setName("密码测试" + i);
            user.setPassword("oldpass");
            user.setDepartment("信息学院");
            user.setMajor("软件工程");
            user.setGpa(3.0);
            user.setAcademicRank(i);
            user.setMajorTotal(100);
            user.setRole(Role.STUDENT);
            testUsers.add(userService.createUser(user));
        }

        System.out.println("✅ 预创建10个测试用户");

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    User targetUser = testUsers.get(threadIndex % testUsers.size());
                    String newPassword = "newpass_" + threadIndex;
                    
                    try {
                        userService.changePassword(targetUser.getId(), newPassword);
                        successCount.incrementAndGet();
                    } catch (Exception e) {
                        failCount.incrementAndGet();
                        System.err.println("❌ 修改密码失败: " + targetUser.getStudentId() + " - " + e.getMessage());
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        System.out.println("\n========== 并发修改密码测试报告 ==========");
        System.out.println("总修改次数: " + THREAD_COUNT);
        System.out.println("✅ 成功: " + successCount.get());
        System.out.println("❌ 失败: " + failCount.get());
        System.out.println("=========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(successCount.get() > THREAD_COUNT * 0.7, "密码修改成功率应大于70%（考虑分布式锁竞争）");
    }
}

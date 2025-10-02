package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.config.JwtUtil;
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
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户认证和Token验证的并发性能与稳定性测试
 * 测试场景：
 * 1. 并发登录 - 多用户同时登录
 * 2. 并发Token验证 - 同一Token被大量请求并发验证
 * 3. 并发Token刷新 - 多个请求同时刷新Token
 * 4. 混合场景 - 登录+验证+刷新混合并发
 */
@SpringBootTest
@ActiveProfiles("test")
public class AuthServiceConcurrencyTest {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileMetadataRepository fileMetadataRepository;

    @Autowired
    private com.xuqinyang.xmudemo.repository.ApplicationRepository applicationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    private final int THREAD_COUNT = 100; // 并发线程数
    private final int OPERATIONS_PER_THREAD = 10; // 每个线程操作次数

    @BeforeEach
    @Transactional
    public void setUp() {
        // 清理测试数据（注意顺序：先删除有外键关联的表）
        applicationRepository.deleteAll();
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

        // 创建测试用户（50个）
        for (int i = 1; i <= 50; i++) {
            User user = new User();
            user.setStudentId("test_user_" + i);
            user.setName("测试用户" + i);
            user.setPassword(passwordEncoder.encode("password123"));
            user.setDepartment("测试学院");
            user.setMajor("软件工程");
            user.setGpa(3.5 + (i % 10) * 0.1);
            user.setAcademicRank(i);
            user.setMajorTotal(100);
            user.setRole(Role.STUDENT);
            userRepository.save(user);
        }

        System.out.println("✅ 初始化完成：创建50个测试用户");
    }

    @Test
    @DisplayName("测试并发登录性能与稳定性")
    public void testConcurrentLogin() throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        ConcurrentHashMap<String, String> tokensGenerated = new ConcurrentHashMap<>();
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    // 每个线程模拟多次登录操作
                    for (int j = 0; j < OPERATIONS_PER_THREAD; j++) {
                        String studentId = "test_user_" + ((threadIndex % 50) + 1);
                        String password = "password123";

                        long startTime = System.nanoTime();
                        try {
                            // 模拟AuthController中的登录逻辑
                            authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(studentId, password)
                            );

                            UserDetails userDetails = userDetailsService.loadUserByUsername(studentId);
                            String accessToken = jwtUtil.generateAccessToken(userDetails.getUsername());
                            String refreshToken = jwtUtil.generateRefreshToken(userDetails.getUsername());

                            long duration = (System.nanoTime() - startTime) / 1_000_000; // 转换为毫秒
                            responseTimes.add(duration);

                            // 验证Token生成成功
                            assertNotNull(accessToken, "Access token should not be null");
                            assertNotNull(refreshToken, "Refresh token should not be null");
                            assertTrue(jwtUtil.isAccessToken(accessToken), "Should be access token");
                            assertTrue(jwtUtil.isRefreshToken(refreshToken), "Should be refresh token");

                            tokensGenerated.put(studentId + "_" + j, accessToken);
                            successCount.incrementAndGet();

                        } catch (Exception e) {
                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            responseTimes.add(duration);
                            failCount.incrementAndGet();
                            System.err.println("❌ 登录失败: " + studentId + " - " + e.getMessage());
                        }

                        // 模拟真实请求间隔
                        try {
                            Thread.sleep(10);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;

        // 计算性能指标
        double avgResponseTime = responseTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long maxResponseTime = responseTimes.stream().mapToLong(Long::longValue).max().orElse(0);
        long minResponseTime = responseTimes.stream().mapToLong(Long::longValue).min().orElse(0);
        
        // 计算P95、P99
        List<Long> sortedTimes = new ArrayList<>(responseTimes);
        Collections.sort(sortedTimes);
        long p95 = sortedTimes.get((int)(sortedTimes.size() * 0.95));
        long p99 = sortedTimes.get((int)(sortedTimes.size() * 0.99));

        double qps = (successCount.get() * 1000.0) / testDuration;

        // 输出测试报告
        System.out.println("\n========== 并发登录测试报告 ==========");
        System.out.println("总请求数: " + (THREAD_COUNT * OPERATIONS_PER_THREAD));
        System.out.println("✅ 成功: " + successCount.get());
        System.out.println("❌ 失败: " + failCount.get());
        System.out.println("成功率: " + String.format("%.2f%%", (successCount.get() * 100.0 / (THREAD_COUNT * OPERATIONS_PER_THREAD))));
        System.out.println("\n性能指标:");
        System.out.println("  平均响应时间: " + String.format("%.2f", avgResponseTime) + " ms");
        System.out.println("  最小响应时间: " + minResponseTime + " ms");
        System.out.println("  最大响应时间: " + maxResponseTime + " ms");
        System.out.println("  P95响应时间: " + p95 + " ms");
        System.out.println("  P99响应时间: " + p99 + " ms");
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("  QPS: " + String.format("%.2f", qps));
        System.out.println("  生成Token数: " + tokensGenerated.size());
        System.out.println("=====================================\n");

        // 断言
        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(successCount.get() > THREAD_COUNT * OPERATIONS_PER_THREAD * 0.95, 
            "成功率应大于95%");
        assertTrue(avgResponseTime < 1000, "平均响应时间应小于1秒");
    }

    @Test
    @DisplayName("测试并发Token验证性能")
    public void testConcurrentTokenValidation() throws InterruptedException {
        // 先生成一批Token
        Map<String, String> userTokens = new HashMap<>();
        for (int i = 1; i <= 20; i++) {
            String studentId = "test_user_" + i;
            UserDetails userDetails = userDetailsService.loadUserByUsername(studentId);
            String token = jwtUtil.generateAccessToken(userDetails.getUsername());
            userTokens.put(studentId, token);
        }

        System.out.println("✅ 预生成20个用户的Access Token");

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger validationSuccess = new AtomicInteger(0);
        AtomicInteger validationFail = new AtomicInteger(0);
        List<Long> validationTimes = Collections.synchronizedList(new ArrayList<>());

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    for (int j = 0; j < OPERATIONS_PER_THREAD; j++) {
                        String studentId = "test_user_" + ((threadIndex % 20) + 1);
                        String token = userTokens.get(studentId);

                        long startTime = System.nanoTime();
                        try {
                            // 模拟JwtAuthenticationFilter中的验证逻辑
                            String username = jwtUtil.getUsernameFromToken(token);
                            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                            boolean isValid = jwtUtil.validateToken(token, userDetails);
                            boolean isAccessToken = jwtUtil.isAccessToken(token);

                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            validationTimes.add(duration);

                            if (isValid && isAccessToken) {
                                validationSuccess.incrementAndGet();
                            } else {
                                validationFail.incrementAndGet();
                                System.err.println("❌ Token验证失败: " + studentId);
                            }

                        } catch (Exception e) {
                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            validationTimes.add(duration);
                            validationFail.incrementAndGet();
                            System.err.println("❌ Token验证异常: " + studentId + " - " + e.getMessage());
                        }

                        try {
                            Thread.sleep(5);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;

        // 性能统计
        double avgTime = validationTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long maxTime = validationTimes.stream().mapToLong(Long::longValue).max().orElse(0);
        long minTime = validationTimes.stream().mapToLong(Long::longValue).min().orElse(0);
        double qps = (validationSuccess.get() * 1000.0) / testDuration;

        System.out.println("\n========== 并发Token验证测试报告 ==========");
        System.out.println("总验证次数: " + (THREAD_COUNT * OPERATIONS_PER_THREAD));
        System.out.println("✅ 验证成功: " + validationSuccess.get());
        System.out.println("❌ 验证失败: " + validationFail.get());
        System.out.println("成功率: " + String.format("%.2f%%", (validationSuccess.get() * 100.0 / (THREAD_COUNT * OPERATIONS_PER_THREAD))));
        System.out.println("\n性能指标:");
        System.out.println("  平均验证时间: " + String.format("%.2f", avgTime) + " ms");
        System.out.println("  最小验证时间: " + minTime + " ms");
        System.out.println("  最大验证时间: " + maxTime + " ms");
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("  QPS: " + String.format("%.2f", qps));
        System.out.println("==========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(validationSuccess.get() > THREAD_COUNT * OPERATIONS_PER_THREAD * 0.99, 
            "Token验证成功率应���于99%");
        // 验证平均时间（放宽要求，考虑到并发和Redis网络延迟）
        assertTrue(avgTime < 300, "平均验证时间应小于300ms");
    }

    @Test
    @DisplayName("测试并发Token刷新性能")
    public void testConcurrentTokenRefresh() throws InterruptedException {
        // 先生成一批Refresh Token
        Map<String, String> userRefreshTokens = new HashMap<>();
        for (int i = 1; i <= 20; i++) {
            String studentId = "test_user_" + i;
            UserDetails userDetails = userDetailsService.loadUserByUsername(studentId);
            String refreshToken = jwtUtil.generateRefreshToken(userDetails.getUsername());
            userRefreshTokens.put(studentId, refreshToken);
        }

        System.out.println("✅ 预生成20个用户的Refresh Token");

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger refreshSuccess = new AtomicInteger(0);
        AtomicInteger refreshFail = new AtomicInteger(0);
        List<Long> refreshTimes = Collections.synchronizedList(new ArrayList<>());
        Set<String> newAccessTokens = Collections.synchronizedSet(new HashSet<>());

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    for (int j = 0; j < OPERATIONS_PER_THREAD; j++) {
                        String studentId = "test_user_" + ((threadIndex % 20) + 1);
                        String refreshToken = userRefreshTokens.get(studentId);

                        long startTime = System.nanoTime();
                        try {
                            // 模拟AuthController中的Token刷新逻辑
                            if (!jwtUtil.isRefreshToken(refreshToken)) {
                                throw new IllegalArgumentException("不是Refresh Token");
                            }

                            String username = jwtUtil.getUsernameFromToken(refreshToken);
                            UserDetails details = userDetailsService.loadUserByUsername(username);

                            if (!jwtUtil.validateToken(refreshToken, details)) {
                                throw new IllegalArgumentException("Refresh Token已失效");
                            }

                            String newAccessToken = jwtUtil.generateAccessToken(username);

                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            refreshTimes.add(duration);

                            assertNotNull(newAccessToken, "新的Access Token不应为空");
                            assertTrue(jwtUtil.isAccessToken(newAccessToken), "应该是Access Token");

                            newAccessTokens.add(newAccessToken);
                            refreshSuccess.incrementAndGet();

                        } catch (Exception e) {
                            long duration = (System.nanoTime() - startTime) / 1_000_000;
                            refreshTimes.add(duration);
                            refreshFail.incrementAndGet();
                            System.err.println("❌ Token刷新失败: " + studentId + " - " + e.getMessage());
                        }

                        try {
                            Thread.sleep(10);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;

        // 性能统计
        double avgTime = refreshTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        long maxTime = refreshTimes.stream().mapToLong(Long::longValue).max().orElse(0);
        long minTime = refreshTimes.stream().mapToLong(Long::longValue).min().orElse(0);
        double qps = (refreshSuccess.get() * 1000.0) / testDuration;

        System.out.println("\n========== 并发Token刷新测试报告 ==========");
        System.out.println("总刷新次数: " + (THREAD_COUNT * OPERATIONS_PER_THREAD));
        System.out.println("✅ 刷新成功: " + refreshSuccess.get());
        System.out.println("❌ 刷新失败: " + refreshFail.get());
        System.out.println("成功率: " + String.format("%.2f%%", (refreshSuccess.get() * 100.0 / (THREAD_COUNT * OPERATIONS_PER_THREAD))));
        System.out.println("新生成Access Token数: " + newAccessTokens.size());
        System.out.println("\n性能指标:");
        System.out.println("  平均刷新时间: " + String.format("%.2f", avgTime) + " ms");
        System.out.println("  最小刷新时间: " + minTime + " ms");
        System.out.println("  最大刷新时间: " + maxTime + " ms");
        System.out.println("  总耗时: " + testDuration + " ms");
        System.out.println("  QPS: " + String.format("%.2f", qps));
        System.out.println("=========================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(refreshSuccess.get() > THREAD_COUNT * OPERATIONS_PER_THREAD * 0.95, 
            "Token刷新成功率应大于95%");
        assertTrue(avgTime < 500, "平均刷新时间应小于500ms");
    }

    @Test
    @DisplayName("测试混合场景：登录+验证+刷新")
    public void testMixedAuthScenarios() throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);
        
        AtomicInteger totalOperations = new AtomicInteger(0);
        AtomicInteger successOperations = new AtomicInteger(0);
        AtomicInteger failedOperations = new AtomicInteger(0);

        long testStartTime = System.currentTimeMillis();

        for (int i = 0; i < THREAD_COUNT; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    String studentId = "test_user_" + ((threadIndex % 50) + 1);
                    String password = "password123";

                    // 操作1: 登录
                    try {
                        authenticationManager.authenticate(
                            new UsernamePasswordAuthenticationToken(studentId, password)
                        );
                        UserDetails userDetails = userDetailsService.loadUserByUsername(studentId);
                        String accessToken = jwtUtil.generateAccessToken(userDetails.getUsername());
                        String refreshToken = jwtUtil.generateRefreshToken(userDetails.getUsername());
                        
                        totalOperations.incrementAndGet();
                        successOperations.incrementAndGet();

                        // 操作2: 验证Access Token（模拟10次API请求）
                        for (int j = 0; j < 10; j++) {
                            String username = jwtUtil.getUsernameFromToken(accessToken);
                            UserDetails details = userDetailsService.loadUserByUsername(username);
                            boolean isValid = jwtUtil.validateToken(accessToken, details);
                            
                            totalOperations.incrementAndGet();
                            if (isValid && jwtUtil.isAccessToken(accessToken)) {
                                successOperations.incrementAndGet();
                            } else {
                                failedOperations.incrementAndGet();
                            }
                            try {
                                Thread.sleep(5);
                            } catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                            }
                        }

                        // 操作3: 刷新Token
                        if (jwtUtil.isRefreshToken(refreshToken)) {
                            String username = jwtUtil.getUsernameFromToken(refreshToken);
                            UserDetails details = userDetailsService.loadUserByUsername(username);
                            if (jwtUtil.validateToken(refreshToken, details)) {
                                String newAccessToken = jwtUtil.generateAccessToken(username);
                                
                                totalOperations.incrementAndGet();
                                if (newAccessToken != null && jwtUtil.isAccessToken(newAccessToken)) {
                                    successOperations.incrementAndGet();
                                } else {
                                    failedOperations.incrementAndGet();
                                }
                            }
                        }

                    } catch (Exception e) {
                        failedOperations.incrementAndGet();
                        System.err.println("❌ 混合场景操作失败: " + studentId + " - " + e.getMessage());
                    }

                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(120, TimeUnit.SECONDS);
        executor.shutdown();

        long testDuration = System.currentTimeMillis() - testStartTime;
        double qps = (successOperations.get() * 1000.0) / testDuration;

        System.out.println("\n========== 混合场景测试报告 ==========");
        System.out.println("总操作数: " + totalOperations.get());
        System.out.println("✅ 成功: " + successOperations.get());
        System.out.println("❌ 失败: " + failedOperations.get());
        System.out.println("成功率: " + String.format("%.2f%%", (successOperations.get() * 100.0 / totalOperations.get())));
        System.out.println("总耗时: " + testDuration + " ms");
        System.out.println("QPS: " + String.format("%.2f", qps));
        System.out.println("====================================\n");

        assertTrue(completed, "所有线程应在超时前完成");
        assertTrue(successOperations.get() > totalOperations.get() * 0.95, 
            "混合场景成功率应大于95%");
    }
}

package com.xuqinyang.xmudemo.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 并发测试配置类
 * 为并发测试提供优化的配置和资源
 */
@TestConfiguration
@Profile("test")
public class ConcurrencyTestConfig {

    /**
     * 测试专用线程池 - 用于模拟高并发场景
     */
    @Bean("testExecutorService")
    public ExecutorService testExecutorService() {
        return Executors.newFixedThreadPool(200);
    }

    /**
     * 高性能线程池 - 用于性能测试
     */
    @Bean("performanceTestExecutor")
    public ThreadPoolExecutor performanceTestExecutor() {
        return new ThreadPoolExecutor(
            50,     // 核心线程数
            500,    // 最大线程数
            60L,    // 线程空闲时间
            java.util.concurrent.TimeUnit.SECONDS,
            new java.util.concurrent.LinkedBlockingQueue<>(1000)
        );
    }

    /**
     * 测试用Redis模板 - 优化序列化配置
     */
    @Bean("testRedisTemplate")
    @Primary
    public RedisTemplate<String, Object> testRedisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();

        // 使用内存Redis连接工厂（测试环境）
        LettuceConnectionFactory factory = new LettuceConnectionFactory("localhost", 6379);
        factory.setDatabase(15); // 使用测试数据库
        template.setConnectionFactory(factory);

        // 优化序列化器
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());

        template.afterPropertiesSet();
        return template;
    }

    /**
     * 测试数据源配置 - 使用H2内存数据库提高测试速度
     */
    @Bean("testDataSource")
    @Primary
    public javax.sql.DataSource testDataSource() {
        org.springframework.boot.jdbc.DataSourceBuilder<?> builder =
            org.springframework.boot.jdbc.DataSourceBuilder.create();

        return builder
            .url("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE")
            .driverClassName("org.h2.Driver")
            .username("sa")
            .password("")
            .build();
    }

    /**
     * 测试环境JPA配置
     */
    @Bean
    public java.util.Properties testJpaProperties() {
        java.util.Properties properties = new java.util.Properties();
        properties.setProperty("hibernate.hbm2ddl.auto", "create-drop");
        properties.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        properties.setProperty("hibernate.show_sql", "false");
        properties.setProperty("hibernate.format_sql", "false");
        properties.setProperty("hibernate.jdbc.batch_size", "50");
        properties.setProperty("hibernate.order_inserts", "true");
        properties.setProperty("hibernate.order_updates", "true");
        properties.setProperty("hibernate.jdbc.batch_versioned_data", "true");
        return properties;
    }
}

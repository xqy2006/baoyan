package com.xuqinyang.xmudemo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 异步处理配置
 * 支持高并发异步任务处理
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * 主要异步任务执行器 - 高并发优化版本
     * 用于处理一般的异步任务
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 高并发优化：大幅增加线程数
        executor.setCorePoolSize(20);        // 核心线程数：20
        executor.setMaxPoolSize(100);        // 最大线程数：100
        executor.setQueueCapacity(2000);     // 队列容量：2000
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("AsyncTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * 消息队列任务执行器 - 高并发优化版本
     * 专门处理RabbitMQ消息队列任务
     */
    @Bean(name = "messageTaskExecutor")
    public Executor messageTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 消息队列高并发优化
        executor.setCorePoolSize(15);        // 核心线程数：15
        executor.setMaxPoolSize(80);         // 最大线程数：80
        executor.setQueueCapacity(1500);     // 队列容量：1500
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("MessageTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    /**
     * 文件处理任务执行器 - 高并发优化版本
     * 专门处理文件上传、压缩、转换等IO密集型任务
     */
    @Bean(name = "fileProcessTaskExecutor")
    public Executor fileProcessTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 文件处理高并发优化（IO密集型，可以有更多线程）
        executor.setCorePoolSize(10);        // 核心线程数：10
        executor.setMaxPoolSize(50);         // 最大线程数：50
        executor.setQueueCapacity(800);      // 队列容量：800
        executor.setKeepAliveSeconds(600);   // 线程空闲时间：10分钟（文件处理可能较慢）

        executor.setThreadNamePrefix("FileProcessTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(120);
        executor.initialize();
        return executor;
    }

    /**
     * 系统自动审核任务执行器 - 新增
     * 专门处理系统自动审核任务
     */
    @Bean(name = "autoReviewTaskExecutor")
    public Executor autoReviewTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 自动审核任务优化
        executor.setCorePoolSize(8);         // 核心线程数：8
        executor.setMaxPoolSize(30);         // 最大线程数：30
        executor.setQueueCapacity(1000);     // 队列容量：1000
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("AutoReviewTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Web请求异步处理执行器 - 新增
     * 专门处理API请求中的异步任务
     */
    @Bean(name = "webAsyncTaskExecutor")
    public Executor webAsyncTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // Web异步任务优化
        executor.setCorePoolSize(10);        // 核心线程数：10
        executor.setMaxPoolSize(50);         // 最大线程数：50
        executor.setQueueCapacity(1000);     // 队列容量：1000
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("WebAsyncTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(45);
        executor.initialize();
        return executor;
    }

    /**
     * 活动任务执行器 - 新增
     * 专门处理活动相关的异步任务
     */
    @Bean(name = "activityTaskExecutor")
    public Executor activityTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 活动任务优化
        executor.setCorePoolSize(12);        // 核心线程数：12
        executor.setMaxPoolSize(40);         // 最大线程数：40
        executor.setQueueCapacity(1200);     // 队列容量：1200
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("ActivityTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * 数据统计任务执行器 - 新增
     * 专门处理数据统计和分析任务
     */
    @Bean(name = "statisticsTaskExecutor")
    public Executor statisticsTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 统计任务优化
        executor.setCorePoolSize(6);         // 核心线程数：6
        executor.setMaxPoolSize(25);         // 最大线程数：25
        executor.setQueueCapacity(800);      // 队列容量：800
        executor.setKeepAliveSeconds(600);   // 线程空闲时间：10分钟

        executor.setThreadNamePrefix("StatisticsTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(120);
        executor.initialize();
        return executor;
    }

    /**
     * 通知任务执行器 - 新增
     * 专门处理通知和邮件发送任务
     */
    @Bean(name = "notificationTaskExecutor")
    public Executor notificationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 通知任务优化
        executor.setCorePoolSize(10);        // 核心线程数：10
        executor.setMaxPoolSize(35);         // 最大线程数：35
        executor.setQueueCapacity(1500);     // 队列容量：1500
        executor.setKeepAliveSeconds(300);   // 线程空闲时间：5分钟

        executor.setThreadNamePrefix("NotificationTask-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}

package com.xuqinyang.xmudemo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * 定时任务配置
 * 启用Spring的定时任务功能并配置高并发线程池
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

    /**
     * 定时任务线程池配置
     * 支持高并发定时任务执行
     */
    @Bean(name = "taskScheduler")
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();

        // 核心线程数：足够处理多个定时任务
        scheduler.setPoolSize(10);

        // 线程名前缀，便于调试和监控
        scheduler.setThreadNamePrefix("ScheduledTask-");

        // 拒绝策略：由调用线程执行
        scheduler.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());

        // 等待任务完成再关闭
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(30);

        // 守护线程设置
        scheduler.setDaemon(false);

        scheduler.initialize();
        return scheduler;
    }
}

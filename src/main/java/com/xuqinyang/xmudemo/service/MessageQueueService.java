package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * 消息队列服务
 * 负责发送各种异步消息到队列
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageQueueService {

    private final RabbitTemplate rabbitTemplate;

    /**
     * 发送用户认证消息
     */
    public void sendUserAuthMessage(String userId, String action, String ip, String userAgent) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "action", action,
                "ip", ip != null ? ip : "",
                "userAgent", userAgent != null ? userAgent : "",
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.USER_AUTH_ROUTING_KEY,
                message
        );

        log.info("Sent user auth message: userId={}, action={}", userId, action);
    }

    /**
     * 发送应用处理消息 - ApplicationController实际调用
     */
    public void sendApplicationProcessMessage(Long applicationId, String action) {
        Map<String, Object> message = Map.of(
                "applicationId", applicationId,
                "action", action,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.APPLICATION_ROUTING_KEY,
                message
        );

        log.info("Sent application process message: applicationId={}, action={}", applicationId, action);
    }

    /**
     * 发送活动处理消息 - ActivityService实际调用
     */
    public void sendActivityProcessMessage(Long activityId, String action) {
        Map<String, Object> message = Map.of(
                "activityId", activityId,
                "action", action,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.ACTIVITY_ROUTING_KEY,
                message
        );

        log.info("Sent activity process message: activityId={}, action={}", activityId, action);
    }

    /**
     * 发送文件处理消息 - FileController实际调用
     */
    public void sendFileProcessMessage(String fileName, String filePath, String action) {
        Map<String, Object> message = Map.of(
                "fileName", fileName,
                "filePath", filePath,
                "action", action,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.FILE_ROUTING_KEY,
                message
        );

        log.info("Sent file process message: fileName={}, action={}", fileName, action);
    }

    /**
     * 发送通知消息 - ApplicationController实际调用
     */
    public void sendNotificationMessage(Long userId, String title, String content, String type) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "title", title,
                "content", content,
                "type", type,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.TOPIC_EXCHANGE,
                RabbitMQConfig.NOTIFICATION_ROUTING_KEY,
                message
        );

        log.info("Sent notification message: userId={}, type={}", userId, type);
    }

    /**
     * 发送审计日志消息
     */
    public void sendAuditLogMessage(String userId, String action, String resourceType, String details) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "action", action,
                "resourceType", resourceType,
                "details", details,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.AUDIT_ROUTING_KEY,
                message
        );

        log.info("Sent audit log message: userId={}, action={}", userId, action);
    }

    /**
     * 发送数据统计消息
     */
    public void sendDataStatisticsMessage(String category, String action, Map<String, Object> data) {
        Map<String, Object> message = Map.of(
                "category", category,
                "action", action,
                "data", data,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.STATISTICS_ROUTING_KEY,
                message
        );

        log.info("Sent data statistics message: category={}, action={}", category, action);
    }
}

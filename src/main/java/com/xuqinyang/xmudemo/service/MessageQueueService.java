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
     * 发送应用处理消息
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
     * 发送活动处理消息
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
     * 发送文件处理消息
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
     * 发送通知消息
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
     * 发送邮件消息
     */
    public void sendEmailMessage(String to, String subject, String content) {
        Map<String, Object> message = Map.of(
                "to", to,
                "subject", subject,
                "content", content,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.TOPIC_EXCHANGE,
                RabbitMQConfig.EMAIL_ROUTING_KEY,
                message
        );

        log.info("Sent email message: to={}, subject={}", to, subject);
    }

    /**
     * 发送用户认证消息
     */
    public void sendUserAuthMessage(String userId, String action, String ip, String userAgent) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "action", action,
                "ip", ip,
                "userAgent", userAgent,
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
     * 发送数据统计消息
     */
    public void sendDataStatisticsMessage(String type, String operation, Map<String, Object> data) {
        Map<String, Object> message = Map.of(
                "type", type,
                "operation", operation,
                "data", data,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.TOPIC_EXCHANGE,
                RabbitMQConfig.DATA_STATISTICS_ROUTING_KEY,
                message
        );

        log.info("Sent data statistics message: type={}, operation={}", type, operation);
    }

    /**
     * 发送审计日志消息
     */
    public void sendAuditLogMessage(String userId, String action, String resource, String details) {
        Map<String, Object> message = Map.of(
                "userId", userId,
                "action", action,
                "resource", resource,
                "details", details,
                "timestamp", System.currentTimeMillis()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.TOPIC_EXCHANGE,
                RabbitMQConfig.AUDIT_LOG_ROUTING_KEY,
                message
        );

        log.info("Sent audit log message: userId={}, action={}, resource={}", userId, action, resource);
    }

    /**
     * 发送系统自动审核消息
     */
    public void sendSystemAutoReviewMessage(Long applicationId, String reviewType) {
        Map<String, Object> message = Map.of(
                "applicationId", applicationId,
                "reviewType", reviewType,
                "timestamp", System.currentTimeMillis(),
                "source", "SYSTEM_AUTO_REVIEW"
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.DIRECT_EXCHANGE,
                RabbitMQConfig.SYSTEM_AUTO_REVIEW_ROUTING_KEY,
                message
        );

        log.info("Sent system auto review message: applicationId={}, reviewType={}", applicationId, reviewType);
    }
}

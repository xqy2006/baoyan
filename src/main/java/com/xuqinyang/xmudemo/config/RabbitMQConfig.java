package com.xuqinyang.xmudemo.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ消息队列配置
 * 支持异步消息处理，提升系统并发能力
 */
@Configuration
public class RabbitMQConfig {

    // 队列名称常量 - 只保留真正使用的队列
    public static final String APPLICATION_PROCESS_QUEUE = "application.process.queue";
    public static final String ACTIVITY_PROCESS_QUEUE = "activity.process.queue";
    public static final String FILE_PROCESS_QUEUE = "file.process.queue";
    public static final String NOTIFICATION_QUEUE = "notification.queue";
    public static final String USER_AUTH_QUEUE = "user.auth.queue";
    public static final String AUDIT_LOG_QUEUE = "audit.log.queue";
    public static final String STATISTICS_QUEUE = "statistics.queue";

    // 交换机名称
    public static final String DIRECT_EXCHANGE = "xmudemo.direct.exchange";
    public static final String TOPIC_EXCHANGE = "xmudemo.topic.exchange";

    // 路由键 - 只保留使用的路由键
    public static final String APPLICATION_ROUTING_KEY = "application.process";
    public static final String ACTIVITY_ROUTING_KEY = "activity.process";
    public static final String FILE_ROUTING_KEY = "file.process";
    public static final String NOTIFICATION_ROUTING_KEY = "notification.send";
    public static final String USER_AUTH_ROUTING_KEY = "user.auth";
    public static final String AUDIT_ROUTING_KEY = "audit.log";
    public static final String STATISTICS_ROUTING_KEY = "statistics.data";

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());

        // 高并发优化：大幅增加并发消费者数量
        factory.setConcurrentConsumers(10);       // 初始并发消费者：10（原来是5）
        factory.setMaxConcurrentConsumers(50);    // 最大并发消费者：50（原来是20）

        // 新增：消息预取数量优化
        factory.setPrefetchCount(20);             // 每个消费者预取20条消息

        // 新增：消息确认模式
        factory.setAcknowledgeMode(org.springframework.amqp.core.AcknowledgeMode.AUTO);

        // 新增：错误处理策略
        factory.setDefaultRequeueRejected(false); // 失败消息不重新入队

        return factory;
    }

    // 直接交换机
    @Bean
    public DirectExchange directExchange() {
        return new DirectExchange(DIRECT_EXCHANGE, true, false);
    }

    // 主题交换机
    @Bean
    public TopicExchange topicExchange() {
        return new TopicExchange(TOPIC_EXCHANGE, true, false);
    }

    // 应用处理队列
    @Bean
    public Queue applicationProcessQueue() {
        return QueueBuilder.durable(APPLICATION_PROCESS_QUEUE)
                .withArgument("x-max-length", 10000)
                .build();
    }

    // 活动处理队列
    @Bean
    public Queue activityProcessQueue() {
        return QueueBuilder.durable(ACTIVITY_PROCESS_QUEUE)
                .withArgument("x-max-length", 8000)
                .build();
    }

    // 文件处理队列
    @Bean
    public Queue fileProcessQueue() {
        return QueueBuilder.durable(FILE_PROCESS_QUEUE)
                .withArgument("x-max-length", 5000)
                .build();
    }

    // 通知队列
    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE)
                .withArgument("x-max-length", 20000)
                .build();
    }

    // 用户认证队列
    @Bean
    public Queue userAuthQueue() {
        return QueueBuilder.durable(USER_AUTH_QUEUE)
                .withArgument("x-max-length", 3000)
                .build();
    }

    // 审计日志队列
    @Bean
    public Queue auditLogQueue() {
        return QueueBuilder.durable(AUDIT_LOG_QUEUE)
                .withArgument("x-max-length", 10000)
                .build();
    }

    // 数据统计队列
    @Bean
    public Queue statisticsQueue() {
        return QueueBuilder.durable(STATISTICS_QUEUE)
                .withArgument("x-max-length", 5000)
                .build();
    }

    // 绑定应用处理队列到直接交换机
    @Bean
    public Binding applicationProcessBinding() {
        return BindingBuilder
                .bind(applicationProcessQueue())
                .to(directExchange())
                .with(APPLICATION_ROUTING_KEY);
    }

    // 绑定活动处理队列到直接交换机
    @Bean
    public Binding activityProcessBinding() {
        return BindingBuilder
                .bind(activityProcessQueue())
                .to(directExchange())
                .with(ACTIVITY_ROUTING_KEY);
    }

    // 绑定文件处理队列到直接交换机
    @Bean
    public Binding fileProcessBinding() {
        return BindingBuilder
                .bind(fileProcessQueue())
                .to(directExchange())
                .with(FILE_ROUTING_KEY);
    }

    // 绑定通知队列到主题交换机
    @Bean
    public Binding notificationBinding() {
        return BindingBuilder
                .bind(notificationQueue())
                .to(topicExchange())
                .with(NOTIFICATION_ROUTING_KEY);
    }

    // 绑定用户认证队列到直接交换机
    @Bean
    public Binding userAuthBinding() {
        return BindingBuilder
                .bind(userAuthQueue())
                .to(directExchange())
                .with(USER_AUTH_ROUTING_KEY);
    }

    // 绑定审计日志队列到直接交换机
    @Bean
    public Binding auditLogBinding() {
        return BindingBuilder
                .bind(auditLogQueue())
                .to(directExchange())
                .with(AUDIT_ROUTING_KEY);
    }

    // 绑定数据统计队列到直接交换机
    @Bean
    public Binding statisticsBinding() {
        return BindingBuilder
                .bind(statisticsQueue())
                .to(directExchange())
                .with(STATISTICS_ROUTING_KEY);
    }
}

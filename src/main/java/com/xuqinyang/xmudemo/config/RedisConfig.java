package com.xuqinyang.xmudemo.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

/**
 * Redis缓存配置
 * 提供高性能缓存支持，支持 Java 8 时间类型序列化
 */
@Configuration
@EnableCaching
public class RedisConfig {

    /**
     * 为 HTTP API 创建标准的 ObjectMapper（不包含类型信息）
     */
    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();

        // 注册 JavaTimeModule 以支持 Java 8 时间类型
        objectMapper.registerModule(new JavaTimeModule());

        // 禁用时间戳写入，使用 ISO 格式
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // 配置Jackson处理Hibernate懒加载对象和空Bean
        objectMapper.configure(com.fasterxml.jackson.databind.SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
        objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        return objectMapper;
    }

    /**
     * 专门为 Redis 创建支持 Java 8 时间类型和类型信息的 ObjectMapper
     */
    @Bean("redisObjectMapper")
    public ObjectMapper redisObjectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();

        // 注册 JavaTimeModule 以支持 Java 8 时间类型
        objectMapper.registerModule(new JavaTimeModule());

        // 禁用时间戳写入，使用 ISO 格式
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // 设置可见性
        objectMapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);

        // 启用默认类型信息（仅用于 Redis）
        objectMapper.activateDefaultTyping(
            LaissezFaireSubTypeValidator.instance,
            ObjectMapper.DefaultTyping.NON_FINAL,
            JsonTypeInfo.As.PROPERTY
        );

        // 配置Jackson处理Hibernate懒加载对象
        objectMapper.configure(com.fasterxml.jackson.databind.SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
        objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // 添加Hibernate5模块来正确处理懒加载对象
        try {
            Class<?> hibernateModuleClass = Class.forName("com.fasterxml.jackson.datatype.hibernate5.Hibernate5Module");
            Object hibernateModule = hibernateModuleClass.getDeclaredConstructor().newInstance();
            objectMapper.registerModule((com.fasterxml.jackson.databind.Module) hibernateModule);
        } catch (Exception e) {
            // 如果Hibernate5Module不可用，使用基本配置
            System.err.println("Hibernate5Module not available, using basic lazy loading handling");
        }

        // 添加混合配置来忽略Application实体的@JsonIgnore注解，确保User和Activity关系被序列化
        objectMapper.addMixIn(com.xuqinyang.xmudemo.model.Application.class, ApplicationCacheMixin.class);

        // 为User实体添加混合配置，确保roles集合被正确序列化
        objectMapper.addMixIn(com.xuqinyang.xmudemo.model.User.class, UserCacheMixin.class);

        return objectMapper;
    }

    /**
     * Redis缓存专用的Application混合配置
     * 忽略@JsonIgnore注解，确保User和Activity关系被正确序列化到Redis
     */
    public static abstract class ApplicationCacheMixin {
        // 重新暴露User字段用于Redis序列化，忽略原有的@JsonIgnore
        @com.fasterxml.jackson.annotation.JsonProperty("user")
        abstract Object getUser();

        // 重新暴露Activity字段用于Redis序列化，忽略原有的@JsonIgnore
        @com.fasterxml.jackson.annotation.JsonProperty("activity")
        abstract Object getActivity();
    }

    /**
     * Redis缓存专用的User混合配置
     * 确保roles集合被正确序列化到Redis
     */
    public static abstract class UserCacheMixin {
        // 重新暴露roles字段用于Redis序列化，确保集合内容被序列化
        @com.fasterxml.jackson.annotation.JsonProperty("roles")
        abstract Object getRoles();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // 使用专门为 Redis 配置的 ObjectMapper 创建序列化器
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(redisObjectMapper());

        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        template.setDefaultSerializer(serializer);
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // 使用专门为 Redis 配置的 ObjectMapper 创建序列化器
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(redisObjectMapper());

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1)) // 默认1小时过期
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer))
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
}

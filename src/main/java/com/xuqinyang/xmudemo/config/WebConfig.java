package com.xuqinyang.xmudemo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * SPA 前端在 Spring Boot 同端口部署时，保证直接访问刷新 /dashboard 等路径不会 404。
 * 仅枚举已知前端顶级路由，避免与 /api/** 冲突。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // 根路径
        registry.addViewController("/").setViewName("forward:/index.html");
        // 已知前端视图（不含点的简短路径）。按需可继续添加。
        String[] spaPaths = {
                "dashboard", "activities", "import", "settings",
                "applications", "apply", "review"
        };
        for (String p : spaPaths) {
            registry.addViewController("/" + p).setViewName("forward:/index.html");
        }
    }
}


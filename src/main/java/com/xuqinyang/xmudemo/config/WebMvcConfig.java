package com.xuqinyang.xmudemo.config;

import com.xuqinyang.xmudemo.interceptor.ApiRequestInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC配置
 * 注册拦截器和其他Web相关配置
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final ApiRequestInterceptor apiRequestInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(apiRequestInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                    "/api/actuator/**",
                    "/api/health/**",
                    "/static/**",
                    "/css/**",
                    "/js/**",
                    "/images/**"
                );
    }
}

package com.xuqinyang.xmudemo.config;

import com.xuqinyang.xmudemo.service.CustomUserDetailsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(HttpSecurity http) throws Exception {
        AuthenticationManagerBuilder authenticationManagerBuilder =
                http.getSharedObject(AuthenticationManagerBuilder.class);
        authenticationManagerBuilder.userDetailsService(userDetailsService)
                .passwordEncoder(passwordEncoder());
        return authenticationManagerBuilder.build();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> {})
                .authorizeHttpRequests(auth -> auth
                        // 预检请求放行
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // 错误页面放行
                        .requestMatchers("/error").permitAll()
                        // 静态/前端 SPA 构建资源放行（根路径 & 资源目录）
                        .requestMatchers("/", "/index.html", "/favicon.ico", "/assets/**", "/favicon.png", "/manifest.json").permitAll()
                        // 显式前端 SPA 路由放行（避免刷新 403）
                        .requestMatchers(
                                "/login", "/register",
                                "/apply", "/apply/**",
                                "/review", "/review/**",
                                "/admin", "/admin/**",
                                "/activities", "/activities/**",
                                "/applications", "/account", "/settings", "/import"
                        ).permitAll()
                        // Actuator health/info for probes
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        // 健康检查接口放行
                        .requestMatchers("/api/health").permitAll()
                        // 登录/注册等认证接口放行
                        .requestMatchers("/api/auth/**").permitAll()
                        // 管理员接口仅限 ADMIN 访问
                        .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
                        // 用户管理接口需要认证
                        .requestMatchers("/api/users/**").authenticated()
                        // 学生可以访问草稿接口
                        .requestMatchers("/api/drafts/**").hasAuthority("STUDENT")
                        // 学生提交申请接口
                        .requestMatchers("/api/applications/submit**").hasAuthority("STUDENT")
                        // 申请接口根据角色细分
                        .requestMatchers("/api/applications/**").hasAnyAuthority("STUDENT", "REVIEWER", "ADMIN")
                        // 其它所有 /api/** 仍需认证
                        .requestMatchers("/api/**").authenticated()
                        // 剩余所有非 /api/** 的请求（SPA 前端路由）全部放行
                        .anyRequest().permitAll()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            String uri = request.getRequestURI();
                            if (uri.startsWith("/api/")) {
                                response.setStatus(401);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write("{\"code\":401,\"message\":\"未认证\"}");
                            } else {
                                response.sendRedirect("/");
                            }
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            String uri = request.getRequestURI();
                            if (uri.startsWith("/api/")) {
                                response.setStatus(403);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write("{\"code\":403,\"message\":\"无权限\"}");
                            } else {
                                // 非 API 路径统一重定向到根目录（交给前端路由处理）
                                response.sendRedirect("/");
                            }
                        })
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                );

        // 仅让 JWT 过滤器处理（主要目标是 /api/**）。如需进一步精细化可以在过滤器内部根据路径判断。
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        // 如需前后端分离开发，可在 application.properties 设置 app.cors.origins=http://localhost:5173 等
        String origins = System.getProperty("app.cors.origins", System.getenv().getOrDefault("APP_CORS_ORIGINS", ""));
        if (!origins.isBlank()) {
            for (String o : origins.split(",")) {
                if (!o.isBlank()) config.addAllowedOriginPattern(o.trim());
            }
        }
        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.addExposedHeader("Authorization");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

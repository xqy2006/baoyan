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
                        // 静态资源：仅允许显式目录与顶层常见文件，移除无效的 /**/*.js 等模式
                        .requestMatchers("/", "/index.html", "/favicon.ico", "/assets/**").permitAll()
                        // Actuator health/info for container orchestration probes
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
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                );

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

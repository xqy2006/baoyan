package com.xuqinyang.xmudemo.config;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

@Configuration
public class DataInitializer {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    CommandLineRunner initUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String adminId = "admin";
            if (userRepository.findByStudentId(adminId).isEmpty()) {
                User u = new User();
                u.setStudentId(adminId);
                u.setPassword(passwordEncoder.encode("admin123"));
                u.setRoles(Set.of(Role.ADMIN));
                u.setName("系统管理员");
                userRepository.save(u);
                log.warn("[INIT] 已创建默认管理员账号 studentId=admin 密码=admin123 请尽快修改密码！");
            } else {
                log.info("[INIT] 默认管理员已存在，跳过创建");
            }
        };
    }
}


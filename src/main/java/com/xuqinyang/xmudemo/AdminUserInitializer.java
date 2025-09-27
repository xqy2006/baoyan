package com.xuqinyang.xmudemo;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Collections;

@Component
public class AdminUserInitializer implements CommandLineRunner {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.findByStudentId("admin").isEmpty()) {
            User admin = new User();
            admin.setStudentId("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRoles(Collections.singleton(Role.ADMIN));
            userRepository.save(admin);
            System.out.println("管理员账号已创建: 学号admin 密码admin123");
        }
    }
}


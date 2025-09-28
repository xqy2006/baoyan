package com.xuqinyang.xmudemo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaFallbackController {

    @RequestMapping({
            // 动态详情页与列表页都转发到前端入口
            "/apply",            // 新增：基础路径本身
            "/apply/{id}",
            "/apply/**",
            "/review",          // 也补上 /review 的基础路径（对称性，若需要）
            "/review/{id}",
            "/review/**",
            "/activities",
            "/applications",
            "/account",
            "/settings",
            "/import",
            // 登录/注册页（之前缺少，刷新 404）
            "/login",
            "/register",
            // 管理后台页面（之前缺少，刷新 404）
            "/admin",
            "/admin/**"
    })
    public String forwardIndex() {
        return "forward:/index.html";
    }
}

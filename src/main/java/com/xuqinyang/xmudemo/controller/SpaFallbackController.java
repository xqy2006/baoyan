package com.xuqinyang.xmudemo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaFallbackController {

    @RequestMapping({
            // 动态详情页与列表页都转发到前端入口
            "/apply/{id}",
            "/apply/**",
            "/review/{id}",
            "/review/**",
            "/activities",
            "/applications",
            "/account",
            "/settings",
            "/import"
    })
    public String forwardIndex() {
        return "forward:/index.html";
    }
}

package com.xuqinyang.xmudemo.controller;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

/**
 * SPA路由控制器
 * 处理前端路由，将非API的404错误转发到index.html由前端处理
 */
@Controller
public class SpaController implements ErrorController {

    @RequestMapping("/error")
    public String handleError(HttpServletRequest request) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);

        // 获取请求的URI
        String requestUri = (String) request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);

        // 如果是404错误且不是API请求，转发到index.html让前端路由处理
        if (status != null && Integer.valueOf(status.toString()) == 404) {
            if (requestUri != null && !requestUri.startsWith("/api/")) {
                return "forward:/index.html";
            }
        }

        // API请求的错误或其他错误，返回错误信息
        return "error";
    }
}


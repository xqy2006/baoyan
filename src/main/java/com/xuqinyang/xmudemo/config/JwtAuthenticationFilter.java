package com.xuqinyang.xmudemo.config;

import com.xuqinyang.xmudemo.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");

        String username = null;
        String jwt = null;

        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            try {
                username = jwtUtil.getUsernameFromToken(jwt);
            } catch (Exception ex) {
                log.warn("[JWT] Parse token failed: {}", ex.getMessage());
            }
        } else {
            // 尝试从 Cookie 中读取 access_token
            if (request.getCookies()!=null) {
                for (jakarta.servlet.http.Cookie c : request.getCookies()) {
                    if ("access_token".equals(c.getName())) {
                        jwt = c.getValue();
                        try { username = jwtUtil.getUsernameFromToken(jwt); } catch (Exception e) { log.debug("[JWT] Cookie token parse fail: {}", e.getMessage()); }
                        break;
                    }
                }
            }
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);
                if (jwtUtil.validateToken(jwt, userDetails) && jwtUtil.isAccessToken(jwt)) {
                    UsernamePasswordAuthenticationToken usernamePasswordAuthenticationToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    usernamePasswordAuthenticationToken
                            .setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(usernamePasswordAuthenticationToken);
                    log.debug("[JWT] Authenticated user {} for {} via {}", username, request.getRequestURI(), authorizationHeader!=null?"header":"cookie");
                } else {
                    log.debug("[JWT] Token invalid or not access token for user {}", username);
                }
            } catch (Exception e) {
                log.error("[JWT] Authentication chain error for user {}: {}", username, e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }
}


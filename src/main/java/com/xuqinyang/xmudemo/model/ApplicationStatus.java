package com.xuqinyang.xmudemo.model;

public enum ApplicationStatus {
    DRAFT,
    SYSTEM_REVIEWING,
    SYSTEM_APPROVED,
    SYSTEM_REJECTED,
    ADMIN_REVIEWING,  // 保留用于向后兼容
    FIRST_REVIEW_PENDING,  // 待第一审核员审核
    FIRST_REVIEW_APPROVED, // 第一审核员通过
    FIRST_REVIEW_REJECTED, // 第一审核员拒绝
    SECOND_REVIEW_PENDING, // 待第二审核员审核
    APPROVED,
    REJECTED,
    CANCELLED
}


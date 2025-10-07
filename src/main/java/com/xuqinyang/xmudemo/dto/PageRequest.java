package com.xuqinyang.xmudemo.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageRequest {
    private int page = 0; // 页码，从0开始
    private int size = 10; // 每页大小
    private String sortBy = "id"; // 排序字段
    private String sortDirection = "ASC"; // 排序方向: ASC/DESC
    private String searchKeyword = ""; // 搜索关键词

    // 添加最大分页限制
    public static final int MAX_PAGE_SIZE = 100;

    public int getSize() {
        // 强制限制最大分页大小，防止前端恶意修改
        return Math.min(size, MAX_PAGE_SIZE);
    }

    public int getPage() {
        // 确保页码非负
        return Math.max(0, page);
    }
}


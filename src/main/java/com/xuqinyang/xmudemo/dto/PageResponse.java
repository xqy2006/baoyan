package com.xuqinyang.xmudemo.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> content; // 当前页数据
    private int page; // 当前页码
    private int size; // 每页大小
    private long totalElements; // 总记录数
    private int totalPages; // 总页数
    private boolean first; // 是否首页
    private boolean last; // 是否末页
    private boolean empty; // 是否为空

    public static <T> PageResponse<T> of(org.springframework.data.domain.Page<T> page) {
        return new PageResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast(),
            page.isEmpty()
        );
    }
}


package com.xuqinyang.xmudemo.dto;

import java.util.ArrayList;
import java.util.List;

public class ImportRecord {
    private int row;
    private String studentId;
    private String name; // 可选，当前导入未提供
    private String status; // "success", "failed", "warning"
    private String message;
    private List<String> ignoredFields; // 新增：被忽略字段

    public ImportRecord(int row, String studentId, String status, String message) {
        this.row = row;
        this.studentId = studentId;
        this.status = status;
        this.message = message;
        this.ignoredFields = new ArrayList<>();
    }

    public void addIgnoredField(String field) {
        if (ignoredFields == null) ignoredFields = new ArrayList<>();
        ignoredFields.add(field);
    }

    // Getters and Setters
    public int getRow() {
        return row;
    }

    public void setRow(int row) {
        this.row = row;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<String> getIgnoredFields() {
        return ignoredFields;
    }

    public void setIgnoredFields(List<String> ignoredFields) {
        this.ignoredFields = ignoredFields;
    }
}

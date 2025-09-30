package com.xuqinyang.xmudemo.dto;

import java.util.List;

public class ImportResult {
    private int success;
    private int failed;
    private int warnings;
    private List<ImportRecord> details;

    public ImportResult(List<ImportRecord> details) {
        this.details = details;
        this.success = (int) details.stream().filter(d -> "success".equals(d.getStatus()) || "created".equals(d.getStatus()) || "updated".equals(d.getStatus())).count();
        this.failed = (int) details.stream().filter(d -> "failed".equals(d.getStatus())).count();
        this.warnings = (int) details.stream().filter(d -> "warning".equals(d.getStatus())).count();
    }

    // 添加getTotal方法
    public int getTotal() {
        return details != null ? details.size() : 0;
    }

    // Getters and Setters
    public int getSuccess() {
        return success;
    }

    public void setSuccess(int success) {
        this.success = success;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }

    public int getWarnings() {
        return warnings;
    }

    public void setWarnings(int warnings) {
        this.warnings = warnings;
    }

    public List<ImportRecord> getDetails() {
        return details;
    }

    public void setDetails(List<ImportRecord> details) {
        this.details = details;
    }
}

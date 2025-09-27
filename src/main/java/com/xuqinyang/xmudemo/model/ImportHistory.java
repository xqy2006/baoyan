package com.xuqinyang.xmudemo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "import_history")
public class ImportHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filename;
    private String mode; // CREATE_USERS 或 UPDATE_ACADEMIC
    private int totalRecords;
    private int success;
    private int failed;
    private int warnings;
    private LocalDateTime createdAt;

    public ImportHistory() {}

    public ImportHistory(String filename, String mode, int totalRecords, int success, int failed, int warnings) {
        this.filename = filename;
        this.mode = mode;
        this.totalRecords = totalRecords;
        this.success = success;
        this.failed = failed;
        this.warnings = warnings;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public int getTotalRecords() { return totalRecords; }
    public void setTotalRecords(int totalRecords) { this.totalRecords = totalRecords; }
    public int getSuccess() { return success; }
    public void setSuccess(int success) { this.success = success; }
    public int getFailed() { return failed; }
    public void setFailed(int failed) { this.failed = failed; }
    public int getWarnings() { return warnings; }
    public void setWarnings(int warnings) { this.warnings = warnings; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}


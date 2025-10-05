package com.xuqinyang.xmudemo.dto;

public class CreateUserRequest {
    private String studentId;
    private String password;
    private String role; // 单角色 (STUDENT/REVIEWER/ADMIN)
    private String name;
    private String department;
    private String major;
    private Double gpa;
    private Integer academicRank;
    private Integer majorTotal;
    private Double convertedScore;

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }
    public Double getGpa() { return gpa; }
    public void setGpa(Double gpa) { this.gpa = gpa; }
    public Integer getAcademicRank() { return academicRank; }
    public void setAcademicRank(Integer academicRank) { this.academicRank = academicRank; }
    public Integer getMajorTotal() { return majorTotal; }
    public void setMajorTotal(Integer majorTotal) { this.majorTotal = majorTotal; }
    public Double getConvertedScore() { return convertedScore; }
    public void setConvertedScore(Double convertedScore) { this.convertedScore = convertedScore; }
}

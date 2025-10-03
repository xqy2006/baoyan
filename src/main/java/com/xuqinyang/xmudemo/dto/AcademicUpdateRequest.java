package com.xuqinyang.xmudemo.dto;

public class AcademicUpdateRequest {
    private Double gpa;
    private Integer academicRank;
    private Integer majorTotal;
    private String department;
    private String major;
    private String name;
    private Double convertedScore;

    public Double getGpa() { return gpa; }
    public void setGpa(Double gpa) { this.gpa = gpa; }
    public Integer getAcademicRank() { return academicRank; }
    public void setAcademicRank(Integer academicRank) { this.academicRank = academicRank; }
    public Integer getMajorTotal() { return majorTotal; }
    public void setMajorTotal(Integer majorTotal) { this.majorTotal = majorTotal; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Double getConvertedScore() { return convertedScore; }
    public void setConvertedScore(Double convertedScore) { this.convertedScore = convertedScore; }
}

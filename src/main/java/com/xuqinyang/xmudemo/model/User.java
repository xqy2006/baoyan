package com.xuqinyang.xmudemo.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String studentId;
    private String password;

    // 姓名（学生必填，管理员/审核员可为空）
    private String name;
    // 学院/系（学生必填，管理员/审核员可为空）
    private String department;
    // 专业（学生必填，管理员/审核员可为空）
    private String major;

    // GPA（学生学业信息导入）
    private Double gpa; // 允许为空，导入更新
    // 学业排名（班级/专业内排名）
    private Integer academicRank;
    // 专业总人数（用于排名参考）
    private Integer majorTotal;

    @ElementCollection(targetClass = Role.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    private Set<Role> roles;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles = roles;
    }

    // 便利方法：获取主要角色（兼容现有代码）
    public Role getRole() {
        if (roles == null || roles.isEmpty()) {
            return Role.STUDENT; // 默认角色
        }
        // 按优先级返回：ADMIN > REVIEWER > STUDENT
        if (roles.contains(Role.ADMIN)) return Role.ADMIN;
        if (roles.contains(Role.REVIEWER)) return Role.REVIEWER;
        return Role.STUDENT;
    }

    // 便利方法：设置主要角色（兼容现有代码）
    public void setRole(Role role) {
        if (this.roles == null) {
            this.roles = new HashSet<>();
        }
        this.roles.clear();
        this.roles.add(role);
    }

    // 检查是否拥有某个角色
    public boolean hasRole(Role role) {
        return roles != null && roles.contains(role);
    }

    // 添加角色
    public void addRole(Role role) {
        if (this.roles == null) {
            this.roles = new HashSet<>();
        }
        this.roles.add(role);
    }

    // 移除角色
    public void removeRole(Role role) {
        if (this.roles != null) {
            this.roles.remove(role);
        }
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getMajor() {
        return major;
    }

    public void setMajor(String major) {
        this.major = major;
    }

    public Double getGpa() { return gpa; }
    public void setGpa(Double gpa) { this.gpa = gpa; }

    public Integer getAcademicRank() { return academicRank; }
    public void setAcademicRank(Integer academicRank) { this.academicRank = academicRank; }

    public Integer getMajorTotal() { return majorTotal; }
    public void setMajorTotal(Integer majorTotal) { this.majorTotal = majorTotal; }
}

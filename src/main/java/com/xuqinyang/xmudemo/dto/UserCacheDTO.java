package com.xuqinyang.xmudemo.dto;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import java.io.Serializable;
import java.util.Set;
import java.util.HashSet;

/**
 * 用户缓存DTO，避免Hibernate懒加载序列化问题
 */
public class UserCacheDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String studentId;
    private String name;
    private String password;
    private String department;
    private String major;
    private Double gpa;
    private Integer academicRank;
    private Integer majorTotal;
    private Role role;
    private Set<Role> roles = new HashSet<>();

    // 默认构造函数
    public UserCacheDTO() {}

    // 从User实体创建DTO
    public static UserCacheDTO fromEntity(User user) {
        if (user == null) return null;

        UserCacheDTO dto = new UserCacheDTO();
        dto.id = user.getId();
        dto.studentId = user.getStudentId();
        dto.name = user.getName();
        dto.password = user.getPassword();
        dto.department = user.getDepartment();
        dto.major = user.getMajor();
        dto.gpa = user.getGpa();
        dto.academicRank = user.getAcademicRank();
        dto.majorTotal = user.getMajorTotal();
        dto.role = user.getRole();

        // 安全地复制roles集合，避免懒加载问题
        try {
            if (user.getRoles() != null) {
                dto.roles = new HashSet<>(user.getRoles());
            }
        } catch (Exception e) {
            // 如果懒加载失败，使用空集合
            dto.roles = new HashSet<>();
        }

        return dto;
    }

    // 转换为User实体
    public User toEntity() {
        User user = new User();
        user.setId(this.id);
        user.setStudentId(this.studentId);
        user.setName(this.name);
        user.setPassword(this.password);
        user.setDepartment(this.department);
        user.setMajor(this.major);
        user.setGpa(this.gpa);
        user.setAcademicRank(this.academicRank);
        user.setMajorTotal(this.majorTotal);
        user.setRole(this.role);
        user.setRoles(new HashSet<>(this.roles));
        return user;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

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

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public Set<Role> getRoles() { return roles; }
    public void setRoles(Set<Role> roles) { this.roles = roles; }
}

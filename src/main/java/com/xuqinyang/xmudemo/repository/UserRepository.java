package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByStudentId(String studentId);

    // 分页查询所有用户
    Page<User> findAll(Pageable pageable);

    // 根据关键词搜索用户（学号、姓名、学院、专业）
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.studentId) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.department) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.major) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<User> searchUsers(@Param("keyword") String keyword, Pageable pageable);
}

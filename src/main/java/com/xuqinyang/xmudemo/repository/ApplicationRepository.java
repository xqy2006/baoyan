package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.Application;
import com.xuqinyang.xmudemo.model.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {
    List<Application> findByUser_Id(Long userId);
    List<Application> findByStatusIn(List<ApplicationStatus> statuses);
    long countByStatus(ApplicationStatus status);
    Optional<Application> findByUser_IdAndActivity_Id(Long userId, Long activityId);
    boolean existsByUser_IdAndActivity_Id(Long userId, Long activityId);

    // 新增：按状态查询并按最后更新时间升序排列（用于自动审核调度）
    List<Application> findByStatusOrderByLastUpdateDateAsc(ApplicationStatus status);

    // 新增：按状态查询并限制数量（用于批量处理）
    List<Application> findTop50ByStatusOrderByLastUpdateDateAsc(ApplicationStatus status);

    // 新增：根据ID查找Application并预加载user和activity关系
    @Query("SELECT a FROM Application a JOIN FETCH a.user u JOIN FETCH a.activity ac WHERE a.id = :id")
    Optional<Application> findByIdWithUserAndActivity(@Param("id") Long id);

    // 新增：查找所有Application并预加载user和activity关系（用于统计等场景）
    @Query("SELECT a FROM Application a JOIN FETCH a.user u JOIN FETCH a.activity ac")
    List<Application> findAllWithUserAndActivity();

    // 新增：强制从数据库查询，绕过缓存的查询方法
    @Query(value = "SELECT a.*, u.student_id, u.name, u.department, u.major, ac.name as activity_name " +
           "FROM application a " +
           "JOIN users u ON a.user_id = u.id " +
           "JOIN activity ac ON a.activity_id = ac.id " +
           "WHERE a.id = :id", nativeQuery = true)
    Optional<Object[]> findApplicationWithUserByIdNative(@Param("id") Long id);

    // 新增：查找某用户的所有申请并预加载 activity（避免懒加载问题在序列化时发生）
    @Query("SELECT a FROM Application a LEFT JOIN FETCH a.activity WHERE a.user.id = :userId")
    List<Application> findByUser_IdWithActivity(@Param("userId") Long userId);
}

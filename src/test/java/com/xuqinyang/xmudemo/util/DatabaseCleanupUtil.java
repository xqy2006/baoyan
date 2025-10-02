package com.xuqinyang.xmudemo.util;

import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Component;

/**
 * 数据库清理工具类
 * 统一处理测试数据清理，避免外键约束违反问题
 */
@Component
public class DatabaseCleanupUtil {

    /**
     * 清理所有测试数据，按照正确的外键依赖顺序
     * @param entityManager JPA实体管理器
     */
    @Transactional
    public void cleanupAllTestData(EntityManager entityManager) {
        try {
            // 1. 首先禁用外键检查（MySQL）
            try {
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：无法禁用外键检查: " + e.getMessage());
            }

            // 2. 按照依赖顺序删除数据
            // 删除申请相关数据
            try {
                entityManager.createNativeQuery("DELETE FROM application").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理application表失败: " + e.getMessage());
            }

            // 删除活动相关数据
            try {
                entityManager.createNativeQuery("DELETE FROM activity").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理activity表失败: " + e.getMessage());
            }

            // 删除文件元数据
            try {
                entityManager.createNativeQuery("DELETE FROM file_metadata").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理file_metadata表失败: " + e.getMessage());
            }

            // 删除用户角色关联表
            try {
                entityManager.createNativeQuery("DELETE FROM user_roles").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理user_roles表失败: " + e.getMessage());
            }

            // 删除用户表
            try {
                entityManager.createNativeQuery("DELETE FROM users").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理users表失败: " + e.getMessage());
            }

            // 删除导入历史
            try {
                entityManager.createNativeQuery("DELETE FROM import_history").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：清理import_history表失败: " + e.getMessage());
            }

            // 3. 重新启用外键检查
            try {
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            } catch (Exception e) {
                System.err.println("警告：无法重新启用外键检查: " + e.getMessage());
            }

            // 4. 强制刷新到数据库
            entityManager.flush();

            System.out.println("✅ 数据库清理完成");

        } catch (Exception e) {
            System.err.println("❌ 数据库清理过程中发生错误: " + e.getMessage());
            // 尝试重新启用外键检查
            try {
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            } catch (Exception ex) {
                System.err.println("警告：错误恢复时无法重新启用外键检查: " + ex.getMessage());
            }
            throw e;
        }
    }
}

package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.dto.ImportResult;
import com.xuqinyang.xmudemo.dto.ImportRecord;
import com.xuqinyang.xmudemo.dto.UserCacheDTO;
import com.xuqinyang.xmudemo.model.ImportHistory;
import com.xuqinyang.xmudemo.repository.ImportHistoryRepository;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private ImportHistoryRepository importHistoryRepository;
    @Autowired
    private DistributedLockService distributedLockService;

    private enum ImportMode { UPSERT }
    private static final String DEFAULT_PASSWORD = "123456";

    @Transactional
    @CacheEvict(value = "users", allEntries = true)
    public ImportResult importUsersFromExcel(MultipartFile file) throws IOException {
        // 使用文件名和大小作为锁键，确保相同文件的并发导入被串行化
        // 这样可以避免重复导入相同文件的问题
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        long fileSize = file.getSize();
        String lockKey = "user:import:" + fileName + ":" + fileSize;

        return distributedLockService.executeWithLockAndRetry(lockKey, () -> {
            String filename = file.getOriginalFilename()!=null?file.getOriginalFilename().toLowerCase():"";
            if (filename.endsWith(".xls")) {
                List<ImportRecord> rec = List.of(new ImportRecord(0, "", "failed", ".xls 旧格式暂不支持，请另存为 .xlsx 或导出为 .csv"));
                return new ImportResult(rec);
            }
            ImportResult result;
            if (filename.endsWith(".csv")) {
                result = importFromCsv(file);
            } else {
                result = importFromXlsx(file);
            }
            try {
                importHistoryRepository.save(new ImportHistory(file.getOriginalFilename(), ImportMode.UPSERT.name(),
                        result.getDetails().size(), result.getSuccess(), result.getFailed(), result.getWarnings()));
            } catch (Exception ignored) {}
            return result;
        }, 10); // 用户导入操作可能较慢，增加重试次数
    }

    @Transactional
    @CacheEvict(value = "users", allEntries = true)
    public User createUser(User user) {
        return distributedLockService.executeWithLockAndRetry("user:create:" + user.getStudentId(), () -> {
            try {
                // 双重检查：再次检查学号是否已存在（防止并发间隙）
                Optional<User> existing = userRepository.findByStudentId(user.getStudentId());
                if (existing.isPresent()) {
                    throw new IllegalArgumentException("学号已存在: " + user.getStudentId());
                }

                // 加密密码
                if (user.getPassword() != null && !user.getPassword().isEmpty()) {
                    user.setPassword(passwordEncoder.encode(user.getPassword()));
                } else {
                    user.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));
                }

                // 尝试保存用户
                return userRepository.save(user);

            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // 处理数据库唯一约束冲突
                if (e.getMessage() != null && e.getMessage().contains("Duplicate entry")) {
                    throw new IllegalArgumentException("学号已存在: " + user.getStudentId());
                } else {
                    throw new RuntimeException("数据完整性违反: " + e.getMessage(), e);
                }
            } catch (org.hibernate.exception.ConstraintViolationException e) {
                // 处理Hibernate约束违反异常
                if (e.getConstraintName() != null && e.getConstraintName().contains("student")) {
                    throw new IllegalArgumentException("学号已存在: " + user.getStudentId());
                } else {
                    throw new RuntimeException("约束违反: " + e.getMessage(), e);
                }
            } catch (IllegalArgumentException e) {
                // 重新抛出业务逻辑异常
                throw e;
            } catch (Exception e) {
                // 处理其他未预期的异常
                throw new RuntimeException("创建用户失败: " + e.getMessage(), e);
            }
        }, 5);
    }

    @Transactional
    @CacheEvict(value = "users", key = "#user.id")
    public User updateUser(User user) {
        return distributedLockService.executeWithLockAndRetry("user:update:" + user.getId(), () -> {
            User existingUser = userRepository.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

            // 更新用户信息（不更新密码和学号）
            existingUser.setName(user.getName());
            existingUser.setDepartment(user.getDepartment());
            existingUser.setMajor(user.getMajor());
            existingUser.setGpa(user.getGpa());
            existingUser.setAcademicRank(user.getAcademicRank());
            existingUser.setMajorTotal(user.getMajorTotal());
            existingUser.setConvertedScore(user.getConvertedScore());
            existingUser.setRole(user.getRole());

            return userRepository.save(existingUser);
        }, 15);
    }

    @Transactional
    @CacheEvict(value = "users", key = "#userId")
    public void deleteUser(Long userId) {
        distributedLockService.executeWithLockAndRetry("user:delete:" + userId, () -> {
            userRepository.deleteById(userId);
            return null;
        }, 3);
    }

    @Transactional
    @CacheEvict(value = "users", key = "#userId")
    public User changePassword(Long userId, String newPassword) {
        return distributedLockService.executeWithLockAndRetry("user:changePassword:" + userId, () -> {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

            user.setPassword(passwordEncoder.encode(newPassword));
            return userRepository.save(user);
        }, 15); // 增加重试次数到10次
    }

    // 查询方法 - 使用DTO缓存避免懒加载序列化问题
    @Cacheable(value = "users", key = "'all'")
    public List<User> getAllUsers() {
        List<User> users = userRepository.findAll();
        // 初始化所有用户的roles集合
        users.forEach(u -> {
            try {
                if (u.getRoles() != null) {
                    u.getRoles().size();
                    u.setRoles(new java.util.HashSet<>(u.getRoles()));
                } else {
                    u.setRoles(new java.util.HashSet<>());
                }
            } catch (Exception e) {
                u.setRoles(new java.util.HashSet<>());
            }
        });
        return users;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "userDTO", key = "#id")
    public Optional<User> findById(Long id) {
        Optional<User> user = userRepository.findById(id);
        if (user.isEmpty()) {
            return Optional.empty();
        }

        User u = user.get();
        // 彻底初始化懒加载关系
        try {
            if (u.getRoles() != null) {
                u.getRoles().size(); // 触发初始化
                u.setRoles(new java.util.HashSet<>(u.getRoles()));
            } else {
                u.setRoles(new java.util.HashSet<>());
            }
        } catch (Exception e) {
            System.err.println("警告：初始化用户角色失败: " + e.getMessage());
            u.setRoles(new java.util.HashSet<>());
        }

        return Optional.of(u);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "userDTO", key = "#studentId")
    public Optional<User> findByStudentId(String studentId) {
        Optional<User> user = userRepository.findByStudentId(studentId);
        if (user.isEmpty()) {
            return Optional.empty();
        }

        User u = user.get();
        // 彻底初始化懒加载关系，避免缓存序列化问题
        try {
            if (u.getRoles() != null) {
                u.getRoles().size(); // 触发初始化
                // 创建全新的HashSet，完全脱离Hibernate代理
                Set<com.xuqinyang.xmudemo.model.Role> newRoles = new java.util.HashSet<>();
                for (com.xuqinyang.xmudemo.model.Role role : u.getRoles()) {
                    newRoles.add(role);
                }
                u.setRoles(newRoles);
            } else {
                u.setRoles(new java.util.HashSet<>());
            }
        } catch (Exception e) {
            System.err.println("警告：初始化用户角色失败 (studentId=" + studentId + "): " + e.getMessage());
            u.setRoles(new java.util.HashSet<>());
        }

        return Optional.of(u);
    }

    // Alias method for backward compatibility with tests
    @Transactional(readOnly = true)
    public Optional<User> getUserByStudentId(String studentId) {
        return findByStudentId(studentId);
    }

    private ImportResult importFromXlsx(MultipartFile file) throws IOException {
        List<ImportRecord> records = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rows = sheet.iterator();
            DataFormatter formatter = new DataFormatter();
            if (!rows.hasNext()) {
                records.add(new ImportRecord(0, "", "failed", "文件为空"));
                return new ImportResult(records);
            }
            Row headerRow = rows.next();
            int headerRowNum = headerRow.getRowNum()+1;
            Map<String,Integer> headerIndex = new HashMap<>();
            for (int i=0;i<headerRow.getLastCellNum();i++) {
                String h = formatter.formatCellValue(headerRow.getCell(i));
                if (h!=null) headerIndex.put(h.trim(), i);
            }
            int rowNumber = headerRowNum;
            while (rows.hasNext()) {
                Row currentRow = rows.next(); rowNumber++;
                String studentId = ""; String name=null;
                try {
                    studentId = getCell(formatter, currentRow, headerIndex, List.of("学号","学生学号","studentId"));
                    if (isBlank(studentId)) { records.add(new ImportRecord(rowNumber, "", "failed", "学号为空")); continue; }
                    name = getCell(formatter, currentRow, headerIndex, List.of("姓名","name"));
                    String department = getCell(formatter, currentRow, headerIndex, List.of("学院","系别","department"));
                    String major = getCell(formatter, currentRow, headerIndex, List.of("专业","major"));
                    String roleStr = getCell(formatter, currentRow, headerIndex, List.of("角色","role"));
                    String gpaStr = getCell(formatter, currentRow, headerIndex, List.of("GPA","绩点"));
                    String rankStr = getCell(formatter, currentRow, headerIndex, List.of("学业排名","排名","rank"));
                    String totalStr = getCell(formatter, currentRow, headerIndex, List.of("专业总人数","总人数","total"));
                    String convertedScoreStr = getCell(formatter, currentRow, headerIndex, List.of("换算后的成绩","学业综合成绩","convertedScore","百分制成绩"));
                    upsertUser(records, rowNumber, studentId, name, department, major, roleStr, gpaStr, rankStr, totalStr, convertedScoreStr);
                } catch (Exception e) {
                    ImportRecord rec = new ImportRecord(rowNumber, studentId, "failed", "处理失败: "+e.getMessage());
                    rec.setName(name); records.add(rec);
                }
            }
        }
        return new ImportResult(records);
    }

    private ImportResult importFromCsv(MultipartFile file) throws IOException {
        List<ImportRecord> records = new ArrayList<>();

        // 尝试检测字符编码和分隔符
        String csvContent = detectEncodingAndReadFile(file);
        if (csvContent == null || csvContent.trim().isEmpty()) {
            records.add(new ImportRecord(0, "", "failed", "CSV文件为空或无法读取"));
            return new ImportResult(records);
        }

        String[] lines = csvContent.split("\\r?\\n");
        if (lines.length == 0) {
            records.add(new ImportRecord(0, "", "failed", "CSV文件没有数据行"));
            return new ImportResult(records);
        }

        // 检测分隔符（逗号、分号、制表符）
        String separator = detectSeparator(lines[0]);
        System.out.println("[CSV_IMPORT] Detected separator: '" + (separator.equals("\t") ? "\\t" : separator) + "'");

        // 解析表头
        String[] headers = parseCSVLine(lines[0], separator);
        Map<String, Integer> headerIndex = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            String header = headers[i].trim();
            if (!header.isEmpty()) {
                headerIndex.put(header, i);
            }
        }

        System.out.println("[CSV_IMPORT] Headers detected: " + headerIndex.keySet());

        // 处理数据行
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) continue; // 跳过空行

            int rowNumber = i + 1;
            String[] cols = parseCSVLine(line, separator);
            String studentId = "";
            String name = null;

            try {
                studentId = getCSVCellImproved(cols, headerIndex, List.of("学号", "学生学号", "studentId", "StudentId", "STUDENTID"));
                if (isBlank(studentId)) {
                    records.add(new ImportRecord(rowNumber, "", "failed", "学号为空"));
                    continue;
                }

                name = getCSVCellImproved(cols, headerIndex, List.of("姓名", "name", "Name", "NAME"));
                String department = getCSVCellImproved(cols, headerIndex, List.of("学院", "系别", "department", "Department", "DEPARTMENT"));
                String major = getCSVCellImproved(cols, headerIndex, List.of("专业", "major", "Major", "MAJOR"));
                String roleStr = getCSVCellImproved(cols, headerIndex, List.of("角色", "role", "Role", "ROLE"));
                String gpaStr = getCSVCellImproved(cols, headerIndex, List.of("GPA", "绩点", "gpa"));
                String rankStr = getCSVCellImproved(cols, headerIndex, List.of("学业排名", "排名", "rank", "Rank", "RANK"));
                String totalStr = getCSVCellImproved(cols, headerIndex, List.of("专业总人数", "总人数", "total", "Total", "TOTAL"));
                String convertedScoreStr = getCSVCellImproved(cols, headerIndex, List.of("换算后的成绩", "学业综合成绩", "convertedScore", "百分制成绩"));

                upsertUser(records, rowNumber, studentId, name, department, major, roleStr, gpaStr, rankStr, totalStr, convertedScoreStr);

            } catch (Exception e) {
                ImportRecord rec = new ImportRecord(rowNumber, studentId, "failed", "处理失败: " + e.getMessage());
                rec.setName(name);
                records.add(rec);
                System.err.println("[CSV_IMPORT] Error processing row " + rowNumber + ": " + e.getMessage());
            }
        }

        return new ImportResult(records);
    }

    /**
     * 检测文件编码并读取内容
     */
    private String detectEncodingAndReadFile(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();

        // 检测BOM并移除
        String content = null;

        // UTF-8 BOM
        if (bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF) {
            content = new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        }
        // UTF-16 BE BOM
        else if (bytes.length >= 2 && bytes[0] == (byte) 0xFE && bytes[1] == (byte) 0xFF) {
            content = new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16BE);
        }
        // UTF-16 LE BOM
        else if (bytes.length >= 2 && bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xFE) {
            content = new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16LE);
        }
        // 尝试不同编码
        else {
            // 首先尝试UTF-8
            try {
                content = new String(bytes, StandardCharsets.UTF_8);
                // 检查是否包含中文且没有乱码
                if (content.contains("学号") || content.contains("姓名") || content.matches(".*[\\u4e00-\\u9fa5]+.*")) {
                    // 看起来像是正确的UTF-8编码
                } else {
                    // 尝试GBK编码
                    content = new String(bytes, "GBK");
                }
            } catch (Exception e) {
                // 如果UTF-8失败，尝试GBK
                try {
                    content = new String(bytes, "GBK");
                } catch (Exception ex) {
                    // 最后尝试ISO-8859-1
                    content = new String(bytes, "ISO-8859-1");
                }
            }
        }

        return content;
    }

    /**
     * 检测CSV分隔符
     */
    private String detectSeparator(String headerLine) {
        // 统计各种分隔符的出现次数
        long commaCount = headerLine.chars().filter(ch -> ch == ',').count();
        long semicolonCount = headerLine.chars().filter(ch -> ch == ';').count();
        long tabCount = headerLine.chars().filter(ch -> ch == '\t').count();

        // 返回出现次数最多的分隔符
        if (semicolonCount > commaCount && semicolonCount > tabCount) {
            return ";";
        } else if (tabCount > commaCount && tabCount > semicolonCount) {
            return "\t";
        } else {
            return ",";
        }
    }

    /**
     * 解析CSV行，处理引号包围的字段
     */
    private String[] parseCSVLine(String line, String separator) {
        List<String> fields = new ArrayList<>();
        StringBuilder currentField = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);

            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    // 双引号转义
                    currentField.append('"');
                    i++; // 跳过下一个引号
                } else {
                    // 切换引号状态
                    inQuotes = !inQuotes;
                }
            } else if (!inQuotes && separator.equals(String.valueOf(c))) {
                // 字段分隔符
                fields.add(currentField.toString().trim());
                currentField = new StringBuilder();
            } else {
                currentField.append(c);
            }
        }

        // 添加最后一个字段
        fields.add(currentField.toString().trim());

        return fields.toArray(new String[0]);
    }

    /**
     * 改进的CSV单元格获取方法，支持更多列名变体
     */
    private String getCSVCellImproved(String[] cols, Map<String, Integer> headerIndex, List<String> candidates) {
        for (String candidate : candidates) {
            Integer index = headerIndex.get(candidate);
            if (index != null && index < cols.length) {
                String value = cols[index].trim();
                // 移除可能的引号
                if (value.startsWith("\"") && value.endsWith("\"") && value.length() > 1) {
                    value = value.substring(1, value.length() - 1);
                }
                return value;
            }
        }
        return "";
    }

    private void upsertUser(List<ImportRecord> records, int rowNumber, String studentId, String name,
                           String department, String major, String roleStr, String gpaStr, String rankStr, String totalStr, String convertedScoreStr) {
        // 为每个用户的创建/更新添加锁保护
        distributedLockService.executeWithLockAndRetry("user:upsert:" + studentId, () -> {
            try {
                // 再次检查是否存在，防止并发创建
                Optional<User> existing = userRepository.findByStudentId(studentId);
                Role role = Role.STUDENT;
                if (!isBlank(roleStr)) {
                    try { role = Role.valueOf(roleStr.toUpperCase()); } catch (Exception ignored) {}
                }
                Double gpa = null; Integer rank = null, total = null; Double convertedScore = null;
                if (!isBlank(gpaStr)) {
                    try { gpa = Double.parseDouble(gpaStr); } catch (Exception ignored) {}
                }
                if (!isBlank(rankStr)) {
                    try { rank = Integer.parseInt(rankStr); } catch (Exception ignored) {}
                }
                if (!isBlank(totalStr)) {
                    try { total = Integer.parseInt(totalStr); } catch (Exception ignored) {}
                }
                if (!isBlank(convertedScoreStr)) {
                    try { convertedScore = Double.parseDouble(convertedScoreStr); } catch (Exception ignored) {}
                }

                User user;
                String status;
                if (existing.isPresent()) {
                    user = existing.get();
                    if (!isBlank(name)) user.setName(name);
                    if (!isBlank(department)) user.setDepartment(department);
                    if (!isBlank(major)) user.setMajor(major);
                    user.setRole(role);
                    if (gpa != null) user.setGpa(gpa);
                    if (rank != null) user.setAcademicRank(rank);
                    if (total != null) user.setMajorTotal(total);
                    if (convertedScore != null) user.setConvertedScore(convertedScore);
                    status = "updated";
                } else {
                    user = new User();
                    user.setStudentId(studentId);
                    user.setName(isBlank(name) ? studentId : name);
                    user.setDepartment(department);
                    user.setMajor(major);
                    user.setRole(role);
                    user.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));
                    if (gpa != null) user.setGpa(gpa);
                    if (rank != null) user.setAcademicRank(rank);
                    if (total != null) user.setMajorTotal(total);
                    if (convertedScore != null) user.setConvertedScore(convertedScore);
                    status = "created";
                }

                // 使用try-catch处理可能的数据库约束冲突
                try {
                    userRepository.save(user);
                    ImportRecord rec = new ImportRecord(rowNumber, studentId, status, "成功");
                    rec.setName(user.getName());
                    records.add(rec);
                } catch (org.springframework.dao.DataIntegrityViolationException e) {
                    // 处理唯一约束冲突
                    if (e.getMessage().contains("Duplicate entry")) {
                        ImportRecord rec = new ImportRecord(rowNumber, studentId, "skipped", "学号已存在，跳过创建");
                        rec.setName(name);
                        records.add(rec);
                    } else {
                        throw e;
                    }
                } catch (Exception e) {
                    ImportRecord rec = new ImportRecord(rowNumber, studentId, "failed", "保存失败: " + e.getMessage());
                    rec.setName(name);
                    records.add(rec);
                }

            } catch (Exception e) {
                ImportRecord rec = new ImportRecord(rowNumber, studentId, "failed", "处理失败: " + e.getMessage());
                rec.setName(name);
                records.add(rec);
            }
            return null;
        }, 5); // 增加重试次数到5次
    }

    private String getCell(DataFormatter formatter, Row row, Map<String,Integer> headerIndex, List<String> candidates) {
        for (String candidate : candidates) {
            Integer index = headerIndex.get(candidate);
            if (index != null && index < row.getLastCellNum()) {
                return formatter.formatCellValue(row.getCell(index));
            }
        }
        return "";
    }

    private String getCSVCell(String[] cols, Map<String,Integer> headerIndex, List<String> candidates) {
        for (String candidate : candidates) {
            Integer index = headerIndex.get(candidate);
            if (index != null && index < cols.length) {
                return cols[index];
            }
        }
        return "";
    }

    private boolean isBlank(String str) {
        return str == null || str.trim().isEmpty();
    }

    /**
     * 分页查询用户列表（支持搜索和缓存）
     */
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<User> getUsersPage(int page, int size, String sortBy, String sortDirection, String searchKeyword) {
        // 构建分页参数
        org.springframework.data.domain.Sort sort = sortDirection.equalsIgnoreCase("DESC")
            ? org.springframework.data.domain.Sort.by(sortBy).descending()
            : org.springframework.data.domain.Sort.by(sortBy).ascending();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, sort);

        org.springframework.data.domain.Page<User> userPage;

        // 如果有搜索关键词，执行搜索查询
        if (searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            userPage = userRepository.searchUsers(searchKeyword.trim(), pageable);
        } else {
            userPage = userRepository.findAll(pageable);
        }

        // 初始化每个用户的懒加载关系
        userPage.getContent().forEach(u -> {
            try {
                if (u.getRoles() != null) {
                    u.getRoles().size();
                    u.setRoles(new java.util.HashSet<>(u.getRoles()));
                } else {
                    u.setRoles(new java.util.HashSet<>());
                }
            } catch (Exception e) {
                u.setRoles(new java.util.HashSet<>());
            }
        });

        return userPage;
    }
}

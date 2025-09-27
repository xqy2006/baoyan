package com.xuqinyang.xmudemo.service;

import com.xuqinyang.xmudemo.model.Role;
import com.xuqinyang.xmudemo.model.User;
import com.xuqinyang.xmudemo.repository.UserRepository;
import com.xuqinyang.xmudemo.dto.ImportResult;
import com.xuqinyang.xmudemo.dto.ImportRecord;
import com.xuqinyang.xmudemo.model.ImportHistory;
import com.xuqinyang.xmudemo.repository.ImportHistoryRepository;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
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

    private enum ImportMode { UPSERT }
    private static final String DEFAULT_PASSWORD = "123456";

    public ImportResult importUsersFromExcel(MultipartFile file) throws IOException {
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
                    upsertUser(records, rowNumber, studentId, name, department, major, roleStr, gpaStr, rankStr, totalStr);
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
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = br.readLine();
            if (headerLine == null) { records.add(new ImportRecord(0, "", "failed", "CSV为空")); return new ImportResult(records); }
            if (headerLine.startsWith("\uFEFF")) headerLine = headerLine.substring(1); // 去除BOM
            List<String> headers = parseCsvLine(headerLine);
            Map<String,Integer> headerIndex = new HashMap<>();
            for (int i=0;i<headers.size();i++) headerIndex.put(headers.get(i).trim(), i);
            String line; int rowNumber=1;
            while ((line=br.readLine())!=null) {
                rowNumber++;
                if (line.trim().isEmpty()) continue;
                List<String> cols = parseCsvLine(line);
                String studentId = getCsv(cols, headerIndex, List.of("学号","studentId"));
                if (isBlank(studentId)) { records.add(new ImportRecord(rowNumber, "", "failed", "学号为空")); continue; }
                try {
                    String name = getCsv(cols, headerIndex, List.of("姓名","name"));
                    String department = getCsv(cols, headerIndex, List.of("学院","系别","department"));
                    String major = getCsv(cols, headerIndex, List.of("专业","major"));
                    String roleStr = getCsv(cols, headerIndex, List.of("角色","role"));
                    String gpaStr = getCsv(cols, headerIndex, List.of("GPA","绩点"));
                    String rankStr = getCsv(cols, headerIndex, List.of("学业排名","排名","rank"));
                    String totalStr = getCsv(cols, headerIndex, List.of("专业总人数","总人数","total"));
                    upsertUser(records, rowNumber, studentId, name, department, major, roleStr, gpaStr, rankStr, totalStr);
                } catch (Exception e) {
                    records.add(new ImportRecord(rowNumber, studentId, "failed", "处理失败: "+e.getMessage()));
                }
            }
        }
        return new ImportResult(records);
    }

    private void upsertUser(List<ImportRecord> records, int rowNumber, String studentId, String name, String department, String major, String roleStr,
                             String gpaStr, String rankStr, String totalStr) {
        Optional<User> opt = userRepository.findByStudentId(studentId);
        User user; boolean created = false; List<String> ignored = new ArrayList<>(); int updates = 0;
        if (opt.isEmpty()) {
            user = new User();
            user.setStudentId(studentId);
            user.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));
            // 角色
            Role role = Role.STUDENT;
            if (!isBlank(roleStr)) {
                try { role = Role.valueOf(roleStr.trim().toUpperCase()); } catch (Exception ignoredParse) { ignored.add("角色无效"); }
            }
            user.setRoles(new HashSet<>(Set.of(role)));
            created = true;
        } else {
            user = opt.get();
            if (!isBlank(roleStr)) {
                try { Role role = Role.valueOf(roleStr.trim().toUpperCase()); user.setRoles(new HashSet<>(Set.of(role))); updates++; } catch (Exception e) { ignored.add("角色无效"); }
            }
        }
        if (!isBlank(name)) { if (!name.equals(user.getName())) { user.setName(name.trim()); updates++; } }
        if (!isBlank(department)) { if (!department.equals(user.getDepartment())) { user.setDepartment(department.trim()); updates++; } }
        if (!isBlank(major)) { if (!major.equals(user.getMajor())) { user.setMajor(major.trim()); updates++; } }
        if (!isBlank(gpaStr)) { try { Double g=Double.valueOf(gpaStr.trim()); if (g>=0 && g<=4) { user.setGpa(g); updates++; } else ignored.add("GPA范围"); } catch (Exception e) { ignored.add("GPA格式"); } }
        if (!isBlank(rankStr)) { try { Integer r=Integer.valueOf(rankStr.trim()); if (r>0) { user.setAcademicRank(r); updates++; } else ignored.add("学业排名范围"); } catch (Exception e) { ignored.add("学业排名格式"); } }
        if (!isBlank(totalStr)) { try { Integer t=Integer.valueOf(totalStr.trim()); if (t>0) { user.setMajorTotal(t); updates++; } else ignored.add("专业总人数范围"); } catch (Exception e) { ignored.add("专业总人数格式"); } }
        userRepository.save(user);
        ImportRecord rec = new ImportRecord(rowNumber, studentId, "success", created?"创建成功" : (updates>0?"更新成功(字段数="+updates+")":"无变化"));
        rec.setName(user.getName());
        for (String ig: ignored) rec.addIgnoredField(ig);
        if (!ignored.isEmpty()) { rec.setStatus("warning"); rec.setMessage(rec.getMessage()+"; 忽略:"+String.join("/",ignored)); }
        records.add(rec);
    }

    private String getCell(DataFormatter f, Row row, Map<String,Integer> headerIndex, List<String> names) {
        for (String n : names) { Integer idx = headerIndex.get(n); if (idx!=null) return f.formatCellValue(row.getCell(idx)); }
        return null;
    }
    private String getCsv(List<String> cols, Map<String,Integer> headerIndex, List<String> names) {
        for (String n: names) { Integer idx = headerIndex.get(n); if (idx!=null && idx<cols.size()) return cols.get(idx); }
        return null;
    }
    private boolean isBlank(String s) { return s==null || s.trim().isEmpty(); }
    private List<String> parseCsvLine(String line) {
        List<String> res = new ArrayList<>(); if (line==null) return res;
        StringBuilder cur = new StringBuilder(); boolean inQuotes=false; for (int i=0;i<line.length();i++) {
            char c=line.charAt(i);
            if (c=='"') { inQuotes=!inQuotes; continue; }
            if (c==',' && !inQuotes) { res.add(cur.toString().trim()); cur.setLength(0); } else { cur.append(c); }
        }
        res.add(cur.toString().trim()); return res;
    }
}

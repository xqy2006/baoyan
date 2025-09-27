import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';
import { StudentBasicInfo } from '../App';

interface ImportResult {
  success: number;
  failed: number;
  warnings: number;
  details: ImportRecord[];
}

interface ImportRecord {
  row: number;
  studentId: string;
  name: string;
  status: 'success' | 'failed' | 'warning';
  message: string;
}

export const DataImport: React.FC = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 模拟学生数据
  const [studentsData, setStudentsData] = useState<StudentBasicInfo[]>([
    {
      studentId: '20210001',
      name: '张明',
      department: '计算机科学系',
      major: '计算机科学与技术',
      gpa: 3.85,
      academicRanking: 5,
      totalStudents: 120,
      email: 'zhangming@stu.xmu.edu.cn'
    },
    {
      studentId: '20210002',
      name: '李小红',
      department: '软件工程系',
      major: '软件工程',
      gpa: 3.92,
      academicRanking: 3,
      totalStudents: 98,
      email: 'lixiaohong@stu.xmu.edu.cn'
    }
  ]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setUploadProgress(0);

    // 模拟文件上传和处理过程
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // 模拟处理延迟
    setTimeout(() => {
      // 模拟导入结果
      const mockResult: ImportResult = {
        success: 45,
        failed: 3,
        warnings: 2,
        details: [
          {
            row: 1,
            studentId: '20210001',
            name: '张明',
            status: 'success',
            message: '导入成功'
          },
          {
            row: 15,
            studentId: '20210015',
            name: '王刚',
            status: 'warning',
            message: 'GPA数据格式异常，已使用默认值'
          },
          {
            row: 23,
            studentId: '',
            name: '李华',
            status: 'failed',
            message: '学号为空，导入失败'
          },
          {
            row: 35,
            studentId: '20210035',
            name: '',
            status: 'failed',
            message: '姓名为空，导入失败'
          }
        ]
      };

      setImportResult(mockResult);
      setIsImporting(false);
      clearInterval(progressInterval);
    }, 2500);
  };

  const downloadTemplate = () => {
    // 创建Excel模板数据
    const templateData = [
      ['学号', '姓名', '系别', '专业', 'GPA', '学业排名', '专业总人数', '邮箱'],
      ['20210001', '张三', '计算机科学系', '计算机科学与技术', '3.85', '5', '120', 'zhangsan@stu.xmu.edu.cn'],
      ['20210002', '李四', '软件工程系', '软件工程', '3.92', '3', '98', 'lisi@stu.xmu.edu.cn']
    ];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '学生信息导入模板.csv';
    link.click();
  };

  const getStatusIcon = (status: ImportRecord['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: ImportRecord['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">成功</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">失败</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1>数据导入</h1>
        <p className="text-gray-600 mt-2">批量导入学生基本信息和成绩数据</p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">数据导入</TabsTrigger>
          <TabsTrigger value="current">当前数据</TabsTrigger>
          <TabsTrigger value="history">导入历史</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* 导入说明 */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              请使用Excel或CSV格式上传学生信息。支持的字段包括：学号、姓名、系别、专业、GPA、学业排名、专业总人数、邮箱。
              <Button variant="link" className="p-0 h-auto" onClick={downloadTemplate}>
                下载模板文件
              </Button>
            </AlertDescription>
          </Alert>

          {/* 文件上传区域 */}
          <Card>
            <CardHeader>
              <CardTitle>上传数据文件</CardTitle>
              <CardDescription>
                选择Excel (.xlsx) 或 CSV (.csv) 格式的学生信息文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600">点击选择文件或拖拽文件到此处</p>
                  <p className="text-sm text-gray-500">支持 .xlsx, .csv 格式，最大 10MB</p>
                </div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  选择文件
                </Button>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                  >
                    {isImporting ? '导入中...' : '开始导入'}
                  </Button>
                </div>
              )}

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>导入进度</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 导入结果 */}
          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle>导入结果</CardTitle>
                <CardDescription>
                  本次导入处理了 {importResult.success + importResult.failed + importResult.warnings} 条记录
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 统计概览 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-green-600">{importResult.success}</p>
                    <p className="text-sm text-gray-600">成功导入</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-yellow-600">{importResult.warnings}</p>
                    <p className="text-sm text-gray-600">警告</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <p className="text-2xl font-semibold text-red-600">{importResult.failed}</p>
                    <p className="text-sm text-gray-600">失败</p>
                  </div>
                </div>

                {/* 详细结果 */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>行号</TableHead>
                        <TableHead>学号</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.details.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell>{record.row}</TableCell>
                          <TableCell>{record.studentId || '-'}</TableCell>
                          <TableCell>{record.name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(record.status)}
                              {getStatusBadge(record.status)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{record.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>当前学生数据</CardTitle>
              <CardDescription>
                系统中已有的学生基本信息 ({studentsData.length} 条记录)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>系别</TableHead>
                      <TableHead>专业</TableHead>
                      <TableHead>GPA</TableHead>
                      <TableHead>排名</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsData.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell>{student.studentId}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.department}</TableCell>
                        <TableCell>{student.major}</TableCell>
                        <TableCell>{student.gpa}</TableCell>
                        <TableCell>{student.academicRanking}/{student.totalStudents}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>导入历史</CardTitle>
              <CardDescription>
                最近的数据导入记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">2024年春季学期学生信息.xlsx</p>
                      <p className="text-sm text-gray-600">2024-03-15 14:30 - 成功导入 156 条记录</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">成功</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">补充学生数据.csv</p>
                      <p className="text-sm text-gray-600">2024-03-10 09:15 - 导入 23 条，2 条警告</p>
                    </div>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium">错误格式文件.xlsx</p>
                      <p className="text-sm text-gray-600">2024-03-08 16:45 - 导入失败，格式不正确</p>
                    </div>
                  </div>
                  <Badge className="bg-red-100 text-red-800">失败</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
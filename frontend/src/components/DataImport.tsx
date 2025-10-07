import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Users, Pencil, Save as SaveIcon, X as CloseIcon, Key, RefreshCw, FileDown } from 'lucide-react';
import { StudentBasicInfo } from '../App';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { ConfirmDialog, InputDialog } from './ui/confirm-dialog';
import { SearchBox } from './SearchBox';
import { Pagination } from './Pagination';

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
  ignoredFields?: string[]; // 新增
}

const ignoredFieldExplain: Record<string,string> = {
  'GPA范围':'GPA 不在 0~4 合理范围内，因此未更新',
  'GPA格式':'GPA 不是合法数字',
  '学业排名范围':'排名必须为正整数',
  '学业排名格式':'排名不是合法整数',
  '专业总人数范围':'总人数必须为正整数',
  '专业总人数格式':'总人数不是合法整数'
};

export const DataImport: React.FC<{ role: string }> = ({ role }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 用户管理相关状态
  const [userList, setUserList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 分页和搜索状态
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 创建用户表单状态
  const [createForm, setCreateForm] = useState<{
    studentId: string;
    password: string;
    role: string;
    name: string;
    department: string;
    major: string;
    gpa?: string;
    academicRank?: string;
    majorTotal?: string;
    convertedScore?: string;
  }>({
    studentId: '',
    password: '',
    role: 'STUDENT',
    name: '',
    department: '',
    major: ''
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 导入历史相关状态
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('import');

  // 行内编辑状态
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ gpa?: string; academicRank?: string; majorTotal?: string; convertedScore?: string; name?: string; department?: string; major?: string }>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // 错误/提示信息状态
  const [importError, setImportError] = useState('');
  const [importInfo, setImportInfo] = useState('');

  // 删除用户确认
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string|null>(null);
  // 重置密码对话框
  const [resetPwdUser, setResetPwdUser] = useState<string|null>(null);

  React.useEffect(() => {
    fetch('/api/users/me', { credentials:'include' })
      .then(r=>r.ok? r.json(): Promise.reject())
      .then(data=> setCurrentUserId(data.studentId))
      .catch(()=>{});
  }, []);

  const onTabChange = (val: string) => {
    setActiveTab(val);
    if (val === 'history') {
      loadHistory();
    }
    if (val === 'current') {
      loadUsers();
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/users/import-history', { credentials:'include' });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (e) {
      /* ignore */
    }
    setLoadingHistory(false);
  };

  // 仅管理员可见
  if (role !== 'ADMIN') {
    return <Alert><AlertDescription>无权限访问此页面。</AlertDescription></Alert>;
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImportError(''); setImportInfo('');
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx','csv'].includes(ext||'')) { setImportError('仅支持 .xlsx / .csv 文件'); return; }
    if (selectedFile.size > 10*1024*1024) { setImportError('文件超过 10MB 限制'); return; }

    setIsImporting(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', selectedFile);

    // 使用 XMLHttpRequest 以支持进度
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/users/import');
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 70); // 上传部分占 70%
          setUploadProgress(pct);
        }
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >=200 && xhr.status <300) {
            try {
              const result = JSON.parse(xhr.responseText);
              setImportResult(result);
              setUploadProgress(100);
              setImportInfo('导入完成');
            } catch (e:any) {
              setImportError('解析服务器响应失败');
              setUploadProgress(0);
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              setImportResult(err); // 可能包含 details
            } catch {
              setImportError('导入失败，状态码 '+xhr.status);
            }
            setUploadProgress(0);
          }
          setIsImporting(false);
          resolve();
        }
      };
      xhr.onerror = () => {
        setImportError('网络错误，无法上传');
        setIsImporting(false);
        setUploadProgress(0);
        resolve();
      };
      xhr.send(formData);
    });
  };

  // 新增：两类模板下载（用户创建、学业信息更新）
  const downloadUserTemplate = () => {
    const data = [
      ['学号', '密码', '角色', '姓名', '学院', '专业'],
      ['20250001', 'Init@123', 'STUDENT', '张三', '信息学院', '软件工程'],
      ['20250002', 'Init@123', 'REVIEWER', '李四', '', '']
    ];
    const csv = data.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '用户创建模板.csv';
    a.click();
  };

  const downloadAcademicTemplate = () => {
    const data = [
      ['学号', '姓名', '学院', '专业', 'GPA', '学业排名', '专业总人数', '换算后的成绩'],
      ['20250001', '张三', '信息学院', '软件工程', '3.85', '5', '120', '94.5'],
      ['20250002', '李四', '信息学院', '软件工程', '3.92', '3', '120', '96.2']
    ];
    const csv = data.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '学业信息更新模板.csv';
    a.click();
  };

  const downloadTemplate = () => {
    const data = [
      ['学号','姓名','学院','专业','角色(可选)','GPA(可选 0~4)','学业排名(可选)','专业总人数(可选)','换算后的成绩(可选)'],
      ['20250001','张三','信息学院','软件工程','STUDENT','3.85','5','120','94.5'],
      ['20250002','李四','信息学院','软件工程','REVIEWER','','','','']
    ];
    const csv = data.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='导入模板.csv'; a.click();
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

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      // 构建分页查询参数
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        sortBy: 'id',
        sortDirection: 'ASC'
      });

      if (searchKeyword) {
        params.append('search', searchKeyword);
      }

      const res = await fetch(`/api/users/page?${params.toString()}`, { credentials:'include' });
      if (res.ok) {
        const data = await res.json();
        // 分页API返回的是PageResponse，需要提取content
        setUserList(data.content || []);
        setTotalElements(data.totalElements || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (e) {
      console.error('加载用户失败:', e);
    }
    setLoadingUsers(false);
  };

  React.useEffect(() => {
    if (activeTab === 'current') {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, pageSize, searchKeyword]);

  const handleSearch = useCallback((keyword: string) => {
    console.log('[DataImport] handleSearch 调用:', keyword);
    setSearchKeyword(keyword);
    setPage(0); // 搜索时重置到第一页
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    console.log('[DataImport] handlePageChange 调用 - 从', page, '到', newPage);
    setPage(newPage);
  }, [page]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    console.log('[DataImport] handlePageSizeChange 调用:', newSize);
    setPageSize(newSize);
    setPage(0); // 改变每页大小时重置到第一页
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    if (!createForm.studentId || !createForm.password || !createForm.role) {
      setCreateError('学号/密码/角色必填');
      return;
    }
    if (createForm.role === 'STUDENT' && (!createForm.name || !createForm.department || !createForm.major)) {
      setCreateError('学生需填写姓名/学院/专业');
      return;
    }
    try {
      // 构建请求体，包含学业信息
      const payload: any = {
        studentId: createForm.studentId,
        password: createForm.password,
        role: createForm.role,
        name: createForm.name,
        department: createForm.department,
        major: createForm.major
      };

      // 添加可选的学业信息字段
      if (createForm.gpa) {
        payload.gpa = parseFloat(createForm.gpa);
      }
      if (createForm.academicRank) {
        payload.academicRank = parseInt(createForm.academicRank);
      }
      if (createForm.majorTotal) {
        payload.majorTotal = parseInt(createForm.majorTotal);
      }
      if (createForm.convertedScore) {
        payload.convertedScore = parseFloat(createForm.convertedScore);
      }

      const res = await fetch('/api/users', { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || '创建失败');
      } else {
        setCreateSuccess('创建成功');
        setCreateForm({ studentId: '', password: '', role: 'STUDENT', name: '', department: '', major: '' });
        loadUsers();
      }
    } catch (e:any) {
      setCreateError(e.message);
    }
  };

  const handleDeleteUser = async (studentId: string) => {
    setDeleteMsg('');
    setConfirmDeleteUser(studentId);
  };
  const doDeleteUser = async () => {
    if(!confirmDeleteUser) return;
    try {
      const res = await fetch(`/api/users/${confirmDeleteUser}`, { method:'DELETE', credentials:'include' });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setDeleteMsg(data.error || '删除失败');
        toast.error(data.error || '删除失败');
      } else {
        const sid = confirmDeleteUser; setDeleteMsg(`删除成功: ${sid}`); toast.success(`已删除 ${sid}`); loadUsers();
      }
    } catch (e:any) { setDeleteMsg(e.message || '删除异常'); toast.error(e.message||'删除异常'); }
    finally { setConfirmDeleteUser(null); }
  };

  const startEdit = (u: any) => {
    setEditRow(u.studentId);
    setEditValues({
      gpa: u.gpa == null ? '' : String(u.gpa),
      academicRank: u.academicRank == null ? '' : String(u.academicRank),
      majorTotal: u.majorTotal == null ? '' : String(u.majorTotal),
      convertedScore: u.convertedScore == null ? '' : String(u.convertedScore),
      name: u.name || '',
      department: u.department || '',
      major: u.major || ''
    });
  };

  const cancelEdit = () => {
    setEditRow(null);
    setEditValues({});
  };

  const saveEdit = async (studentId: string) => {
    setSavingRow(studentId);
    try {
      const payload: any = {};
      if (editValues.gpa !== undefined) payload.gpa = editValues.gpa === '' ? null : Number(editValues.gpa);
      if (editValues.academicRank !== undefined) payload.academicRank = editValues.academicRank === '' ? null : Number(editValues.academicRank);
      if (editValues.majorTotal !== undefined) payload.majorTotal = editValues.majorTotal === '' ? null : Number(editValues.majorTotal);
      if (editValues.convertedScore !== undefined) payload.convertedScore = editValues.convertedScore === '' ? null : Number(editValues.convertedScore);
      if (editValues.name !== undefined) payload.name = editValues.name;
      if (editValues.department !== undefined) payload.department = editValues.department;
      if (editValues.major !== undefined) payload.major = editValues.major;
      const res = await fetch(`/api/users/${studentId}/academic`, { method:'PATCH', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        toast.error('更新失败: ' + (data.error || '未知错误'));
      } else {
        setUserList(list => list.map(u => u.studentId === studentId ? { ...u, ...{ gpa: data.gpa, academicRank: data.academicRank, majorTotal: data.majorTotal, convertedScore: data.convertedScore, name: data.name, department: data.department, major: data.major }} : u));
        toast.success('更新成功');
        cancelEdit();
      }
    } catch (e:any) {
      toast.error('更新异常: ' + e.message);
    } finally { setSavingRow(null); }
  };

  const exportUsers = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/users/export', { credentials:'include' });
      if (!res.ok) { toast.error('导出失败'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'users_export.csv';
      a.click();
      toast.success('导出成功');
    } catch (e:any) { toast.error('导出异常: ' + e.message); }
    finally { setExporting(false); }
  };

  const resetPassword = async (studentId: string) => {
    setResetPwdUser(studentId);
  };
  const doResetPassword = async (pwd:string) => {
    if(pwd.length < 4){ toast.error('长度不足'); return; }
    try {
      const res = await fetch(`/api/users/${resetPwdUser}/reset-password`, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ newPassword: pwd }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) toast.error('重置失败: ' + (data.error || '')); else toast.success('重置成功');
    } catch (e:any) { toast.error('重置异常: ' + e.message); }
    finally { setResetPwdUser(null); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold">数据导入 / 用户管理</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">批量导入或手动创建用户</p>
      </div>

      <Tabs defaultValue="import" className="space-y-4" onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="import">Excel导入</TabsTrigger>
          <TabsTrigger value="create">手动创建</TabsTrigger>
          <TabsTrigger value="current">当前用户</TabsTrigger>
          <TabsTrigger value="history">导入历史</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* 顶部新增导出按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>下载导入模板</Button>
            <Button variant="outline" size="sm" onClick={exportUsers} disabled={exporting}>{exporting? '导出中...' : '导出全部用户CSV'}</Button>
          </div>
          {/* 导入说明 */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              统一导入/更新模式 (UPSERT)：按学号匹配，存在则更新相关字段，不存在则创建用户。<br/>
              创建时若未提供角色，默认 STUDENT；初始密码固定为 123456。角色可为 STUDENT / REVIEWER / ADMIN。<br/>
              可选字段：GPA (0~4)，学业排名 / 专业总人数 为正整数。空单元格不会覆盖已有值。<br/>
              支持 .xlsx 与 .csv，CSV 请使用 UTF-8 编码。<br/>
              模板列：学号, 姓名, 学院, 专业, 角色(可选), GPA(可选), 学业排名(可选), 专业总人数(可选)。
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

              {(importError || importInfo) && (
                <div className={`text-sm mt-2 ${importError? 'text-red-600':'text-green-600'}`}>
                  {importError || importInfo}
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
                        <TableHead>忽略字段</TableHead>{/* 新增列 */}
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
                          <TableCell className="text-xs text-gray-600">{record.ignoredFields && record.ignoredFields.length>0 ? (
                            <div className="flex flex-wrap gap-1">
                              {record.ignoredFields.map((f,i)=>(
                                <span key={i} className="relative group inline-block px-1 py-0.5 rounded bg-yellow-50 border border-yellow-200 cursor-help" title={ignoredFieldExplain[f]||'字段被忽略'}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>手动创建用户</CardTitle>
              <CardDescription>填写信息单个添加（学生需填写姓名、学院、专业）</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>学号</Label>
                    <Input value={createForm.studentId} onChange={e=>setCreateForm(f=>({...f,studentId:e.target.value.trim()}))} required />
                  </div>
                  <div>
                    <Label>密码</Label>
                    <Input type="password" value={createForm.password} onChange={e=>setCreateForm(f=>({...f,password:e.target.value}))} required />
                  </div>
                  <div>
                    <Label>角色</Label>
                    <select className="border rounded px-2 h-9 w-full" value={createForm.role} onChange={e=>setCreateForm(f=>({...f,role:e.target.value as any}))}>
                      <option value="STUDENT">STUDENT</option>
                      <option value="REVIEWER">REVIEWER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  {createForm.role === 'STUDENT' && (
                    <>
                      <div>
                        <Label>姓名</Label>
                        <Input value={createForm.name} onChange={e=>setCreateForm(f=>({...f,name:e.target.value}))} required />
                      </div>
                      <div>
                        <Label>学院/系</Label>
                        <Input value={createForm.department} onChange={e=>setCreateForm(f=>({...f,department:e.target.value}))} required />
                      </div>
                      <div>
                        <Label>专业</Label>
                        <Input value={createForm.major} onChange={e=>setCreateForm(f=>({...f,major:e.target.value}))} required />
                      </div>
                      <div>
                        <Label>GPA (可选, 0-4)</Label>
                        <Input type="number" step="0.0001" min="0" max="4" placeholder="例如: 3.85" onChange={e=>setCreateForm(f=>({...f,gpa:e.target.value}))} />
                      </div>
                      <div>
                        <Label>学业排名 (可选)</Label>
                        <Input type="number" min="1" placeholder="例如: 5" onChange={e=>setCreateForm(f=>({...f,academicRank:e.target.value}))} />
                      </div>
                      <div>
                        <Label>专业总人数 (可选)</Label>
                        <Input type="number" min="1" placeholder="例如: 120" onChange={e=>setCreateForm(f=>({...f,majorTotal:e.target.value}))} />
                      </div>
                      <div>
                        <Label>换算后的成绩 (可选, 0-100)</Label>
                        <Input type="number" step="0.0001" min="0" max="100" placeholder="例如: 94.5" onChange={e=>setCreateForm(f=>({...f,convertedScore:e.target.value}))} />
                      </div>
                    </>
                  )}
                </div>
                {createError && <div className="text-sm text-red-600">{createError}</div>}
                {createSuccess && <div className="text-sm text-green-600">{createSuccess}</div>}
                <Button type="submit" disabled={isImporting}>创建</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>当前用户列表</CardTitle>
              <CardDescription>系统中已有用户（共 {totalElements} 条）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 mb-4">
                {/* 搜索框 */}
                <div className="flex justify-between items-center gap-2">
                  <SearchBox
                    placeholder="搜索学号、姓名、学院或专业..."
                    onSearch={handleSearch}
                    defaultValue={searchKeyword}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadUsers} disabled={loadingUsers}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${loadingUsers ? 'animate-spin' : ''}`} />
                      {loadingUsers ? '刷新中...' : '刷新'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportUsers} disabled={exporting}>
                      <FileDown className="h-4 w-4 mr-1" />
                      {exporting ? '导出中...' : '导出CSV'}
                    </Button>
                  </div>
                </div>

                {deleteMsg && <span className="text-sm text-gray-600">{deleteMsg}</span>}
              </div>

              <div className="border rounded-lg max-h-[480px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>学院/系</TableHead>
                      <TableHead>专业</TableHead>
                      <TableHead>GPA</TableHead>
                      <TableHead>学业排名</TableHead>
                      <TableHead>专业总人数</TableHead>
                      <TableHead>换算后的成绩</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead className="min-w-[150px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userList.map((u,i)=> {
                      const editing = editRow === u.studentId;
                      return (
                        <TableRow key={i}>
                          <TableCell>{u.studentId}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.name} onChange={e=>setEditValues(v=>({...v,name:e.target.value}))} /> : (u.name || '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.department} onChange={e=>setEditValues(v=>({...v,department:e.target.value}))} /> : (u.department || '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.major} onChange={e=>setEditValues(v=>({...v,major:e.target.value}))} /> : (u.major || '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.gpa} onChange={e=>setEditValues(v=>({...v,gpa:e.target.value}))} className="w-20" /> : (u.gpa ?? '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.academicRank} onChange={e=>setEditValues(v=>({...v,academicRank:e.target.value}))} className="w-20" /> : (u.academicRank ?? '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.majorTotal} onChange={e=>setEditValues(v=>({...v,majorTotal:e.target.value}))} className="w-20" /> : (u.majorTotal ?? '-')}</TableCell>
                          <TableCell>{editing ? <Input value={editValues.convertedScore} onChange={e=>setEditValues(v=>({...v,convertedScore:e.target.value}))} className="w-24" /> : (u.convertedScore ?? '-')}</TableCell>
                          <TableCell>{(u.role || (u.roles && Array.isArray(u.roles)? [...u.roles][0] : '-')) || '-'}</TableCell>
                          <TableCell className="space-x-1">
                            {editing ? (
                              <>
                                <Button size="sm" variant="default" onClick={()=>saveEdit(u.studentId)} disabled={savingRow===u.studentId}>{savingRow===u.studentId? '保存中...' : '保存'}</Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={()=>startEdit(u)}>编辑</Button>
                                <Button size="sm" variant="outline" onClick={()=>resetPassword(u.studentId)}>重置密码</Button>
                                <Button size="sm" variant="destructive" disabled={u.studentId===currentUserId} onClick={()=>handleDeleteUser(u.studentId)}>
                                  {u.studentId===currentUserId? '当前用户' : '删除'}
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {userList.length===0 && !loadingUsers && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-gray-500">
                          {searchKeyword ? '没有找到匹配的用户' : '暂无用户'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              {totalPages > 0 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalElements={totalElements}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>导入历史</CardTitle>
              <CardDescription>
                最近 50 条导入记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between mb-2">
                <Button size="sm" variant="outline" onClick={loadHistory} disabled={loadingHistory}>{loadingHistory? '加载中...' : '刷新'}</Button>
                <span className="text-xs text-gray-500">进入此标签自动刷新</span>
              </div>
              <div className="border rounded-lg max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>文件名</TableHead>
                      <TableHead>模式</TableHead>
                      <TableHead>总数</TableHead>
                      <TableHead>成功</TableHead>
                      <TableHead>警告</TableHead>
                      <TableHead>失败</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyList.map((h,i)=>(
                      <TableRow key={i}>
                        <TableCell>{h.createdAt?.replace('T',' ').substring(0,19)}</TableCell>
                        <TableCell>{h.filename}</TableCell>
                        <TableCell>{h.mode==='CREATE_USERS'? '用户创建' : '学业更新'}</TableCell>
                        <TableCell>{h.totalRecords}</TableCell>
                        <TableCell className="text-green-600">{h.success}</TableCell>
                        <TableCell className="text-yellow-600">{h.warnings}</TableCell>
                        <TableCell className="text-red-600">{h.failed}</TableCell>
                      </TableRow>
                    ))}
                    {historyList.length===0 && !loadingHistory && (
                      <TableRow><TableCell colSpan={7} className="text-center text-sm text-gray-500">暂无历史记录</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!confirmDeleteUser} onOpenChange={o=>{ if(!o) setConfirmDeleteUser(null); }} title="确认删除用户" description={`将删除用户 ${confirmDeleteUser||''} ，该操作不可恢复。`} confirmText="删除" destructive onConfirm={doDeleteUser} />
      <InputDialog open={!!resetPwdUser} onOpenChange={o=>{ if(!o) setResetPwdUser(null); }} title={`重置密码 - ${resetPwdUser||''}`} placeholder="输入新密码(至少4位)" confirmText="重置" type="password" onConfirm={doResetPassword} />
    </div>
  );
};

// 在导入结果表格中增加忽略字段列
// (由于大段 existing code 隐式保留，上面插入的修改会让原来导入结果部分继续使用，只需在详细结果表生成时若 record.ignoredFields 显示)

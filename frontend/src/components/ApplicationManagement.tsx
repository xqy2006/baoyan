import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SearchBox } from './SearchBox';
import { Pagination } from './Pagination';
import { FileText, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Application {
  id: number;
  status: string;
  userStudentId: string;
  userName: string;
  activityName: string;
  totalScore: number | null;
  submittedAt: string | null;
  createdAt: string;
}

interface PageResponse {
  content: Application[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export const ApplicationManagement: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const loadApplications = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        sortBy: 'id',
        sortDirection: 'DESC'
      });

      if (searchKeyword) {
        params.append('search', searchKeyword);
      }

      if (statusFilter.length > 0) {
        statusFilter.forEach(s => params.append('statuses', s));
      }

      const res = await fetchWithAuth(`/api/applications/page?${params.toString()}`);
      if (!res.ok) throw new Error('加载失败');

      const data: PageResponse = await res.json();
      setApplications(data.content);
      setTotalElements(data.totalElements);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [page, pageSize, searchKeyword, statusFilter]);

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setPage(0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(0);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setPage(0);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string }> = {
      DRAFT: { variant: 'secondary', label: '草稿' },
      SYSTEM_REVIEWING: { variant: 'default', label: '系统审核中' },
      SYSTEM_APPROVED: { variant: 'default', label: '系统通过' },
      SYSTEM_REJECTED: { variant: 'destructive', label: '系统拒绝' },
      ADMIN_REVIEWING: { variant: 'default', label: '人工审核中' },
      APPROVED: { variant: 'default', label: '通过' },
      REJECTED: { variant: 'destructive', label: '拒绝' },
      CANCELLED: { variant: 'secondary', label: '已取消' }
    };
    const { variant, label } = config[status] || { variant: 'secondary', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const allStatuses = [
    'SYSTEM_REVIEWING',
    'SYSTEM_APPROVED',
    'ADMIN_REVIEWING',
    'APPROVED',
    'REJECTED'
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold">申请管理</h1>
            <p className="text-sm text-gray-600">
              共 {totalElements} 个申请
            </p>
          </div>
          <SearchBox
            placeholder="搜索学号、姓名或活动..."
            onSearch={handleSearch}
            defaultValue={searchKeyword}
          />
        </div>

        {/* 状态筛选 */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 self-center">筛选状态:</span>
          {allStatuses.map(status => (
            <Button
              key={status}
              variant={statusFilter.includes(status) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilterChange(status)}
            >
              {getStatusBadge(status)}
            </Button>
          ))}
          {statusFilter.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter([])}
            >
              清除筛选
            </Button>
          )}
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>申请列表</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-500">
              {searchKeyword || statusFilter.length > 0 ? '没有找到匹配的申请' : '暂无申请'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-2">ID</th>
                    <th className="p-2">学号</th>
                    <th className="p-2">姓名</th>
                    <th className="p-2 hidden md:table-cell">活动</th>
                    <th className="p-2 hidden lg:table-cell">总分</th>
                    <th className="p-2">状态</th>
                    <th className="p-2 hidden sm:table-cell">提交时间</th>
                    <th className="p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{app.id}</td>
                      <td className="p-2 font-mono text-xs">{app.userStudentId}</td>
                      <td className="p-2">{app.userName}</td>
                      <td className="p-2 hidden md:table-cell truncate max-w-xs">
                        {app.activityName}
                      </td>
                      <td className="p-2 hidden lg:table-cell">
                        {app.totalScore !== null ? app.totalScore.toFixed(2) : '-'}
                      </td>
                      <td className="p-2">{getStatusBadge(app.status)}</td>
                      <td className="p-2 hidden sm:table-cell text-xs text-gray-600">
                        {app.submittedAt
                          ? new Date(app.submittedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/review/${app.id}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalElements={totalElements}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
};


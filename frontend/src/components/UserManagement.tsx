import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SearchBox } from './SearchBox';
import { Pagination } from './Pagination';
import { Users, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface User {
  studentId: string;
  name: string;
  department: string;
  major: string;
  gpa: number | null;
  academicRank: number | null;
  majorTotal: number | null;
  convertedScore: number | null;
  roles: string[];
  role: string;
}

interface PageResponse {
  content: User[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export const UserManagement: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 使用 useRef 存储 fetchWithAuth，避免依赖变化
  const fetchWithAuthRef = useRef(fetchWithAuth);
  fetchWithAuthRef.current = fetchWithAuth;

  // 使用 useEffect 直接处理加载逻辑
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          size: pageSize.toString(),
          sortBy: 'id',
          sortDirection: 'ASC'
        });

        if (searchKeyword) {
          params.append('search', searchKeyword);
        }

        const res = await fetchWithAuthRef.current(`/api/users/page?${params.toString()}`);
        if (!res.ok) throw new Error('加载失败');

        const data: PageResponse = await res.json();
        setUsers(data.content);
        setTotalElements(data.totalElements);
        setTotalPages(data.totalPages);
      } catch (e: any) {
        setError(e.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
    // 注意：这里故意不包含 fetchWithAuth 作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchKeyword]);

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setPage(0); // 搜索时重置到第一页
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(0); // 改变每页大小时重置到第一页
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm(`确定要删除用户 ${studentId} 吗？`)) return;

    try {
      const res = await fetchWithAuthRef.current(`/api/users/${studentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '删除失败');
      }
      // 删除后重新加载 - 通过更新时间戳触发
      setPage(p => p);
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      ADMIN: 'destructive',
      REVIEWER: 'default',
      STUDENT: 'secondary'
    };
    return <Badge variant={variants[role] || 'secondary'}>{role}</Badge>;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">用户管理</h1>
          <p className="text-sm text-gray-600">
            共 {totalElements} 个用户
          </p>
        </div>
        <SearchBox
          placeholder="搜索学号、姓名、学院或专业..."
          onSearch={handleSearch}
          defaultValue={searchKeyword}
        />
      </div>

      {loading && <div className="text-sm text-gray-500">加载中...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>用户列表</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-500">
              {searchKeyword ? '没有找到匹配的用户' : '暂无用户'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-2">学号</th>
                    <th className="p-2">姓名</th>
                    <th className="p-2 hidden sm:table-cell">学院</th>
                    <th className="p-2 hidden md:table-cell">专业</th>
                    <th className="p-2 hidden lg:table-cell">GPA</th>
                    <th className="p-2 hidden lg:table-cell">排名</th>
                    <th className="p-2">角色</th>
                    <th className="p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.studentId} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{user.studentId}</td>
                      <td className="p-2">{user.name}</td>
                      <td className="p-2 hidden sm:table-cell">{user.department}</td>
                      <td className="p-2 hidden md:table-cell">{user.major}</td>
                      <td className="p-2 hidden lg:table-cell">
                        {user.gpa ? user.gpa.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 hidden lg:table-cell">
                        {user.academicRank && user.majorTotal
                          ? `${user.academicRank}/${user.majorTotal}`
                          : '-'}
                      </td>
                      <td className="p-2">{getRoleBadge(user.role)}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.studentId)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
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

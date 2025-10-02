import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../context/AuthContext';

interface Props { role: string; }

export const Account: React.FC<Props> = () => {
  const { logout, user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (!oldPassword || !newPassword) { setError('请输入原密码和新密码'); return; }
    if (newPassword !== confirmNew) { setError('两次输入的新密码不一致'); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/users/change-password', { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ oldPassword, newPassword }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { setError(data.error || '修改失败'); }
      else { setMsg('密码修改成功'); setOldPassword(''); setNewPassword(''); setConfirmNew(''); }
    } catch (e:any) { setError(e.message || '请求异常'); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold">账户管理</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">修改个人密码{user && <span className="ml-2 text-xs text-gray-400">({user.role})</span>}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>为保障安全，请使用至少 4 位的新密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChange} className="space-y-4 max-w-md">
            <div>
              <Label>原密码</Label>
              <Input type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} required />
            </div>
            <div>
              <Label>新密码</Label>
              <Input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
            </div>
            <div>
              <Label>确认新密码</Label>
              <Input type="password" value={confirmNew} onChange={e=>setConfirmNew(e.target.value)} required />
            </div>
            {error && <Alert className="bg-red-50 border-red-200"><AlertDescription className="text-red-700 text-sm">{error}</AlertDescription></Alert>}
            {msg && <Alert className="bg-green-50 border-green-200"><AlertDescription className="text-green-700 text-sm">{msg}</AlertDescription></Alert>}
            <Button type="submit" disabled={loading}>{loading? '提交中...' : '提交修改'}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>退出登录</CardTitle>
          <CardDescription>安全退出当前会话（会清空浏览器内的访问令牌 Cookie）</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={logout}>退出登录</Button>
        </CardContent>
      </Card>
    </div>
  );
};

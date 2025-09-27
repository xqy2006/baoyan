import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { GraduationCap, Mail, Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleDemoLogin = (userType: 'student' | 'reviewer' | 'admin') => {
    if (userType === 'student') {
      onLogin('student@stu.xmu.edu.cn', 'password');
    } else if (userType === 'reviewer') {
      onLogin('reviewer@xmu.edu.cn', 'password');
    } else {
      onLogin('admin@xmu.edu.cn', 'password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl mb-2">厦门大学信息学院推免系统</h1>
          <p className="text-gray-600">2025年推荐免试攻读研究生申请平台</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">登录账户</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="请输入邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                登录
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">或使用演示账户</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleDemoLogin('student')}
                >
                  学生账户演示
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleDemoLogin('reviewer')}
                >
                  审核员账户演示
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleDemoLogin('admin')}
                >
                  管理员账户演示
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
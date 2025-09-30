import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-6xl font-bold text-gray-300">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mt-2">页面未找到</h2>
          <p className="text-gray-600 mt-2 max-w-md mx-auto">
            抱歉，您访问的页面不存在或已被移动。
          </p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            返回首页
          </Button>
          <div>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="ml-3"
            >
              返回上页
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

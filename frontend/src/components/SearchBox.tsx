import React, { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface SearchBoxProps {
  placeholder?: string;
  onSearch: (keyword: string) => void;
  defaultValue?: string;
  debounceMs?: number;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  placeholder = '搜索...',
  onSearch,
  defaultValue = '',
  debounceMs = 500
}) => {
  const [keyword, setKeyword] = useState(defaultValue);
  const lastSearchedRef = useRef(defaultValue);

  // 防抖搜索 - 只在keyword真正改变时触发
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword !== lastSearchedRef.current) {
        lastSearchedRef.current = keyword;
        onSearch(keyword);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [keyword, debounceMs]);

  const handleClear = () => {
    setKeyword('');
  };

  return (
    <div className="relative w-full" style={{ height: '36px' }}>
      {/* 搜索图标 - 前置 */}
      <div
        className="absolute left-0 flex items-center pl-3 pointer-events-none z-10"
        style={{ top: 0, bottom: 0 }}
      >
        <Search className="h-4 w-4 text-gray-400" />
      </div>

      <Input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={placeholder}
        className="w-full"
        style={{ height: '36px', paddingLeft: '36px', paddingRight: '36px' }}
      />

      {/* 清除按钮 - 后置 */}
      {keyword && (
        <div
          className="absolute right-0 flex items-center pr-2 z-10"
          style={{ top: 0, bottom: 0 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 w-7 p-0 hover:bg-gray-100"
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalElements,
  onPageChange,
  onPageSizeChange
}) => {
  const [jumpPage, setJumpPage] = useState('');
  const startItem = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements);

  const goToPage = (page: number) => {
    if (page >= 0 && page < totalPages) {
      onPageChange(page);
    }
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      goToPage(page - 1);
      setJumpPage('');
    }
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  // 生成页码按钮
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // 总页数少，显示所有页码
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {

      if (currentPage < 3) {
        // 当前在前面
        for (let i = 0; i < 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages - 1);
      } else if (currentPage > totalPages - 4) {
        // 当前在后面
        pages.push(0);
        pages.push('...');
        for (let i = totalPages - 4; i < totalPages; i++) pages.push(i);
      } else {
        // 当前在中间
        pages.push(0);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages - 1);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 border-t bg-white">
      <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
        显示 <span className="font-medium">{startItem}</span> 到{' '}
        <span className="font-medium">{endItem}</span>，共{' '}
        <span className="font-medium">{totalElements}</span> 条
      </div>

      <div className="flex items-center gap-2 order-1 sm:order-2">
        {/* 每页大小选择器 */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs sm:text-sm border rounded px-2 py-1"
          >
            <option value={10}>10/页</option>
            <option value={20}>20/页</option>
            <option value={50}>50/页</option>
            <option value={100}>100/页</option>
          </select>
        )}

        {/* 跳转到指定页 */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            placeholder="页码"
            className="w-16 text-xs sm:text-sm border rounded px-2 py-1 text-center"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleJumpToPage}
            disabled={!jumpPage}
            className="text-xs"
          >
            跳转
          </Button>
        </div>

        {/* 分页按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(0)}
            disabled={currentPage === 0}
            className="hidden sm:flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 页码按钮 */}
          {getPageNumbers().map((page, idx) =>
            typeof page === 'number' ? (
              <Button
                key={idx}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => goToPage(page)}
                className="min-w-[2rem] hidden sm:flex"
              >
                {page + 1}
              </Button>
            ) : (
              <span key={idx} className="px-2 text-gray-400 hidden sm:inline">
                {page}
              </span>
            )
          )}

          {/* 移动端显示当前页 */}
          <span className="px-2 text-sm sm:hidden">
            {currentPage + 1}/{totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="hidden sm:flex"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Input } from './input';
import { Label } from './label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { searchCompetitions, COMPETITION_DATABASE, CompetitionItem } from '../../config/competitionDatabase';

interface CompetitionPickerProps {
  value: string;
  level?: 'A+类' | 'A类' | 'A-类';
  onChange: (value: string, item?: CompetitionItem) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CompetitionPicker: React.FC<CompetitionPickerProps> = ({
  value,
  level,
  onChange,
  disabled = false,
  placeholder = "选择或搜索竞赛..."
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<CompetitionItem[]>(COMPETITION_DATABASE);
  const [customMode, setCustomMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 检查当前值是否在竞赛库中
  const currentItem = COMPETITION_DATABASE.find(comp => comp.name === value);
  const isCustomValue = value && !currentItem;

  useEffect(() => {
    // 根据搜索关键词过滤
    let results = searchCompetitions(searchQuery);

    // 如果指定了级别，进一步过滤
    if (level) {
      results = results.filter(comp => comp.level === level);
    }

    setFilteredItems(results);
  }, [searchQuery, level]);

  // 处理选择竞赛
  const handleSelect = (item: CompetitionItem) => {
    onChange(item.name, item);
    setOpen(false);
    setCustomMode(false);
  };

  // 处理自定义输入
  const handleCustomInput = (val: string) => {
    onChange(val);
  };

  // 如果是自定义输入模式
  if (customMode || isCustomValue) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => handleCustomInput(e.target.value)}
            placeholder="输入自定义竞赛名称"
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomMode(false);
              onChange('');
            }}
            disabled={disabled}
          >
            返回选择
          </Button>
        </div>
        <p className="text-xs text-amber-600">
          ⚠️ 自定义竞赛名称可能需要管理员审核
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            type="button"
          >
            <span className="truncate">
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索竞赛名称、关键词..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm">
                  <p className="mb-2">未找到匹配的竞赛</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomMode(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    输入自定义名称
                  </Button>
                </div>
              </CommandEmpty>

              {/* 按级别分组显示 */}
              {['A+类', 'A类', 'A-类'].map((levelKey) => {
                const itemsInLevel = filteredItems.filter(item => item.level === levelKey);
                if (itemsInLevel.length === 0) return null;

                return (
                  <CommandGroup key={levelKey} heading={levelKey}>
                    {itemsInLevel.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => handleSelect(item)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === item.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {item.organizer}
                          </div>
                        </div>
                        <div className="ml-2">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            item.level === 'A+类' ? "bg-red-100 text-red-700" :
                            item.level === 'A类' ? "bg-blue-100 text-blue-700" :
                            "bg-green-100 text-green-700"
                          )}>
                            {item.level}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>

          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                setCustomMode(true);
                setOpen(false);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              或输入其他竞赛名称
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {currentItem && (
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
          <p><strong>主办方：</strong>{currentItem.organizer}</p>
          {currentItem.category && <p><strong>类别：</strong>{currentItem.category}</p>}
        </div>
      )}
    </div>
  );
};


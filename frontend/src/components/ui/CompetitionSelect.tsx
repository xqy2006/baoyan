import React from 'react';
import { COMPETITION_DATABASE, CompetitionItem } from '../../config/competitionDatabase';

interface CompetitionSelectProps {
  value: string;
  onChange: (value: string, item?: CompetitionItem) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CompetitionSelect: React.FC<CompetitionSelectProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "选择或搜索竞赛..."
}) => {
  const [searchValue, setSearchValue] = React.useState(value);
  const [isOpen, setIsOpen] = React.useState(false);
  const [filteredItems, setFilteredItems] = React.useState<CompetitionItem[]>(COMPETITION_DATABASE);

  React.useEffect(() => {
    setSearchValue(value);
  }, [value]);

  React.useEffect(() => {
    const query = searchValue.toLowerCase();
    if (!query) {
      setFilteredItems(COMPETITION_DATABASE);
    } else {
      const filtered = COMPETITION_DATABASE.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.keywords?.some(k => k.toLowerCase().includes(query))
      );
      setFilteredItems(filtered);
    }
  }, [searchValue]);

  const handleSelect = (item: CompetitionItem) => {
    setSearchValue(item.name);
    onChange(item.name, item);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    onChange(newValue, undefined);
    setIsOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {isOpen && filteredItems.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
          {filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => handleSelect(item)}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                {item.keywords && (
                  <div className="text-xs text-muted-foreground">
                    {item.keywords.join(', ')}
                  </div>
                )}
              </div>
              <div className="ml-2 text-xs text-muted-foreground">
                {item.level}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && filteredItems.length === 0 && searchValue && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover p-2 shadow-md">
          <p className="text-sm text-muted-foreground">未找到匹配的竞赛，可直接输入自定义名称</p>
        </div>
      )}
    </div>
  );
};


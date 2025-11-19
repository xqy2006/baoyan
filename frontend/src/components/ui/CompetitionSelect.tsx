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
  placeholder = '选择或搜索竞赛...'
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

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%'
  };

  const inputStyle: React.CSSProperties = {
    display: 'flex',
    height: 40,
    width: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#d4d4d8',
    backgroundColor: '#ffffff',
    padding: '8px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none'
  };

  const listStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    width: '100%',
    marginTop: 4,
    maxHeight: 240,
    overflowY: 'auto',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)'
  };

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    fontSize: 14,
    cursor: 'pointer',
    boxSizing: 'border-box'
  };

  const emptyStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    width: '100%',
    marginTop: 4,
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    padding: 8,
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <input
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        style={inputStyle}
      />

      {isOpen && filteredItems.length > 0 && (
        <div style={listStyle}>
          {filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => handleSelect(item)}
              style={optionStyle}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                {item.keywords && (
                  <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.keywords.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 8, fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                {item.level}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && filteredItems.length === 0 && searchValue && (
        <div style={emptyStyle}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>未找到匹配的竞赛，可直接输入自定义名称</p>
        </div>
      )}
    </div>
  );
};

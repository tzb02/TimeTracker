import React, { useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  usedColors?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#A855F7', // Violet
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  usedColors = [],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    setIsOpen(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onChange(color);
  };

  const isColorUsed = (color: string) => usedColors.includes(color);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:bg-gray-50"
      >
        <div
          className="w-4 h-4 rounded-full border border-gray-300"
          style={{ backgroundColor: value }}
        />
        <span className="text-gray-700">Color</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 p-3 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform ${
                  value === color ? 'border-gray-800' : 'border-gray-300'
                } ${isColorUsed(color) ? 'opacity-50' : ''}`}
                style={{ backgroundColor: color }}
                title={isColorUsed(color) ? 'Color already in use' : color}
              />
            ))}
          </div>
          
          <div className="border-t pt-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Custom Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  const color = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    setCustomColor(color);
                    onChange(color);
                  }
                }}
                placeholder="#3B82F6"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
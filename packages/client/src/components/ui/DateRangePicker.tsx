import React from 'react';
import { DatePicker } from './DatePicker';

interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  disabled?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const handleStartDateChange = (startDate: Date | undefined) => {
    onChange({ ...value, startDate });
  };

  const handleEndDateChange = (endDate: Date | undefined) => {
    onChange({ ...value, endDate });
  };

  const getMaxStartDate = () => {
    if (value.endDate) {
      return value.endDate.toISOString().split('T')[0];
    }
    return undefined;
  };

  const getMinEndDate = () => {
    if (value.startDate) {
      return value.startDate.toISOString().split('T')[0];
    }
    return undefined;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          From
        </label>
        <DatePicker
          value={value.startDate}
          onChange={handleStartDateChange}
          placeholder="Start date"
          disabled={disabled}
          max={getMaxStartDate()}
          className="w-full"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          To
        </label>
        <DatePicker
          value={value.endDate}
          onChange={handleEndDateChange}
          placeholder="End date"
          disabled={disabled}
          min={getMinEndDate()}
          className="w-full"
        />
      </div>
    </div>
  );
};
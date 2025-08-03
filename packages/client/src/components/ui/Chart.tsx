import React from 'react';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: ChartDataPoint[];
  height?: number;
  className?: string;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  className = '',
  showValues = true,
  formatValue = (value) => value.toString(),
}) => {
  if (!data.length) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ height }}>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minBarHeight = 4; // Minimum height for visibility

  return (
    <div className={`bg-white rounded-lg ${className}`}>
      <div className="flex items-end justify-between space-x-1 px-2 pb-2" style={{ height }}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? Math.max(minBarHeight, (item.value / maxValue) * (height - 40)) : minBarHeight;
          
          return (
            <div key={index} className="flex flex-col items-center flex-1 min-w-0">
              <div className="flex flex-col items-center justify-end flex-1 w-full">
                {showValues && item.value > 0 && (
                  <span className="text-xs text-gray-600 mb-1 truncate">
                    {formatValue(item.value)}
                  </span>
                )}
                <div
                  className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: item.color || '#3B82F6',
                    minHeight: `${minBarHeight}px`,
                  }}
                  title={`${item.label}: ${formatValue(item.value)}`}
                />
              </div>
              <span className="text-xs text-gray-500 mt-1 truncate w-full text-center" title={item.label}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PieChartProps {
  data: ChartDataPoint[];
  size?: number;
  className?: string;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 200,
  className = '',
  showLegend = true,
  formatValue = (value) => value.toString(),
}) => {
  if (!data.length) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ width: size, height: size }}>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  const slices = data.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    // Calculate path for SVG arc
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (currentAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return {
      ...item,
      pathData,
      percentage,
      color: item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
    };
  });

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <svg width={size} height={size} className="flex-shrink-0">
        {slices.map((slice, index) => (
          <path
            key={index}
            d={slice.pathData}
            fill={slice.color}
            stroke="white"
            strokeWidth="2"
            className="hover:opacity-80 transition-opacity duration-200"
          >
            <title>{`${slice.label}: ${formatValue(slice.value)} (${slice.percentage.toFixed(1)}%)`}</title>
          </path>
        ))}
      </svg>
      
      {showLegend && (
        <div className="flex-1 min-w-0">
          <div className="space-y-2">
            {slices.map((slice, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate flex-1" title={slice.label}>
                  {slice.label}
                </span>
                <span className="text-gray-600 flex-shrink-0">
                  {formatValue(slice.value)} ({slice.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
import React from 'react';

export const ResponsiveContainer: React.FC<{
  width?: string | number;
  height?: string | number;
  children?: React.ReactNode;
}> = ({ width = '100%', height = 300, children }) => (
  <div style={{ width, height, position: 'relative' }} className="w-full h-full flex items-center justify-center">
    {children}
  </div>
);

const BaseChart: React.FC<{ data?: any[]; children?: React.ReactNode }> = ({ data = [], children }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(100, ...data.map((d) => Number(d?.النسبة_المئوية ?? d?.percentage ?? d?.value ?? 0)));
  return (
    <div className="w-full h-full flex flex-col justify-end gap-2 p-3 select-none">
      <div className="flex-1 flex items-end justify-around gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {data.map((item, idx) => {
          const val = Number(item?.النسبة_المئوية ?? item?.percentage ?? item?.value ?? 0);
          const pct = Math.max(6, Math.min(100, Math.round((val / maxVal) * 100)));
          const passed = item?.passed !== false && val >= 60;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">
                {val}%
              </span>
              <div
                style={{ height: `${pct}%` }}
                className={`w-full max-w-[36px] rounded-t-xl transition-all ${
                  passed
                    ? 'bg-gradient-to-t from-indigo-600 to-emerald-500'
                    : 'bg-gradient-to-t from-rose-600 to-amber-500'
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-around gap-2 text-[10px] font-bold text-slate-500 truncate">
        {data.map((item, idx) => (
          <span key={idx} className="truncate max-w-[70px] text-center">
            {item?.name || item?.shortName || `#${idx + 1}`}
          </span>
        ))}
      </div>
      <div className="hidden">{children}</div>
    </div>
  );
};

export const BarChart = BaseChart;
export const AreaChart = BaseChart;
export const LineChart = BaseChart;
export const ComposedChart = BaseChart;

export const PieChart: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full flex items-center justify-center p-2">{children}</div>
);

export const Pie: React.FC<{ data?: any[]; children?: React.ReactNode; [k: string]: any }> = ({
  data = [],
}) => {
  const total = data.reduce((acc, d) => acc + Number(d?.value || 0), 0) || 1;
  return (
    <div className="w-full space-y-2.5 p-2">
      {data.map((item, idx) => {
        const pct = Math.round((Number(item?.value || 0) / total) * 100);
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-200">{item?.name}</span>
              <span className="font-mono font-black" style={{ color: item?.color || '#6366f1' }}>
                {item?.value} ({pct}%)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: item?.color || '#6366f1' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Bar: React.FC<any> = () => null;
export const Area: React.FC<any> = () => null;
export const Line: React.FC<any> = () => null;
export const XAxis: React.FC<any> = () => null;
export const YAxis: React.FC<any> = () => null;
export const Tooltip: React.FC<any> = () => null;
export const Legend: React.FC<any> = () => null;
export const CartesianGrid: React.FC<any> = () => null;
export const ReferenceLine: React.FC<any> = () => null;
export const Cell: React.FC<any> = () => null;

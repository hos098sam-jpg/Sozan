import React from 'react';
import { Heart, Atom } from 'lucide-react';
import qalbAlElmLogo from '../assets/images/qalb_alelm_official_logo_1791663594965.jpg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  subtitle,
}) => {
  const sizeMap = {
    sm: { box: 'w-9 h-9 rounded-full', icon: 'w-4 h-4', title: 'text-sm', sub: 'text-[10px]' },
    md: { box: 'w-11 h-11 rounded-full', icon: 'w-5 h-5', title: 'text-base sm:text-lg', sub: 'text-[11px]' },
    lg: { box: 'w-14 h-14 rounded-full', icon: 'w-7 h-7', title: 'text-xl sm:text-2xl', sub: 'text-xs' },
    xl: { box: 'w-20 h-20 rounded-full', icon: 'w-10 h-10', title: 'text-2xl sm:text-3xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Visual Logo Icon Badge */}
      <div
        className={`${currentSize.box} relative bg-white text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/40 overflow-hidden shrink-0 group`}
      >
        <img
          src={qalbAlElmLogo}
          alt="شعار منصة المتفلسفة  التعليمية"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        
        {/* Heart + Knowledge atom symbol combination fallback */}
        <div className="absolute inset-0 flex items-center justify-center -z-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900">
          <span className="text-amber-400 font-serif font-black text-xs">فلسفة</span>
          
        </div>
      </div>

      {showText && (
        <div className="text-right min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <h1 className={`${currentSize.title} font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate`}>
              منصة المتفلسفة 
            </h1>
            <span className="hidden xs:inline-block sm:inline-block bg-gradient-to-r from-rose-500 to-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs shrink-0">
              2027
            </span>
          </div>
          {subtitle ? (
            <p className={`${currentSize.sub} text-slate-500 font-bold mt-0.5 truncate`}>
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

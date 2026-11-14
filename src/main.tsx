import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class PlatformErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع أثناء تحميل الواجهة.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PlatformErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#0c091d] text-[#f8f6f0] flex items-center justify-center p-6 font-sans"
        >
          <div className="max-w-md w-full rounded-3xl bg-[#15112c] border border-[#d4af37]/40 p-8 text-center space-y-5 shadow-2xl">
            <img
              src="/logo.png"
              alt="شعار منصة المتفلسفة"
              className="w-20 h-20 mx-auto rounded-2xl object-contain bg-[#0c091d] p-2 border border-[#d4af37]/40"
            />
            <div className="space-y-2">
              <h1 className="text-xl font-black text-[#d4af37]">منصة المتفلسفة التعليمية</h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                حدث تعارض مؤقت أثناء تحميل الصفحة. اضغط على زر التحديث لإعادة تشغيل المنصة بأمان.
              </p>
              {this.state.message && (
                <p className="text-[11px] font-mono text-amber-300/80 bg-black/30 rounded-xl p-2 break-words" dir="ltr">
                  {this.state.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 rounded-2xl bg-[#d4af37] hover:bg-[#e5c158] text-[#0c091d] font-black text-sm cursor-pointer transition-colors"
            >
              تحديث وإعادة فتح المنصة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformErrorBoundary>
      <App />
    </PlatformErrorBoundary>
  </StrictMode>
);

import React from 'react';
import {AlertTriangle, RotateCcw} from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع في التطبيق',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#000000] p-6 text-center text-white"
        >
          <div className="w-full rounded-3xl border-2 border-[#C9A227] bg-[#0A0802] p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C9A227] bg-[#C9A227]/15 text-[#F3D56B]">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-[#F3D56B]">
              حدث خطأ مؤقت — تم حفظ بياناتك محليًا
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              يمكنك إعادة تشغيل الواجهة فورًا للمتابعة بهدوء.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A227] px-4 py-2.5 text-sm font-bold text-black"
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

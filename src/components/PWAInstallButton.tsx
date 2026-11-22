import React, {useState} from 'react';
import {Download, Share, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90'
            : 'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A227] px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90'
        }
      >
        <Download className="h-4 w-4" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#C9A227] px-3 py-2 text-xs font-bold text-[#9A7415] dark:text-[#F3D56B]'
              : 'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#C9A227] px-4 py-2.5 text-sm font-bold text-[#9A7415] dark:text-[#F3D56B]'
          }
        >
          <Share className="h-4 w-4" />
          <span>تثبيت على آيفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
            <div className="w-full max-w-sm rounded-3xl border-2 border-[#C9A227] bg-white p-6 shadow-2xl dark:bg-[#050505]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#F3D56B]">
                  تثبيت البرنامج الإسلامي الذهبي
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="إغلاق"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-white dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
                <li>1. اضغط على زر <strong>المشاركة (Share)</strong> أسفل متصفح سفاري.</li>
                <li>2. مرر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</li>
                <li>3. اضغط <strong>إضافة</strong> لتشغيل التطبيق كتطبيق مستقل يعمل دون إنترنت.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 min-h-[44px] w-full rounded-xl bg-[#C9A227] py-2.5 text-sm font-bold text-black"
              >
                فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

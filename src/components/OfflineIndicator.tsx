import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-[66px] left-1/2 z-50 flex w-[calc(100%-24px)] max-w-[376px] -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-[#C9A227] bg-black px-3.5 py-2 text-xs font-bold text-[#FCE38A] shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[#C9A227]" />
      <span>أنت أوفلاين — التطبيق يعمل 100% بدون نت</span>
    </div>
  );
};

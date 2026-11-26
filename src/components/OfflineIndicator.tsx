import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[72px] z-50 flex items-center gap-2 rounded-2xl border-2 border-[#C9A227] bg-black px-3.5 py-2 text-xs font-bold text-[#FCE38A] shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[#C9A227]" />
      <span>أنت حاليًا في وضع الأوفلاين — يعمل من البيانات المحفوظة على الجهاز</span>
    </div>
  );
};

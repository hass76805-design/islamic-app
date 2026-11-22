import React from 'react';

export const RubElHizbIcon: React.FC<{className?: string}> = ({className = 'w-6 h-6'}) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
    <rect
      x="11"
      y="11"
      width="26"
      height="26"
      rx="2"
      stroke="currentColor"
      strokeWidth="2.2"
    />
    <rect
      x="11"
      y="11"
      width="26"
      height="26"
      rx="2"
      stroke="currentColor"
      strokeWidth="2.2"
      transform="rotate(45 24 24)"
    />
    <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const SurahHeaderFrame: React.FC<{
  title: string;
  subtitle?: string;
}> = ({title, subtitle}) => (
  <div className="relative my-4 flex items-center justify-between overflow-hidden rounded-2xl border-2 border-[#C9A227] bg-[#FBF6E6] px-5 py-3 text-[#5C4308] shadow-sm dark:bg-[#0D0A02] dark:text-[#F3D56B]">
    <RubElHizbIcon className="h-7 w-7 shrink-0 text-[#C9A227]" />
    <div className="text-center">
      <h3 className="font-quran text-2xl font-bold tracking-wide text-[#7A5908] dark:text-[#F3D56B]">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-xs font-semibold text-[#9A7415] dark:text-zinc-300">
          {subtitle}
        </p>
      )}
    </div>
    <RubElHizbIcon className="h-7 w-7 shrink-0 text-[#C9A227]" />
  </div>
);

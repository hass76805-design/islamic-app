import React, {useId} from 'react';

interface GoldenBrandLogoProps {
  size?: number;
  className?: string;
  showWordmarkInside?: boolean;
}

export const GoldenBrandLogo: React.FC<GoldenBrandLogoProps> = ({
  size = 44,
  className = '',
  showWordmarkInside = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradMain = `gold-main-${uid}`;
  const gradBright = `gold-bright-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradMain} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCE38A" />
          <stop offset="48%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9A7210" />
        </linearGradient>
        <linearGradient id={gradBright} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF2BF" />
          <stop offset="55%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#8A640A" />
        </linearGradient>
      </defs>

      {/* Pure Black Rounded Shield with Double Golden Rounded Border */}
      <rect x="0" y="0" width="512" height="512" rx="112" fill="#000000" />
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="98"
        stroke={`url(#${gradMain})`}
        strokeWidth="12"
      />
      <rect
        x="34"
        y="34"
        width="444"
        height="444"
        rx="82"
        stroke="#C9A227"
        strokeOpacity="0.45"
        strokeWidth="3"
      />

      {/* Bespoke 8-Pointed Geometric Star Backdrop */}
      <g
        transform="translate(256, 212)"
        opacity="0.28"
        stroke={`url(#${gradMain})`}
        strokeWidth="3"
      >
        <rect x="-124" y="-124" width="248" height="248" rx="18" />
        <rect
          x="-124"
          y="-124"
          width="248"
          height="248"
          rx="18"
          transform="rotate(45)"
        />
      </g>

      {/* Small Golden Crescent & Star */}
      <g transform="translate(256, 112)">
        <path
          d="M 10,-34 A 26,26 0 1,0 10,18 A 21,21 0 1,1 10,-34 Z"
          fill={`url(#${gradMain})`}
        />
        <polygon
          points="36,-20 40,-9 51,-5 40,-1 36,10 32,-1 21,-5 32,-9"
          fill="#FCE38A"
        />
      </g>

      {/* Golden Open Mushaf */}
      <g transform="translate(256, 236)">
        <path
          d="M -138,44 L -120,-62 Q -62,-76 0,-48 Q 62,-76 120,-62 L 138,44 Q 68,26 0,54 Q -68,26 -138,44 Z"
          fill="#090702"
          stroke={`url(#${gradMain})`}
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M -124,33 L -108,-50 Q -54,-62 -4,-38 L -4,44 Q -62,18 -124,33 Z"
          stroke="#F3D56B"
          strokeWidth="2.5"
          strokeOpacity="0.75"
        />
        <path
          d="M 124,33 L 108,-50 Q 54,-62 4,-38 L 4,44 Q 62,18 124,33 Z"
          stroke="#F3D56B"
          strokeWidth="2.5"
          strokeOpacity="0.75"
        />
        <line
          x1="0"
          y1="-48"
          x2="0"
          y2="54"
          stroke={`url(#${gradMain})`}
          strokeWidth="5"
        />
        <polygon points="0,48 11,59 0,70 -11,59" fill={`url(#${gradMain})`} />

        <g stroke={`url(#${gradMain})`} strokeWidth="3.5" strokeLinecap="round">
          <line x1="-88" y1="-28" x2="-22" y2="-16" />
          <line x1="-92" y1="-8" x2="-22" y2="3" />
          <line x1="-96" y1="12" x2="-24" y2="22" />
          <line x1="88" y1="-28" x2="22" y2="-16" />
          <line x1="92" y1="-8" x2="22" y2="3" />
          <line x1="96" y1="12" x2="24" y2="22" />
        </g>
      </g>

      {/* Unique Arabic Calligraphy: الذهبي */}
      {showWordmarkInside && (
        <g transform="translate(256, 398)">
          <line
            x1="-112"
            y1="-46"
            x2="-40"
            y2="-46"
            stroke={`url(#${gradMain})`}
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          <circle cx="0" cy="-46" r="5" fill="#FCE38A" />
          <line
            x1="40"
            y1="-46"
            x2="112"
            y2="-46"
            stroke={`url(#${gradMain})`}
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          <text
            x="0"
            y="22"
            textAnchor="middle"
            direction="rtl"
            fill={`url(#${gradBright})`}
            fontFamily="'Amiri', 'Noto Naskh Arabic', serif"
            fontSize="84"
            fontWeight="700"
          >
            الذهبي
          </text>
        </g>
      )}
    </svg>
  );
};

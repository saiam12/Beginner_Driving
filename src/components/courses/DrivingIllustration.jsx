import {Check} from 'lucide-react';

export default function DrivingIllustration() {
 return <div className="welcome-illustration fluid-driving-illustration" aria-hidden="true">
  <svg viewBox="0 0 340 170" preserveAspectRatio="xMidYMid meet">
   <defs><pattern id="driving-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#e5edf7" strokeWidth="1"/></pattern></defs>
   <rect width="340" height="170" fill="#f4f8fd"/><rect width="340" height="170" fill="url(#driving-grid)"/>
   <path d="M-30 150L370 5M100-30L175 200" stroke="#e3ebf5" strokeWidth="34"/>
   <path d="M-30 150L370 5M100-30L175 200" stroke="white" strokeWidth="32"/>
   <circle cx="76" cy="82" r="12" fill="#def0e7"/><circle cx="76" cy="82" r="7" fill="#cee9db"/>
   <circle cx="312" cy="144" r="12" fill="#def0e7"/><circle cx="312" cy="144" r="7" fill="#cee9db"/>
   <g transform="rotate(-22 186 93)">
    <rect x="113" y="50" width="146" height="85" rx="14" fill="none" stroke="#7898f5" strokeWidth="4"/>
    <rect x="219" y="70" width="34" height="34" rx="8" fill="white"/>
    <g transform="translate(224 76)" fill="none" stroke="#2d6aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <path d="M3 8L5 3H19L21 8M2 8H22V19H2ZM5 19V22M19 19V22M3 13H6M18 13H21M7 8H17"/>
    </g>
   </g>
   <circle cx="123" cy="139" r="16" fill="white"/><circle cx="123" cy="139" r="12" fill="#52b090"/>
   <path d="M123 131a5 5 0 0 1 5 5c0 4-5 8-5 8s-5-4-5-8a5 5 0 0 1 5-5Z" fill="none" stroke="white" strokeWidth="1.5"/><circle cx="123" cy="136" r="1.5" fill="white"/>
  </svg>
  <span className="mini-label"><Check size={11}/> 나에게 맞는 길</span>
 </div>;
}

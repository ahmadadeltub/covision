
import React, { useEffect, useState } from 'react';

const icons = [
    // Eye Icon
    (key: number, style: any) => (
        <svg key={key} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute opacity-10 text-cyan-500 animate-float">
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    // AI Brain Icon
    (key: number, style: any) => (
        <svg key={key} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute opacity-10 text-purple-500 animate-float">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
    ),
    // Snellen E (Text)
    (key: number, style: any) => (
        <div key={key} style={style} className="absolute opacity-10 text-emerald-500 font-black font-serif animate-float select-none pointer-events-none flex items-center justify-center">
            E
        </div>
    )
];

const FloatingBackground: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        // Generate random items on mount to avoid hydration mismatch if used with SSR (though this is SPA)
        const newItems = Array.from({ length: 15 }).map((_, i) => {
            const type = i % 3;
            const size = 30 + Math.random() * 100;
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            const delay = Math.random() * 20;
            const duration = 15 + Math.random() * 20;

            return {
                id: i,
                type,
                style: {
                    width: type === 2 ? undefined : `${size}px`,
                    height: type === 2 ? undefined : `${size}px`,
                    fontSize: type === 2 ? `${size}px` : undefined,
                    left: `${left}%`,
                    top: `${top}%`,
                    animationDelay: `-${delay}s`,
                    animationDuration: `${duration}s`,
                }
            };
        });
        setItems(newItems);
    }, []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            {items.map(item => icons[item.type](item.id, item.style))}
            <style>{`
        @keyframes float {
          0% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -50px) rotate(10deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
        </div>
    );
};

export default FloatingBackground;

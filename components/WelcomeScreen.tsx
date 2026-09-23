import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { requestForToken } from '../firebase';
import { isLowPowerDevice } from '../utils/devicePerformance';

interface Props {
    lang: Language;
    onStart: () => void;
}

const WelcomeScreen: React.FC<Props> = ({ lang, onStart }) => {
    const t = translations[lang];
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [stats, setStats] = useState({ visitors: 0, tests: 0, reports: 0 });

    useEffect(() => {
        // Local visit counter — always increments, even if API is blocked
        const localVisits = parseInt(localStorage.getItem('cv_local_visits') || '0', 10) + 1;
        localStorage.setItem('cv_local_visits', localVisits.toString());

        const fetchStats = async () => {
            let visCount = localVisits;
            let testsCount = 0;
            let reportsCount = 0;

            try {
                // Increment visitor and read the new count from the response
                const visUpRes = await fetch('https://api.counterapi.dev/v1/covision_final_v2/visitors/up');
                if (visUpRes.ok) {
                    const data = await visUpRes.json();
                    if (data.count) visCount = data.count;
                }
            } catch (e) {
                console.warn('Visitor API unreachable, using local count');
            }

            try {
                const testsRes = await fetch('https://api.counterapi.dev/v1/covision_final_v2/tests_completed');
                if (testsRes.ok) { const d = await testsRes.json(); testsCount = d.count || 0; }
            } catch (e) {
                console.warn('Stats API unreachable');
            }

            setStats({
                visitors: 101 + visCount,
                tests: 305 + testsCount,
                reports: 0,
            });
        };
        fetchStats();
    }, []);

    // Animated particle network background (Optimized for embedded & low-power devices)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animId: number;
        let particles: { x: number; y: number; vx: number; vy: number; size: number; hue: number }[] = [];

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const count = isLowPowerDevice ? 12 : 24;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2.0 + 0.8,
                hue: 190 + Math.random() * 30,
            });
        }

        const maxDist = isLowPowerDevice ? 120 : 160;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = p.x - particles[j].x;
                    const dy = p.y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < maxDist) {
                        ctx.beginPath();
                        ctx.strokeStyle = `hsla(${p.hue}, 100%, 70%, ${(1 - dist / maxDist) * 0.12})`;
                        ctx.lineWidth = 0.8;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
                ctx.beginPath();
                ctx.fillStyle = `hsla(${p.hue}, 100%, 75%, 0.7)`;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            animId = requestAnimationFrame(animate);
        };
        animate();
        setTimeout(() => setLoaded(true), 150);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    const features = [
        { icon: '🔬', label: t.feature_acuity || 'Visual Acuity Test' },
        { icon: '🎨', label: t.feature_color || 'Color Vision Test' },
        { icon: '🤖', label: t.feature_distance || 'AI Analysis' },
        { icon: '📋', label: t.feature_report || 'Professional Medical Report' },
    ];

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        }}>
            {/* Particle canvas */}
            <canvas ref={canvasRef} style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                opacity: 0.7, zIndex: 0,
            }} />

            {/* Ambient glows */}
            <div style={{
                position: 'absolute', top: '-15%', left: '50%',
                transform: 'translateX(-50%)',
                width: '70vw', height: '70vw', maxWidth: 700, maxHeight: 700,
                background: 'radial-gradient(circle, rgba(0,200,255,0.12) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{
                position: 'absolute', bottom: '-20%', right: '-5%',
                width: '50vw', height: '50vw', maxWidth: 500, maxHeight: 500,
                background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
            }} />

            {/* Main content */}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '100%', maxWidth: 740,
                height: '100%',
                maxHeight: '100%',
                padding: 'clamp(6px, 1.2vh, 14px) clamp(10px, 3vw, 20px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'clamp(6px, 1vh, 12px)',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'translateY(0)' : 'translateY(16px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden',
            }}>

                {/* Hero — Logo + Title */}
                <div style={{ textAlign: 'center', flexShrink: 0, width: '100%' }}>
                    {/* Animated logo */}
                    <div style={{
                        width: 'clamp(44px, 7vh, 70px)',
                        height: 'clamp(44px, 7vh, 70px)',
                        margin: '0 auto clamp(6px, 1vh, 12px)',
                        position: 'relative',
                    }}>
                        <div style={{
                            position: 'absolute', inset: -4,
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderTopColor: 'rgba(56,189,248,0.6)',
                            borderRightColor: 'rgba(56,189,248,0.2)',
                            animation: 'spin 3s linear infinite',
                        }} />
                        <div style={{
                            position: 'absolute', inset: -10,
                            borderRadius: '50%',
                            border: '1.5px solid transparent',
                            borderBottomColor: 'rgba(129,140,248,0.5)',
                            animation: 'spin 6s linear infinite reverse',
                        }} />
                        <div style={{
                            width: '100%', height: '100%',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(129,140,248,0.12))',
                            border: '1.5px solid rgba(56,189,248,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 'clamp(24px, 4vh, 38px)',
                            boxShadow: '0 0 30px rgba(56,189,248,0.2)',
                        }}>👁️</div>
                    </div>

                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 12px',
                        background: 'rgba(56,189,248,0.1)',
                        border: '1px solid rgba(56,189,248,0.2)',
                        borderRadius: 20,
                        fontSize: 'clamp(9px, 1.1vh, 11px)',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        marginBottom: 'clamp(4px, 0.8vh, 8px)',
                    }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        AI-Powered Vision Screening
                    </div>

                    {/* Title */}
                    <h1 style={{
                        fontSize: 'clamp(18px, 3.8vh, 32px)',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 60%, #818cf8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 1.12,
                        margin: '0 0 clamp(4px, 0.6vh, 8px)',
                        letterSpacing: '-0.02em',
                        fontFamily: 'Outfit, Inter, sans-serif',
                    }}>{t.welcome_title}</h1>

                    <p style={{
                        fontSize: 'clamp(11px, 1.4vh, 14px)',
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        maxWidth: 480,
                        margin: '0 auto',
                        lineHeight: 1.4,
                    }}>{t.welcome_subtitle}</p>
                </div>

                {/* Feature cards — 2×2 grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'clamp(8px, 1.3vh, 14px)',
                    width: '100%',
                    flexShrink: 0,
                }}>
                    {features.map((f, i) => (
                        <div key={i} style={{
                            padding: 'clamp(10px, 1.5vh, 16px) clamp(12px, 2.2vw, 20px)',
                            minHeight: 'clamp(54px, 7.2vh, 70px)',
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderRadius: 16,
                            border: '1.5px solid var(--border-color)',
                            boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'clamp(10px, 1.6vw, 16px)',
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            opacity: loaded ? 1 : 0,
                            transform: loaded ? 'translateY(0)' : 'translateY(16px)',
                            transitionDelay: `${0.2 + i * 0.06}s`,
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(56,189,248,0.45)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(56,189,248,0.18)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.06)';
                            }}
                        >
                            <div style={{
                                width: 'clamp(36px, 4.8vh, 48px)',
                                height: 'clamp(36px, 4.8vh, 48px)',
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(99,102,241,0.1))',
                                border: '1px solid rgba(56,189,248,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'clamp(20px, 2.8vh, 28px)',
                                flexShrink: 0,
                                boxShadow: '0 2px 10px rgba(56,189,248,0.1)',
                            }}>
                                {f.icon}
                            </div>
                            <span style={{
                                fontSize: 'clamp(12px, 1.6vh, 15px)',
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                                lineHeight: 1.25,
                                letterSpacing: '-0.01em',
                                fontFamily: 'Outfit, Inter, sans-serif',
                            }}>
                                {f.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Disclaimer */}
                <div style={{
                    width: '100%', flexShrink: 0,
                    padding: 'clamp(6px, 0.9vh, 10px) clamp(10px, 1.5vw, 14px)',
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.15)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <p style={{ fontSize: 'clamp(9px, 1.1vh, 12px)', color: 'var(--text-muted)', lineHeight: 1.35, fontWeight: 500, margin: 0 }}>
                        <strong style={{ color: 'var(--warning)', fontWeight: 700 }}>{t.disclaimer_title?.replace('⚠️ ', '') || 'Medical Disclaimer'} — </strong>
                        {t.disclaimer_text}
                    </p>
                </div>

                {/* CTA Button */}
                <button
                    onClick={async () => {
                        try { await requestForToken(); } catch(e) { console.error(e); }
                        onStart();
                    }}
                    style={{
                        width: '100%', flexShrink: 0, position: 'relative',
                        padding: 'clamp(12px, 2vh, 18px) 20px',
                        minHeight: 'clamp(54px, 7vh, 66px)',
                        fontSize: 'clamp(15px, 2.2vh, 20px)',
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 45%, #6366f1 100%)',
                        border: 'none',
                        borderRadius: 16,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 6px 24px rgba(14,165,233,0.4)',
                        overflow: 'hidden',
                        fontFamily: 'Outfit, Inter, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(14,165,233,0.55)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(14,165,233,0.4)';
                    }}
                >
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        transform: 'translateX(-100%)',
                        animation: 'shimmer 2.5s ease-in-out infinite',
                    }} />
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 'clamp(18px, 2.6vh, 24px)' }}>🚀</span>
                        <span>{t.begin_screening}</span>
                    </span>
                </button>

                {/* Live Stats + Credits inline row */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    flexShrink: 0,
                    padding: 'clamp(5px, 0.8vh, 8px) 12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 'clamp(9px, 1.1vh, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
                            👥 Visitors:
                        </span>
                        <span style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', color: 'var(--accent)', fontWeight: 900, fontFamily: 'Outfit, Inter, sans-serif' }}>
                            {stats.visitors === 0 ? '—' : stats.visitors.toLocaleString()}
                        </span>
                    </div>
                    <div style={{
                        fontSize: 'clamp(8px, 1vh, 10px)',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                        lineHeight: 1.25,
                    }}>
                        Yousef Al-Qahtani, Fahad Rashid · Eng. Ahmad Tubaishat
                    </div>
                </div>
            </div>

            <div className="absolute bottom-3 right-4 text-[9px] text-slate-600 font-bold tracking-widest uppercase z-10 hidden md:block">
                CoVision v1.4.0
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default WelcomeScreen;

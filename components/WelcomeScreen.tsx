import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { requestForToken } from '../firebase';

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

    // Animated particle network background
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        let animId: number;
        let particles: { x: number; y: number; vx: number; vy: number; size: number; hue: number }[] = [];

        const resize = () => {
            canvas.width = canvas.offsetWidth * 2;
            canvas.height = canvas.offsetHeight * 2;
        };
        resize();
        window.addEventListener('resize', resize);

        const count = 50;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                size: Math.random() * 2.5 + 0.8,
                hue: 190 + Math.random() * 30,
            });
        }

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
                    if (dist < 200) {
                        ctx.beginPath();
                        ctx.strokeStyle = `hsla(${p.hue}, 100%, 70%, ${(1 - dist / 200) * 0.15})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
                ctx.beginPath();
                ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, 0.6)`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.5)`;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
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
        { icon: '🔬', label: t.feature_acuity || 'Visual Acuity' },
        { icon: '🎨', label: t.feature_color || 'Color Vision' },
        { icon: '🤖', label: t.feature_distance || 'AI Face Analysis' },
        { icon: '📋', label: t.feature_report || 'PDF Report' },
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
                width: '100%', maxWidth: 680,
                height: '100%',
                padding: 'clamp(16px, 3vh, 32px) clamp(12px, 4vw, 24px) 80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 'clamp(10px, 1.8vh, 20px)',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'translateY(0)' : 'translateY(24px)',
                transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                overflowY: 'auto',
                overflowX: 'hidden',
            }}>

                {/* Hero — Logo + Title */}
                <div style={{ textAlign: 'center', flexShrink: 0, width: '100%' }}>
                    {/* Animated logo */}
                    <div style={{
                        width: 'clamp(64px, 11vh, 100px)',
                        height: 'clamp(64px, 11vh, 100px)',
                        margin: '0 auto clamp(12px, 2vh, 20px)',
                        position: 'relative',
                    }}>
                        <div style={{
                            position: 'absolute', inset: -6,
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderTopColor: 'rgba(56,189,248,0.6)',
                            borderRightColor: 'rgba(56,189,248,0.2)',
                            animation: 'spin 3s linear infinite',
                        }} />
                        <div style={{
                            position: 'absolute', inset: -14,
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
                            fontSize: 'clamp(32px, 6vh, 52px)',
                            boxShadow: '0 0 40px rgba(56,189,248,0.2)',
                        }}>👁️</div>
                    </div>

                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 14px',
                        background: 'rgba(56,189,248,0.1)',
                        border: '1px solid rgba(56,189,248,0.2)',
                        borderRadius: 20,
                        fontSize: 'clamp(9px, 1.3vh, 12px)',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        marginBottom: 'clamp(8px, 1.2vh, 14px)',
                    }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        AI-Powered Vision Screening
                    </div>

                    {/* Title */}
                    <h1 style={{
                        fontSize: 'clamp(22px, 5.5vw, 44px)',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 60%, #818cf8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 1.12,
                        margin: '0 0 clamp(6px, 1vh, 12px)',
                        letterSpacing: '-0.02em',
                        fontFamily: 'Outfit, Inter, sans-serif',
                    }}>{t.welcome_title}</h1>

                    <p style={{
                        fontSize: 'clamp(13px, 2vh, 17px)',
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        maxWidth: 480,
                        margin: '0 auto',
                        lineHeight: 1.6,
                    }}>{t.welcome_subtitle}</p>
                </div>

                {/* Feature cards — 2×2 grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'clamp(8px, 1.2vh, 12px)',
                    width: '100%',
                    flexShrink: 0,
                }}>
                    {features.map((f, i) => (
                        <div key={i} style={{
                            padding: 'clamp(10px, 1.6vh, 16px) clamp(12px, 2vw, 18px)',
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            borderRadius: 14,
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'all 0.25s ease',
                            opacity: loaded ? 1 : 0,
                            transform: loaded ? 'translateY(0)' : 'translateY(16px)',
                            transitionDelay: `${0.2 + i * 0.06}s`,
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(56,189,248,0.3)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(56,189,248,0.1)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                            }}
                        >
                            <span style={{ fontSize: 'clamp(22px, 3.5vh, 34px)', lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                            <span style={{ fontSize: 'clamp(11px, 1.5vh, 15px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{f.label}</span>
                        </div>
                    ))}
                </div>

                {/* Disclaimer */}
                <div style={{
                    width: '100%', flexShrink: 0,
                    padding: 'clamp(8px, 1.2vh, 14px) clamp(12px, 2vw, 18px)',
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.15)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                    <p style={{ fontSize: 'clamp(11px, 1.4vh, 14px)', color: 'var(--text-muted)', lineHeight: 1.55, fontWeight: 500, margin: 0 }}>
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
                        padding: 'clamp(14px, 2.2vh, 22px) 20px',
                        fontSize: 'clamp(15px, 2.4vh, 22px)',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                        border: 'none',
                        borderRadius: 16,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 4px 24px rgba(14,165,233,0.35), 0 1px 4px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                        fontFamily: 'Outfit, Inter, sans-serif',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(14,165,233,0.45), 0 2px 8px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(14,165,233,0.35), 0 1px 4px rgba(0,0,0,0.15)';
                    }}
                >
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                        transform: 'translateX(-100%)',
                        animation: 'shimmer 2.5s ease-in-out infinite',
                    }} />
                    <span style={{ position: 'relative', zIndex: 1 }}>🚀 {t.begin_screening}</span>
                </button>

                {/* Live Stats — pill design */}
                <div style={{
                    display: 'flex', gap: 0, width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    flexShrink: 0,
                }}>
                    {[
                        { label: 'Total Visitors', value: stats.visitors.toLocaleString(), color: 'var(--accent)', icon: '👥' },
                        { label: 'Tests Completed', value: stats.tests.toLocaleString(), color: 'var(--success)', icon: '✅' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            flex: 1,
                            padding: 'clamp(10px, 1.5vh, 14px) 12px',
                            textAlign: 'center',
                            borderRight: i === 0 ? '1px solid var(--border-color)' : 'none',
                        }}>
                            <div style={{ fontSize: 'clamp(9px, 1.1vh, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                                {s.icon} {s.label}
                            </div>
                            <div style={{ fontSize: 'clamp(18px, 2.8vh, 26px)', color: s.color, fontWeight: 900, fontFamily: 'Outfit, Inter, sans-serif' }}>
                                {stats.visitors === 0 ? '—' : s.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Credits */}
                <div style={{
                    fontSize: 'clamp(10px, 1.2vh, 12px)',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    lineHeight: 1.6,
                    flexShrink: 0,
                    paddingBottom: 8,
                }}>
                    Designed by Yousef Al-Qahtani, Fahad Rashid · Supervised by Eng. Ahmad Tubaishat
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

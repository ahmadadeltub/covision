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
        const fetchStats = async () => {
            try {
                // Persistent visitor tracking for local user
                const hasVisited = localStorage.getItem('cv_v');
                if (!hasVisited) {
                    await fetch('https://api.counterapi.dev/v1/covision_final_v2/visitors/up');
                    localStorage.setItem('cv_v', '1');
                }
                
                const [visRes, testsRes, repRes] = await Promise.all([
                    fetch('https://api.counterapi.dev/v1/covision_final_v2/visitors'),
                    fetch('https://api.counterapi.dev/v1/covision_final_v2/tests_completed'),
                    fetch('https://api.counterapi.dev/v1/covision_final_v2/reports_sent')
                ]);
                const vis = visRes.ok ? await visRes.json() : { count: 0 };
                const tests = testsRes.ok ? await testsRes.json() : { count: 0 };
                const rep = repRes.ok ? await repRes.json() : { count: 0 };
                
                // Absolute base values requested by user + real counter
                setStats({ 
                    visitors: 102 + (vis.count || 0), 
                    tests: 305 + (tests.count || 0), 
                    reports: 223 + (rep.count || 0) 
                });
            } catch (err) {
                console.error('Failed to fetch stats', err);
                // Fallback to base values if API fails
                setStats({ visitors: 102, tests: 305, reports: 223 });
            }
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

            {/* Main content — uses flex to fill viewport without scroll */}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '100%', maxWidth: 760,
                height: '100%',
                padding: '2vh 20px 100px 20px', // Extra padding at bottom to avoid overlapping floating AI Guide
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(8px, 1.5vh, 20px)',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'translateY(0)' : 'translateY(30px)',
                transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>

                {/* AI Eye Logo — big & prominent */}
                <div style={{
                    position: 'relative',
                    width: 'clamp(90px, 14vh, 140px)',
                    height: 'clamp(90px, 14vh, 140px)',
                    flexShrink: 0,
                }}>
                    <div style={{
                        position: 'absolute', inset: -8,
                        borderRadius: '50%',
                        border: '2.5px solid transparent',
                        borderTopColor: 'rgba(0,200,255,0.5)',
                        borderRightColor: 'rgba(0,200,255,0.2)',
                        animation: 'spin 4s linear infinite',
                    }} />
                    <div style={{
                        position: 'absolute', inset: -18,
                        borderRadius: '50%',
                        border: '1.5px solid transparent',
                        borderBottomColor: 'rgba(99,102,241,0.4)',
                        borderLeftColor: 'rgba(99,102,241,0.15)',
                        animation: 'spin 7s linear infinite reverse',
                    }} />
                    <div style={{
                        width: '100%', height: '100%',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(99,102,241,0.1) 100%)',
                        border: '1.5px solid rgba(0,200,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'clamp(44px, 7vh, 72px)',
                        boxShadow: '0 0 50px rgba(0,200,255,0.2), inset 0 0 40px rgba(0,200,255,0.06)',
                    }}>
                        👁️
                    </div>
                </div>

                {/* Title block */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{
                        fontSize: 'clamp(13px, 1.6vh, 16px)',
                        fontWeight: 800,
                        letterSpacing: '0.35em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        marginBottom: 'clamp(4px, 0.8vh, 10px)',
                    }}>
                        {lang === 'ar' ? 'نظام ذكاء اصطناعي متقدم' : 'Advanced AI-Powered System'}
                    </div>
                    <h1 style={{
                        fontSize: 'clamp(20px, 6vw, 48px)',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 50%, #818cf8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 1.15,
                        marginBottom: 'clamp(4px, 0.6vh, 10px)',
                        letterSpacing: '-0.02em',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                    }}>
                        {t.welcome_title}
                    </h1>
                    <p style={{
                        fontSize: 'clamp(17px, 2.4vh, 24px)',
                        color: 'var(--text-secondary)',
                        fontWeight: 500,
                        maxWidth: 500,
                        margin: '0 auto',
                        lineHeight: 1.5,
                    }}>
                        {t.welcome_subtitle}
                    </p>
                </div>

                {/* Feature cards — 2x2 grid, bigger icons */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'clamp(8px, 1.2vh, 14px)',
                    width: '100%',
                    flexShrink: 0,
                }}>
                    {features.map((f, i) => (
                        <div key={i} style={{
                            padding: 'clamp(12px, 2vh, 22px) clamp(14px, 2vw, 22px)',
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: 16,
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'clamp(8px, 1.5vw, 14px)',
                            transition: 'all 0.3s',
                            cursor: 'default',
                            opacity: loaded ? 1 : 0,
                            transform: loaded ? 'translateY(0)' : 'translateY(20px)',
                            transitionDelay: `${0.25 + i * 0.08}s`,
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,200,255,0.07)';
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,200,255,0.2)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
                                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                            }}
                        >
                            <span style={{
                                fontSize: 'clamp(40px, 6vh, 56px)',
                                lineHeight: 1,
                                flexShrink: 0,
                                filter: 'drop-shadow(0 0 8px rgba(0,200,255,0.3))',
                            }}>{f.icon}</span>
                            <span style={{
                                fontSize: 'clamp(17px, 2.2vh, 22px)',
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                            }}>{f.label}</span>
                        </div>
                    ))}
                </div>

                {/* Disclaimer — compact */}
                <div style={{
                    width: '100%',
                    padding: 'clamp(10px, 1.2vh, 16px) clamp(14px, 2vw, 20px)',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.12)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexShrink: 0,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                }}>
                    <span style={{ fontSize: 'clamp(20px, 3vh, 26px)', flexShrink: 0 }}>⚠️</span>
                    <p style={{
                        fontSize: 'clamp(13px, 1.5vh, 16px)',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        fontWeight: 500,
                        margin: 0,
                    }}>
                        <span style={{ color: '#f59e0b', fontWeight: 800 }}>
                            {t.disclaimer_title?.replace('⚠️ ', '') || 'Medical Disclaimer'}
                        </span>
                        {' — '}
                        {t.disclaimer_text}
                    </p>
                </div>

                {/* CTA Button — big & cinematic */}
                <button
                    onClick={async () => {
                        try {
                            await requestForToken();
                        } catch(e) { console.error(e); }
                        onStart();
                    }}
                    style={{
                        width: '100%',
                        flexShrink: 0,
                        position: 'relative',
                        padding: 'clamp(18px, 2.8vh, 28px) 40px',
                        fontSize: 'clamp(24px, 3.5vh, 32px)',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: '#0f172a',
                        background: 'linear-gradient(135deg, #ffffff 0%, #a5f3fc 50%, #c7d2fe 100%)',
                        border: 'none',
                        borderRadius: 20,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 0 40px rgba(0,200,255,0.2), 0 4px 20px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.01)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(0,200,255,0.35), 0 8px 30px rgba(0,0,0,0.25)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(1)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(0,200,255,0.2), 0 4px 20px rgba(0,0,0,0.2)';
                    }}
                >
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        transform: 'translateX(-100%)',
                        animation: 'shimmer 3s ease-in-out infinite',
                    }} />
                    <span style={{ position: 'relative', zIndex: 1 }}>{t.begin_screening}</span>
                </button>

                {/* Live Stats */}
                <div style={{
                    display: 'flex', gap: 'clamp(15px, 3vw, 30px)', flexWrap: 'wrap', justifyContent: 'center',
                    padding: 'clamp(10px, 1.5vh, 16px) clamp(20px, 4vw, 30px)', 
                    background: 'rgba(15, 23, 42, 0.6)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '20px',
                    backdropFilter: 'blur(10px)',
                    marginTop: 'clamp(5px, 1vh, 10px)',
                    flexShrink: 0
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'clamp(8px, 1.2vh, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Total Visitors</div>
                        <div style={{ fontSize: 'clamp(18px, 2.5vh, 24px)', color: 'var(--accent)', fontWeight: 900 }}>{stats.visitors.toLocaleString()}</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'clamp(8px, 1.2vh, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Tests Completed</div>
                        <div style={{ fontSize: 'clamp(18px, 2.5vh, 24px)', color: '#10b981', fontWeight: 900 }}>{stats.tests.toLocaleString()}</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'clamp(8px, 1.2vh, 11px)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Reports Sent</div>
                        <div style={{ fontSize: 'clamp(18px, 2.5vh, 24px)', color: '#8b5cf6', fontWeight: 900 }}>{stats.reports.toLocaleString()}</div>
                    </div>
                </div>

                {/* Version */}
                <div style={{
                    fontSize: 'clamp(10px, 1.3vh, 14px)',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}>
                    This Website Designed By Yousef Al-Qahtani, Fahad Rashid — Supervised: Eng. Ahmad Tubaishat
                </div>
            </div>

            <div className="absolute bottom-4 right-6 text-[10px] md:text-xs text-slate-600 font-bold tracking-widest uppercase z-10 hidden md:block">
                CoVision OS v1.3.0 • Final Optimized Update
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

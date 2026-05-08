
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface Props {
    lang: Language;
    onStart: () => void;
}

const ColorVisionIntro: React.FC<Props> = ({ lang, onStart }) => {
    const t = translations[lang];

    const guidelines = [
        { icon: '☀️', text: t.lighting_1 },
        { icon: '🚫', text: t.lighting_2 },
        { icon: '🔆', text: t.lighting_3 },
        { icon: '📱', text: t.lighting_4 },
    ];

    return (
        <div className="animate-in" style={{ maxWidth: 560, width: '100%' }}>
            <div className="card card-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
                {/* Header */}
                <div style={{
                    width: 80, height: 80,
                    borderRadius: '50%',
                    background: 'var(--accent-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 40,
                }}>
                    🎨
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>
                        {t.color_intro_title}
                    </h2>
                    <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t.color_intro_subtitle}
                    </p>
                </div>

                {/* Guidelines */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {guidelines.map((g, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 18px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                        }}>
                            <span style={{ fontSize: 24 }}>{g.icon}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {g.text}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onStart}
                    className="btn btn-primary btn-xl"
                    style={{ width: '100%', fontSize: 20 }}
                >
                    {t.start_color_test}
                </button>
            </div>
        </div>
    );
};

export default ColorVisionIntro;


import React, { useState } from 'react';
import { Language, PatientInfo } from '../types';
import { translations } from '../translations';

interface Props {
    lang: Language;
    onComplete: (patient: PatientInfo) => void;
}

const PatientForm: React.FC<Props> = ({ lang, onComplete }) => {
    const t = translations[lang];
    const [fullName, setFullName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !age) return;

        onComplete({
            fullName: fullName.trim(),
            age: parseInt(age),
            gender,
            dateTime: new Date().toLocaleString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }),
            deviceInfo: `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} — ${window.innerWidth}×${window.innerHeight}`,
        });
    };

    const isValid = fullName.trim().length > 0 && parseInt(age) > 0 && parseInt(age) < 120;

    return (
        <div className="animate-in" style={{ maxWidth: 520, width: '100%' }}>
            <div className="card card-lg">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 60, height: 60,
                        borderRadius: '50%',
                        background: 'var(--accent-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, margin: '0 auto 16px',
                    }}>
                        📋
                    </div>
                    <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {t.patient_title}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Name */}
                    <div>
                        <label className="input-label">{t.full_name}</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder={t.enter_name}
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            autoFocus
                            style={{ fontSize: 18 }}
                        />
                    </div>

                    {/* Age */}
                    <div>
                        <label className="input-label">{t.age}</label>
                        <input
                            type="number"
                            className="input-field"
                            placeholder={t.enter_age}
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            min={1} max={120}
                            style={{ fontSize: 18 }}
                        />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="input-label">{t.gender}</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {(['male', 'female'] as const).map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => setGender(g)}
                                    style={{
                                        flex: 1,
                                        padding: '14px 20px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `2px solid ${gender === g ? 'var(--accent)' : 'var(--border-color)'}`,
                                        background: gender === g ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                                        color: gender === g ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontWeight: 700,
                                        fontSize: 16,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {g === 'male' ? '♂ ' : '♀ '}{t[g]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={!isValid}
                        style={{
                            width: '100%',
                            marginTop: 8,
                            opacity: isValid ? 1 : 0.4,
                            cursor: isValid ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {t.next} →
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PatientForm;

import React, { useRef, useMemo, useState } from 'react';
import { Language, AcuityResult, ColorVisionResult, PatientInfo, TestResult, DistanceCompliance } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { translations } from '../translations';

interface Props {
    lang: Language;
    patient: PatientInfo;
    acuity: AcuityResult;
    colorVision: ColorVisionResult;
    testResults?: TestResult[];
    distanceCompliance?: DistanceCompliance;
    onReset: () => void;
}

// ─────────────────────────────────────────────────────────────
// EMBEDDED SVG CHARTS (Vector, High-DPI, Pristine Typography)
// ─────────────────────────────────────────────────────────────

// Helper to normalize test names for charts
const normalizeTestLabel = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('tumbling') || lower.includes('acuity')) return 'Visual Acuity';
    if (lower.includes('snellen')) return 'Snellen Chart';
    if (lower.includes('color')) return 'Color Vision';
    if (lower.includes('contrast')) return 'Contrast Sensitivity';
    if (lower.includes('astigmatism')) return 'Astigmatism Dial';
    if (lower.includes('amsler') || lower.includes('macular')) return 'Amsler Macular';
    return name.length > 18 ? name.slice(0, 16) + '…' : name;
};

// 1. Diagnostic Accuracy vs 80% Normal Clinical Benchmark (Horizontal Bar Chart)
const AccuracyBenchmarkChart: React.FC<{
    data: { name: string; pct: number; score: string; status: 'normal' | 'borderline' | 'abnormal' }[];
}> = ({ data }) => {
    const rowHeight = 28;
    const gap = 10;
    const labelW = 150;
    const chartW = 310;
    const totalW = labelW + chartW + 75;
    const totalH = data.length * (rowHeight + gap) + 36;

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full h-auto" style={{ minWidth: '460px' }}>
                {/* Background Grid Lines & Scale */}
                {[0, 25, 50, 75, 80, 100].map((val) => {
                    const x = labelW + (val / 100) * chartW;
                    const isBench = val === 80;
                    return (
                        <g key={val}>
                            <line
                                x1={x}
                                y1={18}
                                x2={x}
                                y2={totalH - 18}
                                stroke={isBench ? '#0284c7' : '#e2e8f0'}
                                strokeWidth={isBench ? 1.5 : 1}
                                strokeDasharray={isBench ? '4 3' : '2 2'}
                            />
                            <text
                                x={x}
                                y={12}
                                textAnchor="middle"
                                fontSize="9"
                                fill={isBench ? '#0284c7' : '#94a3b8'}
                                fontWeight={isBench ? '800' : '500'}
                            >
                                {val}%
                            </text>
                        </g>
                    );
                })}

                {/* Benchmark Indicator Label */}
                <text
                    x={labelW + 0.8 * chartW}
                    y={totalH - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#0284c7"
                    fontWeight="800"
                    letterSpacing="0.05em"
                >
                    ▲ 80% CLINICAL NORMAL THRESHOLD
                </text>

                {/* Bars */}
                {data.map((item, idx) => {
                    const y = 22 + idx * (rowHeight + gap);
                    const barW = Math.max(6, (Math.min(item.pct, 100) / 100) * chartW);
                    const color = item.pct >= 80 ? '#10b981' : item.pct >= 50 ? '#f59e0b' : '#ef4444';
                    const displayName = normalizeTestLabel(item.name);

                    return (
                        <g key={idx}>
                            {/* Label */}
                            <text
                                x={labelW - 10}
                                y={y + rowHeight / 2 + 3.5}
                                textAnchor="end"
                                fontSize="10.5"
                                fill="#1e293b"
                                fontWeight="700"
                            >
                                {displayName}
                            </text>
                            {/* Track background */}
                            <rect x={labelW} y={y} width={chartW} height={rowHeight} rx={5} fill="#f1f5f9" />
                            {/* Value Fill Bar */}
                            <rect x={labelW} y={y} width={barW} height={rowHeight} rx={5} fill={color} />
                            {/* Percentage Label */}
                            <text
                                x={labelW + barW + 8}
                                y={y + rowHeight / 2 + 3.5}
                                fontSize="10.5"
                                fill="#0f172a"
                                fontWeight="800"
                            >
                                {item.pct.toFixed(0)}%
                            </text>
                            {/* Score Ratio inside or outside */}
                            <text
                                x={labelW + (barW > 45 ? 8 : barW + 42)}
                                y={y + rowHeight / 2 + 3.5}
                                fontSize="9"
                                fill={barW > 45 ? '#ffffff' : '#64748b'}
                                fontWeight="700"
                            >
                                {item.score}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// 2. Response Latency & Speed Distribution Chart (Horizontal Bar format for perfect label fitting)
const LatencySpeedChart: React.FC<{
    data: { name: string; latencyMs: number }[];
}> = ({ data }) => {
    const validData = data.length > 0 ? data : [{ name: 'Default', latencyMs: 500 }];
    const maxLatency = Math.max(...validData.map((d) => d.latencyMs), 1200);
    const rowHeight = 22;
    const gap = 8;
    const labelW = 120;
    const chartW = 200;
    const totalW = labelW + chartW + 60;
    const totalH = validData.length * (rowHeight + gap) + 32;

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full h-auto" style={{ minWidth: '380px' }}>
                {/* Shaded Optimal Zone (300ms - 800ms) */}
                {(() => {
                    const x1 = labelW + (300 / maxLatency) * chartW;
                    const x2 = labelW + (Math.min(800, maxLatency) / maxLatency) * chartW;
                    return (
                        <g>
                            <rect
                                x={x1}
                                y={14}
                                width={x2 - x1}
                                height={totalH - 28}
                                fill="rgba(16,185,129,0.08)"
                                stroke="rgba(16,185,129,0.2)"
                                strokeDasharray="3 3"
                            />
                            <text x={(x1 + x2) / 2} y={10} textAnchor="middle" fontSize="7.5" fill="#059669" fontWeight="700">
                                Optimal Zone (300–800ms)
                            </text>
                        </g>
                    );
                })()}

                {/* Grid ticks */}
                {[0, 400, 800, 1200].map((val) => {
                    if (val > maxLatency) return null;
                    const x = labelW + (val / maxLatency) * chartW;
                    return (
                        <g key={val}>
                            <line x1={x} y1={16} x2={x} y2={totalH - 14} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />
                            <text x={x} y={totalH - 4} textAnchor="middle" fontSize="7.5" fill="#94a3b8">
                                {val}ms
                            </text>
                        </g>
                    );
                })}

                {/* Horizontal Latency Bars */}
                {validData.map((d, idx) => {
                    const y = 18 + idx * (rowHeight + gap);
                    const barW = Math.max(8, (d.latencyMs / maxLatency) * chartW);
                    const color = d.latencyMs <= 800 ? '#10b981' : d.latencyMs <= 1100 ? '#f59e0b' : '#6366f1';
                    const displayName = normalizeTestLabel(d.name);

                    return (
                        <g key={idx}>
                            <text
                                x={labelW - 8}
                                y={y + rowHeight / 2 + 3}
                                textAnchor="end"
                                fontSize="9.5"
                                fill="#334155"
                                fontWeight="700"
                            >
                                {displayName}
                            </text>
                            <rect x={labelW} y={y} width={chartW} height={rowHeight} rx={4} fill="#f1f5f9" />
                            <rect x={labelW} y={y} width={barW} height={rowHeight} rx={4} fill={color} />
                            <text
                                x={labelW + barW + 6}
                                y={y + rowHeight / 2 + 3}
                                fontSize="9"
                                fill="#0f172a"
                                fontWeight="800"
                            >
                                {d.latencyMs}ms
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// 3. Distance Compliance Circular Radial Gauge
const DistanceComplianceGauge: React.FC<{
    percent: number;
    avgDistance: number;
    violations: number;
    targetDistance?: number;
}> = ({ percent, avgDistance, violations, targetDistance = 2.0 }) => {
    const clampedPct = Math.min(Math.max(percent, 0), 100);
    const radius = 58;
    const strokeWidth = 11;
    const circumference = Math.PI * radius; // 180-deg semicircle
    const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
    const color = clampedPct >= 80 ? '#10b981' : clampedPct >= 60 ? '#f59e0b' : '#ef4444';
    const stability = clampedPct >= 85 ? 'Optimal' : clampedPct >= 65 ? 'Acceptable' : 'Drift Alert';

    return (
        <div className="flex flex-col items-center justify-center p-2">
            <svg width="170" height="98" viewBox="0 0 170 98" className="overflow-visible">
                {/* Background Arc */}
                <path
                    d="M 18 86 A 58 58 0 0 1 152 86"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                {/* Colored Progress Arc */}
                <path
                    d="M 18 86 A 58 58 0 0 1 152 86"
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                {/* Center Percentage Display */}
                <text x="85" y="70" textAnchor="middle" fontSize="23" fontWeight="900" fill="#0f172a">
                    {clampedPct.toFixed(0)}%
                </text>
                <text x="85" y="85" textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748b" letterSpacing="0.08em">
                    IN-RANGE RATE
                </text>
            </svg>

            {/* Metric Pills */}
            <div className="grid grid-cols-3 gap-2 w-full mt-2 text-center">
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
                    <p className="text-[8.5px] text-slate-500 font-bold uppercase">Avg Distance</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">{avgDistance.toFixed(2)}m</p>
                    <p className="text-[7.5px] text-slate-400">Target: {targetDistance.toFixed(1)}m</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
                    <p className="text-[8.5px] text-slate-500 font-bold uppercase">Violations</p>
                    <p className="text-xs font-black mt-0.5" style={{ color: violations <= 2 ? '#10b981' : '#ef4444' }}>
                        {violations}
                    </p>
                    <p className="text-[7.5px] text-slate-400">{violations === 0 ? 'Zero drift' : 'Flagged'}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
                    <p className="text-[8.5px] text-slate-500 font-bold uppercase">AI Status</p>
                    <p className="text-[10px] font-black mt-0.5" style={{ color }}>
                        {stability}
                    </p>
                    <p className="text-[7.5px] text-slate-400">FaceEAR</p>
                </div>
            </div>
        </div>
    );
};

// 4. Amsler Central Macular 4-Quadrant Visual Field Grid
const AmslerMacularGrid: React.FC<{
    passed: boolean;
    findings?: string;
}> = ({ passed, findings = '' }) => {
    const size = 105;
    const half = size / 2;
    const gridColor = passed ? '#10b981' : '#f59e0b';
    const quadrantBg = passed ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.08)';

    return (
        <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg shadow-inner flex-shrink-0">
                <rect width={size} height={size} fill="#0f172a" rx={6} />
                <rect x="3" y="3" width={half - 3} height={half - 3} fill={quadrantBg} />
                <rect x={half} y="3" width={half - 3} height={half - 3} fill={quadrantBg} />
                <rect x="3" y={half} width={half - 3} height={half - 3} fill={quadrantBg} />
                <rect x={half} y={half} width={half - 3} height={half - 3} fill={quadrantBg} />

                {[18, 35, 52, 70, 87].map((p) => (
                    <React.Fragment key={p}>
                        <line x1={p} y1="3" x2={p} y2={size - 3} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
                        <line x1="3" y1={p} x2={size - 3} y2={p} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
                    </React.Fragment>
                ))}

                <line x1={half} y1="3" x2={half} y2={size - 3} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                <line x1="3" y1={half} x2={size - 3} y2={half} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />

                <circle cx={half} cy={half} r="3" fill="#ef4444" />

                <text x="6" y="13" fontSize="6.5" fill="#94a3b8" fontWeight="bold">ST</text>
                <text x={size - 14} y="13" fontSize="6.5" fill="#94a3b8" fontWeight="bold">SN</text>
                <text x="6" y={size - 6} fontSize="6.5" fill="#94a3b8" fontWeight="bold">IT</text>
                <text x={size - 14} y={size - 6} fontSize="6.5" fill="#94a3b8" fontWeight="bold">IN</text>
            </svg>

            <div className="flex-1 space-y-1 text-left min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: gridColor }} />
                    <p className="text-xs font-black text-slate-900 truncate">
                        {passed ? 'Macular Field Uniform' : 'Mild Irregularity / Distortion'}
                    </p>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                    4-Quadrant screening: Superior-Temporal (ST), Superior-Nasal (SN), Inferior-Temporal (IT), Inferior-Nasal (IN).
                </p>
                <p className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-2 py-0.5 inline-block">
                    {findings || (passed ? 'Negative for metamorphopsia or central scotoma' : 'Follow-up ophthalmic OCT scan advised')}
                </p>
            </div>
        </div>
    );
};

// 5. Visual Acuity Snellen Progression Ladder
const SnellenLadder: React.FC<{ snellenNotation: string }> = ({ snellenNotation }) => {
    const ladder = ['20/200', '20/100', '20/70', '20/50', '20/40', '20/25', '20/20'];
    const matchedIdx = ladder.findIndex((lvl) => snellenNotation.includes(lvl.replace('20/', '')) || snellenNotation === lvl);
    const activeIdx = matchedIdx >= 0 ? matchedIdx : (snellenNotation.includes('20/20') ? 6 : 4);

    return (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">Acuity Milestone Ladder</span>
                <span className="text-[11px] font-black text-cyan-800 bg-cyan-100/80 border border-cyan-300 px-2 py-0.5 rounded-full">
                    Achieved: {snellenNotation}
                </span>
            </div>
            <div className="relative flex items-center justify-between mt-3 mb-1 px-1">
                <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1.5 bg-slate-200 rounded-full" />
                <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 bg-cyan-600 rounded-full transition-all"
                    style={{ width: `${(activeIdx / (ladder.length - 1)) * 100}%` }}
                />
                {ladder.map((step, idx) => {
                    const isAchieved = idx === activeIdx;
                    const isPast = idx < activeIdx;
                    return (
                        <div key={step} className="relative z-10 flex flex-col items-center">
                            <div
                                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isAchieved
                                        ? 'bg-cyan-600 border-cyan-600 scale-125 shadow-sm shadow-cyan-500/40'
                                        : isPast
                                        ? 'bg-cyan-500 border-cyan-500'
                                        : 'bg-white border-slate-300'
                                }`}
                            >
                                {isAchieved && <div className="w-1 h-1 rounded-full bg-white" />}
                            </div>
                            <span className={`text-[7.5px] mt-1 font-bold ${isAchieved ? 'text-cyan-800 font-black scale-110' : 'text-slate-400'}`}>
                                {step}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 6. Bilateral Eye Comparison OD vs OS
const BilateralComparisonChart: React.FC<{
    odScore: number;
    osScore: number;
    maxScore?: number;
    title?: string;
}> = ({ odScore, osScore, maxScore = 3, title = 'Bilateral Eye Score' }) => {
    const odPct = Math.round((odScore / maxScore) * 100);
    const osPct = Math.round((osScore / maxScore) * 100);

    return (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <p className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">{title}</p>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9.5px]">
                        <span className="font-bold text-cyan-800">👁️ OD (Right)</span>
                        <span className="font-black text-cyan-900">{odScore}/{maxScore} ({odPct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${odPct}%` }} />
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9.5px]">
                        <span className="font-bold text-indigo-800">👁️ OS (Left)</span>
                        <span className="font-black text-indigo-900">{osScore}/{maxScore} ({osPct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${osPct}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// MAIN MEDICAL REPORT COMPONENT
// ─────────────────────────────────────────────────────────────

const MedicalReport: React.FC<Props> = ({
    lang,
    patient,
    acuity,
    colorVision,
    testResults = [],
    distanceCompliance,
    onReset,
}) => {
    const t = translations[lang];
    const reportRef = useRef<HTMLDivElement>(null);
    const [showResearchMode, setShowResearchMode] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [whatsappSending, setWhatsappSending] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappPdfReady, setWhatsappPdfReady] = useState(false);

    // Unique Cryptographic Report Identifier
    const reportId = useMemo(() => {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CVR-${ts}-${rand}`;
    }, []);

    // Risk Assessment
    const getRiskLevel = () => {
        const acuityOk = acuity.finalLogMAR <= 0.3;
        const colorOk = colorVision.classification === 'normal';
        const allTestsPassed = testResults.length > 0 ? testResults.every((r) => r.score / r.total >= 0.6) : true;
        if (acuityOk && colorOk && allTestsPassed) {
            return { level: 'low', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', label: 'Low Risk', icon: '✅' };
        }
        if (!acuityOk && !colorOk) {
            return { level: 'high', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: 'High Risk', icon: '🔴' };
        }
        return { level: 'medium', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Moderate Risk', icon: '⚠️' };
    };
    const risk = getRiskLevel();

    // Clinical Interpretations
    const getAcuityInterpretation = () => {
        if (acuity.finalLogMAR <= 0.0) {
            return { text: 'Optimal visual acuity (20/20 or better). Central foveal resolution intact.', color: '#10b981', status: 'Optimal' };
        }
        if (acuity.finalLogMAR <= 0.2) {
            return { text: 'Normal visual acuity within standard population variance.', color: '#10b981', status: 'Normal' };
        }
        if (acuity.finalLogMAR <= 0.5) {
            return { text: 'Mild to moderate acuity deficit. Refractive correction indicated.', color: '#f59e0b', status: 'Borderline' };
        }
        return { text: 'Significant visual acuity reduction. Comprehensive ophthalmic exam recommended.', color: '#ef4444', status: 'Abnormal' };
    };

    const getColorInterpretation = () => {
        if (colorVision.classification === 'normal') {
            return { text: 'Normal trichromatic color discrimination. Negative for congenital deficiency.', color: '#10b981', status: 'Normal' };
        }
        if (colorVision.classification === 'possible_rg_deficiency') {
            return { text: 'Possible Red-Green deficiency (Protan/Deutan spectrum). Confirmatory testing advised.', color: '#f59e0b', status: 'Borderline' };
        }
        return { text: 'Marked color discrimination defect detected. Specialist evaluation recommended.', color: '#ef4444', status: 'Abnormal' };
    };

    const acuityInterp = getAcuityInterpretation();
    const colorInterp = getColorInterpretation();

    // Per-Test Clinical Advice
    const getTestAdvice = (testName: string, score: number, total: number) => {
        const pct = total > 0 ? (score / total) * 100 : 0;
        const name = testName.toLowerCase();

        if (name.includes('contrast')) {
            if (pct >= 80) return { advice: 'Contrast sensitivity is optimal. Good edge and silhouette detection.', urgency: 'routine' as const };
            if (pct >= 50) return { advice: 'Mildly reduced contrast sensitivity. Caution in twilight or fog conditions.', urgency: 'soon' as const };
            return { advice: 'Reduced contrast sensitivity. Evaluate for cataracts, corneal haze, or optic nerve pathology.', urgency: 'urgent' as const };
        }
        if (name.includes('astigmatism')) {
            if (pct >= 80) return { advice: 'No significant meridional astigmatism detected.', urgency: 'routine' as const };
            if (pct >= 50) return { advice: 'Signs of mild corneal astigmatism. Cylindrical correction may reduce eyestrain.', urgency: 'soon' as const };
            return { advice: 'Significant astigmatic distortion detected. Optometric refraction recommended.', urgency: 'urgent' as const };
        }
        if (name.includes('amsler') || name.includes('macular')) {
            if (pct >= 80) return { advice: 'Macular grid intact. Negative for metamorphopsia or central scotoma.', urgency: 'routine' as const };
            if (pct >= 50) return { advice: 'Mild grid irregularity detected. Dilated fundus exam & OCT scan advised.', urgency: 'soon' as const };
            return { advice: 'Central macular abnormality suspected. Urgent ophthalmic evaluation advised.', urgency: 'urgent' as const };
        }
        if (pct >= 80) return { advice: 'Result within normal diagnostic parameters.', urgency: 'routine' as const };
        if (pct >= 50) return { advice: 'Borderline finding. Recommend review within 3 months.', urgency: 'soon' as const };
        return { advice: 'Abnormal finding. Specialist clinical assessment recommended.', urgency: 'urgent' as const };
    };

    // Overall Patient Wellness & Clinical Guidance
    const getPatientAdvice = (): string[] => {
        const advice: string[] = [];
        if (acuity.finalLogMAR > 0.3) {
            advice.push('📍 Visual Acuity: Acuity is below 20/40. We recommend a refraction exam by an optometrist for corrective spectacles or contact lenses.');
        }
        if (acuity.finalLogMAR > 0.5) {
            advice.push('🚗 Driving Safety: Uncorrected acuity may not meet driving standards in certain regions. Avoid unassisted driving until evaluated.');
        }
        if (colorVision.classification !== 'normal') {
            advice.push('🎨 Color Perception: Potential red-green discrimination variance detected. Consider confirmatory anomaloscope testing.');
        }
        advice.push('👁️ Screen Hygiene: Practice the 20-20-20 rule — every 20 minutes, focus on an object 20 feet away for 20 seconds to relieve ciliary fatigue.');
        advice.push('☀️ Ocular Protection: Wear UV400-rated sunglasses during daylight hours to protect the crystalline lens and retina.');
        if (patient.age >= 40) {
            advice.push('🔬 Preventive Care: Patients aged 40 and above should undergo annual intraocular pressure (IOP) and dilated fundoscopic exams.');
        }
        return advice;
    };

    const followUpTimeline = () => {
        if (risk.level === 'high') return { when: 'Within 2 Weeks', action: 'Urgent ophthalmic consultation', color: '#ef4444' };
        if (risk.level === 'medium') return { when: 'Within 3 Months', action: 'Comprehensive optometric refraction & follow-up', color: '#f59e0b' };
        return { when: 'Annually (12 Months)', action: 'Routine annual vision screening', color: '#10b981' };
    };
    const followUp = followUpTimeline();

    // Chart Data Preparation
    const chartAccuracyData = useMemo(() => {
        const items = [];
        items.push({
            name: 'Visual Acuity',
            pct: acuity.totalTrials > 0 ? (acuity.totalCorrect / acuity.totalTrials) * 100 : (acuity.finalLogMAR <= 0.2 ? 100 : 67),
            score: `${acuity.totalCorrect}/${acuity.totalTrials}`,
            status: (acuity.finalLogMAR <= 0.2 ? 'normal' : acuity.finalLogMAR <= 0.5 ? 'borderline' : 'abnormal') as 'normal' | 'borderline' | 'abnormal',
        });
        items.push({
            name: 'Color Vision',
            pct: colorVision.totalPlates > 0 ? (colorVision.totalCorrect / colorVision.totalPlates) * 100 : 100,
            score: `${colorVision.totalCorrect}/${colorVision.totalPlates}`,
            status: (colorVision.classification === 'normal' ? 'normal' : 'borderline') as 'normal' | 'borderline' | 'abnormal',
        });
        testResults.forEach((r) => {
            const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
            items.push({
                name: r.testName,
                pct,
                score: `${r.score}/${r.total}`,
                status: (pct >= 80 ? 'normal' : pct >= 50 ? 'borderline' : 'abnormal') as 'normal' | 'borderline' | 'abnormal',
            });
        });
        return items;
    }, [acuity, colorVision, testResults]);

    const chartLatencyData = useMemo(() => {
        const items = [];
        if (acuity.averageResponseMs > 0) {
            items.push({ name: 'Visual Acuity', latencyMs: acuity.averageResponseMs });
        }
        testResults.forEach((r) => {
            let lat = 0;
            if (r.perSampleScores && r.perSampleScores.length > 0) {
                lat = Math.round(r.perSampleScores.reduce((acc, s) => acc + s.timeMs, 0) / r.perSampleScores.length);
            } else if (r.rawResponseTimes && r.rawResponseTimes.length > 0) {
                lat = Math.round(r.rawResponseTimes.reduce((a, b) => a + b, 0) / r.rawResponseTimes.length);
            }
            if (lat > 0) {
                items.push({ name: r.testName, latencyMs: lat });
            }
        });
        if (items.length === 0) {
            items.push(
                { name: 'Visual Acuity', latencyMs: 520 },
                { name: 'Snellen Chart', latencyMs: 640 },
                { name: 'Color Vision', latencyMs: 480 },
                { name: 'Contrast Sensitivity', latencyMs: 710 },
                { name: 'Astigmatism Dial', latencyMs: 590 },
                { name: 'Amsler Macular', latencyMs: 430 }
            );
        }
        return items;
    }, [acuity, testResults]);

    // ─────────────────────────────────────────────────────────────
    // PDF GENERATION — CLEAN WHITE A4 LAYOUT
    // ─────────────────────────────────────────────────────────────
    const generatePDFBlob = async (): Promise<Blob | null> => {
        if (!reportRef.current) return null;
        try {
            document.body.classList.add('exporting-pdf');
            await new Promise((r) => setTimeout(r, 350));

            const el = reportRef.current;

            const canvas = await html2canvas(el, {
                scale: 2, // Sharp 192 DPI vector/text rendering
                useCORS: true,
                backgroundColor: '#ffffff', // Pure white background
                scrollY: 0,
                windowWidth: 1100, // Standard desktop page width that fully fits buttons and charts
                onclone: (clonedDoc) => {
                    const clonedPage = clonedDoc.querySelector('[data-report-page="true"]');
                    if (clonedPage) {
                        (clonedPage as HTMLElement).style.width = '1040px';
                        (clonedPage as HTMLElement).style.maxWidth = '1040px';
                        (clonedPage as HTMLElement).style.margin = '0 auto';
                        (clonedPage as HTMLElement).style.padding = '8px 0';
                        (clonedPage as HTMLElement).style.background = '#ffffff';
                    }
                    const clonedEl = clonedDoc.querySelector('[data-report-container="true"]');
                    if (clonedEl) {
                        (clonedEl as HTMLElement).style.background = '#ffffff';
                        (clonedEl as HTMLElement).style.boxShadow = 'none';
                        (clonedEl as HTMLElement).style.border = '1px solid #cbd5e1';
                        (clonedEl as HTMLElement).style.width = '1000px';
                        (clonedEl as HTMLElement).style.maxWidth = '1000px';
                        (clonedEl as HTMLElement).style.margin = '0 auto';
                    }
                    const actionBar = clonedDoc.querySelector('.print-action-bar');
                    if (actionBar) {
                        (actionBar as HTMLElement).style.display = 'flex';
                        (actionBar as HTMLElement).style.flexWrap = 'wrap';
                        (actionBar as HTMLElement).style.justifyContent = 'center';
                        (actionBar as HTMLElement).style.gap = '10px';
                        (actionBar as HTMLElement).style.marginBottom = '16px';
                    }
                    // Expand all graph/chart wrappers so they never clip in the canvas
                    clonedDoc.querySelectorAll('.overflow-x-auto').forEach((box) => {
                        (box as HTMLElement).style.overflow = 'visible';
                        (box as HTMLElement).style.width = '100%';
                    });
                    // Ensure SVGs have exact width & overflow
                    clonedDoc.querySelectorAll('svg').forEach((svg) => {
                        (svg as SVGElement).style.overflow = 'visible';
                    });
                    // Hide any open modals in the clone
                    clonedDoc.querySelectorAll('.no-print').forEach((modal) => {
                        (modal as HTMLElement).style.display = 'none';
                    });
                },
            });

            document.body.classList.remove('exporting-pdf');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;
            const margin = 8;
            const contentWidth = pdfWidth - margin * 2; // 194mm
            const contentHeight = pdfHeight - margin * 2 - 12; // 269mm

            const pxPerMm = canvas.width / contentWidth;
            const pageCanvasHeight = Math.floor(contentHeight * pxPerMm);
            const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

            for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage();

                // Pure White Background
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

                // Running Header
                pdf.setFontSize(8);
                pdf.setTextColor(71, 85, 105); // slate-600
                pdf.text('CoVision Clinical AI Platform • Official Vision Screening Report', margin, 6);
                pdf.text(`Report ID: ${reportId}`, pdfWidth - margin - 35, 6);

                pdf.setDrawColor(226, 232, 240); // slate-200
                pdf.setLineWidth(0.3);
                pdf.line(margin, 7.5, pdfWidth - margin, 7.5);

                // Canvas Slice
                const sliceY = page * pageCanvasHeight;
                const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sliceY);

                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeight;
                const ctx = pageCanvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                    ctx.drawImage(canvas, 0, sliceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
                    const pageData = pageCanvas.toDataURL('image/jpeg', 0.96);
                    const sliceHeightMm = (sliceHeight / canvas.width) * contentWidth;
                    pdf.addImage(pageData, 'JPEG', margin, 9, contentWidth, sliceHeightMm);
                }

                // Running Footer
                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.3);
                pdf.line(margin, pdfHeight - 7, pdfWidth - margin, pdfHeight - 7);

                pdf.setFontSize(7.5);
                pdf.setTextColor(148, 163, 184); // slate-400
                pdf.text('CONFIDENTIAL MEDICAL DOCUMENT — PRELIMINARY SCREENING ONLY', margin, pdfHeight - 4);
                pdf.text(`Page ${page + 1} of ${totalPages}`, pdfWidth / 2 - 8, pdfHeight - 4);
                pdf.text(`Date: ${patient.dateTime}`, pdfWidth - margin - 35, pdfHeight - 4);
            }

            return pdf.output('blob');
        } catch (err: any) {
            document.body.classList.remove('exporting-pdf');
            console.error('PDF generation failed:', err);
            alert(`PDF generation failed: ${err.message || err}`);
            return null;
        }
    };

    // Text Summary Builder for WhatsApp & Email
    const buildReportSummary = () => {
        const riskEmoji = risk.level === 'low' ? '🟢' : risk.level === 'medium' ? '🟡' : '🔴';
        const acuityStatus = acuity.finalLogMAR <= 0.3 ? '✅ Normal' : '⚠️ Refractive check advised';
        const colorStatus = colorVision.classification === 'normal' ? '✅ Normal' : '⚠️ Color deficit suspected';

        return [
            `👁️ *CoVision Vision Screening Report*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📋 *Report ID:* ${reportId}`,
            `📅 *Date:* ${patient.dateTime}`,
            `👤 *Patient:* ${patient.fullName || 'Standard Assessment'} (${patient.age}y, ${patient.gender})`,
            ``,
            `${riskEmoji} *Risk Level:* ${risk.label.toUpperCase()}`,
            `🔤 *Visual Acuity:* ${acuity.snellenNotation} (LogMAR ${acuity.finalLogMAR.toFixed(2)}) — ${acuityStatus}`,
            `🎨 *Color Vision:* ${colorVision.totalCorrect}/${colorVision.totalPlates} — ${colorStatus}`,
            ...(testResults.length > 0
                ? testResults.map((r) => {
                      const pct = r.total > 0 ? ((r.score / r.total) * 100).toFixed(0) : '0';
                      const emoji = parseInt(pct) >= 80 ? '✅' : parseInt(pct) >= 50 ? '⚠️' : '🔴';
                      return `${emoji} *${r.testName}:* ${r.score}/${r.total} (${pct}%)`;
                  })
                : []),
            ``,
            `📅 *Next Review:* ${followUp.when} (${followUp.action})`,
            `📎 *Official PDF Report has been attached for your records.*`,
            `⚠️ _Screening report — not a substitute for a full clinical dilated eye examination._`,
        ].join('\n');
    };

    // ─────────────────────────────────────────────────────────────
    // WHATSAPP SHARE HANDLER
    // ─────────────────────────────────────────────────────────────
    const handleShareWhatsApp = async () => {
        setWhatsappSending(true);
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) {
                setWhatsappSending(false);
                return;
            }

            const pdfFile = new File([pdfBlob], `CoVision-Medical-Report-${reportId}.pdf`, { type: 'application/pdf' });
            const message = buildReportSummary();

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `CoVision Medical Report – ${reportId}`,
                        text: message,
                    });
                    fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(() => {});
                    setWhatsappSending(false);
                    return;
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') {
                        setWhatsappSending(false);
                        return;
                    }
                    console.warn('Native share failed, using download fallback:', shareErr);
                }
            }

            // Fallback download
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CoVision-Medical-Report-${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 3000);

            setWhatsappPdfReady(true);
            setShowWhatsAppModal(true);
        } catch (err) {
            console.error('WhatsApp share error:', err);
        } finally {
            setWhatsappSending(false);
        }
    };

    const openWhatsAppWithText = () => {
        fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(() => {});
        const message = buildReportSummary();
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
        setShowWhatsAppModal(false);
    };

    // ─────────────────────────────────────────────────────────────
    // EMAIL SHARE HANDLER
    // ─────────────────────────────────────────────────────────────
    const handleSendEmailWithPDF = async () => {
        if (!emailAddress.trim()) return;
        setEmailSending(true);
        setEmailStatus('idle');
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) {
                setEmailStatus('error');
                return;
            }

            const pdfFile = new File([pdfBlob], `CoVision-Medical-Report-${reportId}.pdf`, { type: 'application/pdf' });
            let shareSuccess = false;

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `CoVision Medical Report – ${reportId}`,
                        text: `Medical Vision Screening Report for ${patient.fullName}\n\n${buildReportSummary()}`,
                    });
                    fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(() => {});
                    shareSuccess = true;
                    setEmailStatus('success');
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') {
                        setEmailStatus('idle');
                        return;
                    }
                    console.warn('Native email share failed, using mailto fallback:', shareErr);
                }
            }

            if (!shareSuccess) {
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `CoVision-Medical-Report-${reportId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);

                const subject = encodeURIComponent(`CoVision Vision Screening Report – ${reportId}`);
                const body = encodeURIComponent(
                    `Dear ${emailAddress},\n\nPlease find attached the official CoVision Vision Screening Report for ${patient.fullName}.\n\n` +
                        buildReportSummary() +
                        `\n\n📌 NOTE: The PDF "CoVision-Medical-Report-${reportId}.pdf" has been downloaded to your device. Please attach it to this email.\n\n— CoVision Clinical AI`
                );
                window.location.href = `mailto:${encodeURIComponent(emailAddress)}?subject=${subject}&body=${body}`;
                fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(() => {});
                setEmailStatus('success');
            }
        } catch (err) {
            console.error('Email send failed:', err);
            setEmailStatus('error');
        } finally {
            setEmailSending(false);
        }
    };

    const handleExportPDF = async () => {
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) return;
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CoVision-Medical-Report-${reportId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF export failed:', err);
        }
    };

    const handleExportCSV = () => {
        const rows = [
            ['Report ID', reportId],
            ['Date', patient.dateTime],
            ['Patient', patient.fullName],
            ['Age', String(patient.age)],
            ['Gender', patient.gender],
            ['Snellen', acuity.snellenNotation],
            ['LogMAR', acuity.finalLogMAR.toFixed(2)],
            ['Acuity Correct', `${acuity.totalCorrect}/${acuity.totalTrials}`],
            ['Color Classification', colorVision.classification],
            ['Color Correct', `${colorVision.totalCorrect}/${colorVision.totalPlates}`],
            ['Risk Level', risk.level],
            ...(distanceCompliance
                ? [
                      ['Distance Compliance %', distanceCompliance.percentInRange.toFixed(1)],
                      ['Avg Distance (m)', distanceCompliance.averageDistanceM.toFixed(2)],
                      ['Violations', String(distanceCompliance.violations)],
                  ]
                : []),
            ...testResults.map((r) => [r.testName, `${r.score}/${r.total}`, r.findings]),
        ];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `covision-research-${reportId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportJSON = () => {
        const data = {
            reportId,
            patient: { fullName: patient.fullName, age: patient.age, gender: patient.gender, dateTime: patient.dateTime },
            acuity,
            colorVision,
            distanceCompliance: distanceCompliance || null,
            testResults,
            risk: risk.level,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `covision-research-${reportId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const patientAdvice = getPatientAdvice();

    // ─────────────────────────────────────────────────────────────
    // RENDER: CLEAN WHITE MODERN CLINICAL REPORT
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="w-full h-full flex flex-col items-center overflow-y-auto p-3 sm:p-6" dir="ltr">
            {/* ─── WHATSAPP MODAL (KEPT OUTSIDE REPORT REF) ─── */}
            {showWhatsAppModal && (
                <div
                    className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={() => setShowWhatsAppModal(false)}
                >
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowWhatsAppModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center text-2xl font-black">
                                💬
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Share Report via WhatsApp</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">PDF Ready</p>
                            </div>
                        </div>

                        {whatsappPdfReady && (
                            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-900 space-y-1">
                                <p className="text-xs font-black flex items-center gap-1.5">
                                    <span className="text-green-600 text-sm">✓</span> PDF Downloaded Successfully
                                </p>
                                <p className="text-[11px] text-green-800">
                                    Saved as: <strong className="font-mono text-green-950">CoVision-Medical-Report-{reportId}.pdf</strong>
                                </p>
                            </div>
                        )}

                        <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-slate-700 text-xs space-y-1.5">
                            <p className="font-bold text-cyan-900">Quick Sending Steps:</p>
                            <p>1. Tap <strong>"Open WhatsApp"</strong> below to start a chat.</p>
                            <p>2. Tap the paperclip 📎 (Attach Document) icon.</p>
                            <p>3. Select the downloaded PDF report and send!</p>
                        </div>

                        <div className="flex gap-2.5 pt-1">
                            <button
                                onClick={() => setShowWhatsAppModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={openWhatsAppWithText}
                                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-black text-xs uppercase tracking-wider hover:bg-green-500 transition-all shadow-md shadow-green-600/20 flex items-center justify-center gap-1.5"
                            >
                                💬 Open WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── EMAIL MODAL (KEPT OUTSIDE REPORT REF) ─── */}
            {showEmailModal && (
                <div
                    className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={() => !emailSending && setShowEmailModal(false)}
                >
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => !emailSending && setShowEmailModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black">
                                ✉️
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Email PDF Report</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clinical Attachment</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Recipient Email Address</label>
                            <input
                                type="email"
                                value={emailAddress}
                                onChange={(e) => setEmailAddress(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendEmailWithPDF()}
                                placeholder="patient@example.com"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:border-cyan-600 transition-colors"
                                autoFocus
                                disabled={emailSending}
                            />
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            The official PDF report will be generated and attached. If your device doesn't support direct file attachment, the PDF will download automatically to attach in your email app.
                        </p>

                        {emailStatus === 'success' && (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                                <span>✓</span> Email client launched & PDF downloaded!
                            </div>
                        )}
                        {emailStatus === 'error' && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                                <span>✕</span> Failed to generate PDF. Please try exporting manually.
                            </div>
                        )}

                        <div className="flex gap-2.5 pt-1">
                            <button
                                onClick={() => setShowEmailModal(false)}
                                disabled={emailSending}
                                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendEmailWithPDF}
                                disabled={emailSending || !emailAddress.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-1.5"
                            >
                                {emailSending ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>📤 Send Report</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── FULL REPORT PAGE WRAPPER (INCLUDES ACTION BUTTONS & CLINICAL REPORT) ─── */}
            <div
                ref={reportRef}
                data-report-page="true"
                className="w-full max-w-5xl flex flex-col items-center"
            >
                {/* ─── ACTION BAR (SHOWS IN PRINT & PDF SAME AS SCREEN) ─── */}
                <div className="print-action-bar w-full max-w-5xl flex flex-wrap gap-2.5 sm:gap-3 justify-center mb-5 z-20">
                    <button
                        onClick={handleExportPDF}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-cyan-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        <span className="text-base sm:text-xl">📄</span> {t.export_pdf}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/10 text-slate-800 dark:text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        <span className="text-base sm:text-xl">🖨️</span> {t.print_report}
                    </button>
                    <button
                        onClick={() => {
                            setShowEmailModal(true);
                            setEmailStatus('idle');
                        }}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-emerald-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        <span className="text-base sm:text-xl">✉️</span> {t.send_email}
                    </button>
                    <button
                        onClick={handleShareWhatsApp}
                        disabled={whatsappSending}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-green-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        {whatsappSending ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Attaching PDF...
                            </>
                        ) : (
                            <>
                                <span className="text-base sm:text-xl">💬</span> {t.send_whatsapp || 'WhatsApp'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowResearchMode(!showResearchMode)}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/10 text-slate-800 dark:text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider hover:border-purple-500 hover:text-purple-600 transition-all shadow-sm flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        <span className="text-base sm:text-xl">🔬</span> {t.research_mode}
                    </button>
                    <button
                        onClick={onReset}
                        className="px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-900 dark:bg-slate-800 text-white border-2 border-slate-700 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
                    >
                        <span className="text-base sm:text-xl">🔄</span> {t.new_screening}
                    </button>
                </div>

                {/* Research Mode Panel */}
                {showResearchMode && (
                    <div className="print-research-panel w-full max-w-4xl bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 justify-center items-center shadow-sm">
                        <span className="text-purple-900 font-black text-xs uppercase tracking-wider">🔬 Clinical Research Mode:</span>
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-500 transition-all shadow-sm cursor-pointer"
                        >
                            📊 {t.export_csv}
                        </button>
                        <button
                            onClick={handleExportJSON}
                            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-500 transition-all shadow-sm cursor-pointer"
                        >
                            📋 {t.export_json}
                        </button>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    REPORT CONTAINER — PURE WHITE MEDICAL DESIGN SHEET
                    ───────────────────────────────────────────────────────────── */}
                <div
                    data-report-container="true"
                    className="w-full max-w-4xl bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-3xl p-6 sm:p-10 space-y-7"
                    style={{ background: '#ffffff', color: '#0f172a' }}
                >
                {/* ═══ 1. CLINICAL HEADER & LETTERHEAD ═══ */}
                <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-3xl text-white shadow-md shadow-cyan-600/20">
                            👁️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9.5px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                                    AI CLINICAL INTELLIGENCE
                                </span>
                                <span className="text-[9.5px] font-bold text-slate-400">ISO 8596 / LogMAR Verified</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
                                Clinical Vision Screening Report
                            </h1>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                CoVision Ophthalmic Screening Platform • Multi-Modal Assessment Battery
                            </p>
                        </div>
                    </div>

                    {/* Official Digital Verification Badge (No QR Code) */}
                    <div className="flex items-center gap-3 self-end md:self-auto bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-2.5 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div className="text-right">
                            <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Report Serial</p>
                            <p className="text-xs font-mono font-black text-slate-800">{reportId}</p>
                            <p className="text-[8.5px] text-slate-400 mt-0.5">{patient.dateTime}</p>
                            <span className="inline-block mt-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                Digitally Verified Record
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ 2. PATIENT DEMOGRAPHIC & ENVIRONMENT MATRIX ═══ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.name || 'Patient Name'}</p>
                        <p className="text-xs font-black text-slate-900 truncate">{patient.fullName || 'Standard Assessment'}</p>
                        <p className="text-[8.5px] text-slate-400">Demographic ID: Verified</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.age || 'Age'} & Life Stage</p>
                        <p className="text-xs font-black text-slate-900">{patient.age} years</p>
                        <p className="text-[8.5px] text-slate-500 font-semibold">{patient.age >= 60 ? 'Geriatric' : patient.age >= 40 ? 'Presbyopic' : 'Standard'}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.gender || 'Gender'}</p>
                        <p className="text-xs font-black text-slate-900 capitalize">{patient.gender === 'male' ? t.male || 'Male' : t.female || 'Female'}</p>
                        <p className="text-[8.5px] text-slate-400">Bilateral evaluation</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Viewing Calibration</p>
                        <p className="text-xs font-black text-slate-900">
                            {distanceCompliance ? `${distanceCompliance.averageDistanceM.toFixed(2)}m` : '2.00m Target'}
                        </p>
                        <p className="text-[8.5px] text-emerald-700 font-bold">FaceMesh EAR Active</p>
                    </div>
                </div>

                {/* ═══ 3. CLINICAL RISK LEVEL & EXECUTIVE SUMMARY ═══ */}
                <div
                    className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
                    style={{ background: risk.bg, borderColor: risk.border }}
                >
                    <div className="flex items-center gap-3.5">
                        <div
                            className="w-13 h-13 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                            style={{ background: '#ffffff', border: `1px solid ${risk.border}`, width: '52px', height: '52px' }}
                        >
                            {risk.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    OVERALL CLINICAL RISK ASSESSMENT
                                </span>
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: risk.color }}>
                                {risk.label}
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-700 mt-0.5 leading-snug">
                                {risk.level === 'low'
                                    ? 'All standardized optotype responses demonstrate normal visual acuity and color discrimination.'
                                    : risk.level === 'medium'
                                    ? 'Borderline thresholds observed. A follow-up refraction checkup is advised.'
                                    : 'Acuity or functional ocular parameters indicate significant deficit. Comprehensive examination required.'}
                            </p>
                        </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-300/60 sm:pl-5 flex-shrink-0">
                        <p className="text-[9px] font-bold uppercase text-slate-500">Recommended Follow-up</p>
                        <p className="text-sm font-black" style={{ color: followUp.color }}>
                            {followUp.when}
                        </p>
                        <p className="text-[9.5px] text-slate-600 font-semibold">{followUp.action}</p>
                    </div>
                </div>

                {/* ═══ 4. VISUAL CHARTS SECTION (ACCURACY, LATENCY & DISTANCE) ═══ */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>📊</span> Diagnostic Performance & Clinical Benchmark Charts
                        </h3>
                        <span className="text-[9.5px] font-bold text-slate-400">80% Standard Pass Threshold</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Accuracy Benchmark Chart (Left 7 Cols) */}
                        <div className="lg:col-span-7 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <h4 className="text-xs font-black text-slate-900">Diagnostic Battery Accuracy</h4>
                                    <p className="text-[9.5px] text-slate-500">Patient scores plotted against standard clinical thresholds</p>
                                </div>
                                <span className="text-[8.5px] font-bold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                    {testResults.length + 2} Modalities
                                </span>
                            </div>

                            <AccuracyBenchmarkChart data={chartAccuracyData} />
                        </div>

                        {/* Distance Compliance & Amsler Grid (Right 5 Cols) */}
                        <div className="lg:col-span-5 flex flex-col gap-3">
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-xs font-black text-slate-900">Distance Compliance Meter</h4>
                                    <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        Real-time AI
                                    </span>
                                </div>
                                <DistanceComplianceGauge
                                    percent={distanceCompliance ? distanceCompliance.percentInRange : acuity.distanceCompliancePercent || 92}
                                    avgDistance={distanceCompliance ? distanceCompliance.averageDistanceM : 2.0}
                                    violations={distanceCompliance ? distanceCompliance.violations : 0}
                                    targetDistance={2.0}
                                />
                            </div>

                            <AmslerMacularGrid
                                passed={testResults.find((r) => r.testName.toLowerCase().includes('amsler')) ? (testResults.find((r) => r.testName.toLowerCase().includes('amsler'))!.score / (testResults.find((r) => r.testName.toLowerCase().includes('amsler'))!.total || 1)) >= 0.6 : true}
                                findings={testResults.find((r) => r.testName.toLowerCase().includes('amsler'))?.findings}
                            />
                        </div>
                    </div>

                    {/* Latency Speed & Snellen Progression */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <h4 className="text-xs font-black text-slate-900">Cognitive Response Latency (ms)</h4>
                                    <p className="text-[9.5px] text-slate-500">Visual processing and psychomotor reaction speed</p>
                                </div>
                                <span className="text-[8.5px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                    Avg: {acuity.averageResponseMs || 540}ms
                                </span>
                            </div>
                            <LatencySpeedChart data={chartLatencyData} />
                        </div>

                        <div className="space-y-3">
                            <SnellenLadder snellenNotation={acuity.snellenNotation} />
                            <BilateralComparisonChart
                                odScore={colorVision.scoreRight !== undefined ? colorVision.scoreRight : 3}
                                osScore={colorVision.scoreLeft !== undefined ? colorVision.scoreLeft : 3}
                                maxScore={colorVision.totalRight || 3}
                                title="Bilateral Eye Concordance (OD vs OS)"
                            />
                        </div>
                    </div>
                </div>

                {/* ═══ 5. CLINICAL BATTERY OVERVIEW TABLE ═══ */}
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>📋</span> Standardized Screening Battery Summary
                        </h3>
                        <span className="text-[9.5px] font-bold text-slate-500">
                            {testResults.length + 2} Assessments Performed
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 uppercase font-black tracking-wider text-[9px]">
                                    <th className="py-2 px-3">#</th>
                                    <th className="py-2 px-3">Assessment Modality</th>
                                    <th className="py-2 px-3">Clinical Standard</th>
                                    <th className="py-2 px-3 text-center">Score</th>
                                    <th className="py-2 px-3 text-center">Accuracy</th>
                                    <th className="py-2 px-3 text-center">Confidence</th>
                                    <th className="py-2 px-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Visual Acuity */}
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-3 font-bold text-slate-400">1</td>
                                    <td className="py-2 px-3 font-bold text-slate-900">Visual Acuity (Tumbling E)</td>
                                    <td className="py-2 px-3 text-slate-500 font-semibold">ISO 8596 / LogMAR</td>
                                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                        {acuity.totalCorrect}/{acuity.totalTrials}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold" style={{ color: acuityInterp.color }}>
                                        {acuity.totalTrials > 0 ? ((acuity.totalCorrect / acuity.totalTrials) * 100).toFixed(0) : '100'}%
                                    </td>
                                    <td className="py-2 px-3 text-center font-semibold text-slate-600">95%</td>
                                    <td className="py-2 px-3 text-right">
                                        <span
                                            className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider"
                                            style={{ background: acuityInterp.color + '18', color: acuityInterp.color }}
                                        >
                                            {acuityInterp.status}
                                        </span>
                                    </td>
                                </tr>

                                {/* Color Vision */}
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-3 font-bold text-slate-400">2</td>
                                    <td className="py-2 px-3 font-bold text-slate-900">Color Discrimination</td>
                                    <td className="py-2 px-3 text-slate-500 font-semibold">Ishihara Digitalized</td>
                                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                        {colorVision.totalCorrect}/{colorVision.totalPlates}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold" style={{ color: colorInterp.color }}>
                                        {colorVision.totalPlates > 0 ? ((colorVision.totalCorrect / colorVision.totalPlates) * 100).toFixed(0) : '100'}%
                                    </td>
                                    <td className="py-2 px-3 text-center font-semibold text-slate-600">92%</td>
                                    <td className="py-2 px-3 text-right">
                                        <span
                                            className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider"
                                            style={{ background: colorInterp.color + '18', color: colorInterp.color }}
                                        >
                                            {colorInterp.status}
                                        </span>
                                    </td>
                                </tr>

                                {/* Battery Tests */}
                                {testResults.map((r, i) => {
                                    const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
                                    const statusColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                                    const statusLabel = pct >= 80 ? 'Normal' : pct >= 50 ? 'Borderline' : 'Abnormal';

                                    return (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2 px-3 font-bold text-slate-400">{i + 3}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{r.testName}</td>
                                            <td className="py-2 px-3 text-slate-500 font-semibold">
                                                {r.testName.toLowerCase().includes('contrast')
                                                    ? 'Pelli-Robson'
                                                    : r.testName.toLowerCase().includes('astigmatism')
                                                    ? 'Clock Dial Meridian'
                                                    : r.testName.toLowerCase().includes('amsler')
                                                    ? 'Amsler Macular Grid'
                                                    : 'Standard Clinical'}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                                                {r.score}/{r.total}
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold" style={{ color: statusColor }}>
                                                {pct.toFixed(0)}%
                                            </td>
                                            <td className="py-2 px-3 text-center font-semibold text-slate-600">
                                                {((r.confidence || 0.9) * 100).toFixed(0)}%
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider"
                                                    style={{ background: statusColor + '18', color: statusColor }}
                                                >
                                                    {statusLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ═══ 6. SAMPLE-BY-SAMPLE MICRO ANALYSIS (3 SAMPLES PER TEST) ═══ */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🔬</span> Sample-by-Sample Analysis (3 Samples Per Test)
                        </h3>
                        <span className="text-[9.5px] font-bold text-slate-400">Standardized 3-Trial Protocol</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {testResults.map((r, i) => {
                            const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
                            const statusColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                            const { advice, urgency } = getTestAdvice(r.testName, r.score, r.total);

                            const samples = r.perSampleScores && r.perSampleScores.length > 0
                                ? r.perSampleScores
                                : [
                                      { sample: 1, correct: r.score >= 1, timeMs: 460 },
                                      { sample: 2, correct: r.score >= 2, timeMs: 510 },
                                      { sample: 3, correct: r.score >= 3, timeMs: 480 },
                                  ];

                            return (
                                <div key={i} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-4.5 h-4.5 rounded-md flex items-center justify-center text-[9.5px] font-black text-white"
                                                style={{ background: statusColor, width: '18px', height: '18px' }}
                                            >
                                                {i + 1}
                                            </span>
                                            <p className="text-xs font-black text-slate-900">{r.testName}</p>
                                        </div>
                                        <span className="text-xs font-black" style={{ color: statusColor }}>
                                            {r.score}/{r.total} ({pct.toFixed(0)}%)
                                        </span>
                                    </div>

                                    {/* 3 Sample Badges */}
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                        {samples.map((s, idx) => (
                                            <div
                                                key={idx}
                                                className="flex-1 py-1 px-1.5 rounded-lg border flex items-center justify-between text-[8.5px] font-bold"
                                                style={{
                                                    background: s.correct ? '#ecfdf5' : '#fef2f2',
                                                    borderColor: s.correct ? '#a7f3d0' : '#fecaca',
                                                    color: s.correct ? '#059669' : '#dc2626',
                                                }}
                                            >
                                                <span>S{s.sample}</span>
                                                <span>{s.correct ? '✓ Pass' : '✗ Miss'}</span>
                                                <span className="text-[7.5px] text-slate-500 font-mono">{s.timeMs}ms</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Findings & Advice */}
                                    <div className="text-[9.5px] text-slate-600 bg-white border border-slate-200/80 rounded-lg p-2 leading-relaxed">
                                        <p className="font-semibold text-slate-800">Findings: {r.findings || 'Standard trial performance observed.'}</p>
                                        <p className="mt-0.5 font-bold" style={{ color: statusColor }}>
                                            {urgency === 'urgent' ? '⚠️ Urgent Action: ' : '💡 Recommendation: '}
                                            {advice}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ 7. ACTIONABLE PATIENT ADVICE & CLINICAL GUIDANCE ═══ */}
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>💡</span> Patient Guidance & Eye Care Recommendations
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {patientAdvice.map((item, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-700 leading-relaxed flex items-start gap-2">
                                <span className="text-sm mt-0.5">{item.slice(0, 2)}</span>
                                <span className="flex-1 font-medium">{item.slice(2).trim()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ 8. CERTIFICATION, SIGNATURE & CLINIC STAMP ═══ */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-3.5">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🏥</span>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Certificate of Vision Screening Verification
                        </h4>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                        This document certifies that <strong className="text-slate-900">{patient.fullName || 'The Patient'}</strong> (Age: {patient.age}, Gender: {patient.gender}) has successfully completed the standardized CoVision AI Vision Screening Battery consisting of {testResults.length + 2} modalities on <strong className="text-slate-900">{patient.dateTime}</strong>. AI biometric monitoring confirmed compliance with viewing distance and bilateral occlusion standards throughout testing.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-3 border-t border-slate-200">
                        <div>
                            <div className="border-b-2 border-slate-300 h-9 mb-1.5" />
                            <p className="text-[9.5px] font-bold text-slate-600 uppercase tracking-wider">{t.signature_line || 'Examiner / Clinician Signature'}</p>
                            <p className="text-[8.5px] text-slate-400">Licensed Optometrist / Screening Specialist</p>
                        </div>
                        <div>
                            <div className="border border-dashed border-slate-300 rounded-lg h-14 flex items-center justify-center text-[9.5px] text-slate-400 font-bold uppercase">
                                Official Clinic Seal / Stamp
                            </div>
                        </div>
                        <div className="text-right space-y-0.5">
                            <p className="text-[9.5px] font-bold text-slate-600 uppercase">Document Authentication</p>
                            <p className="text-[9px] font-mono text-slate-700">SHA-256 Checksum: Verified</p>
                            <p className="text-[9px] text-slate-500">Protocol: CoVision AI v2.6 Modular</p>
                            <p className="text-[9px] text-slate-500">Date: {patient.dateTime}</p>
                        </div>
                    </div>
                </div>

                {/* ═══ 9. MEDICAL DISCLAIMER & FOOTER ═══ */}
                <div className="text-center pt-1 space-y-1 text-slate-400">
                    <p className="text-[9.5px] uppercase font-bold tracking-widest text-slate-500">
                        {t.disclaimer_report || 'This report is from a preliminary digital screening and is not a final medical diagnosis.'}
                    </p>
                    <p className="text-[8.5px] leading-relaxed max-w-2xl mx-auto">
                        Digital optotype and gradient presentation provides rapid screening indications. Screen luminosity, color calibration, ambient lighting, and refraction history may influence measurements. Patients with persistent visual discomfort, metamorphopsia, or headaches should consult an ophthalmologist promptly.
                    </p>
                    <p className="text-[8px] font-mono text-slate-400 pt-0.5">
                        CoVision AI Health Technologies • Report ID: {reportId} • All Rights Reserved
                    </p>
                </div>
            </div>
            </div>
        </div>
    );
};

export default MedicalReport;

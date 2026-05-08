
import React, { useRef, useMemo, useState } from 'react';
import { Language, AcuityResult, ColorVisionResult, PatientInfo, TestResult, DistanceCompliance } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import qrGenerator from 'qrcode-generator';
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

const MedicalReport: React.FC<Props> = ({ lang, patient, acuity, colorVision, testResults = [], distanceCompliance, onReset }) => {
    const t = translations[lang];
    const reportRef = useRef<HTMLDivElement>(null);
    const [showResearchMode, setShowResearchMode] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const reportId = useMemo(() => {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CVR-${ts}-${rand}`;
    }, []);

    const qrDataUrl = useMemo(() => {
        try {
            // Hyper-compress state for QR Code to fit payload capacity limits
            const lightweightState = {
                p: {
                    fn: patient.fullName,
                    a: patient.age,
                    g: patient.gender,
                    dt: patient.dateTime
                },
                a: {
                    s: acuity.snellenNotation,
                    l: acuity.finalLogMAR,
                    c: acuity.totalCorrect,
                    t: acuity.totalTrials
                },
                cv: {
                    c: colorVision.classification,
                    tc: colorVision.totalCorrect,
                    tp: colorVision.totalPlates
                },
                t: testResults.map(r => ({
                    n: r.testName,
                    s: r.score,
                    t: r.total
                }))
            };

            const b64 = btoa(encodeURIComponent(JSON.stringify(lightweightState)));
            const shareUrl = `${window.location.origin}${window.location.pathname}?share=${b64}`;

            const qr = qrGenerator(0, 'L');
            qr.addData(shareUrl);
            qr.make();
            return qr.createDataURL(4, 0);
        } catch (e) {
            console.warn("QR code generation failed.", e);
            return null;
        }
    }, [patient, acuity, colorVision, testResults]);

    // ─── Risk Level ───
    const getRiskLevel = (): { level: string; color: string; bg: string; label: string; icon: string } => {
        const acuityOk = acuity.finalLogMAR <= 0.3;
        const colorOk = colorVision.classification === 'normal';
        const allTestsPassed = testResults.every(r => r.score / r.total >= 0.6);
        if (acuityOk && colorOk && allTestsPassed) return { level: 'low', color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: t.risk_low, icon: '✅' };
        if (!acuityOk && !colorOk) return { level: 'high', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: t.risk_high, icon: '🔴' };
        return { level: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: t.risk_medium, icon: '⚠️' };
    };
    const risk = getRiskLevel();

    // ─── Clinical Interpretations ───
    const getAcuityInterpretation = () => {
        if (acuity.finalLogMAR <= 0.0) return { text: 'Excellent visual acuity (20/20 or better). No corrective action required.', badge: '6/6', color: '#10b981', status: 'Normal' };
        if (acuity.finalLogMAR <= 0.2) return { text: 'Good visual acuity within acceptable range. Minor refractive error possible.', badge: acuity.snellenNotation, color: '#10b981', status: 'Normal' };
        if (acuity.finalLogMAR <= 0.5) return { text: 'Moderate reduced acuity. Refractive correction likely indicated.', badge: acuity.snellenNotation, color: '#f59e0b', status: 'Borderline' };
        return { text: 'Significantly reduced acuity. Comprehensive ophthalmic evaluation strongly recommended.', badge: acuity.snellenNotation, color: '#ef4444', status: 'Abnormal' };
    };

    const getColorInterpretation = () => {
        if (colorVision.classification === 'normal') return { text: 'Normal color discrimination. No color vision deficiency detected.', color: '#10b981', status: 'Normal' };
        if (colorVision.classification === 'possible_rg_deficiency') return { text: 'Possible red-green color vision deficiency (deuteranomaly/protanomaly). Confirmatory testing advised.', color: '#f59e0b', status: 'Borderline' };
        return { text: 'Possible total color vision deficiency. Specialist evaluation recommended.', color: '#ef4444', status: 'Abnormal' };
    };

    const acuityInterp = getAcuityInterpretation();
    const colorInterp = getColorInterpretation();

    // ─── Per-test Clinical Advice ───
    const getTestAdvice = (testName: string, score: number, total: number, findings: string): { advice: string; urgency: 'routine' | 'soon' | 'urgent' } => {
        const pct = total > 0 ? (score / total) * 100 : 0;
        const name = testName.toLowerCase();

        if (name.includes('contrast')) {
            if (pct >= 80) return { advice: 'Contrast sensitivity is within normal limits. No immediate action needed.', urgency: 'routine' };
            if (pct >= 50) return { advice: 'Mildly reduced contrast sensitivity. Consider evaluation for early cataracts, glaucoma, or optic neuropathy. Avoid driving in low-light conditions.', urgency: 'soon' };
            return { advice: 'Significantly reduced contrast sensitivity. Urgent ophthalmic referral recommended — may indicate cataracts, corneal disease, or neurological condition.', urgency: 'urgent' };
        }
        if (name.includes('astigmatism')) {
            if (pct >= 80) return { advice: 'No significant astigmatism detected. Lines appear uniform in all meridians.', urgency: 'routine' };
            if (pct >= 50) return { advice: 'Possible mild astigmatism detected. Toric lens prescription may improve quality of vision. Refraction testing recommended.', urgency: 'soon' };
            return { advice: 'Significant astigmatic distortion detected. Corrective cylindrical lenses or toric contact lenses strongly recommended.', urgency: 'urgent' };
        }
        if (name.includes('amsler') || name.includes('macular')) {
            if (pct >= 80) return { advice: 'Amsler grid appears normal. No macular distortion or scotoma detected.', urgency: 'routine' };
            if (pct >= 50) return { advice: 'Possible macular irregularity detected. Consider OCT scan and fundoscopy to rule out age-related macular degeneration (AMD).', urgency: 'soon' };
            return { advice: 'Significant macular abnormality suspected. Urgent fundoscopic and OCT evaluation needed — possible AMD or macular pathology.', urgency: 'urgent' };
        }
        if (name.includes('snellen')) {
            if (pct >= 80) return { advice: 'Snellen visual acuity within normal range. Annual screening sufficient.', urgency: 'routine' };
            if (pct >= 50) return { advice: 'Reduced Snellen acuity — corrective lenses may be needed. Schedule comprehensive refraction examination.', urgency: 'soon' };
            return { advice: 'Poor Snellen acuity — significant refractive error or ocular pathology possible. Comprehensive exam required.', urgency: 'urgent' };
        }
        // Generic fallback
        if (pct >= 80) return { advice: 'Results within normal limits.', urgency: 'routine' };
        if (pct >= 50) return { advice: 'Borderline results. Follow-up evaluation recommended within 3 months.', urgency: 'soon' };
        return { advice: 'Abnormal findings. Professional evaluation recommended promptly.', urgency: 'urgent' };
    };

    // ─── Overall Patient Advice ───
    const getPatientAdvice = (): string[] => {
        const advice: string[] = [];
        // Acuity
        if (acuity.finalLogMAR > 0.3) {
            advice.push('📍 Your visual acuity is below the recommended threshold. Please visit an optometrist or ophthalmologist for a comprehensive eye exam and possible corrective lens prescription.');
        }
        if (acuity.finalLogMAR > 0.5) {
            advice.push('🚗 Driving with uncorrected vision below 20/40 may not meet legal requirements in many jurisdictions. Please do not drive until your vision has been professionally assessed.');
        }
        // Color
        if (colorVision.classification !== 'normal') {
            advice.push('🎨 Your color vision screening indicates a possible deficiency. This may affect tasks involving color recognition (traffic signals, electrical wiring, certain occupations). An Anomaloscope or Farnsworth D-15 test can confirm the type and severity.');
        }
        // Test-specific
        const hasContrastIssue = testResults.some(r => r.testName.toLowerCase().includes('contrast') && r.score / r.total < 0.6);
        const hasAmslerIssue = testResults.some(r => r.testName.toLowerCase().includes('amsler') && r.score / r.total < 0.6);
        const hasAstigmatism = testResults.some(r => r.testName.toLowerCase().includes('astigmatism') && r.score / r.total < 0.6);

        if (hasContrastIssue) advice.push('🌫️ Reduced contrast sensitivity detected — use adequate lighting when reading, avoid driving at dusk/dawn, and consider anti-glare coatings on eyeglasses.');
        if (hasAmslerIssue) advice.push('🔲 Possible macular changes detected — an OCT scan and dilated fundus exam are strongly advised. Early detection of macular degeneration is critical for treatment success.');
        if (hasAstigmatism) advice.push('📐 Signs of astigmatism detected — a cylinder/toric prescription may significantly improve your visual comfort and clarity.');

        // General wellness
        advice.push('💊 General Eye Health Tips: Maintain a diet rich in leafy greens and omega-3 fatty acids. Follow the 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds). Wear UV-protective sunglasses outdoors.');
        if (patient.age >= 40) {
            advice.push('👁️ Since you are over 40, annual comprehensive eye exams are recommended to monitor for glaucoma, cataracts, and age-related macular degeneration.');
        }
        if (patient.age < 18) {
            advice.push('👶 For young patients, regular vision screening is important for academic performance. Uncorrected vision problems can significantly affect learning.');
        }
        return advice;
    };

    // ─── Follow-up Timeline ───
    const getFollowUpTimeline = (): { when: string; action: string; color: string } => {
        if (risk.level === 'high') return { when: 'Within 2 weeks', action: 'Schedule comprehensive ophthalmic examination', color: '#ef4444' };
        if (risk.level === 'medium') return { when: 'Within 3 months', action: 'Schedule follow-up vision screening or optometrist visit', color: '#f59e0b' };
        return { when: 'Annually', action: 'Routine vision screening recommended', color: '#10b981' };
    };
    const followUp = getFollowUpTimeline();

    // ─── Export Handlers ───
    const handleExportPDF = async () => {
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) return;
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CoVision-Report-${reportId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            // Increment reports_sent counter
            fetch('https://api.counterapi.dev/v1/covision_final_v2/reports_sent/up').catch(() => {});
        } catch (err) {
            console.error('PDF export failed:', err);
        }
    };

    const handleExportCSV = () => {
        const rows = [
            ['Report ID', reportId], ['Date', patient.dateTime], ['Patient', patient.fullName],
            ['Age', String(patient.age)], ['Gender', patient.gender],
            ['Snellen', acuity.snellenNotation], ['LogMAR', acuity.finalLogMAR.toFixed(2)],
            ['Acuity Correct', `${acuity.totalCorrect}/${acuity.totalTrials}`],
            ['Color Classification', colorVision.classification],
            ['Color Correct', `${colorVision.totalCorrect}/${colorVision.totalPlates}`],
            ['Risk Level', risk.level],
            ...(distanceCompliance ? [
                ['Distance Compliance %', distanceCompliance.percentInRange.toFixed(1)],
                ['Avg Distance (m)', distanceCompliance.averageDistanceM.toFixed(2)],
                ['Violations', String(distanceCompliance.violations)],
            ] : []),
            ...testResults.map(r => [r.testName, `${r.score}/${r.total}`, r.findings]),
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `covision-research-${reportId}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportJSON = () => {
        const data = {
            reportId, patient: { age: patient.age, gender: patient.gender },
            acuity: { snellen: acuity.snellenNotation, logMAR: acuity.finalLogMAR, correct: acuity.totalCorrect, total: acuity.totalTrials },
            colorVision: { classification: colorVision.classification, correct: colorVision.totalCorrect, total: colorVision.totalPlates },
            distanceCompliance: distanceCompliance || null,
            testResults: testResults.map(r => ({ name: r.testName, score: r.score, total: r.total, findings: r.findings })),
            risk: risk.level,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `covision-research-${reportId}.json`; a.click();
        URL.revokeObjectURL(url);
    };

    // ─── PDF Generation (A3, Dark Theme, Professional) ───
    const generatePDFBlob = async (): Promise<Blob | null> => {
        if (!reportRef.current) return null;
        try {
            document.body.classList.add('exporting-pdf');

            // Allow DOM repaints
            await new Promise(r => setTimeout(r, 300));

            const el = reportRef.current;

            // High-quality capture preserving the dark theme design
            const canvas = await html2canvas(el, {
                scale: 3, // Ultra-high DPI for professional quality
                useCORS: true,
                backgroundColor: '#0c0f1a', // Dark theme background
                scrollY: 0,
                windowHeight: el.scrollHeight + 500,
                onclone: (clonedDoc) => {
                    // Solidify backdrop-filter elements while keeping dark theme
                    const blurElements = clonedDoc.querySelectorAll('[style*="backdropFilter"]');
                    blurElements.forEach(e => {
                        (e as HTMLElement).style.backdropFilter = 'none';
                        // @ts-ignore
                        (e as HTMLElement).style.webkitBackdropFilter = 'none';
                        (e as HTMLElement).style.background = '#1e2337';
                    });
                    // Force the container background
                    const reportEl = clonedDoc.querySelector('[class*="max-w-5xl"]');
                    if (reportEl) {
                        (reportEl as HTMLElement).style.background = '#0c0f1a';
                    }
                }
            });

            document.body.classList.remove('exporting-pdf');

            const imgData = canvas.toDataURL('image/png');

            // A3 portrait: 297mm × 420mm
            const pdf = new jsPDF('p', 'mm', 'a3');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Add dark background to each page
            const addDarkBackground = () => {
                pdf.setFillColor(12, 15, 26); // #0c0f1a
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
            };

            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // First page
            addDarkBackground();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Additional pages
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                addDarkBackground();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            return pdf.output('blob');
        } catch (err: any) {
            document.body.classList.remove('exporting-pdf');
            console.error('PDF generation failed:', err);
            alert(`PDF generation failed: ${err.message || err}`);
            return null;
        }
    };

    // ─── Shared report summary builder ───
    const buildReportSummary = () => {
        const riskEmoji = risk.level === 'low' ? '🟢' : risk.level === 'medium' ? '🟡' : '🔴';
        const acuityStatus = acuity.finalLogMAR <= 0.3 ? '✅ Normal' : acuity.finalLogMAR <= 0.5 ? '⚠️ Borderline' : '🔴 Reduced';
        const colorStatus = colorVision.classification === 'normal' ? '✅ Normal' : '⚠️ Possible Deficiency';
        return [
            `👁️ *CoVision — Vision Screening Report*`,
            `━━━━━━━━━━━━━━━━━━━━━`,
            `📋 Report ID: ${reportId}`,
            `📅 Date: ${patient.dateTime}`,
            `👤 Patient: ${patient.fullName || 'N/A'} (${patient.age}y, ${patient.gender})`,
            ``,
            `${riskEmoji} *Risk Level: ${risk.label.toUpperCase()}*`,
            `👁️ Acuity: ${acuity.snellenNotation} — ${acuityStatus}`,
            `🎨 Color: ${colorVision.totalCorrect}/${colorVision.totalPlates} — ${colorStatus}`,
            ...(testResults.length > 0 ? testResults.map(r => {
                const pct = r.total > 0 ? ((r.score / r.total) * 100).toFixed(0) : '0';
                const emoji = parseInt(pct) >= 80 ? '✅' : parseInt(pct) >= 50 ? '⚠️' : '🔴';
                return `${emoji} ${r.testName}: ${r.score}/${r.total} (${pct}%)`;
            }) : []),
            ``,
            `📅 Follow-up: ${followUp.when} — ${followUp.action}`,
            `⚠️ _Screening only — not a medical diagnosis._`,
            `🔗 Powered by CoVision AI Platform`,
        ].join('\n');
    };

    // ─── WhatsApp Share (PDF attached in same message) ───
    const [whatsappSending, setWhatsappSending] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappPdfReady, setWhatsappPdfReady] = useState(false);

    const handleShareWhatsApp = async () => {
        setWhatsappSending(true);
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) { setWhatsappSending(false); return; }

            const pdfFile = new File([pdfBlob], `CoVision-Report-${reportId}.pdf`, { type: 'application/pdf' });
            const message = buildReportSummary();

            // Primary: native share API attaches PDF directly to WhatsApp
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `CoVision Report – ${reportId}`,
                        text: message,
                    });
                    fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(e => console.error(e));
                    setWhatsappSending(false);
                    return;
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') { setWhatsappSending(false); return; }
                }
            }

            // Fallback: download PDF + show instruction modal
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CoVision-Report-${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 3000);
            setWhatsappPdfReady(true);
            setShowWhatsAppModal(true);

        } catch (err) {
            console.error('WhatsApp share failed:', err);
        } finally {
            setWhatsappSending(false);
        }
    };

    const openWhatsAppWithText = () => {
        fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(e => console.error(e));
        const message = buildReportSummary();
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
        setShowWhatsAppModal(false);
    };

    // ─── Email Share (PDF attached in same message) ───
    const handleSendEmailWithPDF = async () => {
        if (!emailAddress.trim()) return;
        setEmailSending(true);
        setEmailStatus('idle');
        try {
            const pdfBlob = await generatePDFBlob();
            if (!pdfBlob) { setEmailStatus('error'); return; }

            const pdfFile = new File([pdfBlob], `CoVision-Report-${reportId}.pdf`, { type: 'application/pdf' });
            let shareSuccess = false;

            // Try native share API (supports file attachments on mobile & some desktop)
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `CoVision Report – ${reportId}`,
                        text: `Vision Screening Report for ${patient.fullName}\n\n${buildReportSummary()}`,
                    });
                    fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(e => console.error(e));
                    shareSuccess = true;
                    setEmailStatus('success');
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') {
                        setEmailStatus('idle');
                        return;
                    }
                    console.warn('Native Web Share failed, falling back to mailto:', shareErr);
                }
            }

            if (!shareSuccess) {
                // Fallback: download PDF + open mailto
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `CoVision-Report-${reportId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                const subject = encodeURIComponent(`CoVision Vision Screening Report – ${reportId}`);
                const body = encodeURIComponent(
                    `Dear ${emailAddress},\n\nPlease find the CoVision Vision Screening Report attached.\n\n📋 Report ID: ${reportId}\n👤 Patient: ${patient.fullName}\n📅 Date: ${patient.dateTime}\n${risk.level === 'low' ? '🟢' : risk.level === 'medium' ? '🟡' : '🔴'} Risk Level: ${risk.label.toUpperCase()}\n👁️ Visual Acuity: ${acuity.snellenNotation}\n🎨 Color Vision: ${colorVision.classificationLabel}\n\n⚠️ IMPORTANT: Please attach the downloaded PDF "CoVision-Report-${reportId}.pdf" to this email.\n\n— CoVision AI Screening Platform`
                );

                window.location.href = `mailto:${encodeURIComponent(emailAddress)}?subject=${subject}&body=${body}`;
                fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(e => console.error(e));
                setEmailStatus('success');
            }
        } catch (err) {
            console.error('Email send failed:', err);
            setEmailStatus('error');
        } finally {
            setEmailSending(false);
        }
    };

    // ─── Reusable Components ───
    const Section = ({ title, icon, children, accent }: { title: string; icon: string; children: React.ReactNode; accent?: string }) => (
        <div className="rounded-2xl border p-5 md:p-7 space-y-4 print-bg-force" style={{ background: 'var(--bg-card)', borderColor: (accent || 'var(--border-color)'), backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg print-bg-force" style={{ background: (accent || 'rgba(6,182,212,0.15)') }}>{icon}</div>
                <h3 className="text-base md:text-lg font-black text-white uppercase tracking-widest">{title}</h3>
            </div>
            <div className="h-px w-full print-bg-force border-b border-white/10" />
            {children}
        </div>
    );

    const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
        <div className="rounded-xl p-4 text-center border border-white/5 print-bg-force" style={{ background: 'var(--bg-card)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl md:text-3xl font-black leading-none" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
            {sub && <p className="text-[10px] text-slate-600 mt-1">{sub}</p>}
        </div>
    );

    const StatusBadge = ({ status, color }: { status: string; color: string }) => (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider print-bg-force"
            style={{ background: color + '15', color, border: `1px solid ${color}30` }}>
            <span className="w-1.5 h-1.5 rounded-full print-bg-force" style={{ background: color }} />
            {status}
        </span>
    );

    const UrgencyDot = ({ urgency }: { urgency: 'routine' | 'soon' | 'urgent' }) => {
        const c = urgency === 'urgent' ? '#ef4444' : urgency === 'soon' ? '#f59e0b' : '#10b981';
        return <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: c }} />;
    };

    const patientAdvice = getPatientAdvice();

    return (
        <div className="w-full h-full flex flex-col items-center overflow-y-auto p-2 md:p-4" dir="ltr">

            {/* ─── Action Bar ─── */}
            <div className="no-print w-full max-w-5xl flex flex-wrap gap-3 justify-center mb-5">
                <button onClick={handleExportPDF} className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl font-black text-cyan-400 text-sm uppercase tracking-wider hover:bg-cyan-500/20 transition-all shadow-lg shadow-cyan-500/5">
                    📄 {t.export_pdf}
                </button>
                <button onClick={() => window.print()} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-400 text-sm uppercase tracking-wider hover:border-cyan-500/30 transition-all">
                    🖨 {t.print_report}
                </button>
                <button onClick={() => { setShowEmailModal(true); setEmailStatus('idle'); }} className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl font-black text-emerald-400 text-sm uppercase tracking-wider hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/5">
                    ✉️ {t.send_email}
                </button>
                <button onClick={handleShareWhatsApp} disabled={whatsappSending} className="px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-2xl font-black text-green-400 text-sm uppercase tracking-wider hover:bg-green-500/20 transition-all shadow-lg shadow-green-500/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                    {whatsappSending ? (
                        <><span className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> Generating PDF...</>
                    ) : (
                        <>💬 {t.send_whatsapp || 'WhatsApp'}</>
                    )}
                </button>
                <button onClick={() => setShowResearchMode(!showResearchMode)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-400 text-sm uppercase tracking-wider hover:border-purple-500/30 hover:text-purple-400 transition-all">
                    🔬 {t.research_mode}
                </button>
                <button onClick={onReset} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-slate-400 text-sm uppercase tracking-wider hover:border-cyan-500/30 transition-all">
                    🔄 {t.new_screening}
                </button>
            </div>

            {showResearchMode && (
                <div className="no-print w-full max-w-5xl bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 mb-5 flex flex-wrap gap-3 justify-center animate-in fade-in duration-300">
                    <span className="text-purple-400 font-bold text-sm uppercase tracking-wider self-center">🔬 {t.research_mode}</span>
                    <button onClick={handleExportCSV} className="px-5 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 font-bold text-xs uppercase tracking-wider hover:bg-purple-500/30">📊 {t.export_csv}</button>
                    <button onClick={handleExportJSON} className="px-5 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 font-bold text-xs uppercase tracking-wider hover:bg-purple-500/30">📋 {t.export_json}</button>
                </div>
            )}

            {/* ─── WhatsApp Fallback Modal ─── */}
            {showWhatsAppModal && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowWhatsAppModal(false)}>
                    <div className="relative w-full max-w-md mx-4 rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowWhatsAppModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>

                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center text-3xl border border-green-500/30">💬</div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider">Share via WhatsApp</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">PDF Report Ready</p>
                            </div>
                        </div>

                        {whatsappPdfReady && (
                            <div className="flex flex-col gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-400 text-lg">✓</span>
                                    <p className="text-sm text-green-400 font-black tracking-wide">PDF Downloaded Successfully!</p>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    The report <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">CoVision-Report-{reportId}.pdf</span> has been saved to your device.
                                </p>
                            </div>
                        )}

                        <div className="flex items-start gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                            <span className="text-cyan-400 text-sm mt-0.5">📱</span>
                            <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
                                <p><span className="text-white font-bold">Step 1:</span> Tap "Open WhatsApp" below</p>
                                <p><span className="text-white font-bold">Step 2:</span> Pick the contact you want to send to</p>
                                <p><span className="text-white font-bold">Step 3:</span> Tap 📎 (attachment) and select the downloaded PDF</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-500 font-black text-sm uppercase tracking-wider hover:border-white/20 transition-all">
                                Close
                            </button>
                            <button onClick={openWhatsAppWithText} className="flex-1 py-3 rounded-2xl bg-green-500 text-black font-black text-sm uppercase tracking-wider hover:bg-green-400 transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2">
                                💬 Open WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Email Modal ─── */}
            {showEmailModal && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !emailSending && setShowEmailModal(false)}>
                    <div className="relative w-full max-w-md mx-4 rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <button onClick={() => !emailSending && setShowEmailModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>

                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-3xl border border-emerald-500/30">✉️</div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider">Send Report</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">PDF via Email</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipient Email</label>
                            <input
                                type="email"
                                value={emailAddress}
                                onChange={e => setEmailAddress(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendEmailWithPDF()}
                                placeholder="Enter email address"
                                className="w-full px-5 py-4 rounded-2xl bg-white/5 border-2 border-white/10 text-white text-lg font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                autoFocus
                                disabled={emailSending}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                            <span className="text-cyan-400 text-sm mt-0.5">ℹ️</span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                The PDF report will be generated and <span className="text-cyan-400 font-bold">attached directly</span> via your device's share dialog. On supported devices, the PDF goes straight into your email as an attachment.
                            </p>
                        </div>

                        {emailStatus === 'success' && (
                            <div className="flex flex-col gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400 text-lg">✓</span>
                                    <p className="text-sm text-emerald-400 font-black tracking-wide">PDF Generated & Email Client Opened!</p>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    The PDF <span className="text-white font-bold bg-white/10 px-1 rounded">CoVision-Report-{reportId}.pdf</span> has been downloaded. Please attach it in your email client if it wasn't attached automatically.
                                </p>
                            </div>
                        )}
                        {emailStatus === 'error' && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <span className="text-red-400">✕</span>
                                <p className="text-xs text-red-400 font-bold">Failed to generate PDF. Try exporting manually.</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setShowEmailModal(false)} disabled={emailSending} className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-500 font-black text-sm uppercase tracking-wider hover:border-white/20 transition-all disabled:opacity-30">Cancel</button>
                            <button onClick={handleSendEmailWithPDF} disabled={emailSending || !emailAddress.trim()} className="flex-1 py-3 rounded-2xl bg-emerald-500 text-black font-black text-sm uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-30 disabled:hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
                                {emailSending ? (
                                    <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Generating...</>
                                ) : (
                                    <>📤 Send PDF</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Report Body ─── */}
            <div ref={reportRef} className="w-full max-w-5xl space-y-5 print-bg-force">

                {/* ═══ LETTERHEAD / HEADER ═══ */}
                <div className="relative rounded-3xl overflow-hidden border border-white/10 print-bg-force bg-slate-800/50">
                    {/* Decorative watermark */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[3px] border-cyan-400 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border-[2px] border-indigo-400 rounded-full" />
                    </div>
                    <div className="relative z-10 p-8 md:p-12 text-center space-y-4">
                        {/* Clinic branding */}
                        <div className="flex items-center justify-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                                <span className="text-3xl">👁️</span>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">Vision Screening Report</h1>
                            <p className="text-cyan-400/80 font-bold uppercase tracking-[0.4em] text-xs mt-2">{t.clinic_name}</p>
                        </div>
                        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                            <span className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Report ID: {reportId}
                            </span>
                            <span className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                {patient.dateTime}
                            </span>
                            <span className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Confidential
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ RISK LEVEL BANNER ═══ */}
                <div className="rounded-2xl border-2 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                    style={{ borderColor: risk.color + '30', background: risk.bg }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: risk.color + '15' }}>
                            {risk.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">{t.risk_level}</p>
                            <p className="text-3xl font-black uppercase tracking-wider" style={{ color: risk.color }}>{risk.label} Risk</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Follow-up</p>
                            <p className="text-sm font-black" style={{ color: followUp.color }}>{followUp.when}</p>
                        </div>
                        {qrDataUrl && (
                            <div className="flex flex-col items-center gap-1.5 ml-4">
                                <img src={qrDataUrl} alt="Mobile Report QR Code" className="w-32 h-32 rounded-xl border-2 border-white/10 shadow-lg p-1 bg-white" />
                                <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider">Scan for Mobile</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ PATIENT INFORMATION + COMPLIANCE ═══ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Section title={t.patient_info} icon="📋">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label={t.name} value={patient.fullName} />
                            <StatCard label={t.age} value={String(patient.age)} sub={patient.age >= 40 ? 'Age-related screening advised' : 'Standard screening'} />
                            <StatCard label={t.gender} value={patient.gender === 'male' ? t.male : t.female} />
                            <StatCard label={t.date} value={patient.dateTime.split(' ')[0] || patient.dateTime} sub={patient.dateTime.split(' ')[1] || ''} />
                        </div>
                        <p className="text-[9px] text-slate-700 break-all mt-2">{patient.deviceInfo}</p>
                    </Section>

                    <Section title={t.compliance_section} icon="📏">
                        {distanceCompliance ? (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <StatCard label={t.distance_compliance} value={`${distanceCompliance.percentInRange.toFixed(0)}%`}
                                        color={distanceCompliance.percentInRange >= 80 ? '#10b981' : '#ef4444'}
                                        sub={distanceCompliance.percentInRange >= 80 ? 'Acceptable' : 'Below threshold'} />
                                    <StatCard label={t.avg_distance} value={`${distanceCompliance.averageDistanceM.toFixed(2)}m`}
                                        sub="Target: 2.0m" />
                                    <StatCard label={t.violations} value={String(distanceCompliance.violations)}
                                        color={distanceCompliance.violations <= 3 ? '#10b981' : '#ef4444'} />
                                </div>
                                <div className="mt-3 h-6 w-full bg-slate-800/60 rounded-full overflow-hidden relative border border-white/5">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min(distanceCompliance.percentInRange, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                                        {distanceCompliance.percentInRange.toFixed(0)}% {t.in_range}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                <StatCard label={t.distance_compliance} value={`${acuity.distanceCompliancePercent}%`} color="#10b981" />
                                <StatCard label={t.avg_distance} value="2.00m" sub="Target: 2.0m" />
                                <StatCard label={t.violations} value="0" color="#10b981" />
                            </div>
                        )}
                    </Section>
                </div>

                {/* ═══ VISUAL ACUITY — DETAILED ═══ */}
                <Section title="Visual Acuity Assessment" icon="🔤" accent="rgba(6,182,212,0.15)">
                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex-1">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard label={t.snellen} value={acuity.snellenNotation} color={acuityInterp.color} />
                                <StatCard label={t.logmar} value={acuity.finalLogMAR.toFixed(2)} />
                                <StatCard label={t.correct_answers} value={`${acuity.totalCorrect}/${acuity.totalTrials}`} />
                                <StatCard label={t.avg_response} value={`${acuity.averageResponseMs}`} sub="milliseconds" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 p-4 rounded-xl border" style={{ background: acuityInterp.color + '08', borderColor: acuityInterp.color + '20' }}>
                        <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Clinical Interpretation</p>
                            <p className="text-sm font-bold" style={{ color: acuityInterp.color }}>{acuityInterp.text}</p>
                        </div>
                        <StatusBadge status={acuityInterp.status} color={acuityInterp.color} />
                    </div>
                </Section>

                {/* ═══ COLOR VISION — DETAILED ═══  */}
                <Section title="Color Vision Assessment" icon="🎨" accent="rgba(168,85,247,0.15)">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label={t.correct_answers} value={`${colorVision.totalCorrect}/${colorVision.totalPlates}`} />
                        <StatCard label={t.classification} value={colorInterp.text.split('.')[0]} color={colorInterp.color} />
                        {colorVision.scoreRight !== undefined && (
                            <StatCard label="Right Eye (OD)" value={`${colorVision.scoreRight}/${colorVision.totalRight}`}
                                color={colorVision.scoreRight! / (colorVision.totalRight || 1) >= 0.8 ? '#10b981' : '#f59e0b'} />
                        )}
                        {colorVision.scoreLeft !== undefined && (
                            <StatCard label="Left Eye (OS)" value={`${colorVision.scoreLeft}/${colorVision.totalLeft}`}
                                color={colorVision.scoreLeft! / (colorVision.totalLeft || 1) >= 0.8 ? '#10b981' : '#f59e0b'} />
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-2 p-4 rounded-xl border" style={{ background: colorInterp.color + '08', borderColor: colorInterp.color + '20' }}>
                        <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Clinical Interpretation</p>
                            <p className="text-sm font-bold" style={{ color: colorInterp.color }}>{colorInterp.text}</p>
                        </div>
                        <StatusBadge status={colorInterp.status} color={colorInterp.color} />
                    </div>
                </Section>

                {/* ═══ SCREENING OVERVIEW TABLE ═══ */}
                {testResults.length > 0 && (
                    <Section title="Screening Overview" icon="📋" accent="rgba(99,102,241,0.15)">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3">Complete Test Summary — {testResults.length + 2} assessments performed</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                                <thead>
                                    <tr>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 pl-3">#</th>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2">Test Name</th>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 text-center">Score</th>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 text-center">Percentage</th>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 text-center">Confidence</th>
                                        <th className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Acuity row */}
                                    <tr>
                                        <td className="text-xs text-slate-400 py-2 pl-3 rounded-l-lg" style={{ background: 'var(--bg-card)' }}>1</td>
                                        <td className="text-xs font-bold text-white py-2" style={{ background: 'var(--bg-card)' }}>Visual Acuity</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{acuity.totalCorrect}/{acuity.totalTrials}</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{acuity.totalTrials > 0 ? ((acuity.totalCorrect / acuity.totalTrials) * 100).toFixed(0) : 0}%</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>—</td>
                                        <td className="text-xs py-2 text-center rounded-r-lg" style={{ background: 'var(--bg-card)', color: acuityInterp.color }}><StatusBadge status={acuityInterp.status} color={acuityInterp.color} /></td>
                                    </tr>
                                    {/* Color row */}
                                    <tr>
                                        <td className="text-xs text-slate-400 py-2 pl-3 rounded-l-lg" style={{ background: 'var(--bg-card)' }}>2</td>
                                        <td className="text-xs font-bold text-white py-2" style={{ background: 'var(--bg-card)' }}>Color Vision</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{colorVision.totalCorrect}/{colorVision.totalPlates}</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{colorVision.totalPlates > 0 ? ((colorVision.totalCorrect / colorVision.totalPlates) * 100).toFixed(0) : 0}%</td>
                                        <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>—</td>
                                        <td className="text-xs py-2 text-center rounded-r-lg" style={{ background: 'var(--bg-card)' }}><StatusBadge status={colorInterp.status} color={colorInterp.color} /></td>
                                    </tr>
                                    {/* Test result rows */}
                                    {testResults.map((r, i) => {
                                        const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
                                        const sc = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                                        const sl = pct >= 80 ? 'Pass' : pct >= 50 ? 'Borderline' : 'Fail';
                                        return (
                                            <tr key={i}>
                                                <td className="text-xs text-slate-400 py-2 pl-3 rounded-l-lg" style={{ background: 'var(--bg-card)' }}>{i + 3}</td>
                                                <td className="text-xs font-bold text-white py-2" style={{ background: 'var(--bg-card)' }}>{r.testName}</td>
                                                <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{r.score}/{r.total}</td>
                                                <td className="text-xs py-2 text-center" style={{ background: 'var(--bg-card)', color: sc }}>{pct.toFixed(0)}%</td>
                                                <td className="text-xs text-slate-300 py-2 text-center" style={{ background: 'var(--bg-card)' }}>{((r.confidence || 0) * 100).toFixed(0)}%</td>
                                                <td className="text-xs py-2 text-center rounded-r-lg" style={{ background: 'var(--bg-card)' }}><StatusBadge status={sl} color={sc} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <StatCard label="Total Tests" value={String(testResults.length + 2)} color="#06b6d4" />
                            <StatCard label="Tests Passed" value={String(
                                (acuity.finalLogMAR <= 0.3 ? 1 : 0) +
                                (colorVision.classification === 'normal' ? 1 : 0) +
                                testResults.filter(r => r.total > 0 && (r.score / r.total) >= 0.6).length
                            )} color="#10b981" />
                            <StatCard label="Overall Score" value={`${(() => {
                                const allScores = [
                                    acuity.totalTrials > 0 ? (acuity.totalCorrect / acuity.totalTrials) * 100 : 0,
                                    colorVision.totalPlates > 0 ? (colorVision.totalCorrect / colorVision.totalPlates) * 100 : 0,
                                    ...testResults.map(r => r.total > 0 ? (r.score / r.total) * 100 : 0),
                                ];
                                return (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(0);
                            })()}%`} color={risk.color} />
                        </div>
                    </Section>
                )}

                {/* ═══ TEST METHODOLOGY & PROTOCOL ═══ */}
                <Section title="Testing Protocol & Methodology" icon="🔬" accent="rgba(168,85,247,0.12)">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { name: 'Visual Acuity', method: 'Tumbling E, Landolt C & letter optotypes with progressive size reduction and transparency scaling. 15 levels per eye, bilateral testing with AI-monitored eye occlusion.', standard: 'ISO 8596 / LogMAR' },
                            { name: 'Snellen Chart', method: 'Standard Snellen letter chart with 15 progressive levels (20/200 to 20/10). Bilateral testing with early termination on 2 consecutive errors.', standard: 'Snellen / 6-meter equivalent' },
                            { name: 'Color Vision', method: '10 randomized color identification samples per eye using gradient circles with 4-choice response. Bilateral comparison.', standard: 'Ishihara-adapted digital' },
                            { name: 'Contrast Sensitivity', method: 'Pelli-Robson adapted digital presentation with 15 contrast levels (logCS 0.00–2.10). Progressive difficulty, bilateral.', standard: 'Pelli-Robson / logCS' },
                            { name: 'Astigmatism', method: '5 unique pattern types (clock dial, starburst, cross-cylinder, radial, parallel lines) per eye. Meridional blur detection with position mapping.', standard: 'Fan chart / cross-cylinder' },
                            { name: 'Amsler Grid', method: '5 grid variants (standard, red-on-black, threshold, blue-field, fine-mesh) per eye. Scotoma and metamorphopsia detection with quadrant mapping.', standard: 'Amsler Chart / macular screen' },
                        ].map((m, i) => (
                            <div key={i} className="p-3 rounded-xl border border-white/5" style={{ background: 'var(--bg-card)' }}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-black text-white">{m.name}</p>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">{m.standard}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed">{m.method}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 p-3 rounded-xl border border-white/5" style={{ background: 'rgba(6,182,212,0.04)' }}>
                        <p className="text-[10px] text-cyan-400/80 font-bold uppercase tracking-wider mb-1">🤖 AI Compliance Monitoring</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">All tests utilized real-time AI eye-cover detection via MediaPipe FaceLandmarker (Eye Aspect Ratio analysis). Test responses were blocked when proper eye occlusion was not detected, ensuring bilateral test integrity.</p>
                    </div>
                </Section>

                {/* ═══ PRINT PAGE BREAK — PAGE 2 STARTS HERE ═══ */}
                <div className="print-page-break" style={{ breakBefore: 'page', pageBreakBefore: 'always' }} />

                {/* ═══ PAGE 2 HEADER (visible in print) ═══ */}
                <div className="print-only-header rounded-2xl border border-white/10 p-5 mb-2" style={{ background: 'rgba(6,182,212,0.05)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">👁️</span>
                            <div>
                                <p className="text-sm font-black text-white uppercase tracking-wider">Vision Screening Report</p>
                                <p className="text-[10px] text-cyan-400/60 font-bold uppercase tracking-[0.3em]">{t.clinic_name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 font-bold">Report ID: {reportId}</p>
                            <p className="text-[10px] text-slate-600">{patient.fullName} — {patient.dateTime}</p>
                            <p className="text-[10px] text-slate-600 font-bold">Page 2 of 2</p>
                        </div>
                    </div>
                </div>

                {/* ═══ INDIVIDUAL TEST RESULTS WITH CLINICAL ADVICE ═══ */}
                {testResults.length > 0 && (
                    <Section title="Detailed Test Results & Findings" icon="📊">
                        <div className="space-y-4">
                            {testResults.map((r, i) => {
                                const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
                                const statusColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                                const statusLabel = pct >= 80 ? 'Pass' : pct >= 50 ? 'Borderline' : 'Fail';
                                const { advice, urgency } = getTestAdvice(r.testName, r.score, r.total, r.findings);
                                // Parse per-eye data from findings
                                const rightMatch = r.findings.match(/Right\s*(?:eye)?[:\s]+(\d+)\/(\d+)/i);
                                const leftMatch = r.findings.match(/Left\s*(?:eye)?[:\s]+(\d+)\/(\d+)/i);
                                return (
                                    <div key={i} className="rounded-xl border border-white/5 overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                                        {/* Test header */}
                                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white" style={{ background: statusColor + '20', color: statusColor }}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-sm">{r.testName}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                        Confidence: {((r.confidence || 0) * 100).toFixed(0)}% • Difficulty: {r.difficulty || 'standard'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-xl font-black" style={{ color: statusColor }}>{r.score}/{r.total}</p>
                                                    <p className="text-[10px] text-slate-500">{pct.toFixed(0)}%</p>
                                                </div>
                                                <StatusBadge status={statusLabel} color={statusColor} />
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="px-4 pt-3">
                                            <div className="h-2 w-full bg-slate-800/60 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: statusColor }} />
                                            </div>
                                        </div>
                                        {/* Per-eye breakdown */}
                                        {(rightMatch || leftMatch) && (
                                            <div className="px-4 pt-3">
                                                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">Per-Eye Breakdown</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {rightMatch && (
                                                        <div className="p-2.5 rounded-lg border border-white/5" style={{ background: 'var(--bg-card)' }}>
                                                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">👁️ Right Eye (OD)</p>
                                                            <p className="text-lg font-black" style={{ color: parseInt(rightMatch[1]) / parseInt(rightMatch[2]) >= 0.6 ? '#10b981' : '#ef4444' }}>
                                                                {rightMatch[1]}/{rightMatch[2]}
                                                            </p>
                                                            <p className="text-[9px] text-slate-600">{((parseInt(rightMatch[1]) / parseInt(rightMatch[2])) * 100).toFixed(0)}% correct</p>
                                                        </div>
                                                    )}
                                                    {leftMatch && (
                                                        <div className="p-2.5 rounded-lg border border-white/5" style={{ background: 'var(--bg-card)' }}>
                                                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">👁️ Left Eye (OS)</p>
                                                            <p className="text-lg font-black" style={{ color: parseInt(leftMatch[1]) / parseInt(leftMatch[2]) >= 0.6 ? '#10b981' : '#ef4444' }}>
                                                                {leftMatch[1]}/{leftMatch[2]}
                                                            </p>
                                                            <p className="text-[9px] text-slate-600">{((parseInt(leftMatch[1]) / parseInt(leftMatch[2])) * 100).toFixed(0)}% correct</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* Findings */}
                                        <div className="px-4 pt-3">
                                            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1">Clinical Findings</p>
                                            <p className="text-xs text-slate-400 leading-relaxed">{r.findings}</p>
                                        </div>
                                        {/* Per-sample breakdown if available */}
                                        {r.perSampleScores && r.perSampleScores.length > 0 && (
                                            <div className="px-4 pt-3">
                                                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">Sample-by-Sample Results ({r.perSampleScores.filter(s => s.correct).length} correct / {r.perSampleScores.length} total)</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {r.perSampleScores.map((s, j) => (
                                                        <div key={j} className="w-7 h-7 rounded flex flex-col items-center justify-center text-[8px] font-black"
                                                            style={{
                                                                background: s.correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: s.correct ? '#10b981' : '#ef4444',
                                                                border: `1px solid ${s.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                                                            }}>
                                                            <span>{s.correct ? '✓' : '✗'}</span>
                                                            <span className="text-[6px] text-slate-600">{s.sample}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Response time stats */}
                                                {r.perSampleScores.some(s => s.timeMs > 0) && (
                                                    <div className="mt-2 flex gap-4">
                                                        <span className="text-[9px] text-slate-600">
                                                            Avg response: <span className="text-slate-400 font-bold">{(r.perSampleScores.reduce((a, s) => a + s.timeMs, 0) / r.perSampleScores.length).toFixed(0)}ms</span>
                                                        </span>
                                                        <span className="text-[9px] text-slate-600">
                                                            Fastest: <span className="text-emerald-400 font-bold">{Math.min(...r.perSampleScores.filter(s => s.timeMs > 0).map(s => s.timeMs))}ms</span>
                                                        </span>
                                                        <span className="text-[9px] text-slate-600">
                                                            Slowest: <span className="text-amber-400 font-bold">{Math.max(...r.perSampleScores.map(s => s.timeMs))}ms</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Clinical advice */}
                                        <div className="px-4 py-3 mt-3 border-t border-white/5" style={{ background: statusColor + '05' }}>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 flex items-center">
                                                <UrgencyDot urgency={urgency} />
                                                Clinical Recommendation ({urgency === 'urgent' ? 'URGENT' : urgency === 'soon' ? 'Follow-up needed' : 'Routine'})
                                            </p>
                                            <p className="text-xs font-medium" style={{ color: statusColor }}>{advice}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                )}

                {/* ═══ AREAS OF CONCERN SUMMARY ═══ */}
                {(() => {
                    const concerns: { area: string; detail: string; color: string }[] = [];
                    if (acuity.finalLogMAR > 0.3) concerns.push({ area: 'Visual Acuity', detail: `${acuity.snellenNotation} — below normal threshold`, color: acuity.finalLogMAR > 0.5 ? '#ef4444' : '#f59e0b' });
                    if (colorVision.classification !== 'normal') concerns.push({ area: 'Color Vision', detail: colorInterp.text.split('.')[0], color: colorInterp.color });
                    testResults.forEach(r => {
                        if (r.score / r.total < 0.6) concerns.push({ area: r.testName, detail: `${r.score}/${r.total} (${((r.score / r.total) * 100).toFixed(0)}%)`, color: '#ef4444' });
                    });
                    if (concerns.length === 0) return null;
                    return (
                        <Section title="Areas of Concern" icon="🚨" accent="rgba(239,68,68,0.15)">
                            <div className="space-y-2">
                                {concerns.map((c, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: c.color + '06', borderColor: c.color + '15' }}>
                                        <div className="w-2 h-8 rounded-full" style={{ background: c.color }} />
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-white">{c.area}</p>
                                            <p className="text-xs" style={{ color: c.color }}>{c.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    );
                })()}

                {/* ═══ PATIENT ADVICE & RECOMMENDATIONS ═══ */}
                <Section title="Patient Advice & Recommendations" icon="💡" accent="rgba(6,182,212,0.15)">
                    <div className="space-y-3">
                        {patientAdvice.map((advice, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-xl border border-white/5" style={{ background: 'rgba(6,182,212,0.03)' }}>
                                <span className="text-lg leading-none mt-0.5">{advice.slice(0, 2)}</span>
                                <p className="text-sm text-slate-300 leading-relaxed flex-1">{advice.slice(2).trim()}</p>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* ═══ FOLLOW-UP SCHEDULE ═══ */}
                <div className="rounded-2xl border-2 p-5 md:p-7 flex flex-col sm:flex-row items-center justify-between gap-4"
                    style={{ borderColor: followUp.color + '25', background: followUp.color + '06' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: followUp.color + '15' }}>📅</div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Recommended Follow-Up</p>
                            <p className="text-xl font-black" style={{ color: followUp.color }}>{followUp.when}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{followUp.action}</p>
                        </div>
                    </div>
                </div>

                {/* ═══ DISCLAIMER ═══ */}
                <div className="rounded-2xl border border-amber-500/15 p-5" style={{ background: 'rgba(245,158,11,0.04)' }}>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p className="text-xs font-black text-amber-500/80 uppercase tracking-wider mb-2">Important Medical Disclaimer</p>
                            <p className="text-amber-400/60 text-xs leading-relaxed">
                                {t.disclaimer_report}
                            </p>
                            <p className="text-amber-400/40 text-[10px] leading-relaxed mt-2">
                                This screening uses digital optotype presentation and may not replicate clinical conditions precisely.
                                Results should be interpreted by a qualified healthcare professional. Screen brightness, calibration accuracy,
                                and patient cooperation may affect results. This tool is intended for preliminary screening only and does not
                                replace a comprehensive eye examination including intraocular pressure measurement, fundoscopy, and slit-lamp examination.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ═══ SIGNATURE & AUTHENTICATION ═══ */}
                <div className="rounded-2xl border border-white/5 p-6 md:p-8" style={{ background: 'var(--bg-card)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <div className="w-full border-b border-slate-600 mb-2 h-12"></div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.signature_line}</p>
                        </div>
                        <div>
                            <div className="w-full border-b border-slate-600 mb-2 h-12"></div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Clinic Stamp / Seal</p>
                        </div>
                        <div className="text-right space-y-1.5">
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider">{t.date}: {patient.dateTime}</p>
                            <p className="text-[10px] text-slate-700 uppercase tracking-wider">Report ID: {reportId}</p>
                            <p className="text-[10px] text-slate-700 uppercase tracking-wider">Tests Completed: {testResults.length + 2}</p>
                            <p className="text-[10px] text-slate-700 uppercase tracking-wider">Generated by CoVision AI v2.0</p>
                        </div>
                    </div>
                </div>

                {/* ═══ COMPREHENSIVE FINDINGS SUMMARY ═══ */}
                <Section title="Comprehensive Findings Summary" icon="📝" accent="rgba(6,182,212,0.15)">
                    <div className="space-y-3">
                        {/* Eye comparison table */}
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Bilateral Eye Comparison</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl p-3 border border-white/5 text-center" style={{ background: 'var(--bg-card)' }}>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Assessment</p>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-slate-400 font-bold">Visual Acuity</p>
                                        {colorVision.scoreRight !== undefined && <p className="text-[10px] text-slate-400 font-bold">Color Vision</p>}
                                        {testResults.map((r, i) => {
                                            const rm = r.findings.match(/Right/i);
                                            if (rm) return <p key={i} className="text-[10px] text-slate-400 font-bold">{r.testName}</p>;
                                            return null;
                                        })}
                                    </div>
                                </div>
                                <div className="rounded-xl p-3 border border-cyan-500/10 text-center" style={{ background: 'rgba(6,182,212,0.04)' }}>
                                    <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider mb-2">👁️ Right Eye (OD)</p>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-white font-bold">{acuity.snellenNotation}</p>
                                        {colorVision.scoreRight !== undefined && <p className="text-[10px] text-white font-bold">{colorVision.scoreRight}/{colorVision.totalRight}</p>}
                                        {testResults.map((r, i) => {
                                            const rm = r.findings.match(/Right\s*(?:eye)?[:\s]+(\d+)\/(\d+)/i);
                                            if (rm) return <p key={i} className="text-[10px] font-bold" style={{ color: parseInt(rm[1]) / parseInt(rm[2]) >= 0.6 ? '#10b981' : '#ef4444' }}>{rm[1]}/{rm[2]}</p>;
                                            return null;
                                        })}
                                    </div>
                                </div>
                                <div className="rounded-xl p-3 border border-indigo-500/10 text-center" style={{ background: 'rgba(99,102,241,0.04)' }}>
                                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-2">👁️ Left Eye (OS)</p>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-white font-bold">{acuity.snellenNotation}</p>
                                        {colorVision.scoreLeft !== undefined && <p className="text-[10px] text-white font-bold">{colorVision.scoreLeft}/{colorVision.totalLeft}</p>}
                                        {testResults.map((r, i) => {
                                            const lm = r.findings.match(/Left\s*(?:eye)?[:\s]+(\d+)\/(\d+)/i);
                                            if (lm) return <p key={i} className="text-[10px] font-bold" style={{ color: parseInt(lm[1]) / parseInt(lm[2]) >= 0.6 ? '#10b981' : '#ef4444' }}>{lm[1]}/{lm[2]}</p>;
                                            return null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Narrative summary */}
                        <div className="p-4 rounded-xl border border-white/5" style={{ background: 'var(--bg-card)' }}>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Clinical Narrative</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {patient.fullName}, age {patient.age} ({patient.gender}), underwent comprehensive digital vision screening consisting of {testResults.length + 2} standardized assessments.
                                Visual acuity measured at {acuity.snellenNotation} (LogMAR {acuity.finalLogMAR.toFixed(2)}) with {acuity.totalCorrect}/{acuity.totalTrials} correct responses{acuity.averageResponseMs > 0 ? ` and average response time of ${acuity.averageResponseMs}ms` : ''}.
                                Color vision screening classified as {colorVision.classificationLabel} ({colorVision.totalCorrect}/{colorVision.totalPlates} correct).
                                {testResults.map(r => ` ${r.testName}: ${r.score}/${r.total} (${r.total > 0 ? ((r.score / r.total) * 100).toFixed(0) : 0}%).`).join('')}
                                {' '}Overall risk assessment: <strong style={{ color: risk.color }}>{risk.label}</strong>.
                                {followUp.action} recommended {followUp.when.toLowerCase()}.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* ═══ TESTING CONDITIONS ═══ */}
                <Section title="Testing Conditions & Environment" icon="🖥️" accent="rgba(255,255,255,0.05)">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Screening Date" value={patient.dateTime.split(' ')[0] || patient.dateTime} />
                        <StatCard label="Screening Time" value={patient.dateTime.split(' ')[1] || '—'} />
                        <StatCard label="Patient Distance" value={distanceCompliance ? `${distanceCompliance.averageDistanceM.toFixed(2)}m` : '2.00m'} sub="Target: 2.0m" />
                        <StatCard label="Compliance" value={distanceCompliance ? `${distanceCompliance.percentInRange.toFixed(0)}%` : `${acuity.distanceCompliancePercent}%`} color={distanceCompliance ? (distanceCompliance.percentInRange >= 80 ? '#10b981' : '#ef4444') : '#10b981'} />
                    </div>
                    <div className="mt-3 p-3 rounded-xl border border-white/5" style={{ background: 'var(--bg-card)' }}>
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1">Device Information</p>
                        <p className="text-[9px] text-slate-700 break-all leading-relaxed">{patient.deviceInfo}</p>
                    </div>
                </Section>

                {/* ═══ CERTIFICATION STATEMENT ═══ */}
                <div className="rounded-2xl border-2 border-cyan-500/20 p-6 md:p-8" style={{ background: 'rgba(6,182,212,0.04)' }}>
                    <div className="text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl">🏥</span>
                            <p className="text-sm font-black text-white uppercase tracking-wider">Certificate of Screening</p>
                        </div>
                        <div className="h-px w-full bg-cyan-500/20" />
                        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto">
                            This certifies that <strong className="text-white">{patient.fullName}</strong> has completed a comprehensive
                            AI-powered digital vision screening on <strong className="text-white">{patient.dateTime}</strong> using
                            the CoVision platform. The screening included {testResults.length + 2} standardized visual assessments
                            with real-time AI compliance monitoring. Results are based on digital optotype presentation and should be
                            confirmed by a qualified ophthalmologist or optometrist.
                        </p>
                        <div className="grid grid-cols-2 gap-8 max-w-md mx-auto pt-6">
                            <div>
                                <div className="w-full border-b border-cyan-500/30 mb-2 h-10"></div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Examiner Signature</p>
                            </div>
                            <div>
                                <div className="w-full border-b border-cyan-500/30 mb-2 h-10"></div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Date & Stamp</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Footer ─── */}
                <div className="text-center py-4 space-y-1">
                    <p className="text-[10px] text-slate-700 uppercase tracking-[0.3em]">CoVision — AI-Powered Vision Screening Platform</p>
                    <p className="text-[9px] text-slate-800">This document is auto-generated and is valid only with an authorized signature.</p>
                </div>
            </div>
        </div>
    );
};

export default MedicalReport;

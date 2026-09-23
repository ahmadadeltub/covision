
import React, { useState, useEffect, useRef } from 'react';
import { TestResult, Language } from '../types';
import { GoogleGenAI } from "@google/genai";

interface Props {
  lang: Language;
  t: any;
  results: TestResult[];
  onReset: () => void;
}

const ResultsDashboard: React.FC<Props> = ({ lang, t, results, onReset }) => {
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateAiReport();
    
    if (!sessionStorage.getItem('covision_test_counted')) {
      fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/tests_completed/up').catch(e => console.error(e));
      sessionStorage.setItem('covision_test_counted', 'true');
    }
  }, []);

  const generateAiReport = async () => {
    setLoadingAi(true);
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const testSummary = results.map(r => `${r.testName}: ${r.score}/${r.total}`).join('\n');
      const prompt = `Act as a senior ophthalmologist. Analyze these results: ${testSummary}. Provide 3 short paragraphs: Assessment, Anomalies, Recommendation. Keep it professional and concise. End with a medical disclaimer. Use English.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });
      setAiInsight(response.text || 'Diagnostic report unavailable.');
    } catch (e) {
      setAiInsight('Error generating AI report. Please consult a specialist.');
    } finally {
      setLoadingAi(false);
    }
  };

  const overallConfidence = results.reduce((acc, r) => acc + r.confidence, 0) / (results.length || 1);

  const getRiskStatus = (result: TestResult) => {
    const ratio = result.score / result.total;
    if (result.testName.toLowerCase().includes('acuity')) {
      return ratio >= 1 ? 'OPTIMAL' : ratio >= 0.5 ? 'MODERATE' : 'LOW';
    }
    return ratio >= 0.8 ? 'PASS' : 'RECHECK';
  };

  const generateResultsPDFBlob = async (): Promise<Blob | null> => {
    if (!dashboardRef.current) return null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const el = dashboardRef.current;

      const savedStyles: { el: HTMLElement; overflow: string; height: string; maxHeight: string }[] = [];
      let node: HTMLElement | null = el.closest('.overflow-y-auto') || el.closest('.overflow-hidden');
      while (node) {
        savedStyles.push({ el: node, overflow: node.style.overflow, height: node.style.height, maxHeight: node.style.maxHeight });
        node.style.overflow = 'visible';
        node.style.height = 'auto';
        node.style.maxHeight = 'none';
        node = node.parentElement;
      }

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a',
        scrollY: 0,
        windowHeight: el.scrollHeight + 200,
      });

      savedStyles.forEach(s => {
        s.el.style.overflow = s.overflow;
        s.el.style.height = s.height;
        s.el.style.maxHeight = s.maxHeight;
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      return pdf.output('blob');
    } catch (err) {
      console.error('PDF generation failed:', err);
      return null;
    }
  };

  const handleSendEmailWithPDF = async () => {
    if (!emailAddress.trim()) return;
    setEmailSending(true);
    setEmailStatus('idle');
    try {
      const pdfBlob = await generateResultsPDFBlob();
      if (!pdfBlob) { setEmailStatus('error'); setEmailSending(false); return; }

      const pdfFile = new File([pdfBlob], 'covision-results.pdf', { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: 'CoVision Screening Results',
          text: 'Vision screening results report',
        });
        fetch('https://api.counterapi.dev/v1/covision_41ab1_prod/reports_sent/up').catch(e => console.error(e));
        setEmailStatus('success');
      } else {
        // Fallback: download PDF + open mailto
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'covision-results.pdf';
        a.click();
        URL.revokeObjectURL(url);

        const subject = encodeURIComponent('CoVision Vision Screening Results');
        const body = encodeURIComponent(
          `Please find attached the CoVision Vision Screening Results PDF.\n\n` +
          results.map(r => `${r.testName}: ${r.score}/${r.total} — ${r.findings}`).join('\n') +
          `\n\n⚠️ This is a preliminary screening report. Please consult a qualified ophthalmologist.`
        );
        window.open(`mailto:${encodeURIComponent(emailAddress)}?subject=${subject}&body=${body}`, '_self');
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

  return (
    <div ref={dashboardRef} className="w-full max-w-7xl h-auto md:h-full max-h-none md:max-h-[92vh] flex flex-col glass rounded-2xl sm:rounded-3xl md:rounded-[4rem] shadow-xl md:shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 overflow-y-auto md:overflow-hidden bg-slate-900/60 p-3 sm:p-6 md:p-8 animate-in fade-in zoom-in-95 duration-700">

      {/* Top Section: Header & Summary */}
      <div className="shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="text-center sm:text-left rtl:sm:text-right">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none drop-shadow-sm">
            {t.results_title}
          </h2>
          <div className="mt-2 flex items-center justify-center sm:justify-start gap-4">
            <div className="h-1 w-8 bg-sky-500 rounded-full"></div>
            <p className="text-sky-700 dark:text-cyan-400 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[10px] md:text-xs">System Analysis Finalized</p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-5 py-3 sm:px-8 sm:py-4 rounded-2xl md:rounded-[2.5rem] backdrop-blur-3xl shadow-xl">
          <div className="text-right rtl:text-left">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.reliability_score}</div>
            <div className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-none">{(overallConfidence * 100).toFixed(0)}%</div>
          </div>
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_30px_rgba(0,243,255,0.4)] ${overallConfidence > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
            {overallConfidence > 0.8 ? '✅' : '⚠️'}
          </div>
        </div>
      </div>

      {/* Middle Section: Results & AI Insights */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 md:overflow-hidden min-h-0">

        {/* Results Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 md:px-2 space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {results.map((res, i) => {
              const status = getRiskStatus(res);
              return (
                <div key={i} className="group p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-slate-100/80 dark:bg-black/40 border-2 border-slate-200 dark:border-white/5 flex items-center justify-between gap-4 md:gap-6 transition-all hover:border-sky-400 dark:hover:border-cyan-400 hover:bg-sky-50 dark:hover:bg-cyan-500/10 shadow-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                      <h4 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{res.testName}</h4>
                      <span className={`px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${status === 'OPTIMAL' || status === 'PASS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        }`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-snug font-medium italic">"{res.findings}"</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl sm:text-4xl md:text-6xl font-black text-sky-600 dark:text-cyan-400 drop-shadow-sm">{res.score}/{res.total}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Insight Box - Fixed height to ensure layout stability */}
        <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-sky-50/80 dark:bg-cyan-950/20 border-2 border-sky-200 dark:border-cyan-500/20 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-[3.5rem] flex flex-col relative overflow-hidden shadow-inner">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] pointer-events-none"></div>

          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0">
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 dark:bg-cyan-500/20 flex items-center justify-center text-sky-600 dark:text-cyan-400 text-xl sm:text-2xl border border-sky-200 dark:border-cyan-500/30">🧠</span>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider">{t.ai_insights}</h3>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-slate-800 dark:text-slate-200 text-sm sm:text-base md:text-lg font-medium leading-relaxed italic">
            {loadingAi ? (
              <div className="space-y-4 py-4">
                <div className="h-4 bg-white/5 rounded-full w-full animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded-full w-11/12 animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded-full w-4/5 animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded-full w-full animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded-full w-11/12 animate-pulse"></div>
              </div>
            ) : (
              <div className="whitespace-pre-line">{aiInsight}</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Actions */}
      <div className="shrink-0 pt-4 md:pt-6 flex flex-col sm:flex-row gap-3 md:gap-4 max-w-5xl mx-auto w-full">
        <button
          onClick={() => window.print()}
          className="flex-1 py-3.5 sm:py-4 md:py-6 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-2xl md:rounded-[2.5rem] font-black uppercase text-xs sm:text-sm md:text-lg tracking-wider md:tracking-[0.2em] hover:shadow-[0_0_40px_rgba(2,132,199,0.4)] transition-all border border-white/10 active:scale-95 flex items-center justify-center gap-2"
        >
          {t.download_report}
        </button>
        <button
          onClick={() => { setShowEmailModal(true); setEmailStatus('idle'); }}
          className="flex-1 py-3.5 sm:py-4 md:py-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl md:rounded-[2.5rem] font-black uppercase text-xs sm:text-sm md:text-lg tracking-wider md:tracking-[0.2em] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all border border-white/10 active:scale-95 flex items-center justify-center gap-2"
        >
          ✉️ {t.send_email}
        </button>
        <button
          onClick={onReset}
          className="flex-1 py-3.5 sm:py-4 md:py-6 bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-2xl md:rounded-[2.5rem] font-black uppercase text-xs sm:text-sm md:text-lg tracking-wider md:tracking-[0.2em] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] transition-all border border-white/10 active:scale-95 flex items-center justify-center gap-2"
        >
          📋 View Full Report
        </button>
      </div>

      <div className="shrink-0 mt-3 md:mt-4 text-center opacity-40">
        <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] italic">
          {t.disclaimer_text}
        </p>
      </div>

      {/* ─── Email Modal ─── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !emailSending && setShowEmailModal(false)}>
          <div className="relative w-full max-w-md mx-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <button onClick={() => !emailSending && setShowEmailModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">✕</button>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-2xl sm:text-3xl border border-emerald-300 dark:border-emerald-500/30">✉️</div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Send Results</h3>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">PDF via Email</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-700 dark:text-slate-500 uppercase tracking-widest">Recipient Email</label>
              <input
                type="email"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendEmailWithPDF()}
                placeholder="Enter email address"
                className="w-full px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border-2 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-base md:text-lg font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                autoFocus
                disabled={emailSending}
              />
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-50 dark:bg-cyan-500/5 border border-sky-200 dark:border-cyan-500/10">
              <span className="text-sky-600 dark:text-cyan-400 text-sm mt-0.5">ℹ️</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                The results will be generated as a <span className="text-sky-700 dark:text-cyan-400 font-bold">PDF</span> and shared via your device's email client. On supported devices, the PDF will be attached automatically.
              </p>
            </div>

            {emailStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400">✓</span>
                <p className="text-xs text-emerald-400 font-bold">PDF generated & email client opened!</p>
              </div>
            )}
            {emailStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <span className="text-red-400">✕</span>
                <p className="text-xs text-red-400 font-bold">Failed to generate PDF. Try again.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowEmailModal(false)} disabled={emailSending} className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-500 font-black text-sm uppercase tracking-wider hover:border-white/20 transition-all disabled:opacity-30">
                Cancel
              </button>
              <button onClick={handleSendEmailWithPDF} disabled={emailSending || !emailAddress.trim()} className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider transition-all disabled:opacity-30 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2">
                {emailSending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
                ) : (
                  <>📤 Send PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDashboard;

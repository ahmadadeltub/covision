
import React, { useState } from 'react';
import { TestType, Language } from '../types';

interface Props {
  lang: Language;
  t: any;
  onComplete: (tests: TestType[]) => void;
}

const TestSelector: React.FC<Props> = ({ lang, t, onComplete }) => {
  const allTestTypes = [
    TestType.Acuity,
    TestType.NearAcuity,
    TestType.Color,
    TestType.Snellen,
    TestType.Contrast,
    TestType.Astigmatism,
    TestType.Amsler,
    TestType.VisualField,
    TestType.Motility,
  ];

  const [selected, setSelected] = useState<TestType[]>([
    TestType.Acuity,
    TestType.NearAcuity,
    TestType.Color,
    TestType.Snellen,
    TestType.Contrast,
    TestType.Astigmatism,
    TestType.Amsler,
    TestType.VisualField,
    TestType.Motility,
  ]);

  const toggle = (type: TestType) => {
    setSelected(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const testOptions = [
    { type: TestType.Acuity, label: t.visual_acuity || 'Distance Visual Acuity', icon: '👁️', desc: '3 Trials · Far Acuity' },
    { type: TestType.NearAcuity, label: t.near_acuity || 'Near Acuity (40cm)', icon: '📖', desc: '3 Samples · Reading Acuity' },
    { type: TestType.Color, label: t.color_arrangement || 'Color Arrangement', icon: '🎨', desc: '3 Samples · D-15 Spectrum' },
    { type: TestType.Snellen, label: t.snellen_chart || 'Snellen Chart', icon: '🔤', desc: '3 Trials · Standard Optotypes' },
    { type: TestType.Contrast, label: t.contrast_sensitivity || 'Contrast Sensitivity', icon: '🌗', desc: '3 Levels · LogCS Threshold' },
    { type: TestType.Astigmatism, label: t.astigmatism_test || 'Astigmatism Dial', icon: '✴️', desc: '3 Patterns · Meridional Focus' },
    { type: TestType.Amsler, label: t.amsler_grid || 'Amsler Macular Grid', icon: '⬛', desc: '3 Steps · Macular Uniformity' },
    { type: TestType.VisualField, label: t.visual_field || 'Visual Field Screening', icon: '🎯', desc: '3 Stimuli · Central Field' },
    { type: TestType.Motility, label: t.motility || 'Ocular Motility', icon: '🧭', desc: '3 Gazes · Cardinal Tracking' },
  ];

  return (
    <div className="w-full h-full max-h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="glass w-full max-w-6xl xl:max-w-7xl h-full max-h-full rounded-2xl sm:rounded-3xl shadow-2xl border flex flex-col justify-between relative overflow-hidden p-3 sm:p-5 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-cyan-500/20 rounded-full animate-[spin_40s_linear_infinite]"></div>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header Section */}
        <div className="relative z-10 text-center mb-1 sm:mb-2 shrink-0 py-1">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight drop-shadow-sm min-h-[44px] sm:min-h-[52px] flex items-center justify-center">
            {t.test_selection || 'Screening Battery Selection'}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-1.5 sm:mt-2">
            <p className="text-xs sm:text-sm md:text-base text-sky-600 dark:text-cyan-400 uppercase tracking-widest font-black">
              Select Vision Modules (3 Samples Per Test)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(allTestTypes)}
                className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-wider px-3.5 py-1.5 min-h-[36px] sm:min-h-[40px] flex items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 dark:text-cyan-400 border border-sky-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-wider px-3.5 py-1.5 min-h-[36px] sm:min-h-[40px] flex items-center justify-center rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Selection Grid — Spacious Cards with Taller, Prominent Test Labels */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center px-1 md:px-2 my-1 sm:my-2 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 lg:gap-6 max-w-6xl mx-auto w-full h-full items-stretch py-1">
            {testOptions.map(opt => {
              const isSelected = selected.includes(opt.type);
              return (
                <button
                  key={opt.type}
                  onClick={() => toggle(opt.type)}
                  className={`group relative flex flex-col items-center justify-center p-3.5 sm:p-5 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl border-2 sm:border-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[135px] sm:min-h-[160px] md:min-h-[185px] lg:min-h-[210px] ${
                    isSelected 
                    ? 'border-sky-500 dark:border-cyan-400 bg-sky-50/90 dark:bg-cyan-500/20 shadow-lg dark:shadow-[0_0_35px_rgba(0,243,255,0.3)] ring-2 ring-sky-400/30' 
                    : 'border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/40 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-100 text-sky-700 dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-cyan-300'
                      : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5'
                  }`}>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isSelected ? 'bg-sky-500 dark:bg-cyan-400 animate-pulse' : 'bg-slate-400'}`}></div>
                    <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                      {isSelected ? 'Active' : 'Standby'}
                    </span>
                  </div>

                  {/* 3 Samples Badge */}
                  <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 dark:bg-black/60 border border-white/10 text-[8px] sm:text-[9px] md:text-[10px] font-mono font-bold text-slate-300 uppercase shadow-sm">
                    <span>3 SAMPLES</span>
                  </div>

                  {/* Icon — Bigger Size */}
                  <span className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-1 sm:mb-2 transition-all duration-300 leading-none ${isSelected ? 'scale-110 drop-shadow-md' : 'grayscale opacity-40'}`}>
                    {opt.icon}
                  </span>

                  {/* Test Label — Increased Height, Line-Height, & Prominence */}
                  <div className="w-full min-h-[46px] sm:min-h-[56px] md:min-h-[64px] lg:min-h-[72px] flex items-center justify-center px-1 sm:px-2 my-0.5 sm:my-1">
                    <span className={`text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-black uppercase tracking-wide text-center transition-colors duration-300 leading-snug md:leading-normal ${
                      isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                    }`}>
                      {opt.label}
                    </span>
                  </div>

                  {/* Module Subtitle */}
                  <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-500 dark:text-slate-400 text-center">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Action Area */}
        <div className="relative z-10 w-full max-w-4xl mx-auto shrink-0 pt-1 sm:pt-2">
          <button
            disabled={selected.length === 0}
            onClick={() => onComplete(selected)}
            className="group w-full py-3.5 sm:py-4 md:py-5 min-h-[64px] sm:min-h-[72px] md:min-h-[80px] bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-2xl md:rounded-3xl font-black text-sm sm:text-lg md:text-xl uppercase tracking-wider md:tracking-[0.15em] disabled:opacity-30 disabled:grayscale transition-all transform hover:scale-[1.01] active:scale-95 relative overflow-hidden shadow-2xl border-2 border-sky-400/40 hover:shadow-[0_0_40px_rgba(2,132,199,0.5)] flex items-center justify-center gap-3 sm:gap-4 cursor-pointer"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <span>INITIALIZE SCREENING SYSTEM</span>
              <span className="text-lg sm:text-2xl">→</span>
            </span>
            <span className="relative z-10 bg-white/20 backdrop-blur-md text-white px-3 sm:px-4 py-1 rounded-xl text-xs sm:text-base font-mono font-black border border-white/30">
              {selected.length} / {testOptions.length}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSelector;


import React, { useState } from 'react';
import { TestType, Language } from '../types';

interface Props {
  lang: Language;
  t: any;
  onComplete: (tests: TestType[]) => void;
}

const TestSelector: React.FC<Props> = ({ lang, t, onComplete }) => {
  const [selected, setSelected] = useState<TestType[]>([TestType.Acuity, TestType.Color, TestType.Snellen, TestType.Contrast, TestType.Astigmatism, TestType.Amsler]);

  const toggle = (type: TestType) => {
    setSelected(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const testOptions = [
    { type: TestType.Acuity, label: t.visual_acuity, icon: '👁️' },
    { type: TestType.Color, label: t.color_arrangement || 'Color Arrangement', icon: '🎨' },
    { type: TestType.Snellen, label: t.snellen_chart || 'Snellen Chart', icon: '🔤' },
    { type: TestType.Contrast, label: t.contrast_sensitivity, icon: '🌗' },
    { type: TestType.Astigmatism, label: t.astigmatism_test, icon: '✴️' },
    { type: TestType.Amsler, label: t.amsler_grid, icon: '⬛' },
  ];

  return (
    <div className="w-full h-full max-h-full flex items-center justify-center p-1 sm:p-2 md:p-3 overflow-hidden">
      <div className="glass w-full max-w-5xl h-full max-h-full rounded-2xl md:rounded-3xl shadow-2xl border flex flex-col justify-between relative overflow-hidden p-2.5 sm:p-4 md:p-5 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-cyan-500/20 rounded-full animate-[spin_40s_linear_infinite]"></div>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header Section */}
        <div className="relative z-10 text-center mb-1 sm:mb-2 shrink-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none drop-shadow-sm">
            {t.test_selection}
          </h2>
          <p className="text-[9px] md:text-xs text-sky-600 dark:text-cyan-400 uppercase tracking-widest font-black mt-1">
            Choose Screening Modules
          </p>
        </div>

        {/* Selection Grid */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center px-1 md:px-2 my-1 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-5xl mx-auto w-full items-stretch h-full max-h-full">
            {testOptions.map(opt => (
              <button
                key={opt.type}
                onClick={() => toggle(opt.type)}
                className={`group relative flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 ${
                  selected.includes(opt.type) 
                  ? 'border-sky-500 bg-sky-50/80 dark:bg-cyan-500/20 shadow-md dark:shadow-[0_0_30px_rgba(0,243,255,0.25)]' 
                  : 'border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm'
                }`}
              >
                {/* Status Indicator */}
                <div className={`absolute top-2 right-2 md:top-3 md:right-3 flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
                  selected.includes(opt.type)
                    ? 'border-sky-500 bg-sky-100 text-sky-700 dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${selected.includes(opt.type) ? 'bg-sky-500 dark:bg-cyan-400 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">
                    {selected.includes(opt.type) ? 'Active' : 'Standby'}
                  </span>
                </div>

                {/* Icon */}
                <span className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl mb-1 md:mb-2 transition-all duration-300 leading-none ${selected.includes(opt.type) ? 'scale-105' : 'grayscale opacity-40'}`}>
                  {opt.icon}
                </span>

                {/* Label */}
                <span className={`text-[11px] sm:text-xs md:text-sm lg:text-base font-black uppercase tracking-wider text-center transition-colors duration-300 leading-tight ${
                  selected.includes(opt.type) ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                }`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Action Area */}
        <div className="relative z-10 w-full max-w-3xl mx-auto shrink-0 pt-1">
          <button
            disabled={selected.length === 0}
            onClick={() => onComplete(selected)}
            className="group w-full py-2.5 sm:py-3.5 md:py-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl md:rounded-2xl font-black text-xs sm:text-sm md:text-base uppercase tracking-wider md:tracking-[0.2em] disabled:opacity-30 disabled:grayscale transition-all transform hover:scale-[1.01] active:scale-95 relative overflow-hidden shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 sm:gap-3 cursor-pointer"
          >
            <span className="relative z-10">Initialize System</span>
            <span className="relative z-10 bg-white/20 backdrop-blur-md text-white px-2.5 py-0.5 md:px-4 md:py-1 rounded-lg text-xs sm:text-sm md:text-base font-mono">
              {selected.length}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSelector;

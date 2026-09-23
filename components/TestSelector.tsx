
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
    <div className="w-full min-h-full flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="glass w-full max-w-7xl min-h-0 md:h-full md:max-h-[95vh] rounded-3xl md:rounded-[4rem] shadow-2xl border flex flex-col relative overflow-y-auto md:overflow-hidden p-3 sm:p-6 md:p-8 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-cyan-500/20 rounded-full animate-[spin_40s_linear_infinite]"></div>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header Section */}
        <div className="relative z-10 text-center mb-3 md:mb-6 shrink-0">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none drop-shadow-sm">
            {t.test_selection}
          </h2>
          <p className="text-[10px] md:text-xs text-sky-600 dark:text-cyan-400 uppercase tracking-widest font-black mt-1">
            Choose Screening Modules
          </p>
        </div>

        {/* Selection Grid */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-1 md:px-2 mb-3 md:mb-4 overflow-visible md:overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 md:gap-6 max-w-6xl mx-auto w-full items-stretch">
            {testOptions.map(opt => (
              <button
                key={opt.type}
                onClick={() => toggle(opt.type)}
                className={`group relative flex flex-col items-center justify-center p-3 sm:p-5 md:p-6 rounded-2xl md:rounded-[2.5rem] border-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 ${
                  selected.includes(opt.type) 
                  ? 'border-sky-500 bg-sky-50/80 dark:bg-cyan-500/20 shadow-lg dark:shadow-[0_0_50px_rgba(0,243,255,0.25)]' 
                  : 'border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm'
                }`}
              >
                {/* Status Indicator */}
                <div className={`absolute top-2.5 right-3 md:top-4 md:right-6 flex items-center gap-1.5 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full border transition-all ${
                  selected.includes(opt.type)
                    ? 'border-sky-500 bg-sky-100 text-sky-700 dark:border-cyan-400 dark:bg-cyan-400/20 dark:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${selected.includes(opt.type) ? 'bg-sky-500 dark:bg-cyan-400 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                    {selected.includes(opt.type) ? 'Active' : 'Standby'}
                  </span>
                </div>

                {/* Icon */}
                <span className={`text-4xl sm:text-6xl md:text-8xl lg:text-9xl mb-2 md:mb-4 transition-all duration-300 leading-none ${selected.includes(opt.type) ? 'scale-105' : 'grayscale opacity-40'}`}>
                  {opt.icon}
                </span>

                {/* Label */}
                <span className={`text-xs sm:text-sm md:text-lg lg:text-xl font-black uppercase tracking-wider text-center transition-colors duration-300 ${
                  selected.includes(opt.type) ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                }`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Action Area */}
        <div className="relative z-10 w-full max-w-4xl mx-auto shrink-0 pt-1">
          <button
            disabled={selected.length === 0}
            onClick={() => onComplete(selected)}
            className="group w-full py-3.5 sm:py-5 md:py-7 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-2xl md:rounded-[2.5rem] font-black text-sm sm:text-lg md:text-2xl uppercase tracking-wider md:tracking-[0.25em] disabled:opacity-30 disabled:grayscale transition-all transform hover:scale-[1.01] active:scale-95 relative overflow-hidden shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 cursor-pointer"
          >
            <span className="relative z-10">Initialize System</span>
            <span className="relative z-10 bg-white/20 backdrop-blur-md text-white px-3 py-0.5 md:px-5 md:py-1 rounded-xl text-xs sm:text-sm md:text-xl font-mono">
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

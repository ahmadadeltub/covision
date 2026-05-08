
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
    <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden bg-slate-950/20">
      <div className="glass w-full max-w-7xl h-full max-h-[95vh] rounded-[3rem] md:rounded-[5rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col relative overflow-hidden bg-slate-900/60 p-4 md:p-8 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-cyan-500/20 rounded-full animate-[spin_40s_linear_infinite]"></div>
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header Section */}
        <div className="relative z-10 text-center mb-4 md:mb-6 shrink-0">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-2xl">
            {t.test_selection}
          </h2>
        </div>

        {/* Selection Grid - Using flex and proportions to prevent scrolling */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-2 mb-4 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 max-w-6xl mx-auto h-full max-h-full items-stretch">
            {testOptions.map(opt => (
              <button
                key={opt.type}
                onClick={() => toggle(opt.type)}
                className={`group relative flex flex-col items-center justify-center p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] border-2 transition-all duration-500 transform hover:scale-[1.02] active:scale-95 ${
                  selected.includes(opt.type) 
                  ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_60px_rgba(0,243,255,0.3)]' 
                  : 'border-white/5 bg-black/40 hover:border-white/20 hover:bg-white/5 shadow-xl'
                }`}
              >
                {/* Status Indicator */}
                <div className={`absolute top-4 right-6 flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
                  selected.includes(opt.type) ? 'border-cyan-400 bg-cyan-400/20 opacity-100' : 'border-white/10 bg-white/5 opacity-40'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${selected.includes(opt.type) ? 'bg-cyan-400 shadow-[0_0_8px_#00f3ff] animate-pulse' : 'bg-slate-500'}`}></div>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${selected.includes(opt.type) ? 'text-white' : 'text-slate-500'}`}>
                    {selected.includes(opt.type) ? 'Active' : 'Standby'}
                  </span>
                </div>

                {/* Icon - Significantly enlarged */}
                <span className={`text-7xl md:text-9xl lg:text-[10rem] mb-2 md:mb-4 transition-all duration-500 leading-none ${selected.includes(opt.type) ? 'scale-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]' : 'grayscale opacity-30'}`}>
                  {opt.icon}
                </span>

                {/* Label */}
                <span className={`text-sm md:text-xl lg:text-2xl font-black uppercase tracking-widest text-center transition-colors duration-500 ${selected.includes(opt.type) ? 'text-white' : 'text-slate-500'}`}>
                  {opt.label}
                </span>

                {/* Hover Glow */}
                <div className="absolute inset-0 rounded-[inherit] bg-cyan-400/0 group-hover:bg-cyan-400/5 transition-colors duration-500"></div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Action Area */}
        <div className="relative z-10 w-full max-w-4xl mx-auto shrink-0">
          <button 
            disabled={selected.length === 0}
            onClick={() => onComplete(selected)}
            className="group w-full py-6 md:py-10 bg-white text-slate-950 rounded-[2.5rem] md:rounded-[3.5rem] font-black text-xl md:text-5xl uppercase tracking-[0.4em] hover:bg-cyan-400 hover:shadow-[0_0_100px_rgba(0,243,255,0.7)] disabled:opacity-20 disabled:grayscale transition-all transform hover:scale-[1.01] active:scale-95 relative overflow-hidden shadow-2xl"
          >
            <div className="relative z-10 flex items-center justify-center gap-6">
              <span>Initialize System</span>
              <span className="bg-slate-950 text-white px-6 py-1 rounded-2xl text-lg md:text-3xl font-mono">{selected.length}</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSelector;

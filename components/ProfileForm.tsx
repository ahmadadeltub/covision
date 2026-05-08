
import React, { useState } from 'react';
import { UserProfile, Language } from '../types';

interface Props {
  lang: Language;
  t: any;
  initialData?: Partial<UserProfile>;
  onComplete: (data: UserProfile) => void;
}

const ProfileForm: React.FC<Props> = ({ lang, t, initialData, onComplete }) => {
  const [age, setAge] = useState(initialData?.age || 25);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(initialData?.gender || 'male');
  const [device, setDevice] = useState<'mobile' | 'desktop'>(window.innerWidth < 768 ? 'mobile' : 'desktop');
  const [glasses, setGlasses] = useState<'none' | 'reading' | 'distance' | 'always'>(initialData?.glassesUsage || 'none');
  const [family, setFamily] = useState(false);

  return (
    <div className="glass p-10 md:p-16 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 max-w-4xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500 bg-slate-900/40 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center gap-6 border-b border-white/10 pb-8 mb-10 relative z-10">
        <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 text-3xl border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">👤</div>
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none">Profile Synchronization</h2>
          <p className="text-sm text-cyan-400/60 uppercase tracking-[0.3em] font-black mt-2">Refine Detected Biometric Data for System Calibration</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
        {/* Age Selector */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <div className="flex justify-between items-end">
            <label className="text-sm font-black text-cyan-400 uppercase tracking-widest">Neural Age Signature</label>
            <span className="text-white font-black text-5xl leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{age} <span className="text-xs text-slate-500 ml-1">YRS</span></span>
          </div>
          <div className="relative pt-2">
            <input 
              type="range" min="5" max="100" value={age} 
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full h-3 bg-slate-800 rounded-full appearance-none accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-black text-slate-600 mt-2 uppercase tracking-widest">
              <span>05</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Gender Selector */}
        <div className="space-y-4">
          <label className="text-sm font-black text-cyan-400 uppercase tracking-widest">Biological Profile</label>
          <div className="flex gap-4">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`flex-1 py-5 px-4 rounded-2xl border-2 transition-all font-black text-lg uppercase tracking-widest ${gender === g ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'border-white/5 text-slate-500 hover:border-white/20 hover:bg-white/5'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Ocular Aids */}
        <div className="space-y-4">
          <label className="text-sm font-black text-cyan-400 uppercase tracking-widest">Corrective Ocular Aids</label>
          <div className="flex gap-4">
            {(['none', 'always'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGlasses(g as any)}
                className={`flex-1 py-5 px-4 rounded-2xl border-2 transition-all font-black text-lg uppercase tracking-widest ${glasses === g ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'border-white/5 text-slate-500 hover:border-white/20 hover:bg-white/5'}`}
              >
                {g === 'none' ? 'None' : 'Active'}
              </button>
            ))}
          </div>
        </div>

        {/* Checkbox */}
        <div className="col-span-1 md:col-span-2 flex items-center gap-6 p-6 bg-cyan-950/20 rounded-3xl border border-cyan-500/20 hover:bg-cyan-900/30 transition-colors group cursor-pointer" onClick={() => setFamily(!family)}>
          <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${family ? 'bg-cyan-500 border-cyan-500' : 'bg-transparent border-white/20'}`}>
            {family && <span className="text-slate-950 font-black">✓</span>}
          </div>
          <div>
            <label className="text-white font-black text-lg uppercase tracking-tight cursor-pointer">Genetic Vision Predisposition Detected</label>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Include family history of CVD / Impairment in diagnosis</p>
          </div>
        </div>
      </div>

      <button 
        onClick={() => onComplete({ age, gender, deviceType: device, glassesUsage: glasses, symptoms: [], familyHistory: family })}
        className="w-full mt-12 py-8 bg-white text-slate-950 rounded-[2rem] font-black uppercase text-2xl tracking-[0.3em] hover:bg-cyan-400 hover:shadow-[0_0_50px_rgba(34,211,238,0.4)] transition-all transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group shadow-2xl"
      >
        <span className="relative z-10">SYNC PROFILE & INITIALIZE</span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
      </button>
    </div>
  );
};

export default ProfileForm;

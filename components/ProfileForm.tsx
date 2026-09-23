
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
  const [device] = useState<'mobile' | 'desktop'>(window.innerWidth < 768 ? 'mobile' : 'desktop');
  const [glasses, setGlasses] = useState<'none' | 'reading' | 'distance' | 'always'>(initialData?.glassesUsage || 'none');
  const [family, setFamily] = useState(false);

  React.useEffect(() => {
    if (initialData?.age) setAge(initialData.age);
    if (initialData?.gender) setGender(initialData.gender);
    if (initialData?.glassesUsage) setGlasses(initialData.glassesUsage);
  }, [initialData]);

  return (
    <div className="glass p-3 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-2xl border max-w-3xl mx-auto w-full h-full max-h-[96vh] flex flex-col justify-between overflow-hidden relative animate-in fade-in zoom-in-95 duration-500">
      {/* Background Decorative Elements */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center gap-3 sm:gap-4 border-b border-slate-200 dark:border-white/10 pb-2 sm:pb-3 mb-2 sm:mb-3 relative z-10 shrink-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center text-sky-600 dark:text-cyan-400 text-xl sm:text-2xl border border-sky-200 dark:border-cyan-500/20 shadow-sm shrink-0">👤</div>
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Patient Profile</h2>
          <p className="text-[10px] sm:text-xs text-sky-600 dark:text-cyan-400 uppercase tracking-widest font-black mt-0.5">Confirm Your Biometric Data for Clinical Accuracy</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5 relative z-10 flex-1 min-h-0">

        {/* Age Selector */}
        <div className="col-span-1 md:col-span-2 space-y-1.5">
          <div className="flex justify-between items-end">
            <label className="text-[10px] sm:text-xs font-black text-sky-700 dark:text-cyan-400 uppercase tracking-widest">Age</label>
            <span className="text-slate-900 dark:text-white font-black text-2xl sm:text-3xl md:text-4xl leading-none">{age} <span className="text-xs text-slate-500 ml-1">YRS</span></span>
          </div>
          <div className="relative pt-1">
            <input
              type="range" min="5" max="100" value={age}
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-black text-slate-500 mt-1 uppercase tracking-widest">
              <span>05</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Gender Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] sm:text-xs font-black text-sky-700 dark:text-cyan-400 uppercase tracking-widest">Gender</label>
          <div className="flex gap-2 sm:gap-3">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`flex-1 py-3 sm:py-3.5 px-3 rounded-xl sm:rounded-2xl border-2 transition-all font-black text-xs sm:text-base uppercase tracking-wider min-h-[48px] sm:min-h-[54px] flex items-center justify-center gap-2 cursor-pointer ${gender === g ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400 shadow-md' : 'border-slate-200 bg-white text-slate-600 dark:border-white/5 dark:bg-black/40 dark:text-slate-400 hover:border-slate-300'}`}
              >
                <span>{g === 'male' ? '♂ Male' : '♀ Female'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Corrective Lenses */}
        <div className="space-y-1.5">
          <label className="text-[10px] sm:text-xs font-black text-sky-700 dark:text-cyan-400 uppercase tracking-widest">Corrective Lenses</label>
          <div className="flex gap-2 sm:gap-3">
            {(['none', 'always'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGlasses(g as any)}
                className={`flex-1 py-3 sm:py-3.5 px-3 rounded-xl sm:rounded-2xl border-2 transition-all font-black text-xs sm:text-base uppercase tracking-wider min-h-[48px] sm:min-h-[54px] flex items-center justify-center gap-2 cursor-pointer ${glasses === g ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400 shadow-md' : 'border-slate-200 bg-white text-slate-600 dark:border-white/5 dark:bg-black/40 dark:text-slate-400 hover:border-slate-300'}`}
              >
                <span>{g === 'none' ? '👁 None' : '👓 Glasses'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Family History */}
        <div className="col-span-1 md:col-span-2 flex items-center gap-3 p-3 sm:p-3.5 bg-sky-50/70 dark:bg-cyan-950/20 rounded-xl sm:rounded-2xl border border-sky-200 dark:border-cyan-500/20 hover:bg-sky-100/70 transition-colors group cursor-pointer" onClick={() => setFamily(!family)}>
          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${family ? 'bg-sky-600 border-sky-600 text-white dark:bg-cyan-500 dark:border-cyan-500 dark:text-slate-950' : 'bg-white border-slate-300 dark:bg-transparent dark:border-white/20'}`}>
            {family && <span className="font-black text-xs">✓</span>}
          </div>
          <div>
            <label className="text-slate-900 dark:text-white font-black text-xs sm:text-sm uppercase tracking-tight cursor-pointer">Family History of Eye Conditions</label>
            <p className="text-slate-600 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider mt-0.5">Include in clinical diagnosis and recommendations</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          onComplete({ age, gender, deviceType: device, glassesUsage: glasses, symptoms: [], familyHistory: family });
        }}
        className="w-full mt-2 sm:mt-3 py-3.5 sm:py-4 md:py-4.5 min-h-[56px] sm:min-h-[64px] bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl sm:rounded-2xl font-black uppercase text-sm sm:text-base md:text-lg tracking-wider md:tracking-[0.18em] transition-all transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden shadow-xl hover:shadow-2xl cursor-pointer shrink-0 flex items-center justify-center"
      >
        <span className="relative z-10">CONTINUE →</span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
      </button>
    </div>
  );
};

export default ProfileForm;

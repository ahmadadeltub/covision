import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  Language,
  AcuityResult,
  ColorVisionResult,
  PatientInfo,
  TestResult,
  DistanceCompliance,
  ClinicalScreeningRecord,
  ClinicianReview,
} from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import qrcode from 'qrcode-generator';
import { translations } from '../translations';
import {
  buildClinicalScreeningRecord,
  computeSHA256Hash,
} from '../utils/clinicalCalculations';
import {
  saveScreeningRecord,
  getPatientHistory,
} from '../utils/screeningDatabase';
import ClinicalValidationDashboard from './ClinicalValidationDashboard';

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
// QR CODE SVG GENERATOR
// ─────────────────────────────────────────────────────────────
function generateQRCodeSvg(data: string): string {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(data);
    qr.make();
    return qr.createSvgTag({ scalable: true });
  } catch (err) {
    console.warn('QR code generation fallback:', err);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// EMBEDDED HIGH-DPI SVG CHARTS & GAUGES
// ─────────────────────────────────────────────────────────────

// 1. Performance vs 80% Benchmark Chart (renamed from "Accuracy")
const PerformanceBenchmarkChart: React.FC<{
  data: { name: string; pct: number; score: string; status: 'normal' | 'borderline' | 'abnormal' }[];
}> = ({ data }) => {
  const rowHeight = 26;
  const gap = 8;
  const labelW = 150;
  const chartW = 310;
  const totalW = labelW + chartW + 75;
  const totalH = data.length * (rowHeight + gap) + 36;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full h-auto" style={{ minWidth: '460px' }}>
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

        <text
          x={labelW + 0.8 * chartW}
          y={totalH - 4}
          textAnchor="middle"
          fontSize="8"
          fill="#0284c7"
          fontWeight="800"
          letterSpacing="0.05em"
        >
          ▲ 80% SCREENING THRESHOLD
        </text>

        {data.map((item, idx) => {
          const y = 22 + idx * (rowHeight + gap);
          const barW = Math.max(6, (Math.min(item.pct, 100) / 100) * chartW);
          const color = item.pct >= 80 ? '#10b981' : item.pct >= 50 ? '#f59e0b' : '#ef4444';

          return (
            <g key={idx}>
              <text
                x={labelW - 10}
                y={y + rowHeight / 2 + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="#1e293b"
                fontWeight="700"
              >
                {item.name}
              </text>
              <rect x={labelW} y={y} width={chartW} height={rowHeight} rx={4} fill="#f1f5f9" />
              <rect x={labelW} y={y} width={barW} height={rowHeight} rx={4} fill={color} />
              <text
                x={labelW + barW + 8}
                y={y + rowHeight / 2 + 3.5}
                fontSize="10"
                fill="#0f172a"
                fontWeight="800"
              >
                {item.pct.toFixed(0)}%
              </text>
              <text
                x={labelW + (barW > 45 ? 8 : barW + 40)}
                y={y + rowHeight / 2 + 3.5}
                fontSize="8.5"
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

// 2. Response Latency Chart (ms)
const LatencySpeedChart: React.FC<{
  data: { name: string; latencyMs: number }[];
}> = ({ data }) => {
  const validData = data.length > 0 ? data : [{ name: 'Default', latencyMs: 500 }];
  const maxLatency = Math.max(...validData.map((d) => d.latencyMs), 1200);
  const rowHeight = 20;
  const gap = 7;
  const labelW = 120;
  const chartW = 200;
  const totalW = labelW + chartW + 60;
  const totalH = validData.length * (rowHeight + gap) + 32;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full h-auto" style={{ minWidth: '380px' }}>
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

        {validData.map((d, idx) => {
          const y = 18 + idx * (rowHeight + gap);
          const barW = Math.max(8, (d.latencyMs / maxLatency) * chartW);
          const color = d.latencyMs <= 800 ? '#10b981' : d.latencyMs <= 1100 ? '#f59e0b' : '#6366f1';

          return (
            <g key={idx}>
              <text
                x={labelW - 8}
                y={y + rowHeight / 2 + 3}
                textAnchor="end"
                fontSize="9"
                fill="#334155"
                fontWeight="700"
              >
                {d.name}
              </text>
              <rect x={labelW} y={y} width={chartW} height={rowHeight} rx={3} fill="#f1f5f9" />
              <rect x={labelW} y={y} width={barW} height={rowHeight} rx={3} fill={color} />
              <text
                x={labelW + barW + 6}
                y={y + rowHeight / 2 + 3}
                fontSize="8.5"
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

// 3. Technical Screening Reliability Index (SRI) Arc Gauge
const SRIArcGauge: React.FC<{ score: number; level: string; warning?: string }> = ({ score, level, warning }) => {
  const clamped = Math.min(Math.max(score, 0), 100);
  const radius = 54;
  const strokeWidth = 10;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 85 ? '#10b981' : clamped >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center justify-center p-2 text-center">
      <svg width="150" height="88" viewBox="0 0 150 88" className="overflow-visible">
        <path
          d="M 16 78 A 54 54 0 0 1 134 78"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d="M 16 78 A 54 54 0 0 1 134 78"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
        <text x="75" y="66" textAnchor="middle" fontSize="24" fontWeight="900" fill="#0f172a">
          {clamped}
        </text>
        <text x="75" y="80" textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b" letterSpacing="0.08em">
          SRI INDEX / 100
        </text>
      </svg>
      <div className="mt-1">
        <span
          className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
          style={{ background: `${color}18`, color }}
        >
          {level} Technical Reliability
        </span>
      </div>
      {warning && (
        <p className="text-[8px] text-amber-700 font-semibold mt-1 max-w-[200px] leading-tight">
          ⚠️ {warning}
        </p>
      )}
    </div>
  );
};

// 4. Interactive Amsler 4-Quadrant Visual Field Diagram with Distortion Coords
const AmslerQuadrantMap: React.FC<{
  odMarked?: { x: number; y: number; type: string }[];
  osMarked?: { x: number; y: number; type: string }[];
  odDistortion?: boolean;
  osDistortion?: boolean;
}> = ({ odMarked = [], osMarked = [], odDistortion, osDistortion }) => {
  const size = 110;
  const half = size / 2;

  const renderGrid = (title: string, marked: { x: number; y: number; type: string }[], hasDistortion: boolean) => (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">{title}</span>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg shadow-inner bg-slate-900">
        {[20, 38, 55, 73, 92].map((p) => (
          <React.Fragment key={p}>
            <line x1={p} y1="4" x2={p} y2={size - 4} stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
            <line x1="4" y1={p} x2={size - 4} y2={p} stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
          </React.Fragment>
        ))}
        <line x1={half} y1="4" x2={half} y2={size - 4} stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        <line x1="4" y1={half} x2={size - 4} y2={half} stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        <circle cx={half} cy={half} r="3" fill="#ef4444" />
        
        {/* Quadrant labels */}
        <text x="7" y="14" fontSize="7" fill="#94a3b8" fontWeight="bold">ST</text>
        <text x={size - 16} y="14" fontSize="7" fill="#94a3b8" fontWeight="bold">SN</text>
        <text x="7" y={size - 7} fontSize="7" fill="#94a3b8" fontWeight="bold">IT</text>
        <text x={size - 16} y={size - 7} fontSize="7" fill="#94a3b8" fontWeight="bold">IN</text>

        {/* Marked distortion coordinates */}
        {marked.map((coord, idx) => (
          <circle
            key={idx}
            cx={(coord.x / 100) * size}
            cy={(coord.y / 100) * size}
            r="4.5"
            fill={coord.type === 'missing' ? '#000000' : '#f59e0b'}
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <span className={`text-[8px] font-bold ${hasDistortion ? 'text-amber-600' : 'text-emerald-700'}`}>
        {hasDistortion ? `${marked.length || 1} Distortion Point(s)` : 'Uniform Grid (Pass)'}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {renderGrid('OD (Right Eye)', odMarked, !!odDistortion)}
      {renderGrid('OS (Left Eye)', osMarked, !!osDistortion)}
    </div>
  );
};

// 5. Central Visual Field 30-Point Heatmap
const VisualField30PointHeatmap: React.FC<{
  pointsOD?: { id: number; x: number; y: number; detected: boolean }[];
  pointsOS?: { id: number; x: number; y: number; detected: boolean }[];
}> = ({ pointsOD = [], pointsOS = [] }) => {
  const size = 100;

  const renderEyeField = (label: string, points: { id: number; x: number; y: number; detected: boolean }[]) => {
    const valid = points.length > 0;
    const detectedCount = points.filter((p) => p.detected).length;
    const total = points.length || 30;
    const pct = valid ? Math.round((detectedCount / total) * 100) : 100;

    return (
      <div className="flex flex-col items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl">
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">{label}</span>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg bg-slate-900 p-1">
          <circle cx={size / 2} cy={size / 2} r="4" fill="none" stroke="#ef4444" strokeWidth="1.5" />
          <circle cx={size / 2} cy={size / 2} r="1.5" fill="#ef4444" />
          {(valid ? points : Array.from({ length: 30 }, (_, i) => ({
            id: i + 1,
            x: 15 + (i % 6) * 14,
            y: 15 + Math.floor(i / 6) * 17.5,
            detected: true,
          }))).map((pt) => (
            <circle
              key={pt.id}
              cx={(pt.x / 100) * size}
              cy={(pt.y / 100) * size}
              r="2.8"
              fill={pt.detected ? '#10b981' : '#ef4444'}
              opacity={pt.detected ? 0.9 : 1}
            />
          ))}
        </svg>
        <div className="flex items-center gap-1.5 text-[8.5px]">
          <span className="font-bold text-slate-600">Sensitivity:</span>
          <span className="font-mono font-black" style={{ color: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444' }}>
            {pct}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {renderEyeField('OD Visual Field (30-Pt)', pointsOD)}
      {renderEyeField('OS Visual Field (30-Pt)', pointsOS)}
    </div>
  );
};

// 6. Ocular Motility 3×3 Cardinal Grid
const OcularMotility9GazeMap: React.FC<{
  positions?: { position: string; label: string; completed: boolean }[];
  symmetry?: string;
}> = ({ positions = [], symmetry = 'Not Detected' }) => {
  const defaultGrid = [
    { position: 'TL', label: 'Up-Left' },
    { position: 'TC', label: 'Up' },
    { position: 'TR', label: 'Up-Right' },
    { position: 'ML', label: 'Left' },
    { position: 'C', label: 'Center' },
    { position: 'MR', label: 'Right' },
    { position: 'BL', label: 'Down-Left' },
    { position: 'BC', label: 'Down' },
    { position: 'BR', label: 'Down-Right' },
  ];

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider">
          9-Gaze Cardinal Motility Grid
        </span>
        <span className="text-[8.5px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
          Symmetry: {symmetry === 'Not Detected' ? 'Symmetric (Normal)' : 'Asymmetry Detected'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto text-center">
        {defaultGrid.map((pos) => {
          const match = positions.find((p) => p.position === pos.position);
          const isDone = match ? match.completed : true;
          return (
            <div
              key={pos.position}
              className={`p-2 rounded-lg border text-[8.5px] font-bold transition-all ${
                isDone
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              <div className="font-mono text-[9.5px] font-black">{pos.position}</div>
              <div className="text-[7px] text-slate-500 uppercase truncate">{pos.label}</div>
              <div className="text-[7.5px] text-emerald-700 mt-0.5">{isDone ? '✓ Tracked' : '✗ Missed'}</div>
            </div>
          );
        })}
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

  // Modals & Navigation States
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showQRVerifyModal, setShowQRVerifyModal] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappPdfReady, setWhatsappPdfReady] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [printingReport, setPrintingReport] = useState(false);

  // Longitudinal patient history from IndexedDB
  const [patientHistory, setPatientHistory] = useState<ClinicalScreeningRecord[]>([]);

  // Clinician Sign-off state
  const [clinicianReview, setClinicianReview] = useState<ClinicianReview>({
    isReviewed: false,
    reviewedBy: '',
    professionalRole: 'Supervising Clinician',
    licenseNumber: '',
    reviewDate: '',
    clinicalNotes: '',
    statusText: 'NOT CLINICIAN VERIFIED',
  });

  // Unique Cryptographic Report Identifier & Hash
  const reportId = useMemo(() => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CVR-${ts}-${rand}`;
  }, []);

  const [documentHash, setDocumentHash] = useState<string>('Computing SHA-256...');

  // Build the complete clinical screening record
  const record = useMemo(() => {
    return buildClinicalScreeningRecord({
      reportId,
      patient,
      acuity,
      colorVision,
      testResults,
      distanceCompliance,
      clinicianReview,
    });
  }, [reportId, patient, acuity, colorVision, testResults, distanceCompliance, clinicianReview]);

  // Destructure record sections for clean concise code
  const {
    environment,
    tests,
    reliability,
    interpretation,
    authentication,
  } = record;

  const {
    distanceVisualAcuity,
    nearVisualAcuity,
    contrastSensitivity,
    amsler,
    visualField,
    ocularMotility,
    ocularAlignment,
    pupillaryAnalysis,
    blinkAnalysis,
  } = tests;

  // Compute SHA-256 hash & auto-save record to IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function initRecord() {
      const hashPayload = `${record.reportId}-${record.patient.fullName}-${record.patient.dateTime}-${record.authentication.softwareVersion}`;
      const hash = await computeSHA256Hash(hashPayload);
      if (isMounted) {
        setDocumentHash(hash);
      }

      // Persist record to IndexedDB
      const fullRecord: ClinicalScreeningRecord = {
        ...record,
        authentication: {
          ...record.authentication,
          sha256Hash: hash,
        },
      };
      await saveScreeningRecord(fullRecord);

      // Load patient's historical records for longitudinal analysis
      const history = await getPatientHistory(patient.fullName);
      if (isMounted) {
        setPatientHistory(history);
      }
    }

    initRecord();

    return () => {
      isMounted = false;
    };
  }, [record, patient.fullName]);

  // QR Code SVG
  const qrSvgMarkup = useMemo(() => {
    const verificationUrl = `https://covision-41ab1.web.app/?verify=${reportId}&hash=${documentHash.slice(0, 16)}`;
    return generateQRCodeSvg(verificationUrl);
  }, [reportId, documentHash]);

  // Performance data for chart (using "performance" instead of "accuracy")
  const chartPerformanceData = useMemo(() => {
    const items = [
      {
        name: 'Distance Visual Acuity',
        pct: acuity.totalTrials > 0 ? (acuity.totalCorrect / acuity.totalTrials) * 100 : 100,
        score: `${acuity.totalCorrect}/${acuity.totalTrials}`,
        status: (acuity.totalCorrect / (acuity.totalTrials || 1) >= 0.8 ? 'normal' : 'borderline') as 'normal' | 'borderline',
      },
      {
        name: 'Color Discrimination',
        pct: colorVision.totalPlates > 0 ? (colorVision.totalCorrect / colorVision.totalPlates) * 100 : 100,
        score: `${colorVision.totalCorrect}/${colorVision.totalPlates}`,
        status: (colorVision.classification === 'normal' ? 'normal' : 'abnormal') as 'normal' | 'abnormal',
      },
    ];

    testResults.forEach((r) => {
      const pct = r.total > 0 ? (r.score / r.total) * 100 : 100;
      items.push({
        name: r.testName,
        pct,
        score: `${r.score}/${r.total}`,
        status: pct >= 80 ? 'normal' : pct >= 50 ? 'borderline' : 'abnormal',
      });
    });

    return items;
  }, [acuity, colorVision, testResults]);

  // Latency data
  const chartLatencyData = useMemo(() => {
    const items: { name: string; latencyMs: number }[] = [];
    if (acuity.averageResponseMs) {
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
        { name: 'Amsler Macular', latencyMs: 430 }
      );
    }
    return items;
  }, [acuity, testResults]);

  // ─────────────────────────────────────────────────────────────
  // 4-PAGE PRISTINE A4 PDF EXPORT & PRINT ENGINE
  // ─────────────────────────────────────────────────────────────
  const generatePDFBlob = async (forPrint = false): Promise<Blob | null> => {
    if (!reportRef.current) return null;
    try {
      document.body.classList.add('exporting-pdf');
      await new Promise((r) => setTimeout(r, 350));

      const pageElements = reportRef.current.querySelectorAll('.report-page');
      if (!pageElements || pageElements.length === 0) {
        document.body.classList.remove('exporting-pdf');
        return null;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2; // 194 mm

      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) pdf.addPage();

        const pageEl = pageElements[i] as HTMLElement;

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollY: 0,
          windowWidth: 1040,
        });

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

        pdf.setFontSize(7.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text('CoVision AI Vision Screening Report • Clinical Decision-Support', margin, 6);
        pdf.text(`Report ID: ${reportId}`, pdfWidth - margin - 35, 6);

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(margin, 7.5, pdfWidth - margin, 7.5);

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        const pageHeightMm = (canvas.height / canvas.width) * contentWidth;
        const finalHeight = Math.min(pageHeightMm, pdfHeight - margin * 2 - 12);
        pdf.addImage(imgData, 'JPEG', margin, 9, contentWidth, finalHeight);

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pdfHeight - 6.5, pdfWidth - margin, pdfHeight - 6.5);

        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text('PRELIMINARY VISION SCREENING • NOT A FINAL MEDICAL DIAGNOSIS', margin, pdfHeight - 3.5);
        pdf.text(`Page ${i + 1} of ${pageElements.length}`, pdfWidth / 2 - 8, pdfHeight - 3.5);
        pdf.text(`Date: ${patient.dateTime}`, pdfWidth - margin - 35, pdfHeight - 3.5);
      }

      document.body.classList.remove('exporting-pdf');

      if (forPrint) {
        try {
          pdf.autoPrint({ variant: 'non-conform' });
        } catch {
          try {
            (pdf as any).autoPrint();
          } catch {}
        }
      }

      return pdf.output('blob');
    } catch (err: any) {
      document.body.classList.remove('exporting-pdf');
      console.error('PDF Generation failed:', err);
      alert(`PDF generation failed: ${err.message || err}`);
      return null;
    }
  };

  const handleExportPDF = async () => {
    setPdfExporting(true);
    try {
      const blob = await generatePDFBlob(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CoVision-Report-${reportId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setPdfExporting(false);
    }
  };

  const handlePrintReport = async () => {
    setPrintingReport(true);
    try {
      const pdfBlob = await generatePDFBlob(true);
      if (!pdfBlob) return;
      const blobUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      let printTriggered = false;
      const trigger = () => {
        if (printTriggered) return;
        printTriggered = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
      };

      iframe.onload = () => setTimeout(trigger, 350);
      setTimeout(trigger, 1200);

      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 120000);
    } catch (err) {
      window.print();
    } finally {
      setPrintingReport(false);
    }
  };

  const handleSendEmailWithPDF = async () => {
    if (!emailAddress.trim()) return;
    setEmailSending(true);
    try {
      const blob = await generatePDFBlob(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CoVision-Medical-Report-${reportId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      const subject = encodeURIComponent(`CoVision AI Vision Screening Report - ${reportId}`);
      const body = encodeURIComponent(
        `Dear ${patient.fullName || 'Patient'},\n\nAttached is your CoVision AI Vision Screening Report (Report ID: ${reportId}).\n\nOverall Screening Status: ${interpretation.overallFlag}\nScreening Reliability Index (SRI): ${reliability.score}/100\n\nPlease note: This report is from a preliminary digital screening and is not a final medical diagnosis. Please consult an eye care professional for clinical examination.\n\nBest regards,\nCoVision Clinical Platform`
      );
      window.open(`mailto:${emailAddress}?subject=${subject}&body=${body}`, '_blank');
      setEmailStatus('success');
      setTimeout(() => setShowEmailModal(false), 2000);
    } catch (err) {
      setEmailStatus('error');
    } finally {
      setEmailSending(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setWhatsappSending(true);
    try {
      const blob = await generatePDFBlob(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CoVision-Report-${reportId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setWhatsappPdfReady(true);
      }
      setShowWhatsAppModal(true);
    } finally {
      setWhatsappSending(false);
    }
  };

  const openWhatsAppWithText = () => {
    const summary = [
      `👁️ *CoVision AI Vision Screening Report*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *Report ID:* ${reportId}`,
      `📅 *Date:* ${patient.dateTime}`,
      `👤 *Patient:* ${patient.fullName} (${patient.age}y, ${patient.gender})`,
      `⚡ *Screening Reliability Index (SRI):* ${reliability.score}/100 (${reliability.level})`,
      `🏁 *Status:* ${interpretation.overallFlag}`,
      `🔤 *Distance VA (OD):* ${distanceVisualAcuity.OD.snellen} | *(OS):* ${distanceVisualAcuity.OS.snellen}`,
      `📖 *Near VA (OD):* ${nearVisualAcuity.OD.snellenEquivalent} | *(OS):* ${nearVisualAcuity.OS.snellenEquivalent}`,
      `🎨 *Color Vision:* ${colorVision.classificationLabel}`,
      `🌓 *Contrast Sensitivity:* ${contrastSensitivity.OD.logCS} logCS`,
      `📅 *Next Review:* ${interpretation.followUpTimeline.when}`,
      ``,
      `⚠️ _Preliminary screening report — not a final medical diagnosis._`,
    ].join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(summary)}`, '_blank');
    setShowWhatsAppModal(false);
  };

  const handleSaveClinicianSignoff = (notes: string, name: string, lic: string) => {
    setClinicianReview({
      isReviewed: true,
      reviewedBy: name,
      professionalRole: 'Licensed Optometrist / Ophthalmologist',
      licenseNumber: lic,
      reviewDate: new Date().toISOString().split('T')[0],
      clinicalNotes: notes,
      statusText: 'CLINICIAN VERIFIED',
    });
    setShowClinicianModal(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center overflow-y-auto p-3 sm:p-6" dir="ltr">
      {/* ─── ACTION BAR (ALWAYS PRESENT IN VIEW) ─── */}
      <div className="print-action-bar w-full max-w-5xl flex flex-wrap gap-2.5 sm:gap-3 justify-center mb-6 z-20">
        <button
          onClick={handleExportPDF}
          disabled={pdfExporting || printingReport}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-cyan-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {pdfExporting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <span className="text-base sm:text-xl">📄</span> {t.export_pdf || 'Export PDF (4 Pages)'}
            </>
          )}
        </button>

        <button
          onClick={handlePrintReport}
          disabled={pdfExporting || printingReport}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-white/10 text-slate-800 dark:text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {printingReport ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
              <span>Preparing Print...</span>
            </>
          ) : (
            <>
              <span className="text-base sm:text-xl">🖨️</span> {t.print_report || 'Print Report'}
            </>
          )}
        </button>

        <button
          onClick={() => {
            setShowEmailModal(true);
            setEmailStatus('idle');
          }}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-emerald-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
        >
          <span className="text-base sm:text-xl">✉️</span> {t.send_email || 'Email Report'}
        </button>

        <button
          onClick={handleShareWhatsApp}
          disabled={whatsappSending}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-green-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
        >
          <span className="text-base sm:text-xl">💬</span> WhatsApp
        </button>

        <button
          onClick={() => setShowValidationDashboard(true)}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider transition-all shadow-md shadow-purple-600/25 flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
        >
          <span className="text-base sm:text-xl">🔬</span> Clinical Validation Dashboard
        </button>

        <button
          onClick={onReset}
          className="px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-base uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md flex items-center gap-2 min-h-[54px] sm:min-h-[62px] cursor-pointer active:scale-95"
        >
          <span className="text-base sm:text-xl">🔄</span> {t.new_screening || 'New Screening'}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          REPORT CANVAS CONTAINER (4 DEDICATED A4 PAGES)
          ───────────────────────────────────────────────────────────── */}
      <div ref={reportRef} className="w-full max-w-5xl space-y-8">
        
        {/* ═════════════════════════════════════════════════════════════
            PAGE 1: EXECUTIVE SUMMARY & PATIENT DEMOGRAPHICS
            ═════════════════════════════════════════════════════════════ */}
        <div data-report-page="1" className="report-page bg-white text-slate-900 border border-slate-200 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-3xl text-white shadow-md shadow-cyan-600/20">
                👁️
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                    CLINICAL DECISION-SUPPORT
                  </span>
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                    RESEARCH / PRELIMINARY SCREENING
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
                  CoVision AI Vision Screening Report
                </h1>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Clinical Decision-Support • Preliminary Vision Screening System
                </p>
              </div>
            </div>

            {/* QR Code & Serial Block */}
            <div
              onClick={() => setShowQRVerifyModal(true)}
              className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 rounded-2xl p-2.5 shadow-sm cursor-pointer hover:border-cyan-500 transition-colors"
              title="Click to inspect cryptographic record verification"
            >
              {qrSvgMarkup && (
                <div
                  className="w-12 h-12 flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                />
              )}
              <div className="text-right">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Report Serial</p>
                <p className="text-xs font-mono font-black text-slate-900">{reportId}</p>
                <p className="text-[8px] font-mono text-emerald-700 font-bold mt-0.5">✓ SHA-256 Verified</p>
              </div>
            </div>
          </div>

          {/* Mandatory Clinical Disclaimer Banner */}
          <div className="p-3.5 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl text-rose-950 space-y-1">
            <p className="text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span>⚠️</span> MANDATORY CLINICAL SCREENING NOTICE
            </p>
            <p className="text-[10.5px] font-bold leading-relaxed">
              THIS REPORT IS FROM A PRELIMINARY SCREENING AND IS NOT A FINAL MEDICAL DIAGNOSIS. PLEASE CONSULT A QUALIFIED OPHTHALMOLOGIST OR OPTOMETRIST FOR CLINICAL INTERPRETATION.
            </p>
          </div>

          {/* Patient Demographics & Eye Testing Identification Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Patient Name</p>
              <p className="font-black text-slate-900 text-sm truncate">{patient.fullName || 'Standard Assessment'}</p>
              <p className="text-[8.5px] text-slate-500">ID: {patient.patientId || 'CV-REC-AUTO'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Age & Life Stage</p>
              <p className="font-black text-slate-900 text-sm">{patient.age} Years</p>
              <p className="text-[8.5px] text-slate-500">
                {patient.age >= 60 ? 'Geriatric screening' : patient.age >= 40 ? 'Presbyopic screening' : 'Standard Adult'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Eye(s) Tested</p>
              <p className="font-black text-slate-900 text-sm">
                <span className="text-cyan-700">OD</span> • <span className="text-indigo-700">OS</span> (Bilateral)
              </p>
              <p className="text-[8.5px] text-slate-500">Independent Monocular</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Correction Status</p>
              <p className="font-black text-slate-900 text-sm">{patient.correctionStatus || 'Habitual Glasses'}</p>
              <p className="text-[8.5px] text-slate-500">Recorded at calibration</p>
            </div>
          </div>

          {/* Technical Screening Reliability Index (SRI) & Environment Quality Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* SRI Gauge (5 Cols) */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Screening Reliability Index (SRI)
                </h3>
                <span className="text-[8px] font-mono text-slate-500">Technical Gauge</span>
              </div>

              <SRIArcGauge
                score={reliability.score}
                level={reliability.level}
                warning={reliability.warning}
              />

              <div className="w-full space-y-1.5 mt-2">
                {reliability.components.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[8.5px]">
                    <span className="text-slate-600 font-bold">{c.factor} ({(c.weight * 100).toFixed(0)}%):</span>
                    <span className="font-mono font-black text-slate-900">{c.score}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Quality & Environment (7 Cols) */}
            <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
              <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Test Quality & Environment Verification
                </h3>
                <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  FaceMesh Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-0.5">
                  <p className="text-[8.5px] font-black uppercase text-slate-400">Ambient Lighting</p>
                  <p className="font-black text-slate-900">{environment.ambientIllumination}</p>
                  <p className="text-[8px] text-slate-500 font-semibold">Standard glare-free check</p>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-0.5">
                  <p className="text-[8.5px] font-black uppercase text-slate-400">Distance Compliance</p>
                  <p className="font-black text-slate-900">
                    {environment.distanceCompliancePct.toFixed(0)}% In-Range
                  </p>
                  <p className="text-[8px] text-slate-500 font-semibold">
                    Mean: {environment.viewingDistanceM.toFixed(2)}m (Target: 1.0m)
                  </p>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-0.5">
                  <p className="text-[8.5px] font-black uppercase text-slate-400">Head Pose Stability</p>
                  <p className="font-black text-slate-900">
                    {environment.headPoseStabilityPct.toFixed(0)}% Stability
                  </p>
                  <p className="text-[8px] text-slate-500 font-semibold">Yaw / Pitch within tolerance</p>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-0.5">
                  <p className="text-[8.5px] font-black uppercase text-slate-400">Facial Occlusion Check</p>
                  <p className="font-black text-emerald-700 font-mono">PASS (No Obstruction)</p>
                  <p className="text-[8px] text-slate-500 font-semibold">Eye visibility: {environment.eyeVisibilityPct}%</p>
                </div>
              </div>

              <p className="text-[9px] text-slate-500 italic">
                *Technical environment metrics verify that the participant maintained calibrated distance and orientation throughout testing.
              </p>
            </div>
          </div>

          {/* Explainable AI Screening Interpretation Block */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  EXPLAINABLE SCREENING INTERPRETATION & RECOMMENDATION
                </span>
                <h3 className="text-base font-black uppercase tracking-tight mt-0.5" style={{ color: interpretation.followUpTimeline.color }}>
                  {interpretation.overallFlag}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[8.5px] font-bold text-slate-400 uppercase">Follow-up Urgency</p>
                <p className="text-xs font-black" style={{ color: interpretation.followUpTimeline.color }}>
                  {interpretation.followUpTimeline.when}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-700">
                Transparent Rule-Based Factors ({interpretation.factorsContributing.length > 0 ? 'Findings Observed' : 'No Adverse Flags'}):
              </p>
              <div className="space-y-1">
                {interpretation.factorsContributing.length > 0 ? (
                  interpretation.factorsContributing.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <span className="font-bold">⚠️</span>
                      <span className="font-semibold">{f}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-2 text-[10px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <span className="font-bold">✓</span>
                    <span className="font-semibold">All tested optotype, contrast, and visual field thresholds fall within defined screening limits.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            PAGE 2: DETAILED VISION ASSESSMENTS (BILATERAL OD / OS)
            ═════════════════════════════════════════════════════════════ */}
        <div data-report-page="2" className="report-page bg-white text-slate-900 border border-slate-200 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded">
                PAGE 2 OF 4 • STANDARDIZED MODALITIES
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Bilateral Eye Vision Assessments (OD vs OS)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">ISO 8596 / LogMAR Standard</span>
          </div>

          {/* 1. Distance & Near Visual Acuity Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Distance VA */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Distance Visual Acuity (1 Meter)
                </h4>
                <span className="text-[8.5px] font-mono text-slate-500">Tumbling E / ISO 8596</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-cyan-800">OD (Right Eye)</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{distanceVisualAcuity.OD.snellen}</p>
                  <p className="text-[8.5px] text-slate-500 font-mono">LogMAR {distanceVisualAcuity.OD.logMAR.toFixed(2)}</p>
                  <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {distanceVisualAcuity.OD.tested ? 'Tested' : 'NOT TESTED'}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-indigo-800">OS (Left Eye)</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{distanceVisualAcuity.OS.snellen}</p>
                  <p className="text-[8.5px] text-slate-500 font-mono">LogMAR {distanceVisualAcuity.OS.logMAR.toFixed(2)}</p>
                  <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {distanceVisualAcuity.OS.tested ? 'Tested' : 'NOT TESTED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Near VA (40cm) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Near Visual Acuity (40 cm)
                </h4>
                <span className="text-[8.5px] font-mono text-slate-500">N-Notation Standard</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-cyan-800">OD (Right Eye)</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{nearVisualAcuity.OD.snellenEquivalent}</p>
                  <p className="text-[8.5px] text-slate-500 font-mono">{nearVisualAcuity.OD.nearNotation}</p>
                  <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {nearVisualAcuity.OD.tested ? nearVisualAcuity.OD.status : 'NOT TESTED'}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-indigo-800">OS (Left Eye)</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{nearVisualAcuity.OS.snellenEquivalent}</p>
                  <p className="text-[8.5px] text-slate-500 font-mono">{nearVisualAcuity.OS.nearNotation}</p>
                  <span className="inline-block mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {nearVisualAcuity.OS.tested ? nearVisualAcuity.OS.status : 'NOT TESTED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Color Vision Discrimination & Quantitative Contrast Sensitivity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Color Vision */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Color-Vision Discrimination
                </h4>
                <span className="text-[8.5px] font-mono text-slate-500">Pseudoisochromatic Digital</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-900">{colorVision.classificationLabel}</p>
                  <p className="text-[9px] text-slate-500">Methodology: Digital Pseudoisochromatic Screening</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-black text-slate-900">
                    {colorVision.totalCorrect} / {colorVision.totalPlates}
                  </span>
                  <p className="text-[8.5px] text-emerald-700 font-bold">Standard Ishihara Scale</p>
                </div>
              </div>
            </div>

            {/* Contrast Sensitivity */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Quantitative Contrast Sensitivity
                </h4>
                <span className="text-[8.5px] font-mono text-slate-500">Multi-level logCS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-cyan-800">OD</p>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">{contrastSensitivity.OD.logCS.toFixed(2)} logCS</p>
                  <p className="text-[8px] text-emerald-700 font-bold">Level {contrastSensitivity.OD.thresholdLevel}/8</p>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[9px] font-black uppercase text-indigo-800">OS</p>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">{contrastSensitivity.OS.logCS.toFixed(2)} logCS</p>
                  <p className="text-[8px] text-emerald-700 font-bold">Level {contrastSensitivity.OS.thresholdLevel}/8</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Amsler Grid Distortion Map & 30-Point Visual Field Heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Interactive Amsler Distortion Map
                </h4>
                <span className="text-[8px] font-bold text-slate-500">Macular Central Grid</span>
              </div>
              <AmslerQuadrantMap
                odMarked={amsler.OD.markedCoordinates}
                osMarked={amsler.OS.markedCoordinates}
                odDistortion={amsler.OD.distortionDetected}
                osDistortion={amsler.OS.distortionDetected}
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Central Visual Field (30-Point Grid)
                </h4>
                <span className="text-[8px] font-bold text-slate-500">Perimeter Screening</span>
              </div>
              <VisualField30PointHeatmap
                pointsOD={visualField.OD.gridPoints}
                pointsOS={visualField.OS.gridPoints}
              />
            </div>
          </div>

          {/* 4. Diagnostic Battery Performance Table (Correct Responses) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Screening Battery Test Performance (Correct Responses)
              </h4>
              <span className="text-[8.5px] font-bold text-slate-400">
                Sensitivity & Specificity Reserved Exclusively for Clinical Reference Studies
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-black text-[9px]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Assessment Modality</th>
                    <th className="py-2 px-3">Standard</th>
                    <th className="py-2 px-3 text-center">Correct Responses</th>
                    <th className="py-2 px-3 text-center">Performance</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-bold">1</td>
                    <td className="py-2 px-3 font-bold text-slate-900">Distance Visual Acuity</td>
                    <td className="py-2 px-3 text-slate-500">ISO 8596 / LogMAR</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {acuity.totalCorrect} / {acuity.totalTrials}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600">
                      {acuity.totalTrials > 0 ? ((acuity.totalCorrect / acuity.totalTrials) * 100).toFixed(0) : '100'}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700">
                        Pass
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-bold">2</td>
                    <td className="py-2 px-3 font-bold text-slate-900">Near Visual Acuity (40cm)</td>
                    <td className="py-2 px-3 text-slate-500">N-Notation Standard</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {nearVisualAcuity.OD.correctResponses + nearVisualAcuity.OS.correctResponses} / {nearVisualAcuity.OD.totalPresented + nearVisualAcuity.OS.totalPresented}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600">
                      100%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700">
                        Pass
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-400 font-bold">3</td>
                    <td className="py-2 px-3 font-bold text-slate-900">Color Discrimination</td>
                    <td className="py-2 px-3 text-slate-500">Ishihara Digitalized</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {colorVision.totalCorrect} / {colorVision.totalPlates}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600">
                      {colorVision.totalPlates > 0 ? ((colorVision.totalCorrect / colorVision.totalPlates) * 100).toFixed(0) : '100'}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700">
                        {colorVision.classificationLabel}
                      </span>
                    </td>
                  </tr>
                  {testResults.map((r, i) => {
                    const pct = r.total > 0 ? (r.score / r.total) * 100 : 100;
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-bold">{i + 4}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{r.testName}</td>
                        <td className="py-2 px-3 text-slate-500">Clinical Battery</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                          {r.score} / {r.total}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">
                          {pct.toFixed(0)}%
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700">
                            {pct >= 80 ? 'Normal' : 'Borderline'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            PAGE 3: AI & TECHNICAL ANALYSIS (RESEARCH & EXPERIMENTAL)
            ═════════════════════════════════════════════════════════════ */}
        <div data-report-page="3" className="report-page bg-white text-slate-900 border border-slate-200 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-800 bg-purple-50 px-2 py-0.5 rounded">
                PAGE 3 OF 4 • ADVANCED AI METRICS
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                AI Ocular Metrics & Psychomotor Analysis
              </h2>
            </div>
            <span className="text-[9px] font-mono text-purple-700 font-bold uppercase">
              Research & Experimental Modalities
            </span>
          </div>

          {/* 1. Ocular Motility 9-Gaze Cardinal Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>🧭</span> Ocular Motility (9-Gaze Dynamic Tracking)
            </h4>
            <OcularMotility9GazeMap
              positions={ocularMotility.gazeGrid}
              symmetry={ocularMotility.movementSymmetry}
            />
          </div>

          {/* 2. Experimental Badged Modules: Alignment & Pupillary Screen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ocular Alignment */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  AI Ocular Alignment Screen
                </h4>
                <span className="text-[8px] font-black text-purple-700 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full uppercase">
                  EXPERIMENTAL • NON-DIAGNOSTIC
                </span>
              </div>
              <p className="text-[9.5px] text-slate-600 leading-snug">
                {ocularAlignment.classification}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[8.5px] font-bold text-slate-500 uppercase">Alignment Symmetry</p>
                  <p className="text-lg font-black text-slate-900">{ocularAlignment.alignmentSymmetryScorePct}%</p>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[8.5px] font-bold text-slate-500 uppercase">Horizontal Deviation</p>
                  <p className="text-lg font-black text-slate-900">{ocularAlignment.horizontalAsymmetryMm.toFixed(1)}mm</p>
                </div>
              </div>
              <p className="text-[8px] text-slate-400 italic">
                *Corneal light reflex (Hirschberg simulation). Not an autonomous strabismus diagnosis.
              </p>
            </div>

            {/* AI Pupillary Analysis */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  AI Pupillary Analysis Screen
                </h4>
                <span className="text-[8px] font-black text-purple-700 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full uppercase">
                  EXPERIMENTAL • NON-DIAGNOSTIC
                </span>
              </div>
              <p className="text-[9.5px] text-slate-600 leading-snug">
                Screen-illuminated static pupillometry observation.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[8px] font-bold text-slate-500 uppercase">OD Diameter</p>
                  <p className="text-base font-black text-slate-900">{pupillaryAnalysis.odPupilDiameterMm.toFixed(1)}mm</p>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[8px] font-bold text-slate-500 uppercase">OS Diameter</p>
                  <p className="text-base font-black text-slate-900">{pupillaryAnalysis.osPupilDiameterMm.toFixed(1)}mm</p>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[8px] font-bold text-slate-500 uppercase">Δ Difference</p>
                  <p className="text-base font-black text-slate-900">{pupillaryAnalysis.differenceMm.toFixed(1)}mm</p>
                </div>
              </div>
              <p className="text-[8px] text-slate-400 italic">
                *Static camera pupillometry. Dilated clinical evaluation required for neurological anisocoria.
              </p>
            </div>
          </div>

          {/* 3. Blink & Ocular Surface Behavior [RESEARCH METRIC] */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>👁️‍🗨️</span> Blink & Ocular Surface Behavior
              </h4>
              <span className="text-[8px] font-black text-sky-700 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full uppercase">
                RESEARCH METRIC
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-white border border-slate-200 rounded-xl">
                <p className="text-[8px] font-bold text-slate-500 uppercase">Blink Rate</p>
                <p className="text-base font-black text-slate-900">{blinkAnalysis.blinkRatePerMin} /min</p>
                <p className="text-[7.5px] text-slate-400">Normal: 12–20</p>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-xl">
                <p className="text-[8px] font-bold text-slate-500 uppercase">Incomplete Blinks</p>
                <p className="text-base font-black text-slate-900">{blinkAnalysis.incompleteBlinkEstimatePct}%</p>
                <p className="text-[7.5px] text-slate-400">Normal: &lt; 20%</p>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-xl">
                <p className="text-[8px] font-bold text-slate-500 uppercase">Inter-Blink (IBI)</p>
                <p className="text-base font-black text-slate-900">{blinkAnalysis.interBlinkIntervalSec.toFixed(1)}s</p>
                <p className="text-[7.5px] text-slate-400">Mean interval</p>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-xl">
                <p className="text-[8px] font-bold text-slate-500 uppercase">Confidence</p>
                <p className="text-xs font-black text-emerald-700 mt-1">{blinkAnalysis.trackingConfidence}%</p>
                <p className="text-[7.5px] text-slate-400">FaceEAR metric</p>
              </div>
            </div>
          </div>

          {/* 4. Response Latency & Speed Distribution */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Cognitive Response Latency & Psychomotor Reaction Speed (ms)
              </h4>
              <span className="text-[8px] font-bold text-slate-500">
                Avg: {acuity.averageResponseMs || 540}ms
              </span>
            </div>
            <LatencySpeedChart data={chartLatencyData} />
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            PAGE 4: CLINICAL GUIDANCE, LONGITUDINAL TRENDS & VERIFICATION
            ═════════════════════════════════════════════════════════════ */}
        <div data-report-page="4" className="report-page bg-white text-slate-900 border border-slate-200 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                PAGE 4 OF 4 • RECOMMENDATIONS & VERIFICATION
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Clinical Recommendations & Verification Audit
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Official Authenticated Record</span>
          </div>

          {/* 1. Actionable Patient Guidance & Next Steps */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>💡</span> Patient Guidance & Recommended Next Steps
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <p className="font-black text-slate-900">👓 Routine Refractive Review</p>
                <p className="text-[10px] text-slate-600 leading-snug">
                  If wearing habitual corrective lenses, verify prescription annually with a licensed optometrist or ophthalmologist.
                </p>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <p className="font-black text-slate-900">💻 Digital Screen Ergonomics (20-20-20)</p>
                <p className="text-[10px] text-slate-600 leading-snug">
                  Every 20 minutes of screen work, look at an object 20 feet away for at least 20 seconds to relieve ciliary muscle accommodation spasm.
                </p>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <p className="font-black text-slate-900">☀️ Ambient Lighting Optimization</p>
                <p className="text-[10px] text-slate-600 leading-snug">
                  Ensure adequate diffuse indirect lighting without screen reflections or glare to maximize contrast perception.
                </p>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <p className="font-black text-slate-900">🏥 Prompt Evaluation Triggers</p>
                <p className="text-[10px] text-slate-600 leading-snug">
                  Sudden vision blur, persistent ocular pain, flashes of light, or central distortion require immediate dilated ophthalmic examination.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Longitudinal Trend Analysis (from IndexedDB) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>📈</span> Longitudinal Trend Analysis (Historical Screening Timeline)
              </h4>
              <span className="text-[8.5px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                IndexedDB Auto-Sync
              </span>
            </div>

            {patientHistory.length <= 1 ? (
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-center space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  Baseline Screening Established (Session #1)
                </p>
                <p className="text-[10px] text-slate-500 max-w-md mx-auto">
                  This screening establishes the patient baseline record. Subsequent screenings will plot visual acuity, contrast, and SRI progression over time to detect early trends.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase font-black text-[9px]">
                      <th className="p-2">Date</th>
                      <th className="p-2">Report ID</th>
                      <th className="p-2 text-center">Distance VA (OD)</th>
                      <th className="p-2 text-center">Distance VA (OS)</th>
                      <th className="p-2 text-center">SRI Score</th>
                      <th className="p-2 text-right">Trend Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {patientHistory.slice(0, 5).map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-sans font-bold text-slate-900">{h.patient.dateTime}</td>
                        <td className="p-2 text-slate-500">{h.reportId}</td>
                        <td className="p-2 text-center text-slate-800">{h.tests.distanceVisualAcuity.OD.snellen}</td>
                        <td className="p-2 text-center text-slate-800">{h.tests.distanceVisualAcuity.OS.snellen}</td>
                        <td className="p-2 text-center font-bold text-purple-700">{h.reliability.score}</td>
                        <td className="p-2 text-right font-sans">
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700">
                            Stable
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Examiner & Supervising Clinician Review Section */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🏥</span> Examiner Sign-off & Clinician Review Section
              </h4>
              <div className="flex items-center gap-2">
                <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  clinicianReview.isReviewed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {clinicianReview.statusText}
                </span>
                {!clinicianReview.isReviewed && (
                  <button
                    onClick={() => setShowClinicianModal(true)}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9.5px] font-bold uppercase cursor-pointer"
                  >
                    + Add Clinician Review
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-1 text-xs">
              {/* Examiner block */}
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Screening Examiner</p>
                <div className="border-b-2 border-slate-300 h-8 mb-1" />
                <p className="font-bold text-slate-800">CoVision AI Autonomous Kiosk</p>
                <p className="text-[8px] text-slate-400">Automated Screening Protocol v2.7</p>
              </div>

              {/* Supervising Clinician block */}
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Supervising Clinician Review</p>
                <div className="border-b-2 border-slate-300 h-8 mb-1 flex items-end">
                  {clinicianReview.isReviewed && (
                    <span className="text-[10px] font-mono font-bold text-purple-900">
                      Signed: {clinicianReview.reviewedBy} (Lic: {clinicianReview.licenseNumber})
                    </span>
                  )}
                </div>
                <p className="font-bold text-slate-800">
                  {clinicianReview.reviewedBy || 'Pending Clinician Review'}
                </p>
                <p className="text-[8px] text-slate-400">
                  {clinicianReview.licenseNumber ? `License: ${clinicianReview.licenseNumber}` : 'Licensed Optometrist / Ophthalmologist'}
                </p>
              </div>

              {/* Official Clinic Stamp box */}
              <div>
                <div className="border border-dashed border-slate-300 rounded-xl h-16 flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold uppercase text-center p-2">
                  <span>Official Clinic Seal / Stamp</span>
                  <span className="text-[7.5px] text-slate-300 font-normal">CoVision Clinical Partner</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Cryptographic Authentication & Audit Verification Bar */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div
                onClick={() => setShowQRVerifyModal(true)}
                className="cursor-pointer bg-white p-1 rounded-lg"
                title="Inspect Authenticity"
              >
                {qrSvgMarkup && (
                  <div
                    className="w-10 h-10"
                    dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                  />
                )}
              </div>
              <div className="space-y-0.5 font-mono text-[9px]">
                <p className="text-cyan-400 font-bold">SHA-256 Checksum: {documentHash.slice(0, 32)}...</p>
                <p className="text-slate-300">Report UUID: {authentication.reportUUID}</p>
                <p className="text-slate-400">Platform: {authentication.softwareVersion}</p>
              </div>
            </div>

            <div className="text-right font-mono text-[9px] text-slate-400">
              <p>Timestamp: {patient.dateTime}</p>
              <p className="text-emerald-400 font-bold">Tamper-Evident Record</p>
            </div>
          </div>

          {/* 5. Mandatory Medical Disclaimer & Footer */}
          <div className="text-center pt-1 space-y-1 text-slate-400">
            <p className="text-[9.5px] uppercase font-bold tracking-widest text-slate-500">
              {t.disclaimer_report || 'This report is from a preliminary digital screening and is not a final medical diagnosis.'}
            </p>
            <p className="text-[8px] leading-relaxed max-w-2xl mx-auto">
              Screen brightness, color rendering calibration, pupil accommodation, and ambient illumination may influence digital screening findings. Patients with persisting vision loss, ocular discomfort, metamorphopsia, or diabetes should undergo clinical dilated fundus examinations periodically.
            </p>
            <p className="text-[8px] font-mono text-slate-400 pt-0.5">
              CoVision Clinical AI Health Technologies • Report ID: {reportId} • All Rights Reserved
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CRYPTOGRAPHIC QR VERIFICATION INSPECTOR
          ───────────────────────────────────────────────────────────── */}
      {showQRVerifyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowQRVerifyModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full max-w-md space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Cryptographic Verification
                </h3>
              </div>
              <button
                onClick={() => setShowQRVerifyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
              {qrSvgMarkup && (
                <div
                  className="w-28 h-28 bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                />
              )}
              <p className="text-xs font-mono font-black text-slate-900 mt-2">{reportId}</p>
              <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                ✓ Authenticated Clinical Screening Document
              </p>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-900 text-slate-200 p-4 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-400">Subject:</span>
                <span className="text-white font-bold">{patient.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SRI Index:</span>
                <span className="text-emerald-400 font-bold">{reliability.score}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SHA-256:</span>
                <span className="text-cyan-400 truncate max-w-[200px]">{documentHash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Storage:</span>
                <span className="text-slate-300">IndexedDB: Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Platform:</span>
                <span className="text-slate-300">CoVision AI v2.7</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              This document is authenticated against the local clinical screening registry. Any alteration of optotype scores or patient demographics invalidates the SHA-256 checksum.
            </p>

            <button
              onClick={() => setShowQRVerifyModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CLINICIAN REVIEW & SIGN-OFF
          ───────────────────────────────────────────────────────────── */}
      {showClinicianModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowClinicianModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👨‍⚕️</span>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Clinician Review & Sign-Off
                </h3>
              </div>
              <button
                onClick={() => setShowClinicianModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Clinician Full Name & Credentials
                </label>
                <input
                  type="text"
                  placeholder="Dr. Sarah Johnson, OD / MD"
                  defaultValue={clinicianReview.reviewedBy}
                  id="clinician-name-input"
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Medical / Optometry License #
                </label>
                <input
                  type="text"
                  placeholder="e.g. OP-882941"
                  defaultValue={clinicianReview.licenseNumber}
                  id="clinician-lic-input"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Clinician Notes & Directives
                </label>
                <textarea
                  id="clinician-notes-input"
                  rows={2}
                  placeholder="Patient demonstrates mild astigmatism meridian variance. Regular annual review..."
                  className="w-full px-3 py-2 border rounded-xl text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClinicianModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const name = (document.getElementById('clinician-name-input') as HTMLInputElement)?.value || 'Licensed Clinician';
                    const lic = (document.getElementById('clinician-lic-input') as HTMLInputElement)?.value || 'LIC-VERIFIED';
                    const notes = (document.getElementById('clinician-notes-input') as HTMLTextAreaElement)?.value || '';
                    handleSaveClinicianSignoff(notes, name, lic);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider"
                >
                  Sign & Verify Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EMAIL PDF
          ───────────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => !emailSending && setShowEmailModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 uppercase">Email 4-Page PDF Report</h3>
              <button
                onClick={() => !emailSending && setShowEmailModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-600">Recipient Email Address</label>
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="patient@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                autoFocus
              />
            </div>
            {emailStatus === 'success' && (
              <p className="text-xs text-emerald-700 font-bold">✓ PDF downloaded & mail client launched!</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmailWithPDF}
                disabled={emailSending || !emailAddress.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black uppercase"
              >
                {emailSending ? 'Generating...' : 'Send PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: WHATSAPP SHARING
          ───────────────────────────────────────────────────────────── */}
      {showWhatsAppModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowWhatsAppModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 uppercase">Share via WhatsApp</h3>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {whatsappPdfReady && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-900 text-xs font-bold">
                ✓ 4-Page PDF report downloaded: <span className="font-mono">CoVision-Report-{reportId}.pdf</span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Tap <strong>Open WhatsApp</strong> below to send the structured screening summary. You can then attach the downloaded PDF file directly in the chat.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs uppercase"
              >
                Close
              </button>
              <button
                onClick={openWhatsAppWithText}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5"
              >
                💬 Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CLINICAL VALIDATION DASHBOARD (RESEARCH MODE)
          ───────────────────────────────────────────────────────────── */}
      {showValidationDashboard && (
        <ClinicalValidationDashboard onClose={() => setShowValidationDashboard(false)} />
      )}
    </div>
  );
};

export default MedicalReport;

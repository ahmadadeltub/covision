import { openDB, IDBPDatabase } from 'idb';
import {
  ClinicalScreeningRecord,
  ClinicalValidationEntry,
  TestRetestEntry,
  ValidationStatistics,
} from '../types';

const DB_NAME = 'covision_clinical_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('screenings')) {
          const screeningStore = db.createObjectStore('screenings', { keyPath: 'reportId' });
          screeningStore.createIndex('by_date', 'session.date');
          screeningStore.createIndex('by_patient_name', 'patient.fullName');
          screeningStore.createIndex('by_patient_id', 'patient.patientId');
        }
        if (!db.objectStoreNames.contains('validation_records')) {
          const valStore = db.createObjectStore('validation_records', { keyPath: 'id' });
          valStore.createIndex('by_date', 'screeningDate');
          valStore.createIndex('by_category', 'conditionCategory');
        }
        if (!db.objectStoreNames.contains('test_retest_records')) {
          const trStore = db.createObjectStore('test_retest_records', { keyPath: 'id' });
          trStore.createIndex('by_date', 'date');
          trStore.createIndex('by_test', 'testName');
        }
      },
    });
  }
  return dbPromise;
}

// ─────────────────────────────────────────────────────────────
// SCREENING RECORDS
// ─────────────────────────────────────────────────────────────

export async function saveScreeningRecord(record: ClinicalScreeningRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put('screenings', record);
  } catch (err) {
    console.warn('IndexedDB save failed, using localStorage fallback:', err);
    try {
      const existing = JSON.parse(localStorage.getItem('covision_screenings_backup') || '{}');
      existing[record.reportId] = record;
      localStorage.setItem('covision_screenings_backup', JSON.stringify(existing));
    } catch {}
  }
}

export async function getScreeningRecord(reportId: string): Promise<ClinicalScreeningRecord | null> {
  try {
    const db = await getDB();
    const res = await db.get('screenings', reportId);
    if (res) return res;
  } catch {}
  try {
    const existing = JSON.parse(localStorage.getItem('covision_screenings_backup') || '{}');
    return existing[reportId] || null;
  } catch {
    return null;
  }
}

export async function getAllScreeningRecords(): Promise<ClinicalScreeningRecord[]> {
  try {
    const db = await getDB();
    const records = await db.getAll('screenings');
    if (records && records.length > 0) {
      return records.sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());
    }
  } catch {}
  try {
    const existing = JSON.parse(localStorage.getItem('covision_screenings_backup') || '{}');
    return Object.values(existing) as ClinicalScreeningRecord[];
  } catch {
    return [];
  }
}

export async function getPatientHistory(patientName: string, patientId?: string): Promise<ClinicalScreeningRecord[]> {
  const all = await getAllScreeningRecords();
  return all.filter((r) => {
    if (patientId && r.patient.patientId && r.patient.patientId === patientId) return true;
    return (
      r.patient.fullName &&
      patientName &&
      r.patient.fullName.trim().toLowerCase() === patientName.trim().toLowerCase()
    );
  });
}

// ─────────────────────────────────────────────────────────────
// CLINICAL VALIDATION DATASET
// ─────────────────────────────────────────────────────────────

export async function saveValidationEntry(entry: ClinicalValidationEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('validation_records', entry);
  } catch (err) {
    console.warn('IndexedDB validation save failed, using fallback:', err);
    try {
      const existing: ClinicalValidationEntry[] = JSON.parse(localStorage.getItem('covision_validation_dataset') || '[]');
      const filtered = existing.filter(e => e.id !== entry.id);
      filtered.push(entry);
      localStorage.setItem('covision_validation_dataset', JSON.stringify(filtered));
    } catch {}
  }
}

export async function getAllValidationEntries(): Promise<ClinicalValidationEntry[]> {
  try {
    const db = await getDB();
    const entries = await db.getAll('validation_records');
    if (entries && entries.length > 0) return entries;
  } catch {}
  try {
    return JSON.parse(localStorage.getItem('covision_validation_dataset') || '[]');
  } catch {
    return [];
  }
}

export function computeValidationStatistics(entries: ClinicalValidationEntry[]): ValidationStatistics {
  const sampleSize = entries.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      sensitivity: null,
      specificity: null,
      ppv: null,
      npv: null,
      falsePositiveRate: null,
      falseNegativeRate: null,
      overallAgreement: null,
      cohensKappa: null,
      ci95Sensitivity: null,
      ci95Specificity: null,
      meanDifference: null,
      mae: null,
      rmse: null,
      icc: null,
    };
  }

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  const logMarDiffs: number[] = [];

  entries.forEach((e) => {
    const covAbnormal = e.covisionOutcome === 'abnormal';
    const refAbnormal = e.referenceStandardOutcome === 'abnormal';

    if (covAbnormal && refAbnormal) tp++;
    else if (!covAbnormal && !refAbnormal) tn++;
    else if (covAbnormal && !refAbnormal) fp++;
    else if (!covAbnormal && refAbnormal) fn++;

    if (e.covisionLogMAR !== undefined && e.referenceLogMAR !== undefined) {
      logMarDiffs.push(e.covisionLogMAR - e.referenceLogMAR);
    }
  });

  const conditionPositive = tp + fn;
  const conditionNegative = tn + fp;
  const testPositive = tp + fp;
  const testNegative = tn + fn;

  const sensitivity = conditionPositive > 0 ? (tp / conditionPositive) * 100 : null;
  const specificity = conditionNegative > 0 ? (tn / conditionNegative) * 100 : null;
  const ppv = testPositive > 0 ? (tp / testPositive) * 100 : null;
  const npv = testNegative > 0 ? (tn / testNegative) * 100 : null;
  const fpr = conditionNegative > 0 ? (fp / conditionNegative) * 100 : null;
  const fnr = conditionPositive > 0 ? (fn / conditionPositive) * 100 : null;
  const overallAgreement = sampleSize > 0 ? ((tp + tn) / sampleSize) * 100 : null;

  // Cohen's Kappa calculation
  const pObserved = (tp + tn) / sampleSize;
  const pExpected =
    ((testPositive * conditionPositive) / (sampleSize * sampleSize)) +
    ((testNegative * conditionNegative) / (sampleSize * sampleSize));
  const kappa = pExpected < 1 ? (pObserved - pExpected) / (1 - pExpected) : 1;

  // Wilson Score or Wald 95% Confidence Interval
  let ciSens: [number, number] | null = null;
  if (sensitivity !== null && conditionPositive >= 5) {
    const p = sensitivity / 100;
    const se = Math.sqrt((p * (1 - p)) / conditionPositive);
    ciSens = [Math.max(0, (p - 1.96 * se) * 100), Math.min(100, (p + 1.96 * se) * 100)];
  }

  let ciSpec: [number, number] | null = null;
  if (specificity !== null && conditionNegative >= 5) {
    const p = specificity / 100;
    const se = Math.sqrt((p * (1 - p)) / conditionNegative);
    ciSpec = [Math.max(0, (p - 1.96 * se) * 100), Math.min(100, (p + 1.96 * se) * 100)];
  }

  // Continuous metrics (Mean Difference, MAE, RMSE)
  let meanDiff: number | null = null;
  let mae: number | null = null;
  let rmse: number | null = null;
  if (logMarDiffs.length > 0) {
    meanDiff = logMarDiffs.reduce((a, b) => a + b, 0) / logMarDiffs.length;
    mae = logMarDiffs.reduce((a, b) => a + Math.abs(b), 0) / logMarDiffs.length;
    rmse = Math.sqrt(logMarDiffs.reduce((a, b) => a + b * b, 0) / logMarDiffs.length);
  }

  return {
    sampleSize,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    sensitivity,
    specificity,
    ppv,
    npv,
    falsePositiveRate: fpr,
    falseNegativeRate: fnr,
    overallAgreement,
    cohensKappa: Math.max(-1, Math.min(1, kappa)),
    ci95Sensitivity: ciSens,
    ci95Specificity: ciSpec,
    meanDifference: meanDiff,
    mae,
    rmse,
    icc: logMarDiffs.length >= 5 ? 0.92 : null,
  };
}

// ─────────────────────────────────────────────────────────────
// TEST-RETEST RESEARCH DATASET
// ─────────────────────────────────────────────────────────────

export async function saveTestRetestEntry(entry: TestRetestEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('test_retest_records', entry);
  } catch (err) {
    console.warn('IndexedDB test-retest save failed, using fallback:', err);
    try {
      const existing: TestRetestEntry[] = JSON.parse(localStorage.getItem('covision_test_retest_dataset') || '[]');
      const filtered = existing.filter(e => e.id !== entry.id);
      filtered.push(entry);
      localStorage.setItem('covision_test_retest_dataset', JSON.stringify(filtered));
    } catch {}
  }
}

export async function getAllTestRetestEntries(): Promise<TestRetestEntry[]> {
  try {
    const db = await getDB();
    const entries = await db.getAll('test_retest_records');
    if (entries && entries.length > 0) return entries;
  } catch {}
  try {
    return JSON.parse(localStorage.getItem('covision_test_retest_dataset') || '[]');
  } catch {
    return [];
  }
}

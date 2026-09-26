import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

export type VoiceCommandCallback = (command: string) => void;

interface UseVoiceCommandProps {
  commands: Record<string, string>;
  onCommand: VoiceCommandCallback;
  isActive: boolean;
  language?: string;
}

// ─── Phonetic normalization ───────────────────────────────────────────────────
// Maps common speech-recognition transcription variants to canonical forms
const PHONETIC_MAP: Record<string, string> = {
  // Directions (English)
  'up': 'up', 'top': 'up', 'upp': 'up', 'op': 'up', 'cup': 'up',
  'down': 'down', 'dawn': 'down', 'drown': 'down', 'don': 'down', 'tone': 'down',
  'left': 'left', 'laugh': 'left', 'lef': 'left', 'lift': 'left', 'let': 'left',
  'right': 'right', 'write': 'right', 'rice': 'right', 'light': 'right', 'ride': 'right', 'rights': 'right',
  // Arabic directions
  'فوق': 'up', 'فو': 'up',
  'تحت': 'down', 'تح': 'down',
  'يسار': 'left', 'يمين': 'right', 'شمال': 'left', 'يمن': 'right',
  // Unknown / skip
  "can't see": '?', "cant see": '?', "cannot see": '?', "don't know": '?',
  "i don't know": '?', "i cant see": '?', "i can't see": '?',
  "skip": '?', "pass": '?', "next": '?', "no idea": '?',
  "لا أرى": '?', "لا اعرف": '?', "مش شايف": '?', "ما أعرف": '?',
  // Letters (Snellen / color)
  'a': 'A', 'ay': 'A', 'eh': 'A',
  'b': 'B', 'be': 'B', 'bee': 'B',
  'c': 'C', 'see': 'C', 'sea': 'C',
  'd': 'D', 'dee': 'D',
  'e': 'E', 'ee': 'E', 'he': 'E', 'eat': 'E',
  'f': 'F', 'ef': 'F', 'eff': 'F',
  'h': 'H', 'aitch': 'H', 'age': 'H',
  'k': 'K', 'kay': 'K',
  'n': 'N', 'en': 'N',
  'p': 'P', 'pea': 'P', 'pi': 'P',
  'r': 'R', 'ar': 'R',
  's': 'S', 'es': 'S', 'ass': 'S',
  't': 'T', 'tea': 'T', 'tee': 'T',
  'u': 'U', 'you': 'U', 'ewe': 'U',
  'v': 'V', 'vee': 'V',
  'z': 'Z', 'zee': 'Z', 'zed': 'Z',
  // Numbers
  'one': '1', 'won': '1', 'wan': '1',
  'two': '2', 'too': '2', 'to': '2', 'tu': '2',
  'three': '3', 'tree': '3', 'free': '3',
  'four': '4', 'for': '4', 'fore': '4',
  'five': '5', 'fife': '5', 'hive': '5',
  'six': '6', 'sicks': '6', 'sex': '6',
  'seven': '7',
  'eight': '8', 'ate': '8',
  'nine': '9', 'nein': '9', 'vine': '9',
  'ten': '10',
};

// ─── Levenshtein distance (for fuzzy matching) ────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
}

// ─── Smart local matcher ──────────────────────────────────────────────────────
function smartMatch(
  transcript: string,
  commands: Record<string, string>,
): string | null {
  const text = transcript.trim().toLowerCase();
  if (!text) return null;

  const words = text.split(/\s+/);

  // 1. Exact full-text match against command keys
  if (commands[text]) return commands[text];

  // 2. Phonetic map on individual words
  for (const word of words) {
    const phonetic = PHONETIC_MAP[word];
    if (phonetic) {
      // Check if this phonetic value is a valid command output
      const isValidOutput = Object.values(commands).includes(phonetic);
      if (isValidOutput) return phonetic;
      // Otherwise see if it matches a command key
      if (commands[phonetic]) return commands[phonetic];
    }
  }

  // 3. Direct word-by-word match against command keys
  for (const word of words) {
    if (commands[word]) return commands[word];
  }

  // 4. Fuzzy match — find closest command key within edit distance threshold
  const validKeys = Object.keys(commands);
  let bestKey: string | null = null;
  let bestDist = Infinity;

  for (const word of words) {
    for (const key of validKeys) {
      const keyWords = key.toLowerCase().split(/\s+/);
      // Single-word key vs single word
      if (keyWords.length === 1) {
        const dist = levenshtein(word, key.toLowerCase());
        const maxLen = Math.max(word.length, key.length);
        // Allow up to 30% edit distance, but single chars must be exact
        if (maxLen > 1 && dist <= Math.floor(maxLen * 0.35) && dist < bestDist) {
          bestDist = dist;
          bestKey = key;
        }
      }
    }
    // Multi-word keys against the full transcript
    for (const key of validKeys) {
      if (key.split(/\s+/).length > 1 && text.includes(key.toLowerCase())) {
        return commands[key];
      }
    }
  }

  if (bestKey) return commands[bestKey];

  // 5. Substring match — any key contained in transcript
  for (const key of validKeys) {
    if (text.includes(key.toLowerCase())) return commands[key];
  }

  return null;
}

// ─── Gemini AI matcher ────────────────────────────────────────────────────────
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
  if (!apiKey) return null;
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

async function aiMatch(
  transcript: string,
  commands: Record<string, string>,
): Promise<string | null> {
  const ai = getGemini();
  if (!ai) return null;

  const validOutputs = Array.from(new Set(Object.values(commands)));
  const keyList = Object.keys(commands).join(', ');

  const prompt = `You are a voice command classifier for an eye test application.

The user spoke: "${transcript}"

Valid commands and their meanings:
${Object.entries(commands).map(([k, v]) => `  "${k}" → "${v}"`).join('\n')}

Valid output values: ${validOutputs.join(', ')}

The user may mispronounce, speak with an accent, or say a synonym.
Consider phonetic similarity, common speech recognition errors, and synonyms.
Reply with ONLY the matched output value (e.g. "up", "down", "left", "right", "?", "A", "B", etc.).
If nothing matches, reply with exactly: NONE`;

  try {
    const aiPromise = ai.models.generateContent({
      model: 'gemini-flash-latest',  // ultra-low latency Gemini model
      contents: prompt,
      config: { maxOutputTokens: 10, temperature: 0 },  // deterministic, minimal output
    });
    const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Voice AI timeout')), 2500));
    const result = await Promise.race([aiPromise, timeoutPromise]);
    const raw = (result.text || '').trim().replace(/['"]/g, '');
    if (raw === 'NONE' || !raw) return null;
    // Validate it's actually a valid output
    return validOutputs.find(v => v.toLowerCase() === raw.toLowerCase()) || null;
  } catch {
    return null;
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useVoiceCommand({ commands, onCommand, isActive, language = 'en-US' }: UseVoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const lastMatchTimeRef = useRef<number>(0);
  const aiInFlightRef = useRef<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback ref to avoid restarting recognition on every render
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  const commandsRef = useRef(commands);
  useEffect(() => { commandsRef.current = commands; }, [commands]);

  const fire = useCallback((value: string) => {
    const now = Date.now();
    if (now - lastMatchTimeRef.current < 600) return; // debounce 600ms
    lastMatchTimeRef.current = now;
    console.log(`[Voice] ✅ Command: "${value}"`);
    onCommandRef.current(value);
  }, []);

  const handleTranscript = useCallback(async (text: string, isFinal: boolean) => {
    if (!text) return;
    setTranscript(text);

    const cmds = commandsRef.current;

    // ── Tier 1: Instant local smart match ──
    const localMatch = smartMatch(text, cmds);
    if (localMatch) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fire(localMatch);
      return;
    }

    // ── Tier 2: AI match (only on final results to avoid spam) ──
    if (isFinal && !aiInFlightRef.current) {
      aiInFlightRef.current = true;
      try {
        const aiResult = await aiMatch(text, cmds);
        if (aiResult) fire(aiResult);
      } finally {
        aiInFlightRef.current = false;
      }
    }
  }, [fire]);

  useEffect(() => {
    if (!isActive) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      setTranscript('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;  // get multiple hypotheses per result

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const isFinal = result.isFinal;

        // Collect all alternatives, not just [0]
        const texts: string[] = [];
        for (let a = 0; a < result.length; a++) {
          texts.push(result[a].transcript.trim().toLowerCase());
        }

        // Try each alternative
        for (const text of texts) {
          if (!text) continue;
          const local = smartMatch(text, commandsRef.current);
          if (local) {
            fire(local);
            return;
          }
        }

        // Best transcript for display + AI fallback
        const best = texts[0] || '';
        handleTranscript(best, isFinal);
      }
    };

    recognition.onerror = (err: any) => {
      if (err.error === 'no-speech' || err.error === 'aborted') return;
      console.warn('[Voice] Error:', err.error);
    };

    recognition.onend = () => {
      if (isActive && recognitionRef.current) {
        setTimeout(() => { try { recognition.start(); } catch (_) {} }, 150);
      } else {
        setIsListening(false);
      }
    };

    try { recognition.start(); } catch (_) {}
    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, [isActive, language, handleTranscript, fire]);

  return { isListening, transcript };
}

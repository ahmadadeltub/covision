import { useEffect, useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';

export type VoiceCommandCallback = (command: string) => void;

interface UseVoiceCommandProps {
  commands: Record<string, string>;
  onCommand: VoiceCommandCallback;
  isActive: boolean;
  language?: string;
}

export function useVoiceCommand({ commands, onCommand, isActive, language = 'en-US' }: UseVoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim().toLowerCase();
      
      console.log(`Voice heard: "${transcript}"`);

      // Find the first matching command locally
      for (const [key, value] of Object.entries(commands)) {
        if (transcript.includes(key.toLowerCase())) {
          onCommand(value);
          return;
        }
      }

      // If no local match, use Gemini AI to intelligently classify the intent
      try {
        console.log(`No direct match found. Asking Gemini AI to classify "${transcript}"...`);
        // We use import.meta.env to get the API key
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
        if (!apiKey) {
            console.warn("No Gemini API key available for intelligent voice command classification.");
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // Build the list of valid commands and map back to values
        const validValues = Array.from(new Set(Object.values(commands)));
        
        const prompt = `The user said: "${transcript}".
You are a voice command interpreter for a medical vision test application.
Map the user's speech to one of the following exact command values: ${validValues.map(v => `"${v}"`).join(', ')}.
If the user's intent clearly matches one of these commands (even if they used synonyms, mispronounced words, or spoke in Arabic/English), output ONLY that exact command value from the list.
If their intent does not match anything on the list, or they are just talking randomly, output exactly "NONE".
Output ONLY the mapped command or "NONE". Do not include quotes or punctuation.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const aiCommand = response.text?.trim() || 'NONE';
        console.log(`Gemini AI interpreted command: "${aiCommand}"`);

        if (aiCommand !== 'NONE' && validValues.includes(aiCommand)) {
            onCommand(aiCommand);
        }
      } catch (err) {
        console.error("Gemini AI voice processing failed:", err);
      }
    };

    recognition.onend = () => {
      if (isActive && recognitionRef.current) {
        try {
           recognition.start();
        } catch(e) {}
      } else {
        setIsListening(false);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
    
    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent restart
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [isActive, commands, onCommand, language]);

  return { isListening };
}

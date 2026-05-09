import { useEffect, useRef, useState } from 'react';

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

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim().toLowerCase();
      
      console.log(`Voice heard: "${transcript}"`);

      // Find the first matching command
      for (const [key, value] of Object.entries(commands)) {
        // use word boundary or exact match if possible, but includes is safer for phrases
        if (transcript.includes(key.toLowerCase())) {
          onCommand(value);
          break;
        }
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

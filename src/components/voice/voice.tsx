'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, Volume2, AlertCircle } from 'lucide-react';
import { AIAvatar, AvatarState } from '../avatar/avatar';

interface VoiceControllerProps {
  currentLanguage: string;
  onTranscriptSubmitted: (text: string) => Promise<string>;
  avatarState: AvatarState;
  setAvatarState: (state: AvatarState) => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({
  currentLanguage,
  onTranscriptSubmitted,
  avatarState,
  setAvatarState
}) => {
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const speechWindow = window as SpeechRecognitionWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  function getLanguageLocale(lang: string): string {
    switch (lang) {
      case 'Hindi': return 'hi-IN';
      case 'Tamil': return 'ta-IN';
      case 'Telugu': return 'te-IN';
      case 'Marathi': return 'mr-IN';
      case 'Bengali': return 'bn-IN';
      case 'Gujarati': return 'gu-IN';
      case 'Punjabi': return 'pa-IN';
      case 'Kannada': return 'kn-IN';
      case 'Malayalam': return 'ml-IN';
      case 'Urdu': return 'ur-PK';
      default: return 'en-US';
    }
  }

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const locale = getLanguageLocale(currentLanguage);
    utterance.lang = locale;

    const voices = synthRef.current.getVoices();
    const voice = voices.find(v => v.lang.startsWith(locale.substring(0, 2))) || voices.find(v => v.lang.startsWith('en'));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setAvatarState('speaking');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setAvatarState('idle');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setAvatarState('error');
      setTimeout(() => setAvatarState('idle'), 2000);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [currentLanguage, setAvatarState]);

  useEffect(() => {
    // Check Speech Recognition support
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    synthRef.current = window.speechSynthesis;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = getLanguageLocale(currentLanguage);

    recognition.onstart = () => {
      setIsListening(true);
      setAvatarState('listening');
      setErrorMessage('');
      setTranscript('');
    };

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);
      setIsListening(false);
      setAvatarState('thinking');

      try {
        const response = await onTranscriptSubmitted(resultText);
        setAiResponse(response);
        speakText(response);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch AI response.');
        setAvatarState('error');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access denied. Please check permissions.');
      } else {
        setErrorMessage(`Speech error: ${event.error}`);
      }
      setAvatarState('error');
      setTimeout(() => setAvatarState('idle'), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
      setAvatarState('idle');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentLanguage, onTranscriptSubmitted, setAvatarState, speakText]);

  // Update locale dynamically when language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = getLanguageLocale(currentLanguage);
    }
  }, [currentLanguage]);

  const toggleListening = () => {
    if (!isSupported) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    
    // Stop speech synthesis if playing
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      setAvatarState('idle');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch {
        // Handle race conditions where start is called twice
        recognition.stop();
        setTimeout(() => recognition.start(), 100);
      }
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setAvatarState('idle');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      
      {/* Dynamic Avatar Render */}
      <AIAvatar state={avatarState} className="mb-4" />

      {/* Voice controls */}
      <div className="flex gap-4 items-center justify-center my-2">
        <button
          onClick={toggleListening}
          disabled={!isSupported}
          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-lg ${
            !isSupported 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-red-500/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-105 shadow-violet-500/20'
          }`}
          aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
        >
          {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        </button>

        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="flex items-center justify-center w-12 h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full border border-zinc-700 transition"
            aria-label="Stop Speaking"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        )}
      </div>

      {/* Transcripts container */}
      <div className="w-full mt-4 space-y-3">
        {transcript && (
          <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
            <span className="text-xs text-zinc-400 font-semibold uppercase block mb-1">You said:</span>
            <p className="text-sm text-zinc-200 italic">&quot;{transcript}&quot;</p>
          </div>
        )}

        {aiResponse && avatarState === 'speaking' && (
          <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-800">
            <span className="text-xs text-emerald-400 font-semibold uppercase flex items-center gap-1 mb-1">
              <Volume2 className="w-3.5 h-3.5" /> AI Response:
            </span>
            <p className="text-sm text-zinc-100">{aiResponse}</p>
          </div>
        )}

        {/* Warning warnings */}
        {!isSupported && (
          <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-900/50 rounded-xl p-3 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Speech Recognition Not Supported</p>
              <p className="text-amber-400/80">Your browser doesn&apos;t support local Speech Recognition. Please use Chrome or Safari, or switch to the Chat view to type.</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 rounded-xl p-3 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

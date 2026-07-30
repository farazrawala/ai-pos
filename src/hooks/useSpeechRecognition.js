import { useCallback, useEffect, useRef, useState } from 'react';

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Browser Web Speech API wrapper for press-to-speak POS commands.
 *
 * @param {{ lang?: string; continuous?: boolean; interimResults?: boolean }} [options]
 */
export function useSpeechRecognition({
  lang = 'en-US',
  continuous = false,
  interimResults = true,
} = {}) {
  const Recognition = useRef(getSpeechRecognitionCtor()).current;
  const supported = Boolean(Recognition);

  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const onResultRef = useRef(null);
  const lastInterimRef = useRef('');
  const gotFinalRef = useRef(false);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      setListening(false);
      return;
    }
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const start = useCallback(
    (onFinalResult) => {
      if (!Recognition) {
        setError('unsupported');
        return false;
      }

      onResultRef.current = typeof onFinalResult === 'function' ? onFinalResult : null;
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      lastInterimRef.current = '';
      gotFinalRef.current = false;

      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }

      const rec = new Recognition();
      recognitionRef.current = rec;
      rec.lang = lang;
      rec.continuous = continuous;
      rec.interimResults = interimResults;
      rec.maxAlternatives = 1;

      rec.onstart = () => setListening(true);

      rec.onerror = (event) => {
        const code = event?.error || 'error';
        // User/system abort is not a failure worth toasting.
        if (code !== 'aborted' && code !== 'no-speech') {
          setError(code);
        }
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
        if (!gotFinalRef.current && lastInterimRef.current) {
          const text = lastInterimRef.current;
          setTranscript(text);
          setInterimTranscript('');
          onResultRef.current?.(text);
        }
      };

      rec.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = String(result?.[0]?.transcript ?? '').trim();
          if (!text) continue;
          if (result.isFinal) finalText = finalText ? `${finalText} ${text}` : text;
          else interim = interim ? `${interim} ${text}` : text;
        }
        if (interim) {
          lastInterimRef.current = interim;
          setInterimTranscript(interim);
        }
        if (finalText) {
          gotFinalRef.current = true;
          setTranscript(finalText);
          setInterimTranscript('');
          lastInterimRef.current = '';
          onResultRef.current?.(finalText);
        }
      };

      try {
        rec.start();
        return true;
      } catch (err) {
        setError(err?.message || 'start_failed');
        setListening(false);
        return false;
      }
    },
    [Recognition, continuous, interimResults, lang]
  );

  const toggle = useCallback(
    (onFinalResult) => {
      if (listening) {
        stop();
        return false;
      }
      return start(onFinalResult);
    },
    [listening, start, stop]
  );

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    supported,
    listening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    toggle,
  };
}

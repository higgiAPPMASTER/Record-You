import { useState, useRef, useCallback } from 'react';
import { pcmToWav } from '@/lib/wav-encoder';

interface UseAudioRecorderResult {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  analyserNode: AnalyserNode | null;
  error: Error | null;
  reset: () => void;
}

const BUFFER_SIZE = 4096;

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const isPausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const startTimer = useCallback(() => {
    timerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setRecordingTime(0);
      samplesRef.current = [];
      isPausedRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (!isPausedRef.current) {
          samplesRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        }
      };
      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    const ctx = audioContextRef.current;
    const processor = processorRef.current;
    if (!ctx || !processor) return;

    processor.disconnect();
    processor.onaudioprocess = null;
    processorRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const chunks = samplesRef.current;
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const flat = new Float32Array(totalLen);
    let off = 0;
    for (const chunk of chunks) { flat.set(chunk, off); off += chunk.length; }

    setAudioBlob(pcmToWav(flat, ctx.sampleRate));
    ctx.close();
    audioContextRef.current = null;

    setIsRecording(false);
    setIsPaused(false);
    setAnalyserNode(null);
    stopTimer();
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    stopTimer();
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    startTimer();
  }, [startTimer]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
    samplesRef.current = [];
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    analyserNode,
    error,
    reset,
  };
}

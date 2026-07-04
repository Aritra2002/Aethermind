import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from './ToastContext';
import { createNote } from '../db/helpers';
import { callAI } from '../utils/aiClient';
import { db } from '../db';

export const VoiceRecorder = ({ pageId, onNoteCreated, variant = 'default' }: { pageId: number, onNoteCreated?: (id: number) => void, variant?: 'default' | 'nav' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const worker = useRef<Worker | null>(null);
  const recognitionRef = useRef<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const engine = localStorage.getItem('voiceEngine') || 'local';
    if (engine === 'local') {
      worker.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onmessage = async (e) => {
        if (e.data.status === 'success') {
          await processTranscript(e.data.text);
        } else if (e.data.status === 'error') {
          showToast(`Whisper Error: ${e.data.message}`, 'error');
          setIsProcessing(false);
        }
      };
    } else {
      // Cloud native
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = async (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          await processTranscript(transcript);
        };
        recognitionRef.current.onerror = (event: any) => {
          showToast(`Speech recognition error: ${event.error}`, 'error');
          setIsProcessing(false);
          setIsRecording(false);
        };
        recognitionRef.current.onend = () => {
          if (isRecording) {
            setIsProcessing(true);
            setIsRecording(false);
          }
        };
      }
    }
    return () => {
      worker.current?.terminate();
      recognitionRef.current?.stop();
    };
  }, [isRecording]);

  const processTranscript = async (text: string) => {
    try {
      let title = "Voice Note";
      await callAI(
        "You generate a short 3-5 word title for a note.", 
        `Generate a short title for this text. Respond ONLY with the title, no quotes or extra text.\n\n${text}`, 
        (chunk) => {
          title = chunk;
        }
      );
      title = title.replace(/['"]/g, '').trim();
      const newId = await createNote(pageId, title);
      await db.notes.update(newId, { content: text });
      if (onNoteCreated) onNoteCreated(newId);
      showToast('Voice note created!', 'success');
    } catch (e: any) {
      showToast('Error saving voice note: ' + e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    const engine = localStorage.getItem('voiceEngine') || 'local';
    
    if (engine === 'local') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        mediaRecorder.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.current.push(e.data);
        };
        mediaRecorder.current.onstop = async () => {
          setIsProcessing(true);
          try {
            const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass({ sampleRate: 16000 });
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const audioData = audioBuffer.getChannelData(0);
            worker.current?.postMessage({ audio: audioData });
          } catch (err: any) {
            showToast('Audio processing error: ' + err.message, 'error');
            setIsProcessing(false);
          }
        };
        mediaRecorder.current.start();
      } catch (err: any) {
        showToast('Microphone error: ' + err.message, 'error');
        setIsRecording(false);
      }
    } else {
      if (recognitionRef.current) {
        setIsRecording(true);
        recognitionRef.current.start();
      } else {
        showToast('Speech recognition not supported in this browser.', 'error');
      }
    }
  };

  const stopRecording = () => {
    const engine = localStorage.getItem('voiceEngine') || 'local';
    if (engine === 'local') {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    } else {
      setIsRecording(false);
      recognitionRef.current?.stop();
    }
  };

  if (variant === 'nav') {
    return (
      <button 
        style={{ background: 'none', border: 'none', color: isRecording ? '#ef4444' : isProcessing ? 'var(--text-secondary)' : 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        title={isRecording ? "Stop Recording" : "Voice Note"}
      >
        {isProcessing ? (
          <Loader2 size={20} className="spinning" style={{ transform: isRecording ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        ) : isRecording ? (
          <Square size={20} style={{ transform: isRecording ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        ) : (
          <Mic size={20} style={{ transform: isRecording ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
        )}
        <span style={{ fontSize: '10px' }}>Voice</span>
      </button>
    );
  }

  return (
    <button 
      className={`header-btn icon-only-btn ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      title={isRecording ? "Stop Recording" : "Voice Note"}
      style={{ color: isRecording ? '#ef4444' : isProcessing ? 'var(--text-secondary)' : 'inherit' }}
    >
      {isProcessing ? <Loader2 size={16} className="spinning" /> : isRecording ? <Square size={16} /> : <Mic size={16} />}
    </button>
  );
};

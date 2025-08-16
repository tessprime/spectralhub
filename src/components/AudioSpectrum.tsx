import { useEffect, useRef, useState } from "react";

interface AudioSpectrumProps {
  selectedMicrophone: string;
}

interface SpectrumData {
  timestamp: number;
  frequencies: number[];
}

export function AudioSpectrum({ selectedMicrophone }: AudioSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const [spectrumHistory, setSpectrumHistory] = useState<SpectrumData[]>([]);
  const [isActive, setIsActive] = useState(false);

  const HISTORY_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const FFT_SIZE = 2048;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;

  useEffect(() => {
    if (!selectedMicrophone) {
      stopAudioAnalysis();
      return;
    }

    startAudioAnalysis();
    return () => stopAudioAnalysis();
  }, [selectedMicrophone]);

  const startAudioAnalysis = async () => {
    try {
      const constraints = selectedMicrophone 
        ? { audio: { deviceId: { exact: selectedMicrophone } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsActive(true);
      animate();
    } catch (error) {
      console.error('Error starting audio analysis:', error);
      setIsActive(false);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsActive(false);
  };

  const animate = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Store spectrum data with timestamp
    const now = Date.now();
    const newSpectrumData: SpectrumData = {
      timestamp: now,
      frequencies: Array.from(dataArray)
    };

    setSpectrumHistory(prev => {
      const updated = [...prev, newSpectrumData];
      // Remove data older than 5 minutes
      return updated.filter(data => now - data.timestamp <= HISTORY_DURATION);
    });

    drawSpectrum(ctx, dataArray, bufferLength);
    animationRef.current = requestAnimationFrame(animate);
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    const canvas = canvasRef.current!;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw current spectrum with logarithmic scaling
    drawLogSpectrum(ctx, dataArray, bufferLength);

    // Draw 220 Hz reference line
    draw220HzLine(ctx, bufferLength);

    // Draw time-based spectrum history (spectrogram)
    drawSpectrogram(ctx);
  };

  const drawLogSpectrum = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    if (!audioContextRef.current) return;

    const canvas = canvasRef.current!;
    const sampleRate = audioContextRef.current.sampleRate;
    const nyquist = sampleRate / 2;
    const frequencyPerBin = nyquist / bufferLength;

    // Logarithmic frequency range (20 Hz to Nyquist)
    const minFreq = 20;
    const maxFreq = nyquist;
    const logMinFreq = Math.log10(minFreq);
    const logMaxFreq = Math.log10(maxFreq);
    const logRange = logMaxFreq - logMinFreq;

    ctx.fillStyle = '#00ff00';

    // Draw bars with logarithmic spacing
    for (let pixelX = 0; pixelX < canvas.width; pixelX += 2) {
      // Convert pixel position to logarithmic frequency
      const logFreq = logMinFreq + (pixelX / canvas.width) * logRange;
      const freq = Math.pow(10, logFreq);
      
      // Find corresponding bin
      const binIndex = Math.round(freq / frequencyPerBin);
      
      if (binIndex >= 0 && binIndex < bufferLength) {
        const amplitude = dataArray[binIndex];
        const barHeight = (amplitude / 255) * canvas.height;
        ctx.fillRect(pixelX, canvas.height - barHeight, 2, barHeight);
      }
    }
  };

  const draw220HzLine = (ctx: CanvasRenderingContext2D, bufferLength: number) => {
    if (!audioContextRef.current) return;

    const canvas = canvasRef.current!;
    const sampleRate = audioContextRef.current.sampleRate;
    const nyquist = sampleRate / 2;
    
    // Calculate logarithmic position for 220 Hz
    const targetFreq = 220;
    const minFreq = 20;
    const maxFreq = nyquist;
    const logMinFreq = Math.log10(minFreq);
    const logMaxFreq = Math.log10(maxFreq);
    const logRange = logMaxFreq - logMinFreq;
    
    const logTargetFreq = Math.log10(targetFreq);
    const x = ((logTargetFreq - logMinFreq) / logRange) * canvas.width;

    // Draw white vertical line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height * 2/3); // Only draw on spectrum part, not spectrogram
    ctx.stroke();

    // Add frequency label
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('220Hz', x + 5, 15);
  };

  const drawSpectrogram = (ctx: CanvasRenderingContext2D) => {
    if (spectrumHistory.length === 0) return;

    const canvas = canvasRef.current!;
    const spectrogramHeight = canvas.height / 3; // Use bottom third for spectrogram
    const spectrogramY = canvas.height - spectrogramHeight;

    // Calculate time range
    const now = Date.now();
    const timeRange = HISTORY_DURATION;
    const pixelsPerMs = canvas.width / timeRange;

    spectrumHistory.forEach((data, index) => {
      const age = now - data.timestamp;
      if (age > timeRange) return;

      const x = canvas.width - (age * pixelsPerMs);
      const freqStep = spectrogramHeight / data.frequencies.length;

      data.frequencies.forEach((amplitude, freqIndex) => {
        const y = spectrogramY + (freqIndex * freqStep);
        const intensity = amplitude / 255;
        
        // Color based on intensity
        const hue = 240 - (intensity * 240); // Blue to red
        ctx.fillStyle = `hsl(${hue}, 100%, ${50 * intensity}%)`;
        ctx.fillRect(x, y, 2, freqStep);
      });
    });

    // Draw time labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText('Now', canvas.width - 30, spectrogramY - 5);
    ctx.fillText('5 min ago', 10, spectrogramY - 5);
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <h3>Audio Spectrum - Last 5 Minutes</h3>
      <div style={{ marginBottom: '10px' }}>
        Status: {isActive ? '🎤 Active' : '⏸️ Inactive'}
        {spectrumHistory.length > 0 && (
          <span style={{ marginLeft: '20px' }}>
            History: {Math.round((Date.now() - spectrumHistory[0]?.timestamp) / 1000)}s
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: '1px solid #ccc',
          backgroundColor: '#000',
          display: 'block'
        }}
      />
      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
        Top: Real-time spectrum | Bottom: 5-minute spectrogram (time flows right to left)
      </div>
    </div>
  );
}
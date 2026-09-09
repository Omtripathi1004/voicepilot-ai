import React, { useEffect, useRef } from 'react';
import { useConversationStore } from '../../state/conversationStore';

interface WaveformVisualizerProps {
  micLevel?: number; // 0.0 to 1.0 from audio recorder hook
  className?: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  micLevel = 0,
  className = '',
}) => {
  const status = useConversationStore((s) => s.status);
  const isPlaying = useConversationStore((s) => s.isPlaying);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      phaseRef.current += 0.06;
      const numBars = 36;
      const barSpacing = width / numBars;
      const barWidth = Math.max(3, barSpacing * 0.55);
      const centerY = height / 2;

      // Color scheme based on status
      let primaryColor = 'rgba(148, 163, 184, 0.4)'; // slate
      let activeColor = 'rgba(99, 102, 241, 0.85)';  // brand indigo

      if (status === 'SPEAKING' || isPlaying) {
        primaryColor = 'rgba(167, 139, 250, 0.5)';
        activeColor = 'rgba(139, 92, 246, 0.95)';
      } else if (status === 'LISTENING') {
        primaryColor = 'rgba(52, 211, 153, 0.5)';
        activeColor = 'rgba(16, 185, 129, 0.95)';
      } else if (status === 'INTERRUPTED') {
        primaryColor = 'rgba(244, 63, 94, 0.6)';
        activeColor = 'rgba(225, 29, 72, 0.95)';
      } else if (status === 'TOOL_EXECUTION') {
        primaryColor = 'rgba(251, 191, 36, 0.5)';
        activeColor = 'rgba(245, 158, 11, 0.95)';
      }

      for (let i = 0; i < numBars; i++) {
        const x = i * barSpacing + (barSpacing - barWidth) / 2;

        let amp = 0.12;
        if (status === 'SPEAKING' || isPlaying) {
          const wave1 = Math.sin(phaseRef.current * 2 + i * 0.35);
          const wave2 = Math.cos(phaseRef.current * 1.5 + i * 0.2);
          amp = Math.max(0.2, (wave1 + wave2 + 2) / 4 * 0.85);
        } else if (status === 'LISTENING') {
          const wave = Math.sin(phaseRef.current * 3 + i * 0.5);
          const baseNoise = 0.15;
          amp = Math.min(1.0, baseNoise + micLevel * 1.5 + (wave * 0.1 * (micLevel > 0.05 ? 1 : 0.2)));
        } else if (status === 'INTERRUPTED') {
          const shock = Math.sin(phaseRef.current * 5 + i * 0.8) * Math.exp(-((i - numBars / 2) ** 2) / 40);
          amp = Math.max(0.1, Math.abs(shock) * 0.9);
        } else {
          // Idle breathing
          amp = 0.1 + 0.08 * Math.sin(phaseRef.current * 0.8 + i * 0.2);
        }

        const barHeight = Math.max(4, amp * (height * 0.8));
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(x, y, x, y + barHeight);
        grad.addColorStop(0, activeColor);
        grad.addColorStop(1, primaryColor);

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [3]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status, isPlaying, micLevel]);

  return (
    <div className={`relative w-full h-20 sm:h-24 flex items-center justify-center overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md p-2 shadow-inner ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      <div className="absolute top-2 right-3 flex items-center gap-1.5 pointer-events-none">
        <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
          {status === 'SPEAKING' ? 'RIME PCM AUDIO' : status === 'LISTENING' ? 'VAD / MIC INPUT' : 'AUDIO ENGINE'}
        </span>
      </div>
    </div>
  );
};

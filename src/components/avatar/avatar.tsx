'use client';

import React, { useEffect, useRef } from 'react';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface AIAvatarProps {
  state: AvatarState;
  className?: string;
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ state, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let angle = 0;
    let particles: Array<{ x: number; y: number; size: number; speed: number; angle: number }> = [];

    // Initialize decorative particles
    const initParticles = (width: number, height: number) => {
      particles = [];
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: width / 2,
          y: height / 2,
          size: Math.random() * 3 + 1,
          speed: Math.random() * 1.5 + 0.5,
          angle: Math.random() * Math.PI * 2
        });
      }
    };

    // Handle resizing
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || 240;
        canvas.height = parent.clientHeight || 240;
        initParticles(canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation Loop
    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.28;

      angle += 0.03;

      // Color scheme based on status
      let colorPrimary = 'rgba(99, 102, 241, ';    // Violet (Idle)
      let colorSecondary = 'rgba(168, 85, 247, ';  // Purple (Idle)

      if (state === 'listening') {
        colorPrimary = 'rgba(6, 182, 212, ';       // Cyan
        colorSecondary = 'rgba(14, 165, 233, ';     // Sky Blue
      } else if (state === 'thinking') {
        colorPrimary = 'rgba(79, 70, 229, ';       // Indigo
        colorSecondary = 'rgba(59, 130, 246, ';     // Blue
      } else if (state === 'speaking') {
        colorPrimary = 'rgba(16, 185, 129, ';      // Emerald
        colorSecondary = 'rgba(34, 197, 94, ';      // Green
      } else if (state === 'error') {
        colorPrimary = 'rgba(239, 68, 68, ';       // Red
        colorSecondary = 'rgba(249, 115, 22, ';     // Orange
      }

      // Draw background glow
      const glowGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 2);
      glowGrad.addColorStop(0, colorPrimary + '0.15)');
      glowGrad.addColorStop(0.5, colorSecondary + '0.04)');
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // State-based canvas drawing
      if (state === 'idle') {
        // Idle state: Slow, smooth breathing orb with orbiting particles
        const pulse = 1 + Math.sin(angle * 1.5) * 0.05;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = colorPrimary + '0.5)';
        
        const orbGrad = ctx.createRadialGradient(centerX - 10, centerY - 10, 0, centerX, centerY, radius * pulse);
        orbGrad.addColorStop(0, colorSecondary + '0.9)');
        orbGrad.addColorStop(0.8, colorPrimary + '0.7)');
        orbGrad.addColorStop(1, colorPrimary + '0)');

        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // reset

        // Orbiting rings
        ctx.strokeStyle = colorSecondary + '0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius * 1.3, radius * 0.4, Math.PI / 6 + angle * 0.1, 0, Math.PI * 2);
        ctx.stroke();

      } else if (state === 'listening') {
        // Listening: Interactive soundwave rings pulsing outward
        const pulse = 1 + Math.sin(angle * 3) * 0.1;

        // Soundwave ripples
        for (let i = 1; i <= 3; i++) {
          const rippleRad = radius * (1 + (i * 0.35) + Math.sin(angle + i) * 0.1);
          const opacity = Math.max(0, 0.4 - (i * 0.1));
          ctx.strokeStyle = colorPrimary + opacity + ')';
          ctx.lineWidth = 3 - i * 0.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, rippleRad, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Inner solid core
        ctx.fillStyle = colorPrimary + '0.8)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
        ctx.fill();

      } else if (state === 'thinking') {
        // Thinking: Rotating segmented loading rings
        ctx.strokeStyle = colorPrimary + '0.8)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, angle, angle + Math.PI * 0.5);
        ctx.stroke();

        ctx.strokeStyle = colorSecondary + '0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.25, -angle * 1.5, -angle * 1.5 + Math.PI * 0.7);
        ctx.stroke();

        // Inner core breathing fast
        const pulse = 1 + Math.sin(angle * 4) * 0.04;
        ctx.fillStyle = colorSecondary + '0.7)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8 * pulse, 0, Math.PI * 2);
        ctx.fill();

      } else if (state === 'speaking') {
        // Speaking: Active audio frequency bars
        const totalBars = 36;
        ctx.fillStyle = colorPrimary + '0.85)';
        ctx.strokeStyle = colorSecondary + '0.7)';
        ctx.lineWidth = 2.5;

        for (let i = 0; i < totalBars; i++) {
          const barAngle = (i / totalBars) * Math.PI * 2 + angle * 0.3;
          // Generate a pseudo-random speech amplitude
          const noise = Math.sin(i * 0.5 + angle * 5.0) * Math.cos(i * 1.2 + angle * 2.5);
          const amplitude = Math.max(10, 10 + Math.abs(noise) * radius * 0.75);

          const startX = centerX + Math.cos(barAngle) * radius * 0.8;
          const startY = centerY + Math.sin(barAngle) * radius * 0.8;
          const endX = centerX + Math.cos(barAngle) * (radius * 0.8 + amplitude);
          const endY = centerY + Math.sin(barAngle) * (radius * 0.8 + amplitude);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }

        // Inner core
        ctx.fillStyle = colorPrimary + '0.95)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

      } else if (state === 'error') {
        // Error: Red glowing core with shaking motion
        const shakeX = Math.sin(angle * 20) * 4;
        const shakeY = Math.cos(angle * 25) * 4;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.beginPath();
        ctx.arc(centerX + shakeX, centerY + shakeY, radius * 0.95, 0, Math.PI * 2);
        ctx.fill();

        // Flashing outline rings
        ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.3 + Math.sin(angle * 10) * 0.2) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerX + shakeX, centerY + shakeY, radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw floating decorative particles
      particles.forEach(p => {
        p.angle += 0.015;
        const orbitRadius = radius * 1.5 + Math.sin(angle + p.size) * 10;
        const pX = centerX + Math.cos(p.angle) * orbitRadius;
        const pY = centerY + Math.sin(p.angle) * orbitRadius;
        
        ctx.fillStyle = colorPrimary + '0.45)';
        ctx.beginPath();
        ctx.arc(pX, pY, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [state]);

  const getStateText = () => {
    switch (state) {
      case 'listening': return 'Listening...';
      case 'thinking': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Error';
      default: return 'Online / Idle';
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
      <div className="relative w-56 h-56 flex items-center justify-center bg-zinc-900/40 rounded-full border border-zinc-800 shadow-2xl backdrop-blur-md overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${
          state === 'listening' ? 'bg-cyan-400 animate-ping' :
          state === 'thinking' ? 'bg-indigo-400 animate-pulse' :
          state === 'speaking' ? 'bg-emerald-400 animate-pulse' :
          state === 'error' ? 'bg-red-500 animate-bounce' : 'bg-violet-400'
        }`} />
        <span className="text-sm font-semibold tracking-wide uppercase text-zinc-300">
          {getStateText()}
        </span>
      </div>
    </div>
  );
};

"use client";
import { useEffect, useRef } from 'react';

export default function RainEffect() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let drops = [];
    // Create raindrops
    for (let i = 0; i < 150; i++) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 10 + 10,
        opacity: Math.random() * 0.4 + 0.1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';

      drops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        // Slight angle for wind effect
        ctx.lineTo(drop.x - drop.length * 0.2, drop.y + drop.length);
        ctx.strokeStyle = `rgba(200, 210, 255, ${drop.opacity})`;
        ctx.stroke();

        drop.y += drop.speed;
        drop.x -= drop.speed * 0.2; // Move sideways with the wind

        // Reset drop if it goes off screen
        if (drop.y > height || drop.x < 0) {
          drop.y = -drop.length;
          drop.x = Math.random() * width + 50;
        }
      });
      requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 2, /* Above background, behind text */
        opacity: 0.6
      }} 
    />
  );
}

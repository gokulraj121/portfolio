"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./VoiceAgent.module.css";

export default function VoiceAgent({ onClick }) {
  const eyeLeft = useRef(null);
  const eyeRight = useRef(null);
  const containerRef = useRef(null);
  const eyeGroup = useRef(null);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Blinking logic
    const blink = () => {
      // Prevent running animation if component has unmounted
      if (!eyeLeft.current || !eyeRight.current) return;

      // 30% chance to double blink
      const isDouble = Math.random() > 0.7;
      
      const tl = gsap.timeline();
      tl.to([eyeLeft.current, eyeRight.current], {
        scaleY: 0.1,
        duration: 0.1,
        ease: "power2.inOut",
      }).to([eyeLeft.current, eyeRight.current], {
        scaleY: 1,
        duration: 0.1,
        ease: "power2.inOut",
      });

      if (isDouble) {
        tl.to([eyeLeft.current, eyeRight.current], {
          scaleY: 0.1,
          duration: 0.1,
          ease: "power2.inOut",
        }).to([eyeLeft.current, eyeRight.current], {
          scaleY: 1,
          duration: 0.1,
          ease: "power2.inOut",
        });
      }

      // Schedule next blink randomly between 2s and 6s
      blinkTimerRef.current = setTimeout(blink, 2000 + Math.random() * 4000);
    };

    const blinkTimerRef = { current: setTimeout(blink, 2000) };

    // Mouse tracking logic for the eyes
    const handleMouseMove = (e) => {
      if (!containerRef.current || !eyeGroup.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate delta from center
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      
      // Limit eye movement distance
      const maxMove = 12; 
      const moveX = (deltaX / window.innerWidth) * maxMove * 2;
      const moveY = (deltaY / window.innerHeight) * maxMove * 2;
      
      gsap.to(eyeGroup.current, {
        x: moveX,
        y: moveY - 20, // keep the baseline -20px offset
        duration: 0.5,
        ease: "power2.out"
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearTimeout(blinkTimerRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className={styles.draggableWrapper}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 100 : 10
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={styles.agentWrapper} onClick={!isDragging ? onClick : undefined}>
        <div className={styles.liquidRing} />
        <div className={styles.iceFace} ref={containerRef}>
          <div className={styles.eyeContainer} ref={eyeGroup}>
            <div className={styles.eye} ref={eyeLeft} />
            <div className={styles.eye} ref={eyeRight} />
          </div>
        </div>
        
        <div className={styles.statusText}>
          <div className={styles.statusIndicator} />
          Agent Online
        </div>
      </div>
    </div>
  );
}

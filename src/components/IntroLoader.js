"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./IntroLoader.module.css";

export default function IntroLoader({ onComplete }) {
  const loaderRef = useRef(null);
  const trackerRef = useRef(null);
  const dotLeft = useRef(null);
  const dotRight = useRef(null);
  const lineRef = useRef(null);
  
  const text1 = useRef(null);
  const text2 = useRef(null);
  const text3 = useRef(null);
  const text4 = useRef(null);
  
  const lbTop = useRef(null);
  const lbBottom = useRef(null);
  
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Counter animation
      const counterObj = { value: 0 };
      gsap.to(counterObj, {
        value: 100,
        duration: 5.5, // Slowed down for readability
        ease: "power2.inOut",
        onUpdate: () => {
          setProgress(Math.round(counterObj.value));
        }
      });

      // Initial states
      gsap.set(dotLeft.current, { x: -100, opacity: 0 });
      gsap.set(dotRight.current, { x: 100, opacity: 0 });
      gsap.set(lineRef.current, { scaleX: 0, opacity: 0 });
      gsap.set(trackerRef.current, { scale: 1 });
      
      const texts = [text1.current, text2.current, text3.current, text4.current];
      
      // Initial state for all texts: Massive, blurred, widely spaced, hidden
      gsap.set(texts, { 
        opacity: 0, 
        scale: 1.5, 
        filter: "blur(15px)",
        letterSpacing: "1em",
      });

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.to(loaderRef.current, {
            opacity: 0,
            duration: 0.6,
            ease: "power2.inOut",
            onComplete: () => onComplete()
          });
        }
      });

      // 1. Continuous cinematic camera push forward on the whole scene
      tl.to(trackerRef.current, { scale: 1.3, duration: 6, ease: "power1.inOut" }, 0);

      // 2. Dots appear
      tl.to([dotLeft.current, dotRight.current], { opacity: 1, duration: 0.8, ease: "power2.out" }, 0.2);

      // 3. Cinematic Text Sequence (Focus Pulls) with proper delay
      const textDuration = 1.1; // Time each text is clearly readable on screen
      
      texts.forEach((text, i) => {
        const startTime = i * textDuration + 0.5; // Added initial delay
        
        // Slam into focus
        tl.to(text, {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          letterSpacing: "0.4em",
          duration: 0.5,
          ease: "power4.out"
        }, startTime);

        // Fly away / Blur out
        tl.to(text, {
          opacity: 0,
          scale: 0.8,
          filter: "blur(5px)",
          duration: 0.4,
          ease: "power2.in"
        }, startTime + textDuration - 0.2);
      });

      const mergeTime = texts.length * textDuration + 0.5; // When the last text finishes

      // 4. Line connects just before merge
      tl.to(lineRef.current, { scaleX: 1, opacity: 0.5, duration: 0.8, ease: "power3.inOut" }, mergeTime - 0.8);

      // 5. Dots merge into the center
      tl.to(dotLeft.current, { x: 0, duration: 0.8, ease: "power4.inOut" }, mergeTime);
      tl.to(dotRight.current, { x: 0, duration: 0.8, ease: "power4.inOut" }, mergeTime);
      tl.to(lineRef.current, { scaleX: 0, duration: 0.8, ease: "power4.inOut" }, mergeTime);
      
      // 6. Merged dot fades away elegantly
      tl.to(dotLeft.current, { scale: 0, opacity: 0, duration: 0.5, ease: "power2.in" }, mergeTime + 0.6);
      
      // 7. Letterboxes slide away revealing the page
      tl.to(lbTop.current, { yPercent: -100, duration: 1, ease: "power4.inOut" }, mergeTime + 0.6);
      tl.to(lbBottom.current, { yPercent: 100, duration: 1, ease: "power4.inOut" }, mergeTime + 0.6);
      tl.to(".progressCounter", { opacity: 0, duration: 0.5 }, mergeTime + 0.6);

    }, loaderRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div className={styles.loaderContainer} ref={loaderRef}>
      <div className={styles.letterboxTop} ref={lbTop}></div>
      
      <div className={styles.cameraTracker} ref={trackerRef}>
        <div className={styles.animationWrapper}>
          <div className={styles.dot} ref={dotLeft} />
          <div className={styles.line} ref={lineRef} />
          <div className={styles.dot} ref={dotRight} />
        </div>
        <div className={styles.textWrapper}>
          <div className={styles.text} ref={text1}>Your Vision.</div>
          <div className={styles.text} ref={text2}>Strategic Design.</div>
          <div className={styles.text} ref={text3}>Flawless Code.</div>
          <div className={styles.text} ref={text4}>A Perfect Connection.</div>
        </div>
        <div className={`progressCounter ${styles.progressCounter}`}>
          {progress}%
        </div>
      </div>

      <div className={styles.letterboxBottom} ref={lbBottom}></div>
    </div>
  );
}

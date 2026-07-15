"use client";

import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import styles from "./TerminalLoader.module.css";

const lines = [
  "Initialize core systems...",
  "Loading creative assets...",
  "Compiling interfaces...",
  "Bypassing security protocols...",
  "Access granted.",
  "Launching experience..."
];

export default function TerminalLoader({ onComplete }) {
  const [displayedText, setDisplayedText] = useState([]);
  const loaderRef = useRef(null);
  const lightSweepRef = useRef(null);

  useEffect(() => {
    let currentLineIndex = 0;
    let currentCharIndex = 0;
    
    let currentLines = [""];
    let typingTimeout;

    const typeWriter = () => {
      if (currentLineIndex < lines.length) {
        if (currentCharIndex < lines[currentLineIndex].length) {
          currentLines[currentLineIndex] = lines[currentLineIndex].substring(0, currentCharIndex + 1);
          setDisplayedText([...currentLines]);
          currentCharIndex++;
          typingTimeout = setTimeout(typeWriter, Math.random() * 30 + 20);
        } else {
          currentLineIndex++;
          currentCharIndex = 0;
          if (currentLineIndex < lines.length) {
            currentLines.push("");
            typingTimeout = setTimeout(typeWriter, Math.random() * 150 + 50);
          } else {
            finishLoading();
          }
        }
      }
    };

    const finishLoading = () => {
      // Light sweep transition
      const tl = gsap.timeline({
        onComplete: () => {
          onComplete();
        }
      });

      // Quick pause before transition
      tl.to({}, { duration: 0.3 });

      // Light sweeps across the screen
      tl.to(lightSweepRef.current, {
        x: "150vw",
        opacity: 1,
        duration: 1.2,
        ease: "power2.inOut",
      });

      // Background fades to transparent as the light passes over
      tl.to(loaderRef.current, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
      }, "-=0.6"); // trigger slightly before the light sweep finishes
    };

    typingTimeout = setTimeout(typeWriter, 400);

    return () => clearTimeout(typingTimeout);
  }, [onComplete]);

  return (
    <div className={styles.terminalContainer} ref={loaderRef}>
      {/* Full Screen Terminal Content */}
      <div className={styles.terminalHeader}>
        <div className={styles.dot} style={{ backgroundColor: '#ff5f56' }}></div>
        <div className={styles.dot} style={{ backgroundColor: '#ffbd2e' }}></div>
        <div className={styles.dot} style={{ backgroundColor: '#27c93f' }}></div>
        <div className={styles.title}>guest@portfolio:~</div>
      </div>
      <div className={styles.terminalBody}>
        {displayedText.map((line, index) => (
          <div key={index} className={styles.terminalLine}>
            <span className={styles.prompt}>$</span> {line}
            {index === displayedText.length - 1 && <span className={styles.cursor}></span>}
          </div>
        ))}
      </div>

      {/* Light Sweep Element */}
      <div className={styles.lightSweep} ref={lightSweepRef}></div>
    </div>
  );
}


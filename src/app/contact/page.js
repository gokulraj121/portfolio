"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./contact.module.css";
import GLSLHills from "@/components/GLSLHills";
import LiquidGlassButton from "@/components/LiquidGlassButton";
import VoiceAgent from "@/components/VoiceAgent";

export default function Contact() {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Animate the massive typography
      gsap.to(".hero-word", {
        y: "0%",
        duration: 1.2,
        stagger: 0.1,
        ease: "power4.out",
        delay: 0.2,
      });

      // 2. Fade in subheadline and button
      gsap.to(".hero-fade", {
        opacity: 1,
        y: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        delay: 0.8,
      });

      // 3. Fade in the Voice Agent
      gsap.fromTo(
        ".agent-reveal",
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.5,
          ease: "power3.out",
          delay: 0.6,
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <main className={styles.page} ref={containerRef}>
      {/* GLSL Hills Background */}
      <GLSLHills />

      <div className={styles.splitContainer}>
        
        {/* ─── LEFT: KINETIC TYPOGRAPHY ─── */}
        <div className={styles.leftCol}>
          <h1 className={styles.headline}>
            <span className={styles.wordMask}>
              <span className={`${styles.word} hero-word`}>LET'S</span>
            </span>
            <span className={styles.wordMask}>
              <span className={`${styles.word} hero-word`}>BUILD</span>
            </span>
            <span className={styles.wordMask}>
              <span className={`${styles.word} hero-word`}>SOMETHING</span>
            </span>
            <span className={styles.wordMask}>
              <span className={`${styles.word} hero-word`}>EXTRAORDINARY.</span>
            </span>
          </h1>
          
          <p className={`${styles.subHeadline} hero-fade`}>
            Whether you have a fully formed vision or just a rough idea, I'm here to bring it to life with precision and style.
          </p>

          <div className="hero-fade" style={{ 
            opacity: 0, 
            transform: "translateY(20px)", 
            display: "flex", 
            gap: "1rem", 
            flexWrap: "wrap",
            marginTop: "1rem" 
          }}>
            <LiquidGlassButton href="mailto:hello@vgr.design">
              Gmail
            </LiquidGlassButton>
            <LiquidGlassButton href="https://discord.com" target="_blank" rel="noopener noreferrer">
              Discord
            </LiquidGlassButton>
            <LiquidGlassButton href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub
            </LiquidGlassButton>
            <LiquidGlassButton href="https://reddit.com" target="_blank" rel="noopener noreferrer">
              Reddit
            </LiquidGlassButton>
          </div>
        </div>

        {/* ─── RIGHT: VOICE AGENT ─── */}
        <div className={styles.rightCol}>
          <div className="agent-reveal">
            <VoiceAgent onClick={() => window.location.href = "mailto:hello@vgr.design"} />
          </div>
        </div>

      </div>
    </main>
  );
}

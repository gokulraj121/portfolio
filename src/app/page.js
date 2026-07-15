"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import Image from "next/image";
import styles from "./page.module.css";
import LiquidGlassButton from "@/components/LiquidGlassButton";
import ParticleField from "@/components/ParticleField";
import AlienTubeWidget from "@/components/AlienTubeWidget";
import BackgroundOrbs from "@/components/BackgroundOrbs";

import { globalStore } from "@/utils/store";

// Helper component to split text into word-spans for GSAP animation
const SplitText = ({ text, textRefs }) => {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingRight: "0.25em", paddingBottom: "0.1em" }}>
          <span 
            ref={(el) => { if (el) textRefs.current.push(el); }}
            style={{ display: "inline-block", opacity: 0 }}
          >
            {word}
          </span>
        </span>
      ))}
    </>
  );
};

export default function Home() {
  // Ensure the clean theme is forced (clears any lingering dark mode state from hot-reloads)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "clean");
  }, []);
  
  const container = useRef(null);
  const heroImageRef = useRef(null);
  const widgetsRef = useRef([]);
  const heroTextRefs = useRef([]);
  const wordsRef = useRef([]);
  const leftCardRef = useRef(null);
  const rightCardRef = useRef(null);
  const leftCardTextRef = useRef([]);
  const [isReady, setIsReady] = useState(globalStore.hasLoaded);

  // Dynamic Scaling for short/wide screens
  const handleResize = useCallback(() => {
    if (typeof window === "undefined" || !container.current) return;
    
    const nominalHeight = 850; // The baseline height where everything looks normal
    const currentHeight = window.innerHeight;
    
    let scale = 1;
    if (currentHeight < nominalHeight) {
       scale = Math.max(0.3, currentHeight / nominalHeight);
    }
    
    container.current.style.setProperty("--dynamic-scale", scale);
  }, []);

  useEffect(() => {
    handleResize(); // Initial calculation
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  // Effect for entrance animations that trigger AFTER loading
  useEffect(() => {
    // Check if IntroLoader is already complete via globalStore, otherwise wait for the event
    if (!isReady) return; 

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      
      // The cards stay hidden until hovered, so we won't fade them in on entrance.
      // Instead, we just animate the other elements.
      tl.fromTo(
        heroTextRefs.current,
        { x: -50, opacity: 0, scale: 0.95 },
        { x: 0, opacity: 1, scale: 1, duration: 1.5, stagger: 0.2, ease: "power3.out" }
      )
      .fromTo(
        wordsRef.current,
        { opacity: 0, scale: 0.8, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.03, ease: "back.out(1.5)" },
        "-=1.0" // Start while headline is animating
      )
      .fromTo(
        heroImageRef.current,
        { y: 150, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1.2 },
        "-=0.6"
      )
      .fromTo(
        widgetsRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.1 },
        "-=1.0"
      );
    }, container);
    return () => ctx.revert();
  }, [isReady]);



  useEffect(() => {
    if (globalStore.hasLoaded) return;
    
    const onIntroComplete = () => {
      setIsReady(true);
    };
    window.addEventListener("introComplete", onIntroComplete);
    return () => window.removeEventListener("introComplete", onIntroComplete);
  }, []);

  return (
    <>
      <main className={styles.main} ref={container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          {/* Lusion-style white nebula particle flow */}
          <ParticleField />

          <div className={styles.heroTextContainer}>
            <h1 className={styles.heroHeadline}>
              <span className={styles.textLine}>
                <span className={styles.textInner} ref={el => heroTextRefs.current[0] = el} style={{ opacity: 0 }}>BEYOND</span>
              </span>
              <span className={styles.textLine}>
                <span className={styles.textInner} ref={el => heroTextRefs.current[1] = el} style={{ opacity: 0 }}>REALITY.</span>
              </span>
            </h1>
            <p className={styles.heroSubheadline}>
              <SplitText text="Crafting immersive digital dimensions that blur the boundary between science fiction and reality." textRefs={wordsRef} />
            </p>
          </div>

          <div className={styles.bottomLeftWidget}>
            <SplitText text="Digital craftsmanship and interactive experiences tailored for visionary brands." textRefs={wordsRef} />
          </div>

          <div 
            className={styles.bottomRightWidget} 
            ref={el => widgetsRef.current[0] = el} 
            style={{ opacity: 0 }}
          >
            <div className={styles.statusDot}></div>
            <div className={styles.statusText}>Available for Work</div>
          </div>

          <div className={styles.heroImageContainer} ref={heroImageRef} style={{ opacity: 0 }}>
            <img 
              src="/images/bg.png" 
              alt="VGR Avatar"
              className={styles.heroImage}
            />
          </div>
        </section>
      </main>
    </>
  );
}




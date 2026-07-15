"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import styles from "./Header.module.css";
import LiquidGlassButton from "./LiquidGlassButton";
import { globalStore } from "@/utils/store";
import TransitionLink from "./TransitionLink";
import MagneticButton from "./MagneticButton";
import MenuOverlay from "./MenuOverlay";

export default function Header() {
  const [time, setTime] = useState("");
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const logoRef = useRef(null);
  const navRef = useRef(null);
  const btnRef = useRef(null);
  const timeRef = useRef(null);

  // Clock
  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine when to mount the header
  useEffect(() => {
    const isLandingPage = window.location.pathname === "/";
    if (globalStore.hasLoaded || !isLandingPage) {
      setIsReady(true);
    } else {
      const onComplete = () => setIsReady(true);
      window.addEventListener("introComplete", onComplete);
      return () => window.removeEventListener("introComplete", onComplete);
    }
  }, []);

  // Entrance Animation runs once when header mounts
  useEffect(() => {
    if (!isReady) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      
      tl.fromTo(
        logoRef.current,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, delay: 0.2 }
      )
      .fromTo(
        navRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, clearProps: "all" },
        "-=0.8"
      )
      .fromTo(
        btnRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1 },
        "-=0.8"
      )
      .fromTo(
        timeRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 1 },
        "-=0.8"
      );
    });
    return () => ctx.revert();
  }, [isReady]);

  if (!isReady) return null;

  // Work and About use cinematic dark backgrounds; the rest of the site is light.
  const isLightMode = pathname !== "/about";
  const headerStyle = {
    "--logo-color": isLightMode ? "#000000" : "#ffffff",
    "--widget-color": isLightMode ? "#000000" : "#ffffff",
    "--btn-bg": isLightMode ? "#000000" : "#ffffff",
    "--btn-text": isLightMode ? "#ffffff" : "#000000",
    "--btn-border": isLightMode ? "#000000" : "rgba(255, 255, 255, 0.2)",
  };

  return (
    <header style={headerStyle}>
      <div className={styles.logo} ref={logoRef}>
        <TransitionLink href="/" style={{ textDecoration: 'none', color: 'inherit' }}>VGR</TransitionLink>
      </div>
      <div style={{ position: 'absolute', top: '40px', right: '400px', zIndex: 100 }}>
        <MagneticButton intensity={0.6}>
          <button 
            className={styles.magneticMenuBtn}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            MENU
          </button>
        </MagneticButton>
        <MenuOverlay 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
      </div>

      <div className={styles.headerHint}>
        {pathname === "/" ? "[ Click Swarm to Interact ]" : "[ VGR / Digital Experiments ]"}
      </div>

      <div 
        className={styles.headerButtonWrapper} 
        ref={btnRef} 
      >
        <TransitionLink href="/contact" style={{ textDecoration: 'none' }}>
          <LiquidGlassButton>Let's Talk</LiquidGlassButton>
        </TransitionLink>
      </div>

      <div 
        className={styles.topRightWidget} 
        ref={timeRef} 
      >
        <div className={styles.timeText}>{time}</div>
        <div className={styles.locationText}>Local Time</div>
      </div>
    </header>
  );
}

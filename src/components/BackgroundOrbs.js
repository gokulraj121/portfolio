"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./BackgroundOrbs.module.css";

export default function BackgroundOrbs() {
  const containerRef = useRef(null);
  const orb1Ref = useRef(null);
  const orb2Ref = useRef(null);
  const orb3Ref = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Slow, continuous drifting animation
      gsap.to(orb1Ref.current, {
        x: "15vw",
        y: "20vh",
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      gsap.to(orb2Ref.current, {
        x: "-20vw",
        y: "-15vh",
        duration: 15,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2
      });

      gsap.to(orb3Ref.current, {
        x: "10vw",
        y: "-25vh",
        duration: 18,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 5
      });

      // Mouse parallax effect
      const handleMouseMove = (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        gsap.to(orb1Ref.current, {
          xPercent: x * -10,
          yPercent: y * -10,
          duration: 1,
          ease: "power2.out"
        });
        
        gsap.to(orb2Ref.current, {
          xPercent: x * 15,
          yPercent: y * 15,
          duration: 1,
          ease: "power2.out"
        });

        gsap.to(orb3Ref.current, {
          xPercent: x * -5,
          yPercent: y * -5,
          duration: 1,
          ease: "power2.out"
        });
      };

      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={`${styles.orb} ${styles.orb1}`} ref={orb1Ref}></div>
      <div className={`${styles.orb} ${styles.orb2}`} ref={orb2Ref}></div>
      <div className={`${styles.orb} ${styles.orb3}`} ref={orb3Ref}></div>
      {/* Noise overlay to give it a premium textured feel */}
      <div className={styles.noise}></div>
    </div>
  );
}

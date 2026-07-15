"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./MenuOverlay.module.css";
import TransitionLink from "./TransitionLink";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/work", label: "Work" },
  { href: "/contact", label: "Contact" },
];

export default function MenuOverlay({ isOpen, onClose }) {
  const overlayRef = useRef(null);
  const linksRef = useRef([]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (isOpen) {
      // Animate In: scale from 0.95, fade in
      gsap.fromTo(overlay, 
        { opacity: 0, scale: 0.95, y: -10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
      
      gsap.fromTo(
        linksRef.current,
        { y: 15, opacity: 0 },
        { 
          y: 0, 
          opacity: 1, 
          duration: 0.4, 
          stagger: 0.05, 
          ease: "power2.out",
          delay: 0.1
        }
      );
    } else {
      // Animate Out: scale to 0.95, fade out
      gsap.to(linksRef.current, { 
        y: -10, 
        opacity: 0, 
        duration: 0.2, 
        stagger: 0.02, 
        ease: "power2.in" 
      });
      
      gsap.to(overlay, { 
        opacity: 0, 
        scale: 0.95,
        y: -10,
        duration: 0.3, 
        ease: "power3.in",
        delay: 0.1
      });
    }
  }, [isOpen]);

  return (
    <div 
      ref={overlayRef} 
      className={`${styles.dropdown} ${isOpen ? styles.dropdownOpen : ""}`}
    >
      <nav className={styles.menuNav}>
        {links.map((link, index) => (
          <div key={link.href} className={styles.menuLinkWrapper}>
            <div ref={(el) => (linksRef.current[index] = el)}>
              <TransitionLink 
                href={link.href} 
                className={styles.menuLink}
                onClick={onClose}
              >
                {link.label}
              </TransitionLink>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

"use client";

import React from 'react';
import styles from './LiquidGlassButton.module.css';

export default function LiquidGlassButton({ children = "Let's Talk", onClick, className = "" }) {
  return (
    <button className={`${styles.liquidGlassButton} ${className}`} onClick={onClick}>
      <span className={styles.buttonText}>{children}</span>
    </button>
  );
}

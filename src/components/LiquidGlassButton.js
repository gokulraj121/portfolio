"use client";

import React from 'react';
import Link from 'next/link';
import styles from './LiquidGlassButton.module.css';

export default function LiquidGlassButton({ children = "Let's Talk", href, onClick, className = "", ...props }) {
  const combinedClassName = `${styles.liquidGlassButton} ${className}`;

  if (href) {
    const isExternal = href.startsWith('http') || href.startsWith('mailto:');
    if (isExternal) {
      return (
        <a href={href} className={combinedClassName} onClick={onClick} {...props}>
          <span className={styles.buttonText}>{children}</span>
        </a>
      );
    }
    return (
      <Link href={href} className={combinedClassName} onClick={onClick} {...props}>
        <span className={styles.buttonText}>{children}</span>
      </Link>
    );
  }

  return (
    <button className={combinedClassName} onClick={onClick} {...props}>
      <span className={styles.buttonText}>{children}</span>
    </button>
  );
}

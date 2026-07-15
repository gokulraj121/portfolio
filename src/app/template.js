"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function Template({ children }) {
  const container = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Sleek fade and slide up transition whenever a new route mounts
      gsap.fromTo(
        container.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
    });
    return () => ctx.revert();
  }, []);

  return <div ref={container}>{children}</div>;
}

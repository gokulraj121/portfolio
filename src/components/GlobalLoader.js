"use client";

import { useState } from "react";
import IntroLoader from "@/components/IntroLoader";
import { globalStore } from "@/utils/store";

export default function GlobalLoader({ children }) {
  const [isLoading, setIsLoading] = useState(!globalStore.hasLoaded);

  const handleLoadingComplete = () => {
    globalStore.hasLoaded = true;
    setIsLoading(false);
    // Give a tiny delay for React to mount children before firing the animation triggers
    setTimeout(() => {
      window.dispatchEvent(new Event("introComplete"));
    }, 50);
  };

  if (isLoading) {
    // Return ONLY the loader. Nothing else is mounted. 
    // This completely removes the swarm, header, and buttons from the DOM during loading.
    return <IntroLoader onComplete={handleLoadingComplete} />;
  }

  // Once loaded, render the actual app
  return <>{children}</>;
}

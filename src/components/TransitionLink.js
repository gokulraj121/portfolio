"use client";

import { usePathname } from "next/navigation";
import { globalStore } from "@/utils/store";

export default function TransitionLink({ href, children, className, style, onClick }) {
  const pathname = usePathname();

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (pathname === href) return;
    
    e.preventDefault();
    
    // Set the target route in the global store and trigger the collapse
    globalStore.targetRoute = href;
    globalStore.portalState = 'collapsing';
    
    // Dispatch a custom event to notify Murmuration to begin the teleportation
    window.dispatchEvent(new Event("triggerPortalTransition"));
  };

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}

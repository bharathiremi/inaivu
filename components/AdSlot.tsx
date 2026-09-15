"use client";

import { useEffect, useRef } from "react";
import "./AdSlot.css";

type AdSlotProps = {
  adSlot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  responsive?: boolean;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function AdSlot({
  adSlot,
  format = "auto",
  responsive = true,
  className = "",
}: AdSlotProps) {
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!adRef.current) return;

    try {
      if (
        typeof window !== "undefined" &&
        Array.isArray(window.adsbygoogle)
      ) {
        window.adsbygoogle.push({});
      }
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  return (
    <div
      className={`inaivu-ad-wrapper ${className}`}
      aria-label="Advertisement"
    >
      <div className="inaivu-ad-label">ADVERTISEMENT</div>

      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "block",
          width: "100%",
          minHeight: "90px",
        }}
        data-ad-client="ca-pub-YOUR_ADSENSE_PUBLISHER_ID"
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
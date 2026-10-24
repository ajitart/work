"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

// GoatCounter: privacy-friendly visitor counts (no cookies, so no consent banner).
// Dashboard: https://ajitart.goatcounter.com
const ENDPOINT = "https://ajitart.goatcounter.com/count";

type GoatCounter = { count: (vars: { path: string; title?: string; event?: boolean }) => void };

/**
 * Counts one view per page, including moves between pages inside the site
 * (which a plain script tag would miss). Visits from a browser with editing
 * turned on are skipped (GoatCounter honours localStorage "skipgc").
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let tries = 0;
    const send = () => {
      const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
      if (gc?.count) gc.count({ path: window.location.pathname, title: document.title });
      else if (tries++ < 20) setTimeout(send, 250);
    };
    // Let the new page set its title first.
    const t = setTimeout(send, 50);
    return () => clearTimeout(t);
  }, [pathname]);

  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      src="https://gc.zgo.at/count.js"
      data-goatcounter={ENDPOINT}
      data-goatcounter-settings='{"no_onload": true}'
      strategy="afterInteractive"
    />
  );
}

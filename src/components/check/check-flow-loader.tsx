"use client";

import dynamic from "next/dynamic";

/**
 * Loads the check flow in the browser only. It restores progress from
 * sessionStorage and uses the map and canvas, none of which exist during
 * server rendering.
 */
export const CheckFlowLoader = dynamic(() => import("./check-flow").then((m) => m.CheckFlow), {
  ssr: false,
  loading: () => <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-muted" />,
});

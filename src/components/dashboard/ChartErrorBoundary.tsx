"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Recharts' ResponsiveContainer measures its DOM container via
 * ResizeObserver and has known intermittent internal errors when that
 * measurement races the browser's layout pass (a long-standing upstream
 * issue class, not specific to our data). A third-party charting library's
 * internal hiccup should never take down an entire page — this boundary
 * contains it to the chart panel and shows a graceful fallback instead.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Chart rendering failed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-ink-faint">
          Chart temporarily unavailable.
        </div>
      );
    }
    return this.props.children;
  }
}

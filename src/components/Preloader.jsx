// src/components/Preloader.jsx
import { useEffect, useState } from "react";

/**
 * Professional Preloader Component
 * Similar to YouTube/LinkedIn loading experience
 * 
 * @param {string} variant - "page" | "inline" | "skeleton"
 * @param {string} message - Optional loading message
 */
export default function Preloader({ variant = "page", message = "" }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Full page preloader (like YouTube)
  if (variant === "page") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6">
          {/* Animated Logo */}
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-2xl font-black text-white">H</span>
            </div>
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-2xl border-4 border-transparent border-t-purple-600 animate-spin" />
          </div>

          {/* Brand name with animation */}
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              TWITE HRMS
            </h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold">
                {message || "Loading"}
                {dots}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full animate-progress" />
          </div>
        </div>
      </div>
    );
  }

  // Inline preloader (for sections)
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow animate-pulse">
              <span className="text-lg font-black text-white">H</span>
            </div>
            <div className="absolute inset-0 rounded-xl border-3 border-transparent border-t-purple-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {message || "Loading"}
            {dots}
          </p>
        </div>
      </div>
    );
  }

  // Skeleton loader (like LinkedIn)
  if (variant === "skeleton") {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-5/6" />
          <div className="h-4 bg-slate-200 rounded w-4/6" />
        </div>

        {/* Card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-4 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-8 bg-slate-200 rounded w-1/2" />
              <div className="h-3 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// Shimmer effect for skeleton (optional enhancement)
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-white p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-2 bg-slate-200 rounded w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-5/6" />
        <div className="h-3 bg-slate-200 rounded w-4/6" />
      </div>
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4">
            <div className="grid grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 bg-slate-200 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

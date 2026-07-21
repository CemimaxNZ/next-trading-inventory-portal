"use client";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  caption?: string;
};

const sizeMap = {
  sm: {
    wordmark: "text-[2rem]",
    caption: "text-[0.62rem]",
    accent: "h-1.5 w-10",
  },
  md: {
    wordmark: "text-[2.75rem]",
    caption: "text-[0.68rem]",
    accent: "h-1.5 w-12",
  },
  lg: {
    wordmark: "text-[4.8rem] sm:text-[5.6rem]",
    caption: "text-[0.74rem]",
    accent: "h-2 w-16",
  },
} as const;

export function BrandMark({
  className,
  tone = "dark",
  size = "md",
  caption = "Next Trading",
}: BrandMarkProps) {
  const palette =
    tone === "light"
      ? {
          word: "text-white",
          caption: "text-brand-100/90",
          accent: "bg-brand-300",
        }
      : {
          word: "text-slate-950",
          caption: "text-slate-500",
          accent: "bg-brand-400",
        };

  const scale = sizeMap[size];

  return (
    <div className={cn("inline-flex flex-col", className)}>
      <span
        className={cn(
          "font-black uppercase leading-none tracking-[-0.14em]",
          palette.word,
          scale.wordmark,
        )}
        style={{ fontFamily: '"Arial Black", "Helvetica Neue", sans-serif' }}
      >
        NEXT
      </span>
      <span className={cn("mt-2 rounded-full", palette.accent, scale.accent)} />
      <span className={cn("mt-2 uppercase tracking-[0.32em]", palette.caption, scale.caption)}>
        {caption}
      </span>
    </div>
  );
}

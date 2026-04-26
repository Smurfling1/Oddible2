import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const stateStyles = {
  default: {
    badge: "bg-slate-100 text-slate-500",
    label: "Ready",
    tile:
      "border-slate-200/80 bg-white/80 text-slate-900 shadow-soft hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.10)]"
  },
  selected: {
    badge: "bg-white/15 text-white",
    label: "Selected",
    tile: "border-slate-900 bg-slate-900 text-white shadow-[0_22px_40px_rgba(15,23,42,0.20)]"
  },
  correct: {
    badge: "bg-white/15 text-white",
    label: "Correct",
    tile: "border-emerald-500 bg-emerald-500 text-white shadow-[0_24px_44px_rgba(16,185,129,0.24)]"
  },
  incorrect: {
    badge: "bg-rose-100 text-rose-700",
    label: "Miss",
    tile: "border-rose-300 bg-rose-50 text-rose-950 shadow-[0_18px_34px_rgba(244,63,94,0.10)]"
  }
};

export const ChoiceTile = forwardRef(function ChoiceTile(
  { category, disabled, onClick, onKeyDown, option, selected, submittedState },
  ref
) {
  const visualState = submittedState || (selected ? "selected" : "default");
  const style = stateStyles[visualState];

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${category} option ${option.label}${selected ? ", selected" : ""}${submittedState ? `, ${stateStyles[submittedState].label.toLowerCase()}` : ""}`}
      aria-pressed={selected}
      className={cn(
        "group relative min-h-[78px] rounded-[20px] border px-3 py-3 text-left transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed sm:min-h-[84px] sm:rounded-[22px] sm:px-3.5 sm:py-3.5",
        style.tile,
        disabled && !selected && "opacity-60"
      )}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent sm:inset-x-4" />

      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div>
          <span className="block text-sm font-semibold leading-5 tracking-[0.02em] sm:text-[15px] sm:leading-5">{option.label}</span>
        </div>

        <span
          className={cn(
            "rounded-full px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] sm:px-2.5 sm:text-[10px] sm:tracking-[0.22em]",
            style.badge
          )}
        >
          {style.label}
        </span>
      </div>
    </button>
  );
});

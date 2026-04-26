import { useRef } from "react";
import { ChoiceTile } from "@/components/choice-tile";

export function ChoiceGrid({
  categoryLabel,
  columns,
  description,
  disabled,
  eyebrow,
  onSelect,
  options,
  resolveState,
  selectedValue,
  title
}) {
  const buttonRefs = useRef([]);
  const gridColumnsClass = columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  const handleKeyDown = (event, index) => {
    let nextIndex = null;

    if (event.key === "ArrowRight") {
      nextIndex = Math.min(index + 1, options.length - 1);
    }

    if (event.key === "ArrowLeft") {
      nextIndex = Math.max(index - 1, 0);
    }

    if (event.key === "ArrowDown") {
      nextIndex = Math.min(index + columns, options.length - 1);
    }

    if (event.key === "ArrowUp") {
      nextIndex = Math.max(index - columns, 0);
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-slate-50/65 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:rounded-[28px] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1.5 font-display text-2xl font-black uppercase tracking-[0.08em] text-slate-950 sm:mt-2 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-5 text-slate-600 sm:mt-2">{description}</p>
        </div>

        <div className="hidden rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:inline-flex">
          {options.length} options
        </div>
      </div>

      <div className={`mt-4 grid gap-2.5 sm:gap-3 ${gridColumnsClass}`}>
        {options.map((option, index) => (
          <ChoiceTile
            key={option.label}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            category={categoryLabel}
            disabled={disabled}
            onClick={() => onSelect(option.label)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            option={option}
            selected={selectedValue === option.label}
            submittedState={resolveState(option.label)}
          />
        ))}
      </div>
    </section>
  );
}

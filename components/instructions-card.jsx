import { cn } from "@/lib/cn";

const legendItems = [
  { label: "Selected", tone: "selected" },
  { label: "Correct", tone: "correct" },
  { label: "Miss", tone: "incorrect" }
];

const legendClasses = {
  correct: "border-emerald-300 bg-emerald-50 text-emerald-800",
  incorrect: "border-rose-300 bg-rose-50 text-rose-800",
  selected: "border-slate-900 bg-slate-900 text-white"
};

export function InstructionsCard({ gameState, maxAttempts }) {
  return (
    <aside className="grid gap-4">
      <section className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
        <p className="eyebrow">How It Works</p>
        <h3 className="mt-1.5 text-xl font-semibold tracking-[0.01em] text-slate-950 sm:mt-2 sm:text-2xl">
          Guess the sound chain
        </h3>

        <div className="mt-4 space-y-2.5 text-sm leading-5 text-slate-600 sm:mt-5 sm:space-y-3 sm:leading-6">
          <div className="flex gap-2.5 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 sm:gap-3 sm:rounded-[22px] sm:px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 sm:h-8 sm:w-8 sm:text-xs sm:tracking-[0.16em]">
              1
            </span>
            <p>Pick exactly one instrument and one effect. Buttons support tabbing, arrow keys, and visible focus styles.</p>
          </div>

          <div className="flex gap-2.5 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 sm:gap-3 sm:rounded-[22px] sm:px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cool)] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 sm:h-8 sm:w-8 sm:text-xs sm:tracking-[0.16em]">
              2
            </span>
            <p>Submit your guess to reveal whether each selected tile is correct or missed. You get {maxAttempts} attempts each day.</p>
          </div>

          <div className="flex gap-2.5 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 sm:gap-3 sm:rounded-[22px] sm:px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--warm)] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 sm:h-8 sm:w-8 sm:text-xs sm:tracking-[0.16em]">
              3
            </span>
            <p>Use the results panel to review today's guesses. Reset only clears your current unsubmitted picks.</p>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
        <p className="eyebrow">State Legend</p>
        <h3 className="mt-1.5 text-xl font-semibold tracking-[0.01em] text-slate-950 sm:mt-2 sm:text-2xl">
          Read the tiles fast
        </h3>

        <div className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-3 sm:gap-3">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-[18px] border px-3 py-3 text-center text-sm font-semibold sm:rounded-[22px] sm:px-4 sm:py-4",
                legendClasses[item.tone]
              )}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[20px] border border-dashed border-slate-200/80 bg-slate-50/70 px-4 py-3.5 text-sm leading-5 text-slate-600 sm:mt-5 sm:leading-6">
          {gameState === "won"
            ? "Today's ODDIBLE is solved. Next puzzle available tomorrow."
            : gameState === "lost"
              ? "You've finished today's ODDIBLE. Come back tomorrow for a new sound."
              : `A single daily sound stays locked in all day. You have ${maxAttempts} total attempts.`}
        </div>
      </section>
    </aside>
  );
}

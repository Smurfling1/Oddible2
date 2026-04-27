import { cn } from "@/lib/cn";

export function ResultsPanel({
  answer,
  attempts,
  attemptsRemaining,
  gameState,
  isPremiumMode,
  maxAttempts
}) {
  const attemptsToShow = [...attempts].reverse();

  return (
    <section className="glass-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="eyebrow">Results Panel</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-[0.01em] text-slate-950 sm:mt-2 sm:text-2xl">
            Session Tape
          </h3>
          <p className="mt-1.5 text-sm leading-5 text-slate-600 sm:mt-2 sm:leading-6">
            {isPremiumMode
              ? "Every submitted guess gets logged here for your current unlimited round."
              : "Every submitted guess gets logged here for today's ODDIBLE challenge."}
          </p>
        </div>

        <div className="rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.24em]">
          {attempts.length}/{maxAttempts} {isPremiumMode ? "Round" : "Today"}
        </div>
      </div>

      {attemptsToShow.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-dashed border-slate-200/80 bg-slate-50/70 px-4 py-4 text-sm leading-5 text-slate-600 sm:mt-5">
          {isPremiumMode
            ? "No guesses yet. Build a combo above and submit it to start this unlimited round."
            : "No guesses yet. Build a combo above and submit it to start today's tape."}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
          {attemptsToShow.map((attempt, index) => (
            <article
              key={attempt.id}
              className={cn(
                "rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-3.5 shadow-soft sm:p-4",
                index === 0 && "animate-card-rise"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 sm:text-[11px] sm:tracking-[0.28em]">
                  Attempt {attempt.id}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:px-3 sm:text-xs sm:tracking-[0.18em]",
                    attempt.correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200/80 text-slate-600"
                  )}
                >
                  {attempt.correct ? "Correct" : "Submitted"}
                </span>
              </div>

              <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] md:items-center md:gap-3">
                <GuessBadge
                  category="Instrument"
                  label={attempt.instrument}
                  matched={attempt.instrumentMatch}
                />

                <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 font-display text-2xl font-black text-slate-900 md:flex">
                  +
                </div>

                <GuessBadge category="Effect" label={attempt.effect} matched={attempt.effectMatch} />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-950 px-4 py-3.5 text-white sm:mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70 sm:text-[11px] sm:tracking-[0.28em]">
          {isPremiumMode ? "Unlimited Status" : "Daily Status"}
        </p>
        <p className="mt-1.5 text-base font-semibold sm:mt-2 sm:text-lg">
          {isPremiumMode
            ? `Attempt ${attempts.length + 1} of ${maxAttempts}. ${attemptsRemaining} attempts remaining in this round.`
            : gameState === "won"
            ? "You solved today's ODDIBLE."
            : gameState === "lost"
              ? `Locked until tomorrow. Today's sound was ${answer.instrument} + ${answer.effect}.`
              : `Attempt ${attempts.length + 1} of ${maxAttempts}. ${attemptsRemaining} attempts remaining.`}
        </p>
      </div>
    </section>
  );
}

function GuessBadge({ category, label, matched }) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-3 py-3 sm:rounded-[20px] sm:px-4 sm:py-4",
        matched
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70 sm:text-[11px] sm:tracking-[0.24em]">{category}</p>
      <p className="mt-1.5 text-base font-semibold leading-5 sm:mt-2 sm:text-lg">{label}</p>
    </div>
  );
}

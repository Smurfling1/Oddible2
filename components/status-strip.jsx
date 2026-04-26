import { cn } from "@/lib/cn";

const statusMeta = {
  lost: {
    note: "Next puzzle available tomorrow",
    value: "Locked"
  },
  playing: {
    note: "Ready to play today's challenge",
    value: "Live"
  },
  won: {
    note: "Solved for today",
    value: "Solved"
  }
};

export function StatusStrip({
  attemptsRemaining,
  attemptsUsed,
  comboLabel,
  countdown,
  gameState,
  maxAttempts
}) {
  const cards = [
    {
      label: "Attempts Left",
      note:
        gameState === "playing"
          ? `Attempt ${attemptsUsed + 1} of ${maxAttempts}`
          : `Used ${attemptsUsed} of ${maxAttempts}`,
      value: String(attemptsRemaining)
    },
    {
      label: "Challenge Mode",
      note: `${comboLabel} puzzle resets daily`,
      value: "Daily"
    },
    {
      label: "Status",
      note: statusMeta[gameState].note,
      value: statusMeta[gameState].value
    }
  ];

  return (
    <div className="mt-5 w-full sm:mt-6">
      <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              "glass-panel rounded-[20px] px-3.5 py-3 text-left sm:rounded-[22px] sm:px-4 sm:py-3.5",
              card.label === "Attempts Left" && "border-[rgba(184,243,107,0.7)]"
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-[11px] sm:tracking-[0.24em]">{card.label}</p>
            <p className="mt-1.5 font-display text-2xl font-black uppercase tracking-[0.06em] text-slate-950 sm:mt-2 sm:text-3xl sm:tracking-[0.08em]">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{card.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-[11px] sm:tracking-[0.24em]">
        {gameState === "won" || gameState === "lost" ? "Come back in" : "Next puzzle in"}: {countdown}
      </p>
    </div>
  );
}

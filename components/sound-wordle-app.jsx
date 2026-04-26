"use client";

import { useEffect, useRef, useState } from "react";
import { ChoiceGrid } from "@/components/choice-grid";
import { InstructionsCard } from "@/components/instructions-card";
import { ResultsPanel } from "@/components/results-panel";
import { StatusStrip } from "@/components/status-strip";
import { cn } from "@/lib/cn";
import {
  getAvailableSoundCombinations,
  getAvailableSoundPath,
  getPreviewAudio,
  stopSoundPlayback,
  warnMissingSound
} from "@/lib/sound-player";

const feedbackToneClasses = {
  neutral: "border-slate-200/80 bg-slate-50/80 text-slate-900",
  correct: "border-emerald-300 bg-emerald-50 text-emerald-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  danger: "border-rose-300 bg-rose-50 text-rose-950"
};

const DAILY_PROGRESS_STORAGE_KEY = "oddible-daily-progress";
const DEFAULT_DATE_KEY = "1970-01-01";
const CHALLENGE_DATE_KEY_SEPARATOR = "::";

function getTimeUntilNextMidnight(now = new Date()) {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const totalSeconds = Math.max(
    Math.floor((nextMidnight.getTime() - now.getTime()) / 1000),
    0
  );
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function getTodayDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateSeed(dateKey) {
  let hash = 2166136261;

  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildChallengeDateKey(baseDateKey, round = 0) {
  if (round <= 0) {
    return baseDateKey;
  }

  return `${baseDateKey}${CHALLENGE_DATE_KEY_SEPARATOR}${round}`;
}

function parseChallengeDateKey(dateKey) {
  const [baseDateKey = DEFAULT_DATE_KEY, roundValue] = String(dateKey).split(
    CHALLENGE_DATE_KEY_SEPARATOR
  );
  const round = Number.parseInt(roundValue ?? "0", 10);

  return {
    baseDateKey,
    round: Number.isNaN(round) ? 0 : Math.max(round, 0)
  };
}

function isChallengeDateKeyForToday(dateKey, todayDateKey) {
  return parseChallengeDateKey(dateKey).baseDateKey === todayDateKey;
}

function getNextChallengeDateKey(dateKey) {
  const { baseDateKey, round } = parseChallengeDateKey(dateKey);
  return buildChallengeDateKey(baseDateKey, round + 1);
}

function generateDailyAnswer(dateKey, instruments, effects) {
  const { baseDateKey, round } = parseChallengeDateKey(dateKey);
  const seed = getDateSeed(baseDateKey);
  const effectSeed = Math.imul(seed ^ 0x9e3779b9, 2246822519) >>> 0;
  const playableCombinations = getAvailableSoundCombinations(instruments, effects);

  if (!playableCombinations.length) {
    const fallbackInstrumentIndex = seed % instruments.length;
    const fallbackEffectIndex = effectSeed % effects.length;

    return {
      answerKey: `${seed}:${round}`,
      effect: effects[fallbackEffectIndex].label,
      instrument: instruments[fallbackInstrumentIndex].label,
      path: null,
      seed: (seed + round) >>> 0
    };
  }

  const baseCombinationIndex =
    (seed + effectSeed + round) % playableCombinations.length;
  const combination = playableCombinations[baseCombinationIndex];

  return {
    answerKey: `${seed}:${round}:${combination.instrument}:${combination.effect}`,
    effect: combination.effect,
    instrument: combination.instrument,
    path: combination.path,
    seed: (seed + baseCombinationIndex + round) >>> 0
  };
}

function createFreshDailyProgress(dateKey, instruments, effects) {
  const answer = generateDailyAnswer(dateKey, instruments, effects);

  return {
    answer,
    answerSeed: answer.seed,
    attempts: [],
    dateKey,
    failed: false,
    won: false
  };
}

function normalizeAttempts(savedAttempts, answer, maxAttempts) {
  if (!Array.isArray(savedAttempts)) {
    return [];
  }

  return savedAttempts.slice(0, maxAttempts).flatMap((guess, index) => {
    if (!guess || typeof guess.instrument !== "string" || typeof guess.effect !== "string") {
      return [];
    }

    const instrumentMatch = guess.instrument === answer.instrument;
    const effectMatch = guess.effect === answer.effect;

    return [
      {
        correct: instrumentMatch && effectMatch,
        effect: guess.effect,
        effectMatch,
        id: index + 1,
        instrument: guess.instrument,
        instrumentMatch
      }
    ];
  });
}

function resolvePersistedAnswer(savedAnswer, fallbackAnswer) {
  if (
    !savedAnswer ||
    typeof savedAnswer.instrument !== "string" ||
    typeof savedAnswer.effect !== "string"
  ) {
    return fallbackAnswer;
  }

  const path = getAvailableSoundPath(savedAnswer.instrument, savedAnswer.effect);

  if (!path) {
    return fallbackAnswer;
  }

  return {
    ...fallbackAnswer,
    answerKey:
      typeof savedAnswer.answerKey === "string" ? savedAnswer.answerKey : fallbackAnswer.answerKey,
    effect: savedAnswer.effect,
    instrument: savedAnswer.instrument,
    path,
    seed: typeof savedAnswer.seed === "number" ? savedAnswer.seed : fallbackAnswer.seed
  };
}

function loadDailyProgress(dateKey, instruments, effects, maxAttempts) {
  const defaultChallengeDateKey = buildChallengeDateKey(dateKey);
  const freshProgress = createFreshDailyProgress(defaultChallengeDateKey, instruments, effects);

  if (typeof window === "undefined") {
    return freshProgress;
  }

  try {
    const rawProgress = window.localStorage.getItem(DAILY_PROGRESS_STORAGE_KEY);

    if (!rawProgress) {
      return freshProgress;
    }

    const parsedProgress = JSON.parse(rawProgress);
    const savedDateKey =
      parsedProgress && typeof parsedProgress.dateKey === "string"
        ? parsedProgress.dateKey
        : defaultChallengeDateKey;

    if (!parsedProgress || !isChallengeDateKeyForToday(savedDateKey, dateKey)) {
      return freshProgress;
    }

    const currentProgress = createFreshDailyProgress(savedDateKey, instruments, effects);
    const answer = resolvePersistedAnswer(parsedProgress.answer, currentProgress.answer);
    const attempts = normalizeAttempts(parsedProgress.attempts, answer, maxAttempts);
    const won = attempts.some((attempt) => attempt.correct);
    const failed = !won && attempts.length >= maxAttempts;

    return {
      ...currentProgress,
      answer,
      answerSeed: answer.seed,
      attempts,
      failed,
      won
    };
  } catch {
    return freshProgress;
  }
}

export function SoundWordleApp({ challenge, instruments, effects }) {
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [dailyProgress, setDailyProgress] = useState(() =>
    createFreshDailyProgress(buildChallengeDateKey(DEFAULT_DATE_KEY), instruments, effects)
  );
  const [hasHydrated, setHasHydrated] = useState(false);
  const [countdown, setCountdown] = useState("00:00:00");
  const [feedbackPulse, setFeedbackPulse] = useState(false);
  const [mysterySound, setMysterySound] = useState(null);
  const dailyProgressRef = useRef(dailyProgress);
  const hasHydratedRef = useRef(false);
  const mysteryAudioRef = useRef(null);
  const loadedSoundPathRef = useRef(null);
  const autoPlayedDateKeyRef = useRef(null);

  useEffect(() => {
    if (!feedbackPulse) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackPulse(false);
    }, 580);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackPulse]);

  useEffect(() => {
    dailyProgressRef.current = dailyProgress;
  }, [dailyProgress]);

  useEffect(() => {
    hasHydratedRef.current = hasHydrated;
  }, [hasHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncDailyProgress = () => {
      const todayDateKey = getTodayDateKey();

      if (
        hasHydratedRef.current &&
        isChallengeDateKeyForToday(dailyProgressRef.current.dateKey, todayDateKey)
      ) {
        return;
      }

      const nextDailyProgress = loadDailyProgress(
        todayDateKey,
        instruments,
        effects,
        challenge.maxAttempts
      );

      dailyProgressRef.current = nextDailyProgress;
      setDailyProgress(nextDailyProgress);
      setSelectedInstrument(null);
      setSelectedEffect(null);
      setFeedbackPulse(false);

      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        setHasHydrated(true);
      }
    };

    const updateCountdown = () => {
      setCountdown(getTimeUntilNextMidnight());
      syncDailyProgress();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateCountdown();
      }
    };

    updateCountdown();

    const intervalId = window.setInterval(updateCountdown, 1000);
    window.addEventListener("focus", updateCountdown);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updateCountdown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [challenge.maxAttempts, effects, instruments]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DAILY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        answer: dailyProgress.answer,
        answerSeed: dailyProgress.answerSeed,
        attempts: dailyProgress.attempts,
        attemptsMade: dailyProgress.attempts.length,
        dateKey: dailyProgress.dateKey,
        failed: dailyProgress.failed,
        won: dailyProgress.won
      })
    );
  }, [dailyProgress, hasHydrated]);

  const getManagedAudio = () => {
    const audio = getPreviewAudio(mysteryAudioRef);
    audio.preload = "auto";
    return audio;
  };

  const stopMysterySound = () => {
    stopSoundPlayback(mysteryAudioRef.current);
  };

  const playMysterySound = async ({ restart = true } = {}) => {
    if (!mysterySound?.path) {
      return;
    }

    const audio = getManagedAudio();
    const shouldReloadSound = loadedSoundPathRef.current !== mysterySound.path;

    stopSoundPlayback(audio);

    if (shouldReloadSound) {
      audio.src = mysterySound.path;
      loadedSoundPathRef.current = mysterySound.path;
    }

    if (restart || audio.ended || shouldReloadSound) {
      audio.currentTime = 0;
    }

    try {
      await audio.play();
    } catch (error) {
      if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") {
        console.warn("Mystery sound could not be played", error);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopMysterySound();
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const nextPath =
      dailyProgress.answer.path ??
      getAvailableSoundPath(dailyProgress.answer.instrument, dailyProgress.answer.effect);

    if (!nextPath) {
      warnMissingSound(dailyProgress.answer.instrument, dailyProgress.answer.effect);
    }

    setMysterySound((currentMysterySound) => {
      if (
        currentMysterySound?.instrument === dailyProgress.answer.instrument &&
        currentMysterySound?.effect === dailyProgress.answer.effect &&
        currentMysterySound?.path === nextPath
      ) {
        return currentMysterySound;
      }

      return {
        effect: dailyProgress.answer.effect,
        instrument: dailyProgress.answer.instrument,
        path: nextPath
      };
    });
  }, [
    dailyProgress.answer.effect,
    dailyProgress.answer.instrument,
    dailyProgress.answer.path,
    hasHydrated
  ]);

  useEffect(() => {
    if (!hasHydrated || !mysterySound?.path) {
      return;
    }

    if (autoPlayedDateKeyRef.current === dailyProgress.dateKey) {
      return;
    }

    autoPlayedDateKeyRef.current = dailyProgress.dateKey;
    void playMysterySound({ restart: true });
  }, [dailyProgress.dateKey, hasHydrated, mysterySound]);

  const attempts = dailyProgress.attempts;
  const attemptsUsed = attempts.length;
  const attemptsRemaining = Math.max(challenge.maxAttempts - attemptsUsed, 0);
  const gameState = dailyProgress.won ? "won" : dailyProgress.failed ? "lost" : "playing";
  const isLocked = gameState === "won" || gameState === "lost";
  const lastGuess = attempts.at(-1) ?? null;
  const canSubmit = hasHydrated && !isLocked && Boolean(selectedInstrument && selectedEffect);
  const canReset = hasHydrated && !isLocked && Boolean(selectedInstrument || selectedEffect);
  const hasAvailableSound = Boolean(mysterySound?.path);
  const audioControlLabel = hasAvailableSound ? "Play Sound" : "No sound available";

  const handleInstrumentSelect = (instrument) => {
    setSelectedInstrument(instrument);
  };

  const handleEffectSelect = (effect) => {
    setSelectedEffect(effect);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    const guess = {
      id: attemptsUsed + 1,
      instrument: selectedInstrument,
      effect: selectedEffect,
      instrumentMatch: selectedInstrument === dailyProgress.answer.instrument,
      effectMatch: selectedEffect === dailyProgress.answer.effect
    };

    guess.correct = guess.instrumentMatch && guess.effectMatch;
    setFeedbackPulse(true);

    setDailyProgress((currentProgress) => {
      const nextAttempts = [...currentProgress.attempts, guess];

      return {
        ...currentProgress,
        attempts: nextAttempts,
        failed: !guess.correct && nextAttempts.length >= challenge.maxAttempts,
        won: guess.correct
      };
    });
  };

  const handleReset = () => {
    if (!canReset) {
      return;
    }

    setSelectedInstrument(null);
    setSelectedEffect(null);
    setFeedbackPulse(false);
  };

  const handleAudioToggle = () => {
    if (!hasAvailableSound) {
      return;
    }

    void playMysterySound({ restart: true });
  };

  const handleReplaySound = () => {
    if (!hasAvailableSound) {
      return;
    }

    void playMysterySound({ restart: true });
  };

  const feedback = getFeedback({
    answer: dailyProgress.answer,
    attemptsRemaining,
    challengeTitle: challenge.title,
    gameState,
    lastGuess,
    maxAttempts: challenge.maxAttempts
  });

  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="wave-ribbon absolute left-[-7rem] top-[-4rem] h-64 w-64 rounded-full animate-wave-drift sm:h-72 sm:w-72" />
        <div className="wave-ribbon absolute right-[-9rem] top-1/3 h-72 w-72 rounded-full animate-wave-drift [animation-delay:1.8s] sm:h-80 sm:w-80" />
        <div className="sound-grid absolute inset-x-0 top-0 h-[360px] opacity-60 sm:h-[390px]" />
        <div className="absolute bottom-10 left-6 h-24 w-24 rounded-full border border-white/60 bg-white/40 sm:left-10 sm:h-28 sm:w-28" />
        <div className="absolute bottom-16 right-8 h-28 w-28 rounded-full border border-white/60 bg-white/30 sm:bottom-20 sm:right-16 sm:h-36 sm:w-36" />
      </div>

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <header className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 shadow-soft backdrop-blur sm:gap-3 sm:px-4 sm:py-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">
              Daily Mix #{challenge.id}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
            <span className="text-xs font-semibold text-slate-700 sm:text-sm">Prototype Session</span>
          </div>

          <h1 className="mt-4 text-center font-display text-4xl font-black uppercase leading-none tracking-[0.18em] text-slate-950 sm:mt-5 sm:text-5xl lg:text-[3.4rem]">
            {challenge.title}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500 sm:text-xs sm:tracking-[0.36em]">
            {challenge.subtitle}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            {challenge.tagline}
          </p>

          <StatusStrip
            attemptsRemaining={attemptsRemaining}
            attemptsUsed={attemptsUsed}
            comboLabel={challenge.comboLabel}
            countdown={countdown}
            gameState={gameState}
            maxAttempts={challenge.maxAttempts}
          />
        </header>

        <section className="glass-panel mx-auto mt-5 w-full max-w-5xl rounded-[28px] p-3 sm:mt-6 sm:p-4 xl:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.94fr)_72px_minmax(0,1.06fr)] lg:items-start">
            <ChoiceGrid
              categoryLabel="Instrument"
              columns={2}
              description="Start with the source. Pick the instrument that feels closest to the target patch."
              disabled={!hasHydrated || isLocked}
              eyebrow="Source"
              onSelect={handleInstrumentSelect}
              options={instruments}
              resolveState={(label) =>
                lastGuess && lastGuess.instrument === label && selectedInstrument === label
                  ? lastGuess.instrumentMatch
                    ? "correct"
                    : "incorrect"
                  : null
              }
              selectedValue={selectedInstrument}
              title="Instrument"
            />

            <div className="flex items-center justify-center lg:self-center">
              <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border border-slate-200/80 bg-white/85 shadow-soft backdrop-blur sm:h-[78px] sm:w-[78px]">
                <span className="font-display text-4xl font-black leading-none text-slate-900 sm:text-[2.6rem]">+</span>
                <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">
                  Signal
                </span>
              </div>
            </div>

            <ChoiceGrid
              categoryLabel="Effect"
              columns={3}
              description="Shape the tone with one effect. The right chain is all about the final texture."
              disabled={!hasHydrated || isLocked}
              eyebrow="Processing"
              onSelect={handleEffectSelect}
              options={effects}
              resolveState={(label) =>
                lastGuess && lastGuess.effect === label && selectedEffect === label
                  ? lastGuess.effectMatch
                    ? "correct"
                    : "incorrect"
                  : null
              }
              selectedValue={selectedEffect}
              title="Effects"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div
              className={cn(
                "flex-1 rounded-[24px] border px-4 py-3.5 shadow-soft transition",
                feedbackToneClasses[feedback.tone],
                feedbackPulse && "animate-feedback-pop"
              )}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] opacity-70">
                Current Status
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[0.01em]">{feedback.heading}</h2>
              <p aria-live="polite" className="mt-1 text-sm leading-6 opacity-80">
                {feedback.body}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:min-h-[50px] sm:px-6"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                Submit Guess
              </button>
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-[50px] sm:px-6"
                disabled={!canReset}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-[50px] sm:px-6"
                disabled={!hasAvailableSound}
                onClick={handleAudioToggle}
              >
                {audioControlLabel}
              </button>
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-[50px] sm:px-6"
                disabled={!hasAvailableSound}
                onClick={handleReplaySound}
              >
                Replay Sound
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-4 grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <ResultsPanel
            answer={dailyProgress.answer}
            attempts={attempts}
            attemptsRemaining={attemptsRemaining}
            gameState={gameState}
            maxAttempts={challenge.maxAttempts}
          />
          <InstructionsCard gameState={gameState} maxAttempts={challenge.maxAttempts} />
        </section>
      </main>
    </div>
  );
}

function getFeedback({ answer, attemptsRemaining, challengeTitle, gameState, lastGuess, maxAttempts }) {
  if (gameState === "won") {
    return {
      body: `You solved today's ${challengeTitle}. Next puzzle available tomorrow.`,
      heading: "Daily challenge solved",
      tone: "correct"
    };
  }

  if (gameState === "lost") {
    return {
      body: `You've used all ${maxAttempts} attempts. Come back tomorrow for a new sound. Today's answer was ${answer.instrument} + ${answer.effect}.`,
      heading: "Locked until tomorrow",
      tone: "danger"
    };
  }

  if (!lastGuess) {
    return {
      body: `Daily challenge mode is live. You have ${maxAttempts} attempts to guess today's ODDIBLE.`,
      heading: "Ready for today's sound",
      tone: "neutral"
    };
  }

  if (lastGuess.instrumentMatch && !lastGuess.effectMatch) {
    return {
      body: `Instrument is right. Swap the effect and use one of your ${attemptsRemaining} remaining attempts.`,
      heading: "Close guess",
      tone: "warning"
    };
  }

  if (!lastGuess.instrumentMatch && lastGuess.effectMatch) {
    return {
      body: `Effect is right. Keep that texture and try another instrument. ${attemptsRemaining} attempts remaining.`,
      heading: "Close guess",
      tone: "warning"
    };
  }

  return {
    body: `Try again. Adjust the chain and submit another guess. ${attemptsRemaining} attempts remaining today.`,
    heading: "Not today's sound",
    tone: "danger"
  };
}

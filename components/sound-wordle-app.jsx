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
const FEEDBACK_SOUND_PATHS = {
  correct: "/sounds/correct.mp3",
  incorrect: "/sounds/incorrect.mp3"
};
const PREMIUM_STORAGE_KEY = "oddible_premium";
const PREMIUM_STREAK_STORAGE_KEY = "oddible-premium-streak-progress";
const INITIAL_PREMIUM_ROUND_KEY = "premium-initial";
const STREAK_STORAGE_KEY = "oddible-streak-progress";
const STREAK_OUTCOMES = {
  lost: "lost",
  won: "won"
};

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

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  const parsedDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function shiftDateKey(dateKey, dayOffset) {
  const parsedDate = parseDateKey(dateKey);

  if (!parsedDate) {
    return null;
  }

  parsedDate.setDate(parsedDate.getDate() + dayOffset);
  return getTodayDateKey(parsedDate);
}

function getPreviousDateKey(dateKey) {
  return shiftDateKey(dateKey, -1);
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

function createStoredAnswer({ answerKey, effect, instrument, path, seed }) {
  return {
    answerKey,
    answerSeed: seed,
    correctEffect: effect,
    correctInstrument: instrument,
    correctPath: path
  };
}

function buildAnswerView(progress) {
  return {
    answerKey: progress.answerKey,
    effect: progress.correctEffect,
    instrument: progress.correctInstrument,
    path: progress.correctPath,
    seed: progress.answerSeed
  };
}

function buildAnswerMatchInput(progress) {
  return {
    effect: progress.correctEffect,
    instrument: progress.correctInstrument
  };
}

function getResolvedSoundPath(progress) {
  return (
    getAvailableSoundPath(progress.correctInstrument, progress.correctEffect) ?? progress.correctPath
  );
}

function generateDailyAnswer(dateKey, instruments, effects) {
  const { baseDateKey, round } = parseChallengeDateKey(dateKey);
  const seed = getDateSeed(baseDateKey);
  const effectSeed = Math.imul(seed ^ 0x9e3779b9, 2246822519) >>> 0;
  const playableCombinations = getAvailableSoundCombinations(instruments, effects);

  if (!playableCombinations.length) {
    const fallbackInstrumentIndex = seed % instruments.length;
    const fallbackEffectIndex = effectSeed % effects.length;

    return createStoredAnswer({
      answerKey: `${seed}:${round}`,
      effect: effects[fallbackEffectIndex].label,
      instrument: instruments[fallbackInstrumentIndex].label,
      path: null,
      seed: (seed + round) >>> 0
    });
  }

  const baseCombinationIndex =
    (seed + effectSeed + round) % playableCombinations.length;
  const combination = playableCombinations[baseCombinationIndex];

  return createStoredAnswer({
    answerKey: `${seed}:${round}:${combination.instrument}:${combination.effect}`,
    effect: combination.effect,
    instrument: combination.instrument,
    path: combination.path,
    seed: (seed + baseCombinationIndex + round) >>> 0
  });
}

function createFreshDailyProgress(dateKey, instruments, effects) {
  const answer = generateDailyAnswer(dateKey, instruments, effects);

  return {
    ...answer,
    attempts: [],
    dateKey,
    failed: false,
    won: false
  };
}

function createPremiumNotice({ body, heading, tone }) {
  return {
    body,
    heading,
    tone
  };
}

function createDeterministicPremiumAnswer(instruments, effects) {
  const playableCombinations = getAvailableSoundCombinations(instruments, effects);

  if (playableCombinations.length) {
    const combination = playableCombinations[0];

    return createStoredAnswer({
      answerKey: `${INITIAL_PREMIUM_ROUND_KEY}:${combination.instrument}:${combination.effect}`,
      effect: combination.effect,
      instrument: combination.instrument,
      path: combination.path,
      seed: 0
    });
  }

  const fallbackInstrument = instruments[0]?.label ?? "Instrument";
  const fallbackEffect = effects[0]?.label ?? "Effect";

  return createStoredAnswer({
    answerKey: `${INITIAL_PREMIUM_ROUND_KEY}:${fallbackInstrument}:${fallbackEffect}`,
    effect: fallbackEffect,
    instrument: fallbackInstrument,
    path: getAvailableSoundPath(fallbackInstrument, fallbackEffect),
    seed: 0
  });
}

function createRandomPremiumAnswer(instruments, effects, previousAnswer = null) {
  const playableCombinations = getAvailableSoundCombinations(instruments, effects);
  const randomSeed = Date.now();
  const randomToken = Math.random().toString(36).slice(2, 8);

  if (playableCombinations.length) {
    const availableCombinations =
      previousAnswer && playableCombinations.length > 1
        ? playableCombinations.filter(
            (combination) =>
              combination.instrument !== previousAnswer.instrument ||
              combination.effect !== previousAnswer.effect
          )
        : playableCombinations;
    const combination =
      availableCombinations[Math.floor(Math.random() * availableCombinations.length)];

    return createStoredAnswer({
      answerKey: `premium:${randomSeed}:${randomToken}`,
      effect: combination.effect,
      instrument: combination.instrument,
      path: combination.path,
      seed: randomSeed
    });
  }

  const instrumentLabels = instruments.map((instrumentOption) => instrumentOption.label);
  const effectLabels = effects.map((effectOption) => effectOption.label);
  const fallbackInstrument =
    instrumentLabels[Math.floor(Math.random() * Math.max(instrumentLabels.length, 1))] ??
    "Instrument";
  const fallbackEffect =
    effectLabels[Math.floor(Math.random() * Math.max(effectLabels.length, 1))] ?? "Effect";

  return createStoredAnswer({
    answerKey: `premium:${randomSeed}:${randomToken}`,
    effect: fallbackEffect,
    instrument: fallbackInstrument,
    path: getAvailableSoundPath(fallbackInstrument, fallbackEffect),
    seed: randomSeed
  });
}

function createInitialPremiumProgress(instruments, effects) {
  const answer = createDeterministicPremiumAnswer(instruments, effects);

  return {
    ...answer,
    attempts: []
  };
}

function createFreshPremiumProgress(instruments, effects, previousAnswer = null) {
  const answer = createRandomPremiumAnswer(instruments, effects, previousAnswer);

  return {
    ...answer,
    attempts: []
  };
}

function createFreshStreakProgress() {
  return {
    bestStreak: 0,
    completedToday: false,
    currentStreak: 0,
    lastCompletedDateKey: null,
    lastCompletedOutcome: null,
    lastSolvedDateKey: null
  };
}

function normalizeStreakProgress(savedStreakProgress, todayDateKey) {
  const safeCurrentStreak = Number.isFinite(savedStreakProgress?.currentStreak)
    ? Math.max(Math.floor(savedStreakProgress.currentStreak), 0)
    : 0;
  const safeBestStreak = Number.isFinite(savedStreakProgress?.bestStreak)
    ? Math.max(Math.floor(savedStreakProgress.bestStreak), 0)
    : 0;
  const lastSolvedDateKey = parseDateKey(savedStreakProgress?.lastSolvedDateKey)
    ? savedStreakProgress.lastSolvedDateKey
    : null;
  const lastCompletedDateKey = parseDateKey(savedStreakProgress?.lastCompletedDateKey)
    ? savedStreakProgress.lastCompletedDateKey
    : null;
  const lastCompletedOutcome =
    savedStreakProgress?.lastCompletedOutcome === STREAK_OUTCOMES.won ||
    savedStreakProgress?.lastCompletedOutcome === STREAK_OUTCOMES.lost
      ? savedStreakProgress.lastCompletedOutcome
      : null;
  const previousDateKey = getPreviousDateKey(todayDateKey);
  const completedToday = lastCompletedDateKey === todayDateKey;
  const currentStreak =
    completedToday || (previousDateKey && lastSolvedDateKey === previousDateKey)
      ? safeCurrentStreak
      : 0;

  return {
    bestStreak: Math.max(safeBestStreak, safeCurrentStreak),
    completedToday,
    currentStreak,
    lastCompletedDateKey,
    lastCompletedOutcome,
    lastSolvedDateKey
  };
}

function loadStreakProgress(dateKey) {
  const freshStreakProgress = createFreshStreakProgress();

  if (typeof window === "undefined") {
    return freshStreakProgress;
  }

  try {
    const rawStreakProgress = window.localStorage.getItem(STREAK_STORAGE_KEY);

    if (!rawStreakProgress) {
      return freshStreakProgress;
    }

    return normalizeStreakProgress(JSON.parse(rawStreakProgress), dateKey);
  } catch {
    return freshStreakProgress;
  }
}

function applyResultToStreakProgress(streakProgress, dateKey, outcome) {
  const normalizedStreakProgress = normalizeStreakProgress(streakProgress, dateKey);

  if (
    normalizedStreakProgress.completedToday &&
    normalizedStreakProgress.lastCompletedDateKey === dateKey
  ) {
    return normalizedStreakProgress;
  }

  if (outcome === STREAK_OUTCOMES.won) {
    const previousDateKey = getPreviousDateKey(dateKey);
    const currentStreak =
      previousDateKey && normalizedStreakProgress.lastSolvedDateKey === previousDateKey
        ? normalizedStreakProgress.currentStreak + 1
        : 1;

    return {
      ...normalizedStreakProgress,
      bestStreak: Math.max(normalizedStreakProgress.bestStreak, currentStreak),
      completedToday: true,
      currentStreak,
      lastCompletedDateKey: dateKey,
      lastCompletedOutcome: STREAK_OUTCOMES.won,
      lastSolvedDateKey: dateKey
    };
  }

  return {
    ...normalizedStreakProgress,
    completedToday: true,
    currentStreak: 0,
    lastCompletedDateKey: dateKey,
    lastCompletedOutcome: STREAK_OUTCOMES.lost
  };
}

function createFreshPremiumStreakProgress() {
  return {
    bestStreak: 0,
    currentStreak: 0
  };
}

function normalizePremiumStreakProgress(savedPremiumStreakProgress) {
  const currentStreak = Number.isFinite(savedPremiumStreakProgress?.currentStreak)
    ? Math.max(Math.floor(savedPremiumStreakProgress.currentStreak), 0)
    : 0;
  const bestStreak = Number.isFinite(savedPremiumStreakProgress?.bestStreak)
    ? Math.max(Math.floor(savedPremiumStreakProgress.bestStreak), currentStreak)
    : currentStreak;

  return {
    bestStreak,
    currentStreak
  };
}

function loadPremiumStreakProgress() {
  const freshPremiumStreakProgress = createFreshPremiumStreakProgress();

  if (typeof window === "undefined") {
    return freshPremiumStreakProgress;
  }

  try {
    const rawPremiumStreakProgress = window.localStorage.getItem(PREMIUM_STREAK_STORAGE_KEY);

    if (!rawPremiumStreakProgress) {
      return freshPremiumStreakProgress;
    }

    return normalizePremiumStreakProgress(JSON.parse(rawPremiumStreakProgress));
  } catch {
    return freshPremiumStreakProgress;
  }
}

function applyRoundResultToPremiumStreakProgress(premiumStreakProgress, didWinRound) {
  const normalizedPremiumStreakProgress = normalizePremiumStreakProgress(premiumStreakProgress);
  const currentStreak = didWinRound
    ? normalizedPremiumStreakProgress.currentStreak + 1
    : 0;

  return {
    bestStreak: Math.max(normalizedPremiumStreakProgress.bestStreak, currentStreak),
    currentStreak
  };
}

function normalizeAttempts(savedAttempts, progress, maxAttempts) {
  if (!Array.isArray(savedAttempts)) {
    return [];
  }

  return savedAttempts.slice(0, maxAttempts).flatMap((guess, index) => {
    if (!guess || typeof guess.instrument !== "string" || typeof guess.effect !== "string") {
      return [];
    }

    const instrumentMatch = guess.instrument === progress.correctInstrument;
    const effectMatch = guess.effect === progress.correctEffect;

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

function resolvePersistedProgress(savedProgress, fallbackProgress) {
  const legacyAnswer = savedProgress?.answer;
  const correctInstrument =
    typeof savedProgress?.correctInstrument === "string"
      ? savedProgress.correctInstrument
      : typeof legacyAnswer?.instrument === "string"
        ? legacyAnswer.instrument
        : null;
  const correctEffect =
    typeof savedProgress?.correctEffect === "string"
      ? savedProgress.correctEffect
      : typeof legacyAnswer?.effect === "string"
        ? legacyAnswer.effect
        : null;

  if (!correctInstrument || !correctEffect) {
    return fallbackProgress;
  }

  const correctPath = getAvailableSoundPath(correctInstrument, correctEffect);

  if (!correctPath) {
    return fallbackProgress;
  }

  return {
    ...fallbackProgress,
    answerKey:
      typeof savedProgress?.answerKey === "string"
        ? savedProgress.answerKey
        : typeof legacyAnswer?.answerKey === "string"
          ? legacyAnswer.answerKey
          : fallbackProgress.answerKey,
    answerSeed: Number.isFinite(savedProgress?.answerSeed)
      ? savedProgress.answerSeed
      : Number.isFinite(legacyAnswer?.seed)
        ? legacyAnswer.seed
        : fallbackProgress.answerSeed,
    correctEffect,
    correctInstrument,
    correctPath
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
    const progress = resolvePersistedProgress(parsedProgress, currentProgress);
    const attempts = normalizeAttempts(parsedProgress.attempts, progress, maxAttempts);
    const won = attempts.some((attempt) => attempt.correct);
    const failed = !won && attempts.length >= maxAttempts;

    return {
      ...progress,
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
  const [isPremiumMode, setIsPremiumMode] = useState(false);
  const [dailyProgress, setDailyProgress] = useState(() =>
    createFreshDailyProgress(buildChallengeDateKey(DEFAULT_DATE_KEY), instruments, effects)
  );
  const [premiumProgress, setPremiumProgress] = useState(() =>
    createInitialPremiumProgress(instruments, effects)
  );
  const [premiumNotice, setPremiumNotice] = useState(null);
  const [premiumStreakProgress, setPremiumStreakProgress] = useState(() =>
    createFreshPremiumStreakProgress()
  );
  const [streakProgress, setStreakProgress] = useState(() => createFreshStreakProgress());
  const [hasHydrated, setHasHydrated] = useState(false);
  const [countdown, setCountdown] = useState("00:00:00");
  const [feedbackPulse, setFeedbackPulse] = useState(false);
  const dailyProgressRef = useRef(dailyProgress);
  const hasHydratedRef = useRef(false);
  const mysteryAudioRef = useRef(null);
  const correctFeedbackAudioRef = useRef(null);
  const incorrectFeedbackAudioRef = useRef(null);
  const loadedSoundPathRef = useRef(null);
  const autoPlayedDateKeyRef = useRef(null);
  const submitInFlightRef = useRef(false);

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
      const nextPremiumStreakProgress = loadPremiumStreakProgress();
      const nextStreakProgress = loadStreakProgress(todayDateKey);

      dailyProgressRef.current = nextDailyProgress;
      setDailyProgress(nextDailyProgress);
      setPremiumStreakProgress(nextPremiumStreakProgress);
      setStreakProgress(nextStreakProgress);

      if (!hasHydratedRef.current) {
        const savedPremiumMode = window.localStorage.getItem(PREMIUM_STORAGE_KEY) === "true";

        setIsPremiumMode(savedPremiumMode);

        if (savedPremiumMode) {
          setPremiumProgress(createFreshPremiumProgress(instruments, effects));
          setPremiumNotice(
            createPremiumNotice({
              body: "Premium is active. Solve a sound to queue the next unlimited round.",
              heading: "Unlimited mode enabled",
              tone: "neutral"
            })
          );
        }

        hasHydratedRef.current = true;
        setHasHydrated(true);
      }

      if (!isPremiumMode) {
        setSelectedInstrument(null);
        setSelectedEffect(null);
        setFeedbackPulse(false);
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
  }, [challenge.maxAttempts, effects, instruments, isPremiumMode]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DAILY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        answerSeed: dailyProgress.answerSeed,
        attempts: dailyProgress.attempts,
        attemptsMade: dailyProgress.attempts.length,
        answerKey: dailyProgress.answerKey,
        correctEffect: dailyProgress.correctEffect,
        correctInstrument: dailyProgress.correctInstrument,
        correctPath: dailyProgress.correctPath,
        dateKey: dailyProgress.dateKey,
        failed: dailyProgress.failed,
        won: dailyProgress.won
      })
    );
  }, [dailyProgress, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      PREMIUM_STREAK_STORAGE_KEY,
      JSON.stringify(premiumStreakProgress)
    );
  }, [hasHydrated, premiumStreakProgress]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streakProgress));
  }, [hasHydrated, streakProgress]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PREMIUM_STORAGE_KEY, isPremiumMode ? "true" : "false");
  }, [hasHydrated, isPremiumMode]);

  const getManagedAudio = () => {
    const audio = getPreviewAudio(mysteryAudioRef);
    audio.preload = "auto";
    return audio;
  };

  const getFeedbackAudio = (audioRef, source) => {
    const audio = getPreviewAudio(audioRef);
    audio.preload = "auto";

    if (!audio.src || !audio.src.endsWith(source)) {
      audio.src = source;
    }

    return audio;
  };

  const stopFeedbackSound = () => {
    stopSoundPlayback(correctFeedbackAudioRef.current);
    stopSoundPlayback(incorrectFeedbackAudioRef.current);
  };

  const stopMysterySound = () => {
    stopSoundPlayback(mysteryAudioRef.current);
  };

  const waitForAudioPlaybackToFinish = async (audio) => {
    if (!audio || audio.ended || audio.paused) {
      return;
    }

    await new Promise((resolve) => {
      const cleanup = () => {
        audio.removeEventListener("ended", handleFinish);
        audio.removeEventListener("error", handleFinish);
        audio.removeEventListener("pause", handlePause);
      };

      const handleFinish = () => {
        cleanup();
        resolve();
      };

      const handlePause = () => {
        if (audio.ended || audio.currentTime === 0) {
          handleFinish();
        }
      };

      audio.addEventListener("ended", handleFinish);
      audio.addEventListener("error", handleFinish);
      audio.addEventListener("pause", handlePause);
    });
  };

  const playSubmitFeedbackSound = async (isCorrectGuess) => {
    if (typeof window === "undefined") {
      return null;
    }

    const source = isCorrectGuess
      ? FEEDBACK_SOUND_PATHS.correct
      : FEEDBACK_SOUND_PATHS.incorrect;
    const audio = isCorrectGuess
      ? getFeedbackAudio(correctFeedbackAudioRef, source)
      : getFeedbackAudio(incorrectFeedbackAudioRef, source);

    stopMysterySound();
    stopFeedbackSound();
    audio.currentTime = 0;

    try {
      await audio.play();
      return audio;
    } catch (error) {
      if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") {
        console.warn("Submit feedback sound could not be played", error);
      }

      return null;
    }
  };

  const playMysterySound = async ({ restart = true } = {}) => {
    if (!mysterySoundPath) {
      return;
    }

    const audio = getManagedAudio();
    const shouldReloadSound = loadedSoundPathRef.current !== mysterySoundPath;

    stopFeedbackSound();
    stopSoundPlayback(audio);

    if (shouldReloadSound) {
      audio.src = mysterySoundPath;
      loadedSoundPathRef.current = mysterySoundPath;
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
    const correctAudio = getPreviewAudio(correctFeedbackAudioRef);
    correctAudio.preload = "auto";

    if (!correctAudio.src || !correctAudio.src.endsWith(FEEDBACK_SOUND_PATHS.correct)) {
      correctAudio.src = FEEDBACK_SOUND_PATHS.correct;
    }

    const incorrectAudio = getPreviewAudio(incorrectFeedbackAudioRef);
    incorrectAudio.preload = "auto";

    if (!incorrectAudio.src || !incorrectAudio.src.endsWith(FEEDBACK_SOUND_PATHS.incorrect)) {
      incorrectAudio.src = FEEDBACK_SOUND_PATHS.incorrect;
    }

    correctAudio.load();
    incorrectAudio.load();

    return () => {
      stopSoundPlayback(correctFeedbackAudioRef.current);
      stopSoundPlayback(incorrectFeedbackAudioRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopMysterySound();
    };
  }, []);

  const activeProgress = isPremiumMode ? premiumProgress : dailyProgress;
  const activeAnswer = buildAnswerView(activeProgress);
  const correctInstrument = activeProgress.correctInstrument;
  const correctEffect = activeProgress.correctEffect;
  const mysterySoundPath = getResolvedSoundPath(activeProgress);
  const activePlaybackKey = isPremiumMode ? activeProgress.answerKey : activeProgress.dateKey;

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!mysterySoundPath) {
      warnMissingSound(correctInstrument, correctEffect);
      return;
    }

    console.log("ODDIBLE correct answer", {
      correctEffect,
      correctInstrument
    });
  }, [correctEffect, correctInstrument, hasHydrated, mysterySoundPath]);

  useEffect(() => {
    if (!hasHydrated || !mysterySoundPath) {
      return;
    }

    if (autoPlayedDateKeyRef.current === activePlaybackKey) {
      return;
    }

    autoPlayedDateKeyRef.current = activePlaybackKey;
    void playMysterySound({ restart: true });
  }, [activePlaybackKey, hasHydrated, mysterySoundPath]);

  useEffect(() => {
    if (!hasHydrated || (!dailyProgress.won && !dailyProgress.failed)) {
      return;
    }

    const todayDateKey = parseChallengeDateKey(dailyProgress.dateKey).baseDateKey;

    setStreakProgress((currentStreakProgress) =>
      applyResultToStreakProgress(
        currentStreakProgress,
        todayDateKey,
        dailyProgress.won ? STREAK_OUTCOMES.won : STREAK_OUTCOMES.lost
      )
    );
  }, [dailyProgress.dateKey, dailyProgress.failed, dailyProgress.won, hasHydrated]);

  const attempts = activeProgress.attempts;
  const attemptsUsed = attempts.length;
  const attemptsRemaining = Math.max(challenge.maxAttempts - attemptsUsed, 0);
  const gameState = isPremiumMode
    ? "playing"
    : dailyProgress.won
      ? "won"
      : dailyProgress.failed
        ? "lost"
        : "playing";
  const isLocked = !isPremiumMode && (gameState === "won" || gameState === "lost");
  const lastGuess = attempts.at(-1) ?? null;
  const canSubmit = hasHydrated && !isLocked && Boolean(selectedInstrument && selectedEffect);
  const canReset = hasHydrated && !isLocked && Boolean(selectedInstrument || selectedEffect);
  const hasAvailableSound = Boolean(mysterySoundPath);
  const audioControlLabel = hasAvailableSound ? "Play Sound" : "No sound available";

  const handleInstrumentSelect = (instrument) => {
    setSelectedInstrument(instrument);
  };

  const handleEffectSelect = (effect) => {
    setSelectedEffect(effect);
  };

  const handlePremiumToggle = () => {
    const nextPremiumMode = !isPremiumMode;

    setIsPremiumMode(nextPremiumMode);
    setSelectedInstrument(null);
    setSelectedEffect(null);
    setFeedbackPulse(false);

    if (nextPremiumMode) {
      setPremiumProgress(
        createFreshPremiumProgress(instruments, effects, buildAnswerMatchInput(premiumProgress))
      );
      setPremiumNotice(
        createPremiumNotice({
          body: "Unlimited rounds are live. Clear a sound to load the next one instantly.",
          heading: "Unlimited mode enabled",
          tone: "neutral"
        })
      );
      return;
    }

    setPremiumNotice(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;

    const guess = {
      id: attemptsUsed + 1,
      instrument: selectedInstrument,
      effect: selectedEffect,
      instrumentMatch: selectedInstrument === correctInstrument,
      effectMatch: selectedEffect === correctEffect
    };

    guess.correct = guess.instrumentMatch && guess.effectMatch;
    const nextAttemptsCount = attemptsUsed + 1;
    const isFinalLoss = !guess.correct && nextAttemptsCount >= challenge.maxAttempts;
    setFeedbackPulse(true);

    try {
      const feedbackAudio = await playSubmitFeedbackSound(guess.correct);

      if (isPremiumMode) {
        if (guess.correct || isFinalLoss) {
          setPremiumStreakProgress((currentPremiumStreakProgress) =>
            applyRoundResultToPremiumStreakProgress(
              currentPremiumStreakProgress,
              guess.correct
            )
          );
          await waitForAudioPlaybackToFinish(feedbackAudio);
          setPremiumProgress(
            createFreshPremiumProgress(instruments, effects, buildAnswerMatchInput(activeProgress))
          );
          setPremiumNotice(
            createPremiumNotice({
              body: guess.correct
                ? "Correct guess. A fresh mystery sound is ready to play."
                : "Round complete. A new mystery sound has been queued up.",
              heading: guess.correct ? "Next sound loaded" : "New round ready",
              tone: guess.correct ? "correct" : "warning"
            })
          );
          setSelectedInstrument(null);
          setSelectedEffect(null);
        } else {
          setPremiumProgress((currentProgress) => ({
            ...currentProgress,
            attempts: [...currentProgress.attempts, guess]
          }));
        }

        return;
      }

      const todayDateKey = parseChallengeDateKey(dailyProgress.dateKey).baseDateKey;

      setDailyProgress((currentProgress) => {
        const nextAttempts = [...currentProgress.attempts, guess];

        return {
          ...currentProgress,
          attempts: nextAttempts,
          failed: !guess.correct && nextAttempts.length >= challenge.maxAttempts,
          won: guess.correct
        };
      });

      if (guess.correct || isFinalLoss) {
        setStreakProgress((currentStreakProgress) =>
          applyResultToStreakProgress(
            currentStreakProgress,
            todayDateKey,
            guess.correct ? STREAK_OUTCOMES.won : STREAK_OUTCOMES.lost
          )
        );
      }
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleReset = () => {
    if (!canReset) {
      return;
    }

    setSelectedInstrument(null);
    setSelectedEffect(null);
    setFeedbackPulse(false);
  };

  const handleStopSound = () => {
    stopMysterySound();
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
    answer: activeAnswer,
    attemptsRemaining,
    challengeTitle: challenge.title,
    gameState,
    isPremiumMode,
    lastGuess,
    maxAttempts: challenge.maxAttempts,
    premiumNotice
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
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 shadow-soft backdrop-blur sm:gap-3 sm:px-4 sm:py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">
                Daily Mix #{challenge.id}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
              <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                {isPremiumMode ? "Unlimited Mode" : "Prototype Session"}
              </span>
            </div>

            <button
              type="button"
              aria-pressed={isPremiumMode}
              className={cn(
                "inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 sm:min-h-[42px] sm:px-5 sm:text-sm",
                isPremiumMode
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  : "border-slate-200/80 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              )}
              onClick={handlePremiumToggle}
            >
              {isPremiumMode ? "Unlimited Mode Enabled" : "Unlock Unlimited Mode"}
            </button>
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
            bestStreak={isPremiumMode ? premiumStreakProgress.bestStreak : streakProgress.bestStreak}
            comboLabel={challenge.comboLabel}
            countdown={countdown}
            currentStreak={
              isPremiumMode ? premiumStreakProgress.currentStreak : streakProgress.currentStreak
            }
            gameState={gameState}
            isPremiumMode={isPremiumMode}
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
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-[46px] sm:px-5 sm:text-sm"
                disabled={!hasAvailableSound}
                onClick={handleStopSound}
              >
                Stop Sound
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-4 grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <ResultsPanel
            answer={activeAnswer}
            attempts={attempts}
            attemptsRemaining={attemptsRemaining}
            gameState={gameState}
            isPremiumMode={isPremiumMode}
            maxAttempts={challenge.maxAttempts}
          />
          <InstructionsCard
            gameState={gameState}
            isPremiumMode={isPremiumMode}
            maxAttempts={challenge.maxAttempts}
          />
        </section>
      </main>
    </div>
  );
}

function getFeedback({
  answer,
  attemptsRemaining,
  challengeTitle,
  gameState,
  isPremiumMode,
  lastGuess,
  maxAttempts,
  premiumNotice
}) {
  if (isPremiumMode) {
    if (!lastGuess && premiumNotice) {
      return premiumNotice;
    }

    if (!lastGuess) {
      return {
        body: `Unlimited mode is active. You have ${maxAttempts} attempts to clear each sound round.`,
        heading: "Ready for the next mix",
        tone: "neutral"
      };
    }

    if (lastGuess.instrumentMatch && !lastGuess.effectMatch) {
      return {
        body: `Instrument is right. Swap the effect and use one of your ${attemptsRemaining} remaining attempts this round.`,
        heading: "Close guess",
        tone: "warning"
      };
    }

    if (!lastGuess.instrumentMatch && lastGuess.effectMatch) {
      return {
        body: `Effect is right. Keep that texture and try another instrument. ${attemptsRemaining} attempts remain in this round.`,
        heading: "Close guess",
        tone: "warning"
      };
    }

    return {
      body: `Try again. Adjust the chain and submit another guess. ${attemptsRemaining} attempts remaining in this round.`,
      heading: "Keep the round moving",
      tone: "danger"
    };
  }

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

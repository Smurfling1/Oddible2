const instrumentSoundFallbacks = {
  "Crash Cymbal": ["Crash"],
  "Hi-Hat": ["High Hat"],
  "Ride Cymbal": ["Ride"]
};

const missingSoundWarnings = new Set();
const bundledSoundPaths = new Set([
  "/sounds/crash-chorus.mp3",
  "/sounds/crash-compression.mp3",
  "/sounds/crash-delay.mp3",
  "/sounds/crash-eq.mp3",
  "/sounds/crash-flanger.mp3",
  "/sounds/crash-reverb.mp3",
  "/sounds/high-hat-chorus.mp3",
  "/sounds/high-hat-compression.mp3",
  "/sounds/high-hat-delay.mp3",
  "/sounds/high-hat-eq.mp3",
  "/sounds/high-hat-flanger.mp3",
  "/sounds/high-hat-reverb.mp3",
  "/sounds/ride-chorus.mp3",
  "/sounds/ride-compression.mp3",
  "/sounds/ride-delay.mp3",
  "/sounds/ride-eq.mp3",
  "/sounds/ride-flanger.mp3",
  "/sounds/ride-reverb.mp3",
  "/sounds/snare-chorus.mp3",
  "/sounds/snare-compression.mp3",
  "/sounds/snare-delay.mp3",
  "/sounds/snare-flanger.mp3",
  "/sounds/snare-reverb.mp3"
]);

function normalizeSoundSegment(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

export function buildSoundPath(instrument, effect) {
  return `/sounds/${normalizeSoundSegment(instrument)}-${normalizeSoundSegment(effect)}.mp3`;
}

export function getSoundCandidatePaths(instrument, effect) {
  const instrumentCandidates = [
    instrument,
    ...(instrumentSoundFallbacks[instrument] ?? [])
  ];

  return [...new Set(instrumentCandidates.map((candidate) => buildSoundPath(candidate, effect)))];
}

export function getAvailableSoundPath(instrument, effect) {
  const candidatePaths = getSoundCandidatePaths(instrument, effect);

  for (const candidatePath of candidatePaths) {
    if (bundledSoundPaths.has(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export function getAvailableSoundCombinations(instruments, effects) {
  return instruments.flatMap((instrumentOption) =>
    effects.flatMap((effectOption) => {
      const instrument = instrumentOption.label;
      const effect = effectOption.label;
      const path = getAvailableSoundPath(instrument, effect);

      if (!path) {
        return [];
      }

      return [
        {
          effect,
          instrument,
          path
        }
      ];
    })
  );
}

export async function findAvailableSoundPath(instrument, effect) {
  return getAvailableSoundPath(instrument, effect);
}

export function getPreviewAudio(audioRef) {
  if (!audioRef.current) {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
  }

  return audioRef.current;
}

export function stopSoundPlayback(audio) {
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
}

export function warnMissingSound(instrument, effect) {
  const warningKey = `${instrument}::${effect}`;

  if (missingSoundWarnings.has(warningKey)) {
    return;
  }

  missingSoundWarnings.add(warningKey);
  console.warn("Sound file not found", {
    attemptedPaths: getSoundCandidatePaths(instrument, effect),
    effect,
    instrument
  });
}

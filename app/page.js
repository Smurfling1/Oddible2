import { SoundWordleApp } from "@/components/sound-wordle-app";
import { dailyChallenge, effectOptions, instrumentOptions } from "@/data/game-data";

export default function Home() {
  return (
    <SoundWordleApp
      challenge={dailyChallenge}
      instruments={instrumentOptions}
      effects={effectOptions}
    />
  );
}

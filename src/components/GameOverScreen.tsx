import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';

interface GameOverScreenProps {
  isVictory: boolean;
  memoriesCollected: number;
  totalMemories: number;
  playerName: string;
  onRetry: () => void; // MODIFIED: Renamed from onRestart to onRetry for clarity
  onMainMenu: () => void;
  muted: boolean;
}

export const GameOverScreen = ({
  isVictory,
  memoriesCollected,
  totalMemories,
  playerName,
  onRetry, // MODIFIED
  onMainMenu,
  muted,
}: GameOverScreenProps) => {
  const clickSoundRef = useRef<Howl | null>(null);

  useEffect(() => {
    clickSoundRef.current = new Howl({ src: [uiClick], volume: 0.4 });
    return () => { clickSoundRef.current?.unload(); };
  }, []);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  return (
    <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-96 text-center animate-fade-in w-full max-w-lg">
        {isVictory ? (
          <>
            <h2 className="font-dream text-4xl font-bold text-primary animate-pulse-glow">
              Victory, {playerName}!
            </h2>
            <p className="text-lg text-foreground">
              You escaped with all the memories!
            </p>
            <div className="bg-memory-glow/20 border border-memory-glow/30 rounded-lg p-4">
              <p className="font-dream text-xl">
                Memories Collected: {memoriesCollected}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-dream text-4xl font-bold text-destructive">
              Oh No, {playerName}!
            </h2>
            <p className="text-lg text-foreground">
              You were caught by the guardians.
            </p>
            <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4">
              <p className="font-dream text-xl">
                Memories Collected: {memoriesCollected}
              </p>
            </div>
          </>
        )}

        <div className="space-y-3">
          {/* MODIFIED: The button for retrying is different for victory vs. game over */}
          {!isVictory ? (
            <Button
              variant="dream"
              size="lg"
              onClick={() => {
                playClickSound();
                onRetry(); // MODIFIED: Call onRetry
              }}
              className="w-full"
            >
              Try Again (with penalty)
            </Button>
          ) : (
             <Button
              variant="dream"
              size="lg"
              onClick={() => {
                playClickSound();
                onMainMenu(); // On victory, this button can just go to main menu
              }}
              className="w-full"
            >
              Play Again
            </Button>
          )}

          <Button
            variant="ethereal"
            size="lg"
            onClick={() => {
              playClickSound();
              onMainMenu();
            }}
            className="w-full"
          >
            Main Menu
          </Button>
        </div>

        {isVictory && (
          <p className="text-sm text-muted-foreground italic">
            "The memories whisper their secrets to you..."
          </p>
        )}
      </div>
    </div>
  );
};
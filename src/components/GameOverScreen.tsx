import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3'; // Assuming you’re importing audio

interface GameOverScreenProps {
  isVictory: boolean;
  memoriesCollected: number;
  totalMemories: number;
  playerName: string;
  onRestart: () => void;
  onMainMenu: () => void;
  muted: boolean;
}

export const GameOverScreen = ({
  isVictory,
  memoriesCollected,
  totalMemories,
  playerName,
  onRestart,
  onMainMenu,
  muted,
}: GameOverScreenProps) => {
  const clickSoundRef = useRef<Howl | null>(null);

  // Initialize click sound
  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick],
      volume: 10,
      onloaderror: (id, error) => console.error('Failed to load ui-click.mp3:', error),
    });

    return () => {
      if (clickSoundRef.current) {
        clickSoundRef.current.unload();
        clickSoundRef.current = null;
      }
    };
  }, []);

  // Play click sound if not muted
  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  return (
    <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-96 text-center animate-fade-in">
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
                Memories Collected: {memoriesCollected}/{totalMemories}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-dream text-4xl font-bold text-destructive">
              Caught, {playerName}!
            </h2>
            <p className="text-lg text-foreground">
              The guardians sensed your presence...
            </p>
            <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4">
              <p className="font-dream text-xl">
                Memories Collected: {memoriesCollected}/{totalMemories}
              </p>
            </div>
          </>
        )}

        <div className="space-y-3">
          <Button
            variant="dream"
            size="lg"
            onClick={() => {
              playClickSound();
              onRestart();
            }}
            className="w-full"
          >
            Try Again
          </Button>

          <Button
            variant="ethereal"
            size="lg"
            onClick={() => {
              playClickSound();
              console.log('Main Menu button clicked, calling onMainMenu');
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
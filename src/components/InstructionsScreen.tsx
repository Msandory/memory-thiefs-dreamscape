import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';

interface InstructionsScreenProps {
  onBack: () => void;
  muted: boolean; // Ensure muted is defined
}

export const InstructionsScreen = ({ onBack, muted }: InstructionsScreenProps) => {
  const clickSoundRef = useRef<Howl | null>(null);

  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick],
      volume: 0.4,
      onloaderror: (id, error) => console.error('Failed to load ui-click.mp3:', error),
    });

    return () => {
      if (clickSoundRef.current) {
        clickSoundRef.current.unload();
        clickSoundRef.current = null;
      }
    };
  }, []);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card/90 border border-primary/30 rounded-lg p-6 sm:p-8 space-y-6 text-center animate-fade-in max-w-md w-full">
        <h1 className="font-dream text-4xl font-bold text-primary">
          Instructions
        </h1>
        <p className="text-lg text-foreground">
          Navigate the memory palace to steal all memories while avoiding the guardians.
        </p>
        <div className="text-left space-y-4">
          <div>
            <p className="font-dream text-lg">
              <strong>Controls (Desktop):</strong>
            </p>
            <ul className="list-disc list-inside text-foreground space-y-1">
              <li>WASD or Arrow Keys: Move the player</li>
              <li>Escape: Pause/Unpause</li>
              <li>R: Restart game</li>
              <li>M: Toggle mute</li>
            </ul>
          </div>
          <div>
            <p className="font-dream text-lg">
              <strong>Controls (Mobile):</strong>
            </p>
            <ul className="list-disc list-inside text-foreground space-y-1">
              <li>Use the on-screen joystick to move.</li>
              <li>Use the on-screen buttons to pause or mute.</li>
            </ul>
          </div>
          <div>
            <p className="font-dream text-lg">
              <strong>Objective:</strong>
            </p>
            <p className="text-foreground">
              Collect all memory orbs without being caught by the guardians. Each orb collected makes guardians faster.
            </p>
          </div>
        </div>
        <Button
          variant="ethereal"
          size="lg"
          onClick={() => {
            playClickSound();
            onBack();
          }}
          className="w-full"
        >
          Back to Main Menu
        </Button>
        <p className="text-sm text-muted-foreground italic">
          "The memories are fleeting, but the guardians are eternal..."
        </p>
      </div>
    </div>
  );
};
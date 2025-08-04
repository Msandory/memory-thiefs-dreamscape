import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';

interface MainMenuProps {
  onStartGame: (name: string) => void;
  onShowInstructions: () => void;
  muted: boolean;
  savedPlayerName: string;
  onClearPlayerName: () => void; // NEW: Add prop for clearing saved name
}

export const MainMenu = ({ onStartGame, onShowInstructions, muted, savedPlayerName, onClearPlayerName }: MainMenuProps) => {
  const [playerName, setPlayerName] = useState(savedPlayerName);
  const [showNameInput, setShowNameInput] = useState(!savedPlayerName); // NEW: Control whether to show input
  const clickSoundRef = useRef<Howl | null>(null);

  // Initialize click sound
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

  // NEW: Update local state when savedPlayerName changes
  useEffect(() => {
    setPlayerName(savedPlayerName);
    setShowNameInput(!savedPlayerName);
  }, [savedPlayerName]);

  // Play click sound if not muted
  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleSubmit = () => {
    if (playerName.trim()) {
      playClickSound();
      onStartGame(playerName.trim());
    }
  };

  // NEW: Handle changing name
  const handleChangeName = () => {
    playClickSound();
    setShowNameInput(true);
    setPlayerName('');
    onClearPlayerName(); // Clear the saved name in parent component
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card/90 border border-primary/30 rounded-lg p-8 space-y-6 text-center animate-fade-in max-w-md w-full">
        <h1 className="font-dream text-5xl font-bold text-primary animate-pulse-glow">
          Memory Thief
        </h1>
        <p className="text-lg text-foreground">
          Steal the memories, evade the guardians.
        </p>

        {/* UPDATED: Use showNameInput instead of checking savedPlayerName directly */}
        {savedPlayerName && !showNameInput ? (
          <div className="space-y-2">
            <p className="text-lg font-dream text-primary">
              Welcome back, {savedPlayerName}!
            </p>
            <Button
              variant="dream"
              size="lg"
              onClick={() => {
                playClickSound();
                onStartGame(savedPlayerName);
              }}
              className="w-full"
            >
              Continue as {savedPlayerName}
            </Button>
            <Button
              variant="ethereal"
              size="sm"
              onClick={handleChangeName} // UPDATED: Use the new handler
              className="w-full"
            >
              Change Name
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="border-primary/50 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  handleSubmit();
                }
              }}
              autoFocus // NEW: Auto-focus the input when it appears
            />
            <Button
              variant="dream"
              size="lg"
              onClick={handleSubmit}
              disabled={!playerName.trim()}
              className="w-full"
            >
              Start Game
            </Button>
            {/* NEW: Show "Back" button if there was a saved name */}
            {savedPlayerName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  playClickSound();
                  setShowNameInput(false);
                  setPlayerName(savedPlayerName);
                }}
                className="w-full"
              >
                Back
              </Button>
            )}
          </div>
        )}

        <Button
          variant="ethereal"
          size="lg"
          onClick={() => {
            playClickSound();
            onShowInstructions();
          }}
          className="w-full"
        >
          Instructions
        </Button>

        <p className="text-sm text-muted-foreground italic">
          "The palace holds secrets only the bold can claim..."
        </p>
      </div>
    </div>
  );
};
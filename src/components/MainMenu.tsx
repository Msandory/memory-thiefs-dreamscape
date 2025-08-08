import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';

type Difficulty = 'easy' | 'medium' | 'hard';

interface MainMenuProps {
  onStartGame: (name: string, difficulty: Difficulty) => void; // MODIFIED: Add difficulty
  onShowInstructions: () => void;
  muted: boolean;
  savedPlayerName: string;
  onClearPlayerName: () => void;
}

export const MainMenu = ({ onStartGame, onShowInstructions, muted, savedPlayerName, onClearPlayerName }: MainMenuProps) => {
  const [playerName, setPlayerName] = useState(savedPlayerName);
  const [showNameInput, setShowNameInput] = useState(!savedPlayerName);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium'); // NEW: Difficulty state
  const clickSoundRef = useRef<Howl | null>(null);

  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick],
      volume: 0.4,
      onloaderror: (id, error) => console.error('Failed to load ui-click.mp3:', error),
    });
    return () => { clickSoundRef.current?.unload(); };
  }, []);

  useEffect(() => {
    setPlayerName(savedPlayerName);
    setShowNameInput(!savedPlayerName);
  }, [savedPlayerName]);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleSubmit = () => {
    if (playerName.trim()) {
      playClickSound();
      onStartGame(playerName.trim(), difficulty); // MODIFIED: Pass difficulty
    }
  };

  const handleChangeName = () => {
    playClickSound();
    setShowNameInput(true);
    setPlayerName('');
    onClearPlayerName();
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
        
        {/* NEW: Difficulty Selection */}
        <div className="space-y-2">
          <p className="font-dream text-lg text-foreground">Choose Difficulty</p>
          <div className="flex justify-center gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? 'dream' : 'ethereal'}
                onClick={() => { playClickSound(); setDifficulty(d); }}
                className="capitalize w-full"
              >
                {d}
              </Button>
            ))}
          </div>
        </div>

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
                onStartGame(savedPlayerName, difficulty); // MODIFIED: Pass difficulty
              }}
              className="w-full"
            >
              Continue as {savedPlayerName}
            </Button>
            <Button
              variant="ethereal"
              size="sm"
              onClick={handleChangeName}
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              autoFocus
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
            {savedPlayerName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { playClickSound(); setShowNameInput(false); setPlayerName(savedPlayerName); }}
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
          onClick={() => { playClickSound(); onShowInstructions(); }}
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
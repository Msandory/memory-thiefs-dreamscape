import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';
import { Difficulty, MindType, MINDS } from '@/config/gameConfig';
import { getMazes, MazeConfig } from '@/utils/mazeGenerator';

interface MainMenuProps {
  onStartGame: (name: string, difficulty: Difficulty, mind: MindType, mazeId: string, texturePath: string) => void; // Updated to include texturePath
  onShowInstructions: () => void;
  muted: boolean;
  savedPlayerName: string;
  onClearPlayerName: () => void;
}

export const MainMenu = ({ onStartGame, onShowInstructions, muted, savedPlayerName, onClearPlayerName }: MainMenuProps) => {
  const [playerName, setPlayerName] = useState(savedPlayerName);
  const [showNameInput, setShowNameInput] = useState(!savedPlayerName);
  const [step, setStep] = useState<'name' | 'mind' | 'difficulty' | 'maze'>('name');
  const [selectedMind, setSelectedMind] = useState<MindType>('scholar');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [availableMazes, setAvailableMazes] = useState<MazeConfig[]>([]);
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
    if (savedPlayerName) setStep('mind');
  }, [savedPlayerName]);

  useEffect(() => {
    const mazes = getMazes(selectedMind, difficulty);
    setAvailableMazes(mazes);
  }, [selectedMind, difficulty]);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      playClickSound();
      setStep('mind');
    }
  };

  const handleMindSelect = (mind: MindType) => {
    playClickSound();
    setSelectedMind(mind);
    setStep('difficulty');
  };

  const handleDifficultySelect = (diff: Difficulty) => {
    playClickSound();
    setDifficulty(diff);
    setStep('maze');
  };

  const handleMazeSelect = (mazeId: string) => {
    playClickSound();
    const selectedMaze = availableMazes.find(maze => maze.id === mazeId);
    const texturePath = selectedMaze?.texturePath || MINDS[selectedMind].texturePath; // Use maze texture if available, else mind texture
    onStartGame(playerName.trim(), difficulty, selectedMind, mazeId, texturePath);
  };

  const handleChangeName = () => {
    playClickSound();
    setShowNameInput(true);
    setPlayerName('');
    setStep('name');
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
        
        {/* Mind Selection */}
        {step === 'mind' && (
          <div className="space-y-4">
            <p className="font-dream text-lg text-foreground">Choose a Mind to Infiltrate</p>
            <div className="space-y-3">
              {(Object.keys(MINDS) as MindType[]).map((mind) => (
                <Button
                  key={mind}
                  variant="ethereal"
                  onClick={() => handleMindSelect(mind)}
                  className="w-full text-left p-4 h-auto flex flex-col items-start"
                >
                  <div className="font-dream text-lg" style={{ color: MINDS[mind].color }}>
                    {MINDS[mind].name}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {MINDS[mind].description}
                  </div>
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setStep('name')} className="w-full">
              Back
            </Button>
          </div>
        )}

        {/* Difficulty Selection */}
        {step === 'difficulty' && (
          <div className="space-y-4">
            <p className="font-dream text-lg text-foreground">Choose Difficulty</p>
            <div className="space-y-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <Button
                  key={d}
                  variant="ethereal"
                  onClick={() => handleDifficultySelect(d)}
                  className="capitalize w-full"
                >
                  {d}
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setStep('mind')} className="w-full">
              Back
            </Button>
          </div>
        )}

        {/* Maze Selection */}
        {step === 'maze' && (
          <div className="space-y-4">
            <p className="font-dream text-lg text-foreground">Choose Your Maze</p>
            <div className="space-y-2">
              {availableMazes.map((maze) => (
                <Button
                  key={maze.id}
                  variant="ethereal"
                  onClick={() => handleMazeSelect(maze.id)}
                  className="w-full text-left p-4 h-auto"
                >
                  <div className="font-dream">{maze.name}</div>
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setStep('difficulty')} className="w-full">
              Back
            </Button>
          </div>
        )}

        {/* Name Input/Welcome */}
        {(step === 'name' || (savedPlayerName && !showNameInput && step === 'mind')) && (
          savedPlayerName && !showNameInput ? (
            <div className="space-y-2">
              <p className="text-lg font-dream text-primary">
                Welcome back, {savedPlayerName}!
              </p>
              <Button
                variant="dream"
                size="lg"
                onClick={() => setStep('mind')}
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
                autoFocus
              />
              <Button
                variant="dream"
                size="lg"
                onClick={handleNameSubmit}
                disabled={!playerName.trim()}
                className="w-full"
              >
                Continue
              </Button>
              {savedPlayerName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { playClickSound(); setShowNameInput(false); setPlayerName(savedPlayerName); setStep('mind'); }}
                  className="w-full"
                >
                  Back
                </Button>
              )}
            </div>
          )
        )}

        {step === 'name' && (
          <Button
            variant="ethereal"
            size="lg"
            onClick={() => { playClickSound(); onShowInstructions(); }}
            className="w-full"
          >
            Instructions
          </Button>
        )}

        <p className="text-sm text-muted-foreground italic">
          "The palace holds secrets only the bold can claim..."
        </p>
      </div>
    </div>
  );
};

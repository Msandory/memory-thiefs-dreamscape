import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import memoryPalaceBg from "@/assets/memory-palace-bg.jpg";
import { Howl } from "howler";

interface MainMenuProps {
  onStartGame: (name: string) => void;
  onShowInstructions: () => void;
  muted: boolean;
}

export const MainMenu = ({ onStartGame, onShowInstructions, muted }: MainMenuProps) => {
  const [playerName, setPlayerName] = useState("");
  const clickSoundRef = useRef<Howl | null>(null);

  // Initialize click sound
  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: ['/assets/audio/ui-click.mp3'],
      volume: 0.4,
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

  const handleStartGame = () => {
    if (playerName.trim()) {
      playClickSound();
      onStartGame(playerName.trim());
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${memoryPalaceBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      
      {/* Floating mist particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-32 h-32 bg-memory-glow/10 rounded-full animate-drift"
            style={{
              left: `${-10 + i * 15}%`,
              top: `${20 + (i % 3) * 30}%`,
              animationDelay: `${i * 2.5}s`,
              animationDuration: `${15 + i * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center space-y-8 animate-fade-in">
        {/* Title */}
        <div className="space-y-4">
          <h1 className="font-dream text-7xl font-bold text-foreground animate-float">
            Memory Palace
          </h1>
          <h2 className="font-dream text-4xl font-medium text-primary animate-pulse-glow">
            Thief
          </h2>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Navigate surreal dreamscapes and steal forgotten memories while avoiding ancient guardians
          </p>
        </div>

        {/* Menu buttons */}
        <div className="space-y-4 min-w-72">
          <Input 
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full text-center bg-background/20 border-primary/30 placeholder:text-muted-foreground/50"
            onKeyDown={(e) => e.key === 'Enter' && handleStartGame()}
          />
          
          <Button 
            variant="dream" 
            size="xl" 
            onClick={handleStartGame}
            disabled={!playerName.trim()}
            className="w-full animate-float"
            style={{ animationDelay: '0.2s' }}
          >
            Start Game
          </Button>
          
          <Button 
            variant="ethereal" 
            size="lg" 
            onClick={() => {
              playClickSound();
              onShowInstructions();
            }}
            className="w-full animate-float"
            style={{ animationDelay: '0.4s' }}
          >
            Instructions
          </Button>
        </div>

        {/* Atmospheric text */}
        <p className="text-sm text-muted-foreground/70 italic animate-fade-in" style={{ animationDelay: '0.6s' }}>
          "In dreams, all memories become vulnerable..."
        </p>
      </div>
    </div>
  );
};
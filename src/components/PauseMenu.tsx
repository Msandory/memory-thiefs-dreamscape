import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3'; // Added import for consistency

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  muted: boolean;
}

export const PauseMenu = ({ onResume, onRestart, onMainMenu, muted }: PauseMenuProps) => {
  const clickSoundRef = useRef<Howl | null>(null);

  // Initialize click sound
  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick], // Use imported audio file
      volume: 0.4,
    });

    return () => {
      if (clickSoundRef.current) {
        clickSoundRef.current.unload();
        clickSoundRef.current = null;
      }
    };
  }, []);
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('ESC key pressed - resuming game');
      playClickSound();
      onResume();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [onResume, muted])
  // Play click sound if not muted
  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-80 text-center animate-fade-in w-full max-w-sm">
        <h2 className="font-dream text-3xl font-bold text-foreground">Game Paused</h2>
        
        <div className="space-y-3">
          <Button 
            variant="dream" 
            size="lg" 
            onClick={() => {
              playClickSound();
              onResume();
            }}
            className="w-full"
          >
            Resume
          </Button>
          
          <Button 
            variant="ethereal" 
            size="lg" 
            onClick={() => {
              playClickSound();
              onRestart();
            }}
            className="w-full"
          >
            Restart
          </Button>
          
          <Button 
            variant="ghost" 
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
      </div>
    </div>
  );
};
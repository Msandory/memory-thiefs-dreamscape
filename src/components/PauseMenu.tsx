import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, ArrowLeft } from "lucide-react";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';

interface GameSettings {
  mouseSensitivity: number;
  mouseInvert: boolean;
}

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  muted: boolean;
  gameSettings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
}

export const PauseMenu = ({ onResume, onRestart, onMainMenu, muted, gameSettings, onSettingsChange }: PauseMenuProps) => {
  const clickSoundRef = useRef<Howl | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<GameSettings>(gameSettings);

  // Initialize click sound
  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick],
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
        if (showSettings) {
          setShowSettings(false);
          playClickSound();
        } else {
          console.log('ESC key pressed - resuming game');
          playClickSound();
          onResume();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onResume, muted, showSettings]);

  // Play click sound if not muted
  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleSettingsChange = (key: keyof GameSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  if (showSettings) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-80 text-center animate-fade-in w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playClickSound();
                setShowSettings(false);
              }}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-dream text-3xl font-bold text-foreground flex-1">Settings</h2>
          </div>
          
          <div className="space-y-6 text-left">
            {/* Mouse Sensitivity */}
            <div className="space-y-3">
              <Label htmlFor="sensitivity" className="text-foreground font-medium">
                Mouse Sensitivity: {localSettings.mouseSensitivity.toFixed(1)}
              </Label>
              <Slider
                id="sensitivity"
                min={0.1}
                max={3.0}
                step={0.1}
                value={[localSettings.mouseSensitivity]}
                onValueChange={(value) => handleSettingsChange('mouseSensitivity', value[0])}
                className="w-full"
              />
            </div>

            {/* Mouse Invert */}
            <div className="flex items-center justify-between">
              <Label htmlFor="invert" className="text-foreground font-medium">
                Invert Mouse Y-Axis
              </Label>
              <Switch
                id="invert"
                checked={localSettings.mouseInvert}
                onCheckedChange={(checked) => handleSettingsChange('mouseInvert', checked)}
              />
            </div>
          </div>

          <Button 
            variant="dream" 
            size="lg" 
            onClick={() => {
              playClickSound();
              setShowSettings(false);
            }}
            className="w-full"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

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
              setShowSettings(true);
            }}
            className="w-full gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
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
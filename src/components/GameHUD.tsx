import { useEffect } from "react";
import memoryOrbImg from "@/assets/memory-orb.jpg";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Clock } from "lucide-react";

interface GameHUDProps {
  memoriesCollected: number;
  totalMemories: number;
  score: number;
  playerName: string;
  gameMessage: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  muted: boolean;
  onToggleMute: () => void;
  timeRemaining: number;
  timerActive: boolean;
  currentLevel: number; // New prop
}

export const GameHUD = ({
  memoriesCollected,
  totalMemories,
  score,
  playerName,
  gameMessage,
  isPlaying,
  onTogglePlay,
  muted,
  onToggleMute,
  timeRemaining,
  timerActive,
  currentLevel,
}: GameHUDProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        onToggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggleMute]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number) => {
    if (seconds <= 10) return 'text-red-400 animate-pulse';
    if (seconds <= 30) return 'text-yellow-400';
    return 'text-primary';
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
        <div className="flex gap-3">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2 flex items-center gap-3">
            <img 
              src={memoryOrbImg} 
              alt="Memory Orb" 
              className="w-6 h-6 rounded-full animate-pulse-glow"
            />
            <span className="font-dream text-lg">
              {memoriesCollected}/{totalMemories} Memories
            </span>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2">
            <span className="font-dream text-lg">Score: {score}</span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2">
            <span className="font-dream text-lg">Level: {currentLevel}</span>
          </div>

          {timerActive && (
            <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2 flex items-center gap-2">
              <Clock className={`w-5 h-5 ${getTimerColor(timeRemaining)}`} />
              <span className={`font-dream text-lg font-bold ${getTimerColor(timeRemaining)}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ethereal"
            size="lg"
            onClick={onTogglePlay}
            className="bg-card/50 backdrop-blur-sm border border-primary/30"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button
            variant="ethereal"
            size="lg"
            onClick={onToggleMute}
            className="bg-card/50 backdrop-blur-sm border border-primary/30"
            title={muted ? "Unmute (M)" : "Mute (M)"}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2">
            <span className="font-dream text-lg">{playerName}</span>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg p-3">
            <div className="w-16 h-12 bg-muted/50 rounded border grid grid-cols-4 gap-px">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`${i === 5 ? 'bg-primary' : 'bg-muted/30'} rounded-sm`} 
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block text-center">Map</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-6 py-3 text-center">
          <p className="font-dream text-lg text-foreground/90 animate-fade-in">
            {gameMessage}
          </p>
          {timerActive && timeRemaining <= 10 && timeRemaining > 0 && (
            <p className="font-dream text-sm text-red-400 animate-pulse mt-1">
              Time is running out! Hurry!
            </p>
          )}
        </div>
      </div>

      <div className="absolute inset-0 fog-overlay pointer-events-none" />
    </div>
  );
};
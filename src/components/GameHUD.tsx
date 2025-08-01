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
  currentLevel: number;
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
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{
        maxWidth: '800px',
        maxHeight: '600px',
        aspectRatio: '4 / 3',
        margin: 'auto',
        contain: 'layout', // Ensures HUD is clipped to its bounds
      }}
    >
      <div className="absolute top-[1%] left-[1%] right-[1%] flex flex-wrap justify-between items-start gap-2 pointer-events-auto">
        <div className="flex flex-wrap gap-2">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-2 min-w-0">
            <img
              src={memoryOrbImg}
              alt="Memory Orb"
              className="w-5 h-5 rounded-full animate-pulse-glow"
            />
            <span className="font-dream text-sm sm:text-base truncate">
              {memoriesCollected}/{totalMemories}
            </span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">Score: {score}</span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">Level: {currentLevel}</span>
          </div>

          {timerActive && (
            <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-1 min-w-0">
              <Clock className={`w-4 h-4 ${getTimerColor(timeRemaining)}`} />
              <span className={`font-dream text-sm sm:text-base font-bold ${getTimerColor(timeRemaining)} truncate`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            variant="ethereal"
            size="sm"
            onClick={onTogglePlay}
            className="bg-card/50 backdrop-blur-sm border border-primary/30 p-2"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ethereal"
            size="sm"
            onClick={onToggleMute}
            className="bg-card/50 backdrop-blur-sm border border-primary/30 p-2"
            title={muted ? "Unmute (M)" : "Mute (M)"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">{playerName}</span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg p-2">
            <div className="w-12 h-9 bg-muted/50 rounded border grid grid-cols-4 gap-px">
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

      <div className="absolute bottom-[1%] left-[1%] right-[1%]">
        <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2 text-center max-w-full">
          <p className="font-dream text-sm sm:text-base text-foreground/90 animate-fade-in truncate">
            {gameMessage}
          </p>
          {timerActive && timeRemaining <= 10 && timeRemaining > 0 && (
            <p className="font-dream text-xs sm:text-sm text-red-400 animate-pulse mt-1 truncate">
              Time is running out! Hurry!
            </p>
          )}
        </div>
      </div>

      <div className="absolute inset-0 fog-overlay pointer-events-none" />
    </div>
  );
};
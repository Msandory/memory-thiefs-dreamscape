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
    <div className="absolute inset-0 pointer-events-none p-2 sm:p-4">
      {/* Top bar container */}
      <div className="flex justify-between items-center flex-nowrap gap-4 pointer-events-auto">
        
        {/* Left-aligned group */}
        <div className="flex items-center gap-2">
          {/* Memory Orbs: ALWAYS VISIBLE */}
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-2">
            <img
              src={memoryOrbImg}
              alt="Memory Orb"
              className="w-5 h-5 rounded-full animate-pulse-glow"
            />
            <span className="font-dream text-sm sm:text-base">
              {memoriesCollected}/{totalMemories}
            </span>
          </div>

          {/* Score: HIDDEN on mobile, visible on sm screens and up */}
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 hidden sm:flex">
            <span className="font-dream text-sm sm:text-base">Score: {score}</span>
          </div>

          {/* Level: HIDDEN on mobile, visible on sm screens and up */}
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 hidden sm:flex">
            <span className="font-dream text-sm sm:text-base">Level: {currentLevel}</span>
          </div>

          {/* Timer: ALWAYS VISIBLE when active */}
          {timerActive && (
            <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-1">
              <Clock className={`w-4 h-4 ${getTimerColor(timeRemaining)}`} />
              <span className={`font-dream text-sm sm:text-base font-bold ${getTimerColor(timeRemaining)}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Right-aligned group */}
        <div className="flex items-center gap-2">
          {/* Player Name: HIDDEN on mobile, visible on sm screens and up */}
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 hidden sm:flex">
            <span className="font-dream text-sm sm:text-base">{playerName}</span>
          </div>
          
          {/* Pause/Play Button: ALWAYS VISIBLE */}
          <Button
            variant="ethereal"
            size="sm"
            onClick={onTogglePlay}
            className="bg-card/50 backdrop-blur-sm border border-primary/30 p-2"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          {/* Mute/Unmute Button: ALWAYS VISIBLE */}
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
      </div>

      {/* Game Message Area (no changes needed here) */}
      
    </div>
  );
};
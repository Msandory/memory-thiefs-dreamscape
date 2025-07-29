import memoryOrbImg from "@/assets/memory-orb.jpg";

import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface GameHUDProps {
  memoriesCollected: number;
  totalMemories: number;
  score: number;
  playerName: string;
  gameMessage: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const GameHUD = ({ memoriesCollected, totalMemories, score, playerName, gameMessage, isPlaying, onTogglePlay }: GameHUDProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
        {/* Left side - Memory Counter and Score */}
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
        </div>

        {/* Center - Pause/Play Button */}
        <Button
          variant="ethereal"
          size="lg"
          onClick={onTogglePlay}
          className="bg-card/50 backdrop-blur-sm border border-primary/30"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>

        {/* Right side - Player Name and Mini Map */}
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

      {/* Bottom Message Area */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-6 py-3 text-center">
          <p className="font-dream text-lg text-foreground/90 animate-fade-in">
            {gameMessage}
          </p>
        </div>
      </div>

      {/* Atmospheric fog overlay */}
      <div className="absolute inset-0 fog-overlay pointer-events-none" />
    </div>
  );
};
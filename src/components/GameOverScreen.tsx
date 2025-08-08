import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";
import uiClick from '@/assets/audio/ui-click.mp3';

// --- UPDATED SCOREBOARD COMPONENT ---
interface ScoreEntry {
  playerName: string;
  time: number; // in seconds
  difficulty: 'easy' | 'medium' | 'hard';
  date: string;
}

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const difficultyWeights = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

const ScoreboardContent = () => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScores() {
      try {
        const q = query(collection(db, "scores"), orderBy("time", "asc"), limit(10));
        const querySnapshot = await getDocs(q);
        const firebaseScores: ScoreEntry[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          firebaseScores.push({
            playerName: data.playerName,
            time: data.time,
            difficulty: data.difficulty,
            date: data.date,
          });
        });

        // Sort with difficulty weighting (lower time / weight = better)
        firebaseScores.sort((a, b) => {
          const scoreA = a.time / difficultyWeights[a.difficulty];
          const scoreB = b.time / difficultyWeights[b.difficulty];
          return scoreA - scoreB;
        });

        setScores(firebaseScores);
        setError(null);
      } catch (error) {
        console.error("Error fetching scores:", error);
        setError("404 Not Found: Unable to load scores. Please check your connection.");
      }
    }

    fetchScores();
  }, []);

  return (
    <div className="animate-fade-in space-y-4 text-center">
      <h1 className="font-dream text-4xl font-bold text-primary">Scoreboard</h1>
      <p className="text-muted-foreground">See how you rank among the greats!</p>
      {error ? (
        <p className="text-destructive py-8">{error}</p>
      ) : scores.length > 0 ? (
        <table className="w-full text-left text-sm sm:text-base">
          <thead>
            <tr className="border-b border-primary/20 text-muted-foreground">
              <th className="p-2 font-semibold">Rank</th>
              <th className="p-2 font-semibold">Player</th>
              <th className="p-2 font-semibold">Time</th>
              <th className="p-2 font-semibold">Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {scores.slice(0, 10).map((score, index) => (
              <tr key={`${score.date}-${index}`} className="border-b border-primary/10">
                <td className="p-2 font-bold text-primary">{index + 1}</td>
                <td className="p-2 truncate">{score.playerName}</td>
                <td className="p-2">{formatTime(score.time)}</td>
                <td
                  className={`p-2 capitalize font-semibold ${
                    score.difficulty === 'hard'
                      ? 'text-red-400'
                      : score.difficulty === 'medium'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {score.difficulty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground py-8">No scores yet. Be the first to complete the game!</p>
      )}
    </div>
  );
};

// --- GameOverScreen COMPONENT ---
interface GameOverScreenProps {
  isVictory: boolean;
  memoriesCollected: number;
  playerName: string;
  onRetry: () => void;
  onMainMenu: () => void;
  muted: boolean;
  totalMemories: number;
}

export const GameOverScreen = ({
  isVictory,
  memoriesCollected,
  totalMemories,
  playerName,
  onRetry,
  onMainMenu,
  muted,
}: GameOverScreenProps) => {
  const clickSoundRef = useRef<Howl | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'scoreboard'>('summary');

  useEffect(() => {
    clickSoundRef.current = new Howl({ src: [uiClick], volume: 0.4 });
    return () => {
      clickSoundRef.current?.unload();
    };
  }, []);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleTabChange = (tab: 'summary' | 'scoreboard') => {
    playClickSound();
    setActiveTab(tab);
  };

  return (
    <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-6 sm:p-8 space-y-6 min-w-[24rem] text-center animate-fade-in w-full max-w-xl">
        {isVictory ? (
          <>
            <div className="flex justify-center border-b border-primary/20 mb-4">
              <Button
                variant={activeTab === 'summary' ? 'ghost' : 'link'}
                className={`font-dream text-lg transition-colors ${
                  activeTab === 'summary' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'
                }`}
                onClick={() => handleTabChange('summary')}
              >
                Summary
              </Button>
              <Button
                variant={activeTab === 'scoreboard' ? 'ghost' : 'link'}
                className={`font-dream text-lg transition-colors ${
                  activeTab === 'scoreboard' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'
                }`}
                onClick={() => handleTabChange('scoreboard')}
              >
                Scoreboard
              </Button>
            </div>

            <div className="min-h-[150px]">
              {activeTab === 'summary' ? (
                <div className="animate-fade-in space-y-4">
                  <h2 className="font-dream text-4xl font-bold text-primary animate-pulse-glow">
                    Victory, {playerName}!
                  </h2>
                  <p className="text-lg text-foreground">You escaped with all the memories!</p>
                  <div className="bg-memory-glow/20 border border-memory-glow/30 rounded-lg p-4">
                    <p className="font-dream text-xl">Memories Collected: {memoriesCollected}</p>
                  </div>
                </div>
              ) : (
                <ScoreboardContent />
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-dream text-4xl font-bold text-destructive">Oh No, {playerName}!</h2>
            <p className="text-lg text-foreground">You were caught by the guardians.</p>
            <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4">
              <p className="font-dream text-xl">Memories Collected: {memoriesCollected}</p>
            </div>
          </>
        )}

        <div className="space-y-3 pt-4 border-t border-primary/10">
          {!isVictory ? (
            <Button
              variant="dream"
              size="lg"
              onClick={() => {
                playClickSound();
                onRetry();
              }}
              className="w-full"
            >
              Try Again (with penalty)
            </Button>
          ) : (
            <Button
              variant="dream"
              size="lg"
              onClick={() => {
                playClickSound();
                onMainMenu();
              }}
              className="w-full"
            >
              Play Again
            </Button>
          )}

          <Button
            variant="ethereal"
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

        {isVictory && activeTab === 'summary' && (
          <p className="text-sm text-muted-foreground italic">
            "The memories whisper their secrets to you..."
          </p>
        )}
      </div>
    </div>
  );
};
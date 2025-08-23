import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";
import uiClick from '@/assets/audio/ui-click.mp3';
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig"; 
// --- NEW: SCOREBOARD COMPONENT ---
// This component fetches, sorts, and displays the scoreboard.

interface ScoreEntry {
  playerName: string;
  time: number; // in seconds
  difficulty: 'easy' | 'medium' | 'hard';
  date: string;
}

// Helper to format total seconds into a MM:SS string
const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Difficulty weights for ranking. A higher weight means a better score for the same time.
const difficultyWeights = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

const ScoreboardContent = () => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);

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
      } catch (error) {
        console.error("Error fetching scores:", error);
      }
    }
  
    fetchScores();
  }, []);

  return (
    <div className="animate-fade-in space-y-4 text-center">
      <h1 className="font-dream text-4xl font-bold text-primary">Scoreboard</h1>
      <p className="text-muted-foreground">Top 10 wanderers who escaped the palace.</p>
      {scores.length > 0 ? (
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
                <td className={`p-2 capitalize font-semibold ${
                  score.difficulty === 'hard' ? 'text-red-400' : 
                  score.difficulty === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>{score.difficulty}</td>
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


// --- MODIFIED InstructionsScreen COMPONENT ---
interface InstructionsScreenProps {
  onBack: () => void;
  muted: boolean;
}

export const InstructionsScreen = ({ onBack, muted }: InstructionsScreenProps) => {
  const [activeTab, setActiveTab] = useState<'instructions' | 'scoreboard'>('instructions');
  const clickSoundRef = useRef<Howl | null>(null);

  useEffect(() => {
    clickSoundRef.current = new Howl({
      src: [uiClick],
      volume: 0.4,
    });
    return () => { clickSoundRef.current?.unload(); };
  }, []);

  const playClickSound = () => {
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.play();
    }
  };

  const handleTabChange = (tab: 'instructions' | 'scoreboard') => {
    playClickSound();
    setActiveTab(tab);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div 
        className="bg-card/90 border border-primary/30 rounded-lg p-6 sm:p-8 space-y-4 text-center animate-fade-in max-w-2xl w-full flex flex-col" 
        style={{height: '90vh', maxHeight: '800px'}}
      >
        <div className="flex-shrink-0 flex justify-center border-b border-primary/20 mb-4">
          <Button 
            variant={activeTab === 'instructions' ? 'ghost' : 'link'} 
            className={`font-dream text-lg transition-colors ${activeTab === 'instructions' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'}`} 
            onClick={() => handleTabChange('instructions')}>
              Instructions
          </Button>
          <Button 
            variant={activeTab === 'scoreboard' ? 'ghost' : 'link'} 
            className={`font-dream text-lg transition-colors ${activeTab === 'scoreboard' ? 'text-primary' : 'text-muted-foreground hover:text-primary/80'}`} 
            onClick={() => handleTabChange('scoreboard')}>
              Scoreboard
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto pr-3 -mr-3">
          {activeTab === 'instructions' ? (
              <div className="animate-fade-in space-y-6">
                <h1 className="font-dream text-4xl font-bold text-primary">Instructions</h1>
                <p className="text-lg text-foreground">Navigate the memory palace to steal all memories while avoiding the guardians.</p>
                <div className="text-left space-y-4">
                  <div>
                    <p className="font-dream text-lg"><strong>Controls (Desktop):</strong></p>
                    <ul className="list-disc list-inside text-foreground space-y-1">
                      <li>WASD or Arrow Keys: Move</li>
                      <li>Hold Shift: Sprint</li>
                      <li>Mouse: Look Around</li>
                      <li>Click: Lock Mouse (for camera control)</li>
                      <li>V: Toggle Camera View (First/Third Person)</li>
                      <li>SPACE: Use Thunder Power-Up</li>
                      <li>Escape: Pause Menu</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-dream text-lg"><strong>Controls (Mobile):</strong></p>
                    <ul className="list-disc list-inside text-foreground space-y-1">
                      <li>Left Joystick: Move</li>
                      <li>Right Joystick: Look Around</li>
                      <li>Use on-screen buttons for actions (e.g., Use Power-up, Toggle View).</li>
                    </ul>
                  </div>
                  {/* CHANGE: Added tip for mouse/joystick sensitivity */}
                   <div className="!mt-6 p-3 bg-primary/10 rounded-md border border-primary/20">
                    <p className="font-dream text-lg text-primary"><strong>Control Tip:</strong></p>
                    <p className="text-foreground">If looking around with the mouse or right joystick feels too slow or fast, adjust the <strong>Mouse Sensitivity</strong> in the settings via the <strong>Pause Menu</strong>.</p>
                  </div>
                  <div>
                    <p className="font-dream text-lg"><strong>Objective:</strong></p>
                    <p className="text-foreground">Collect all memory orbs without being caught. Each orb collected makes guardians faster and more aware.</p>
                  </div>
                   <div>
                    <p className="font-dream text-lg"><strong>Power-ups:</strong></p>
                    <ul className="list-disc list-inside text-foreground space-y-1">
                    <li>🟡 Speed: Double movement speed for a short time.</li>
                    <li>🟢 Immunity: Guards can't see or catch you for a short time.</li>
                    <li>🟣 Thunder: Press SPACE to eliminate a guard.</li>
                    <li>🟠 Timer: Adds extra time to the clock.</li>
                    </ul>
                  </div>
                </div>
              </div>
          ) : <ScoreboardContent />}
        </div>
        
        <div className="flex-shrink-0 pt-4 mt-auto">
          <Button variant="ethereal" size="lg" onClick={() => { playClickSound(); onBack(); }} className="w-full">
            Back to Main Menu
          </Button>
          <p className="text-sm text-muted-foreground italic mt-4">
            "The memories are fleeting, but the guardians are eternal..."
          </p>
        </div>
      </div>
    </div>
  );
};
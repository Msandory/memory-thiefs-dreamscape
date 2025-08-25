// Game Configuration
import { ChallengeState } from '../utils/miniChallenges';
import brickWallTexture from '@/assets/Texture/brickWallTexture.avif';
import stoneWallTexture from '@/assets/Texture/stoneWallTexture.jpg';
import metalWallTexture from '@/assets/Texture/marbleWallTexture.jpg';
import glassWallTexture from '@/assets/Texture/glassWallTexture.webp';
// CHANGE 3: Import a floor texture
import concreteFloorTexture from '@/assets/Texture/floor.jpg';

export const TILE_SIZE = 40;
export const MAP_COLS = 20;
export const MAP_ROWS = 15;

export type Difficulty = 'easy' | 'medium' | 'hard';
export type PowerUpType = 'speed' | 'immunity' | 'thunder' | 'timer';
export type MindType = 'scholar' | 'artist' | 'detective';

export interface MindConfig {
  name: string;
  description: string;
  theme: string;
  color: string;
<<<<<<< HEAD
  texturePath: string; // Path to the wall texture
  // CHANGE 3: Add path for floor texture
  floorTexturePath: string;
=======
>>>>>>> main
}

export interface MiniChallenge {
  id: string;
  name: string;
  description: string;
  type: 'stealth' | 'speed' | 'collection';
  points: number;
  condition: (gameState: ChallengeState) => boolean;
  duration: number; // seconds
}

export const MINDS: Record<MindType, MindConfig> = {
  scholar: {
<<<<<<< HEAD
    name: 'Scholar',
    description: 'Navigate the labyrinth of knowledge with precision.',
  
    texturePath: brickWallTexture,
    // CHANGE 3: Add floor texture path
    floorTexturePath: concreteFloorTexture,
=======
    name: "Scholar's Library",
    description: "Navigate through ancient halls of knowledge",
>>>>>>> main
    theme: "Academic halls with floating books and scrolls",
    color: "hsl(210, 100%, 70%)"
  },
  artist: {
<<<<<<< HEAD
    name: 'Artist',
    description: 'Weave through the chaos of creativity.',
    texturePath: stoneWallTexture,
    // CHANGE 3: Add floor texture path
    floorTexturePath: concreteFloorTexture,
    theme: "Paint-splattered rooms with floating canvases",
    color: "hsl(300, 100%, 70%)"
  },
  detective: { 
    name: 'Detective',
    description: 'Uncover clues in the maze of mystery.',
    texturePath: metalWallTexture,
    // CHANGE 3: Add floor texture path
    floorTexturePath: concreteFloorTexture,
=======
    name: "Artist's Studio", 
    description: "Steal memories from a creative sanctuary",
    theme: "Paint-splattered rooms with floating canvases",
    color: "hsl(300, 100%, 70%)"
  },
  detective: {
    name: "Detective's Office",
    description: "Infiltrate a mind of logic and deduction", 
>>>>>>> main
    theme: "Noir-style rooms with case files and evidence",
    color: "hsl(45, 100%, 70%)"
  }
};

export const difficultyConfigs = {
  easy: { 
    baseTimer: 45, 
    timerIncrement: 3, 
    baseGuardSpeed: 0.2, 
    speedIncrement: 0.2, 
    initialGuards: 1, 
    guardsPerLevel: 0.5, 
    powerUpChance: 0.8 
  },
  medium: { 
    baseTimer: 35, 
    timerIncrement: 2, 
    baseGuardSpeed: 1, 
    speedIncrement: 0.5, 
    initialGuards: 1, 
    guardsPerLevel: 1, 
    powerUpChance: 0.6 
  },
  hard: { 
    baseTimer: 30, 
    timerIncrement: 1, 
    baseGuardSpeed: 1.3, 
    speedIncrement: 0.6, 
    initialGuards: 2, 
    guardsPerLevel: 1, 
    powerUpChance: 0.8 
  },
};

export const commonConfig = {
  MAX_LEVELS: 10,
  initialOrbs: 2,
  orbsPerLevel: 0.5,
  safeDistance: 100,
<<<<<<< HEAD
  guardianVisionRange: 190, // Distance (in game units) guards can 'see' for the minimap cone
  guardianVisionAngle: 190, // Dwegrees: FOV for vision cone on minimap
  powerUpStartLevel: 1,
  orbRadius: 20, // Collision radius for memory orbs (game units)
  guardianRadius: 10, // Collision radius for guardians (game units) - adjusted!
  playerRadius: 9, // Collision radius for player (game units) - adjusted!
  guardianAlertRadius: 150, // Actual radius for guard's player detection in GameCanvas3D
  guardianAlertSpeedMultiplier: 1.5, 
  playerBaseSpeed: 8, // Base speed for player movement in game units
  playerSprintMultiplier: 1.5, 
  max_stuck_attempts: 10, // Changed from 15 to 10 for faster recovery
  patrolDirectionChangeInterval: 2500, // Base time (ms) before considering a patrol direction change
  patrolDirectionChangeRandomOffset: 10, // Random additional time (ms) for patrol direction change
  powerUpEffects: {
    speedBoostMultiplier: 1.5, 
    timerBoost: 30, 
    timerScoreBonus: 50,
    otherPowerUpScoreBonus: 20,
  }
=======
  guardianVisionRange: 100,
  guardianVisionAngle: Math.PI / 3,
  powerUpStartLevel: 4,
>>>>>>> main
};

export const MINI_CHALLENGES: MiniChallenge[] = [
  {
    id: 'stealth_master',
    name: 'Shadow Walker',
    description: 'Collect 3 orbs without alerting any guards',
    type: 'stealth',
    points: 50,
    condition: (gameState) => gameState.orbsCollectedWithoutAlert >= 3,
    duration: 30
  },
  {
    id: 'speed_demon',
    name: 'Lightning Thief',
    description: 'Collect all orbs in under 15 seconds',
    type: 'speed',
    points: 75,
    condition: (gameState) => gameState.allOrbsCollected && gameState.timeElapsed < 15,
    duration: 20
  },
  {
    id: 'special_collector',
    name: 'Golden Memory',
    description: 'Find and collect the special golden orb',
    type: 'collection',
    points: 100,
    condition: (gameState) => gameState.specialOrbCollected,
    duration: 45
  }
];

export interface SpecialOrb {
  x: number;
  y: number;
  type: 'golden' | 'diamond' | 'rainbow';
  points: number;
  collected: boolean;
  pulse: number;
  glow: number;
}

export const SPECIAL_ORB_TYPES = {
  golden: { points: 25, color: '#FFD700', glowColor: '#FFFF99' },
  diamond: { points: 50, color: '#E0E0E0', glowColor: '#FFFFFF' },
  rainbow: { points: 75, color: '#FF6B6B', glowColor: '#4ECDC4' }
};
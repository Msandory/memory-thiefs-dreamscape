// Game Configuration
import { ChallengeState } from '../utils/miniChallenges';
import brickWallTexture from '@/assets/Texture/brickWallTexture.avif';
import stoneWallTexture from '@/assets/Texture/stoneWallTexture.jpg';
import metalWallTexture from '@/assets/Texture/marbleWallTexture.jpg';
import glassWallTexture from '@/assets/Texture/glassWallTexture.webp';
export const TILE_SIZE = 100;
export const MAP_COLS = 20;
export const MAP_ROWS = 15;

export type Difficulty = 'easy' | 'medium' | 'hard';
export enum PowerUpType {
  Speed = 'speed',
  Immunity = 'immunity',
  Thunder = 'thunder', // Example: clear guardians
  Timer = 'timer', // Example: add time
}

export type MindType = 'scholar' | 'artist' | 'detective';

export interface MindConfig {
  name: string;
  description: string;
  theme: string;
  color: string;
  texturePath: string; // Path to the wall texture
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
    name: 'Scholar',
    description: 'Navigate the labyrinth of knowledge with precision.',
  
    texturePath: brickWallTexture,
    theme: "Academic halls with floating books and scrolls",
    color: "hsl(210, 100%, 70%)"
  },
  artist: {
    name: 'Artist',
    description: 'Weave through the chaos of creativity.',
    texturePath: stoneWallTexture,
    theme: "Paint-splattered rooms with floating canvases",
    color: "hsl(300, 100%, 70%)"
  },
  detective: { // Changed from warrior to detective to match mazeGenerator.ts
    name: 'Detective',
    description: 'Uncover clues in the maze of mystery.',
    texturePath: metalWallTexture,
    theme: "Noir-style rooms with case files and evidence",
    color: "hsl(45, 100%, 70%)"
  },
 
};
export const difficultyConfigs = {
  easy: { 
    baseTimer: 60, 
    timerIncrement: 3, 
    baseGuardSpeed: 10, 
    speedIncrement: 0.2, 
    initialGuards: 1, 
    guardsPerLevel: 0.5, 
    powerUpChance: 0.8,
   
  },
  medium: { 
    baseTimer: 35, 
    timerIncrement: 2, 
    baseGuardSpeed: 10, 
    speedIncrement: 0.5, 
    initialGuards: 1, 
    guardsPerLevel: 1, 
    powerUpChance: 0.6,
   
  },
  hard: { 
    baseTimer: 30, 
    timerIncrement: 1, 
    baseGuardSpeed: 13, 
    speedIncrement: 0.6, 
    initialGuards: 2, 
    guardsPerLevel: 1, 
    powerUpChance: 0.8,
   
  },
};

export const commonConfig = {
  MAX_LEVELS: 10,
  initialOrbs: 2,
  orbsPerLevel: 0.5,
  safeDistance: 100,
  guardianVisionRange: 150,
  guardianVisionAngle: Math.PI / 3,
  powerUpStartLevel: 4,
  orbRadius: 30,
  guardianRadius: 40,
  playerRadius: 20, 
  guardianAlertRadius: 300, 
  guardianAlertSpeedMultiplier: 2.5, 
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
import { MiniChallenge, SpecialOrb, SPECIAL_ORB_TYPES } from '../config/gameConfig';

export interface ChallengeState {
  activeChallenge: MiniChallenge | null;
  challengeStartTime: number;
  challengeProgress: Record<string, any>;
  challengeCompleted: boolean;
  orbsCollectedWithoutAlert: number;
  timeElapsed: number;
  allOrbsCollected: boolean;
  specialOrbCollected: boolean;
}

export interface GameChallengeState {
  orbsCollected: number;
  guardsAlerted: boolean;
  timeElapsed: number;
  allOrbsCollected: boolean;
  specialOrbCollected: boolean;
  orbsCollectedWithoutAlert: number;
}

export class MiniChallengeManager {
  private challenges: MiniChallenge[];
  private currentChallenge: MiniChallenge | null = null;
  private challengeStartTime: number = 0;
  private challengeState: ChallengeState;

  constructor(challenges: MiniChallenge[]) {
    this.challenges = challenges;
    this.challengeState = {
      activeChallenge: null,
      challengeStartTime: 0,
      challengeProgress: {},
      challengeCompleted: false,
      orbsCollectedWithoutAlert: 0,
      timeElapsed: 0,
      allOrbsCollected: false,
      specialOrbCollected: false
    };
  }

  startRandomChallenge(): MiniChallenge | null {
    if (this.currentChallenge) return null;
    
    const availableChallenges = this.challenges.filter(c => !this.challengeState.challengeCompleted);
    if (availableChallenges.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableChallenges.length);
    this.currentChallenge = availableChallenges[randomIndex];
    this.challengeStartTime = Date.now();
    this.challengeState.activeChallenge = this.currentChallenge;
    this.challengeState.challengeStartTime = this.challengeStartTime;
    this.challengeState.challengeCompleted = false;

    return this.currentChallenge;
  }

  updateChallenge(gameState: GameChallengeState): { completed: boolean; expired: boolean; progress: number } {
    if (!this.currentChallenge) return { completed: false, expired: false, progress: 0 };

    const currentTime = Date.now();
    const timeElapsed = (currentTime - this.challengeStartTime) / 1000;
    const timeRemaining = this.currentChallenge.duration - timeElapsed;

    // Update challenge state
    this.challengeState.orbsCollectedWithoutAlert = gameState.orbsCollectedWithoutAlert;
    this.challengeState.timeElapsed = gameState.timeElapsed;
    this.challengeState.allOrbsCollected = gameState.allOrbsCollected;
    this.challengeState.specialOrbCollected = gameState.specialOrbCollected;

    // Check if challenge is expired
    if (timeRemaining <= 0) {
      this.endChallenge();
      return { completed: false, expired: true, progress: 0 };
    }

    // Check if challenge is completed
    const completed = this.currentChallenge.condition(this.challengeState);
    if (completed) {
      this.challengeState.challengeCompleted = true;
      this.endChallenge();
      return { completed: true, expired: false, progress: 100 };
    }

    // Calculate progress
    const progress = this.calculateProgress();
    return { completed: false, expired: false, progress };
  }

  private calculateProgress(): number {
    if (!this.currentChallenge) return 0;

    switch (this.currentChallenge.type) {
      case 'stealth':
        return Math.min((this.challengeState.orbsCollectedWithoutAlert / 3) * 100, 100);
      case 'speed':
        if (this.challengeState.allOrbsCollected) return 100;
        return 0;
      case 'collection':
        return this.challengeState.specialOrbCollected ? 100 : 0;
      default:
        return 0;
    }
  }

  endChallenge(): void {
    this.currentChallenge = null;
    this.challengeStartTime = 0;
    this.challengeState.activeChallenge = null;
  }

  getCurrentChallenge(): MiniChallenge | null {
    return this.currentChallenge;
  }

  getRemainingTime(): number {
    if (!this.currentChallenge) return 0;
    const currentTime = Date.now();
    const timeElapsed = (currentTime - this.challengeStartTime) / 1000;
    return Math.max(0, this.currentChallenge.duration - timeElapsed);
  }

  reset(): void {
    this.currentChallenge = null;
    this.challengeStartTime = 0;
    this.challengeState = {
      activeChallenge: null,
      challengeStartTime: 0,
      challengeProgress: {},
      challengeCompleted: false,
      orbsCollectedWithoutAlert: 0,
      timeElapsed: 0,
      allOrbsCollected: false,
      specialOrbCollected: false
    };
  }
}

export function generateSpecialOrb(level: number): SpecialOrb | null {
  // 30% chance to spawn special orb after level 2
  if (level < 3 || Math.random() > 0.3) return null;

  const types = Object.keys(SPECIAL_ORB_TYPES) as Array<keyof typeof SPECIAL_ORB_TYPES>;
  const randomType = types[Math.floor(Math.random() * types.length)];
  const config = SPECIAL_ORB_TYPES[randomType];

  return {
    x: 0, // Will be set when positioning
    y: 0, // Will be set when positioning
    type: randomType,
    points: config.points,
    collected: false,
    pulse: Math.random() * Math.PI * 2,
    glow: 0
  };
}

export function shouldTriggerChallenge(level: number, orbsCollected: number): boolean {
  // Trigger challenges after level 2, with increasing probability
  if (level < 3) return false;
  
  const baseChance = 0.3;
  const levelMultiplier = Math.min(level * 0.1, 0.5);
  const orbMultiplier = orbsCollected * 0.1;
  
  return Math.random() < (baseChance + levelMultiplier + orbMultiplier);
}
import { Difficulty, MindType, TILE_SIZE, MAP_COLS, MAP_ROWS } from '../config/gameConfig';

export interface MazeConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  mind: MindType;
  layout: number[][];
}

// Maze generation algorithm
function generateMaze(complexity: number, density: number): number[][] {
  const maze: number[][] = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(1));
  
  // Create paths
  for (let row = 1; row < MAP_ROWS - 1; row += 2) {
    for (let col = 1; col < MAP_COLS - 1; col += 2) {
      maze[row][col] = 0;
      
      if (Math.random() < density) {
        // Create horizontal path
        if (col < MAP_COLS - 3 && Math.random() < 0.5) {
          maze[row][col + 1] = 0;
        }
        // Create vertical path  
        if (row < MAP_ROWS - 3 && Math.random() < 0.5) {
          maze[row + 1][col] = 0;
        }
      }
    }
  }
  
  // Add some complexity
  for (let i = 0; i < complexity; i++) {
    const row = Math.floor(Math.random() * (MAP_ROWS - 2)) + 1;
    const col = Math.floor(Math.random() * (MAP_COLS - 2)) + 1;
    if (Math.random() < 0.5) {
      maze[row][col] = 0;
    }
  }
  
  return maze;
}

// Pre-generated mazes for each mind/difficulty combination
const MAZE_TEMPLATES: Record<MindType, Record<Difficulty, MazeConfig[]>> = {
  scholar: {
    easy: [
      {
        id: 'scholar_easy_1',
        name: 'The Reading Room',
        difficulty: 'easy',
        mind: 'scholar',
        layout: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
          [1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1],
          [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
      },
      {
        id: 'scholar_easy_2',
        name: 'The Study Hall',
        difficulty: 'easy',
        mind: 'scholar',
        layout: generateMaze(15, 0.6)
      }
    ],
    medium: [
      {
        id: 'scholar_medium_1',
        name: 'The Archive Maze',
        difficulty: 'medium',
        mind: 'scholar',
        layout: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1],
          [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1],
          [1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
          [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1],
          [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
      },
      {
        id: 'scholar_medium_2',
        name: 'The Knowledge Labyrinth',
        difficulty: 'medium',
        mind: 'scholar',
        layout: generateMaze(25, 0.4)
      }
    ],
    hard: [
      {
        id: 'scholar_hard_1',
        name: 'The Forbidden Section',
        difficulty: 'hard',
        mind: 'scholar',
        layout: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1],
          [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
          [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
          [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
          [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
      },
      {
        id: 'scholar_hard_2',
        name: 'The Master\'s Vault',
        difficulty: 'hard',
        mind: 'scholar',
        layout: generateMaze(35, 0.3)
      }
    ]
  },
  artist: {
    easy: [
      {
        id: 'artist_easy_1',
        name: 'The Paint Studio',
        difficulty: 'easy',
        mind: 'artist',
        layout: generateMaze(12, 0.7)
      },
      {
        id: 'artist_easy_2', 
        name: 'The Canvas Room',
        difficulty: 'easy',
        mind: 'artist',
        layout: generateMaze(14, 0.65)
      }
    ],
    medium: [
      {
        id: 'artist_medium_1',
        name: 'The Gallery Maze',
        difficulty: 'medium',
        mind: 'artist',
        layout: generateMaze(22, 0.45)
      },
      {
        id: 'artist_medium_2',
        name: 'The Sculpture Garden',
        difficulty: 'medium', 
        mind: 'artist',
        layout: generateMaze(26, 0.4)
      }
    ],
    hard: [
      {
        id: 'artist_hard_1',
        name: 'The Creative Chaos',
        difficulty: 'hard',
        mind: 'artist',
        layout: generateMaze(32, 0.35)
      },
      {
        id: 'artist_hard_2',
        name: 'The Masterpiece Vault',
        difficulty: 'hard',
        mind: 'artist',
        layout: generateMaze(38, 0.25)
      }
    ]
  },
  detective: {
    easy: [
      {
        id: 'detective_easy_1',
        name: 'The Case Files',
        difficulty: 'easy',
        mind: 'detective',
        layout: generateMaze(13, 0.68)
      },
      {
        id: 'detective_easy_2',
        name: 'The Evidence Room',
        difficulty: 'easy',
        mind: 'detective', 
        layout: generateMaze(15, 0.62)
      }
    ],
    medium: [
      {
        id: 'detective_medium_1',
        name: 'The Investigation Hub',
        difficulty: 'medium',
        mind: 'detective',
        layout: generateMaze(24, 0.42)
      },
      {
        id: 'detective_medium_2',
        name: 'The Crime Scene',
        difficulty: 'medium',
        mind: 'detective',
        layout: generateMaze(27, 0.38)
      }
    ],
    hard: [
      {
        id: 'detective_hard_1', 
        name: 'The Cold Case Vault',
        difficulty: 'hard',
        mind: 'detective',
        layout: generateMaze(34, 0.32)
      },
      {
        id: 'detective_hard_2',
        name: 'The Sherlock\'s Mind',
        difficulty: 'hard',
        mind: 'detective',
        layout: generateMaze(40, 0.28)
      }
    ]
  }
};

export function getMazes(mind: MindType, difficulty: Difficulty): MazeConfig[] {
  return MAZE_TEMPLATES[mind][difficulty];
}

export function getMaze(mazeId: string): MazeConfig | null {
  for (const mind of Object.values(MAZE_TEMPLATES)) {
    for (const difficulty of Object.values(mind)) {
      const maze = difficulty.find(m => m.id === mazeId);
      if (maze) return maze;
    }
  }
  return null;
}
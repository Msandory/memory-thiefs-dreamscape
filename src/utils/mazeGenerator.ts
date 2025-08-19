import { Difficulty, MindType, TILE_SIZE, MAP_COLS, MAP_ROWS } from '../config/gameConfig';
import brickWallTexture from '@/assets/sprites/brickWallTexture.avif';
import stoneWallTexture from '@/assets/Texture/stoneWallTexture.jpg';
import metalWallTexture from '@/assets/Texture/marbleWallTexture.jpg';
import glassWallTexture from '@/assets/sprites/glassWallTexture.avif';
import woodWallTexture from '@/assets/sprites/woodWallTexture.avif';
import marbleWallTexture from '@/assets/sprites/marbleWallTexture.avif';

export interface MazeConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  mind: MindType;
  layout: number[][];
  texturePath: string; // Added texturePath
}

// Helper function to check if all path cells (0s) are connected
function isMazeConnected(maze: number[][]): boolean {
  let totalPaths = 0;
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (maze[r][c] === 0) totalPaths++;
    }
  }

  if (totalPaths === 0) return true;

  // Find starting point
  let startR = -1, startC = -1;
  outer: for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (maze[r][c] === 0) {
        startR = r;
        startC = c;
        break outer;
      }
    }
  }

  if (startR === -1) return false;

  // Flood fill using BFS
  const visited = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(false));
  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;
  let reached = 1;

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length) {
    const [cr, cc] = queue.shift()!;
    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && maze[nr][nc] === 0 && !visited[nr][nc]) {
        visited[nr][nc] = true;
        reached++;
        queue.push([nr, nc]);
      }
    }
  }

  return reached === totalPaths;
}

// Maze generation algorithm using a modified Prim's algorithm
// Improved maze generation algorithm with better path connectivity
function generateMaze(complexity: number, density: number): number[][] {
  // Initialize maze with walls
  const maze: number[][] = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(1));
  
  // Ensure border walls
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        maze[r][c] = 1;
      }
    }
  }

  // Create main corridors first for better connectivity
  createMainCorridors(maze);
  
  // Then use Prim's algorithm for organic branching
  generateOrganicPaths(maze, complexity, density);
  
  // Ensure minimum path width of 1 tile for easier navigation
  ensureMinimumPathWidth(maze);
  
  // Final connectivity check and fix
  ensureFullConnectivity(maze);
  
  return maze;
}

function createMainCorridors(maze: number[][]) {
  const midRow = Math.floor(MAP_ROWS / 2);
  const midCol = Math.floor(MAP_COLS / 2);
  
  // Create main horizontal corridor (with some breaks for interest)
  for (let c = 2; c < MAP_COLS - 2; c++) {
    if (Math.random() > 0.2) { // 80% chance of being open
      maze[midRow][c] = 0;
    }
  }
  
  // Create main vertical corridor
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    if (Math.random() > 0.2) { // 80% chance of being open
      maze[r][midCol] = 0;
    }
  }
  
  // Connect the corridors at intersection
  maze[midRow][midCol] = 0;
  
  // Add diagonal corridors for more variety
  for (let i = 2; i < Math.min(MAP_ROWS, MAP_COLS) - 2; i++) {
    if (Math.random() > 0.7) { // 30% chance of diagonal paths
      if (i < MAP_ROWS - 2 && i < MAP_COLS - 2) {
        maze[i][i] = 0;
        maze[MAP_ROWS - 1 - i][i] = 0;
      }
    }
  }
}

function generateOrganicPaths(maze: number[][], complexity: number, density: number) {
  const visited = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(false));
  const walls: [number, number, number, number][] = []; // [row, col, fromRow, fromCol]
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Start from multiple points for better distribution
  const startPoints = [
    [1, 1], [1, MAP_COLS - 2], [MAP_ROWS - 2, 1], [MAP_ROWS - 2, MAP_COLS - 2],
    [Math.floor(MAP_ROWS / 2), Math.floor(MAP_COLS / 2)]
  ];

  for (const [startR, startC] of startPoints) {
    if (maze[startR][startC] === 0 && !visited[startR][startC]) {
      visited[startR][startC] = true;
      
      for (const [dr, dc] of dirs) {
        const nr = startR + dr;
        const nc = startC + dc;
        if (nr > 0 && nr < MAP_ROWS - 1 && nc > 0 && nc < MAP_COLS - 1 && maze[nr][nc] === 1) {
          walls.push([nr, nc, startR, startC]);
        }
      }
    }
  }

  // Modified Prim's algorithm with better path selection
  while (walls.length > 0) {
    const wallIndex = Math.floor(Math.random() * walls.length);
    const [wallR, wallC, fromR, fromC] = walls[wallIndex];
    walls.splice(wallIndex, 1);

    if (visited[wallR][wallC]) continue;

    // Check if this wall connects exactly two paths
    let adjacentPaths = 0;
    for (const [dr, dc] of dirs) {
      const nr = wallR + dr;
      const nc = wallC + dc;
      if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && maze[nr][nc] === 0) {
        adjacentPaths++;
      }
    }

    // Only convert to path if it connects appropriately
    if (adjacentPaths === 1) {
      maze[wallR][wallC] = 0;
      visited[wallR][wallC] = true;

      // Add new walls with preference for continuing in same direction
      for (const [dr, dc] of dirs) {
        const nr = wallR + dr;
        const nc = wallC + dc;
        if (nr > 0 && nr < MAP_ROWS - 1 && nc > 0 && nc < MAP_COLS - 1 && 
            maze[nr][nc] === 1 && !visited[nr][nc]) {
          
          // Prefer straight paths for better navigation
          const isStraight = (nr === fromR + (wallR - fromR) && nc === fromC + (wallC - fromC));
          if (isStraight || Math.random() > 0.3) { // 70% chance to add straight paths
            walls.push([nr, nc, wallR, wallC]);
          }
        }
      }
    }
  }

  // Add additional complexity paths with controlled density
  for (let i = 0; i < complexity; i++) {
    if (Math.random() < density) {
      const row = Math.floor(Math.random() * (MAP_ROWS - 4)) + 2;
      const col = Math.floor(Math.random() * (MAP_COLS - 4)) + 2;
      
      // Only convert if it improves connectivity
      if (maze[row][col] === 1) {
        let pathNeighbors = 0;
        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (maze[nr][nc] === 0) pathNeighbors++;
        }
        
        // Only convert if it connects to exactly 1 or 2 paths (avoid dead ends and intersections)
        if (pathNeighbors >= 1 && pathNeighbors <= 2) {
          maze[row][col] = 0;
        }
      }
    }
  }
}

function ensureMinimumPathWidth(maze: number[][]) {
  // Ensure no single-tile choke points by checking 2x2 areas
  for (let r = 1; r < MAP_ROWS - 2; r++) {
    for (let c = 1; c < MAP_COLS - 2; c++) {
      // If we find a pattern that creates a choke point, open it up
      if (maze[r][c] === 1 && maze[r][c + 1] === 0 && maze[r + 1][c] === 0 && maze[r + 1][c + 1] === 1) {
        // Randomly choose which corner to open
        if (Math.random() > 0.5) {
          maze[r][c] = 0;
        } else {
          maze[r + 1][c + 1] = 0;
        }
      }
    }
  }
}

function ensureFullConnectivity(maze: number[][]) {
  if (isMazeConnected(maze)) return;

  // Find all disconnected regions and connect them
  const regions: number[][][] = [];
  const visited = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(false));
  
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      if (maze[r][c] === 0 && !visited[r][c]) {
        const region: number[][] = [];
        const queue: [number, number][] = [[r, c]];
        visited[r][c] = true;
        region.push([r, c]);

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 1 && nr < MAP_ROWS - 1 && nc >= 1 && nc < MAP_COLS - 1 && 
                maze[nr][nc] === 0 && !visited[nr][nc]) {
              visited[nr][nc] = true;
              region.push([nr, nc]);
              queue.push([nr, nc]);
            }
          }
        }
        regions.push(region);
      }
    }
  }

  // Connect regions by creating paths between them
  for (let i = 0; i < regions.length - 1; i++) {
    const region1 = regions[i];
    const region2 = regions[i + 1];
    
    // Find closest points between regions
    let minDistance = Infinity;
    let point1: number[] = [];
    let point2: number[] = [];
    
    for (const [r1, c1] of region1) {
      for (const [r2, c2] of region2) {
        const distance = Math.abs(r1 - r2) + Math.abs(c1 - c2);
        if (distance < minDistance) {
          minDistance = distance;
          point1 = [r1, c1];
          point2 = [r2, c2];
        }
      }
    }
    
    // Create a path between the closest points
    createPathBetweenPoints(maze, point1[0], point1[1], point2[0], point2[1]);
  }
}

function createPathBetweenPoints(maze: number[][], r1: number, c1: number, r2: number, c2: number) {
  let currentR = r1;
  let currentC = c1;
  
  while (currentR !== r2 || currentC !== c2) {
    maze[currentR][currentC] = 0;
    
    if (currentR < r2) currentR++;
    else if (currentR > r2) currentR--;
    
    if (currentC < c2) currentC++;
    else if (currentC > c2) currentC--;
  }
  
  maze[r2][c2] = 0;
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
        ],
        texturePath: brickWallTexture,
      },
      {
        id: 'scholar_easy_2',
        name: 'The Study Hall',
        difficulty: 'easy',
        mind: 'scholar',
        layout: generateMaze(15, 0.6),
        texturePath: brickWallTexture,
      },
    ],
    medium: [
      {
        id: 'scholar_medium_1',
        name: 'The Archive Maze',
        difficulty: 'medium',
        mind: 'scholar',
        layout: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
          [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        texturePath: brickWallTexture,
      },
      {
        id: 'scholar_medium_2',
        name: 'The Knowledge Labyrinth',
        difficulty: 'medium',
        mind: 'scholar',
        layout: generateMaze(20, 0.35), // Reduced complexity for better navigation
        texturePath: brickWallTexture,
      },
    ],
    hard: [
      {
        id: 'scholar_hard_1',
        name: 'The Forbidden Section',
        difficulty: 'hard',
        mind: 'scholar',
        layout: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
          [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
          [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
          [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
          [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        texturePath: brickWallTexture,
      },
      {
        id: 'scholar_hard_2',
        name: "The Master's Vault",
        difficulty: 'hard',
        mind: 'scholar',
        layout: generateMaze(25, 0.25), // Reduced complexity for better navigation
        texturePath: brickWallTexture,
      },
    ],
  },
  artist: {
    easy: [
      {
        id: 'artist_easy_1',
        name: 'The Paint Studio',
        difficulty: 'easy',
        mind: 'artist',
        layout: generateMaze(12, 0.7),
        texturePath: stoneWallTexture,
      },
      {
        id: 'artist_easy_2',
        name: 'The Canvas Room',
        difficulty: 'easy',
        mind: 'artist',
        layout: generateMaze(14, 0.65),
        texturePath: stoneWallTexture,
      },
    ],
    medium: [
      {
        id: 'artist_medium_1',
        name: 'The Gallery Maze',
        difficulty: 'medium',
        mind: 'artist',
        layout: generateMaze(22, 0.45),
        texturePath: stoneWallTexture,
      },
      {
        id: 'artist_medium_2',
        name: 'The Sculpture Garden',
        difficulty: 'medium',
        mind: 'artist',
        layout: generateMaze(26, 0.4),
        texturePath: stoneWallTexture,
      },
    ],
    hard: [
      {
        id: 'artist_hard_1',
        name: 'The Creative Chaos',
        difficulty: 'hard',
        mind: 'artist',
        layout: generateMaze(32, 0.35),
        texturePath: stoneWallTexture,
      },
      {
        id: 'artist_hard_2',
        name: 'The Masterpiece Vault',
        difficulty: 'hard',
        mind: 'artist',
        layout: generateMaze(38, 0.25),
        texturePath: stoneWallTexture,
      },
    ],
  },
  detective: {
    easy: [
      {
        id: 'detective_easy_1',
        name: 'The Case Files',
        difficulty: 'easy',
        mind: 'detective',
        layout: generateMaze(13, 0.68),
        texturePath: metalWallTexture,
      },
      {
        id: 'detective_easy_2',
        name: 'The Evidence Room',
        difficulty: 'easy',
        mind: 'detective',
        layout: generateMaze(15, 0.62),
        texturePath: metalWallTexture,
      },
    ],
    medium: [
      {
        id: 'detective_medium_1',
        name: 'The Investigation Hub',
        difficulty: 'medium',
        mind: 'detective',
        layout: generateMaze(24, 0.42),
        texturePath: metalWallTexture,
      },
      {
        id: 'detective_medium_2',
        name: 'The Crime Scene',
        difficulty: 'medium',
        mind: 'detective',
        layout: generateMaze(27, 0.38),
        texturePath: metalWallTexture,
      },
    ],
    hard: [
      {
        id: 'detective_hard_1',
        name: 'The Cold Case Vault',
        difficulty: 'hard',
        mind: 'detective',
        layout: generateMaze(34, 0.32),
        texturePath: metalWallTexture,
      },
      {
        id: 'detective_hard_2',
        name: "The Sherlock's Mind",
        difficulty: 'hard',
        mind: 'detective',
        layout: generateMaze(40, 0.28),
        texturePath: metalWallTexture,
      },
    ],
  },
};


export function getMazes(mind: MindType, difficulty: Difficulty): MazeConfig[] {
  return MAZE_TEMPLATES[mind][difficulty] || [];
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

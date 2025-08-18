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
function generateMaze(complexity: number, density: number): number[][] {
  const maze: number[][] = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(1));
  const walls: [number, number][] = [];
  const visited = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(false));

  // Start with a single path cell
  const startR = 1;
  const startC = 1;
  maze[startR][startC] = 0;
  visited[startR][startC] = true;

  // Add neighboring walls to the list
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = startR + dr;
    const nc = startC + dc;
    if (nr > 0 && nr < MAP_ROWS - 1 && nc > 0 && nc < MAP_COLS - 1 && maze[nr][nc] === 1) {
      walls.push([nr, nc]);
    }
  }

  // Prim's algorithm to carve paths
  while (walls.length > 0) {
    // Pick a random wall
    const wallIndex = Math.floor(Math.random() * walls.length);
    const [wallR, wallC] = walls[wallIndex];
    walls.splice(wallIndex, 1);

    // Check if wall connects to exactly one path
    let pathCount = 0;
    let pathDir: [number, number] | null = null;
    for (const [dr, dc] of dirs) {
      const nr = wallR + dr;
      const nc = wallC + dc;
      if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && maze[nr][nc] === 0) {
        pathCount++;
        pathDir = [dr, dc];
      }
    }

    if (pathCount === 1 && pathDir) {
      // Make the wall a path
      maze[wallR][wallC] = 0;
      visited[wallR][wallC] = true;

      // Extend path to the next cell if possible
      const [dr, dc] = pathDir;
      const nextR = wallR - dr; // Opposite direction to find unvisited cell
      const nextC = wallC - dc;
      if (
        nextR > 0 &&
        nextR < MAP_ROWS - 1 &&
        nextC > 0 &&
        nextC < MAP_COLS - 1 &&
        maze[nextR][nextC] === 1 &&
        !visited[nextR][nextC]
      ) {
        maze[nextR][nextC] = 0;
        visited[nextR][nextC] = true;

        // Add new neighboring walls
        for (const [ndr, ndc] of dirs) {
          const nnr = nextR + ndr;
          const nnc = nextC + ndc;
          if (
            nnr > 0 &&
            nnr < MAP_ROWS - 1 &&
            nnc > 0 &&
            nnc < MAP_COLS - 1 &&
            maze[nnr][nnc] === 1 &&
            !walls.some(([wr, wc]) => wr === nnr && wc === nnc)
          ) {
            walls.push([nnr, nnc]);
          }
        }
      }

      // Add neighboring walls of the current wall
      for (const [ndr, ndc] of dirs) {
        const nnr = wallR + ndr;
        const nnc = wallC + ndc;
        if (
          nnr > 0 &&
          nnr < MAP_ROWS - 1 &&
          nnc > 0 &&
          nnc < MAP_COLS - 1 &&
          maze[nnr][nnc] === 1 &&
          !walls.some(([wr, wc]) => wr === nnr && wc === nnc)
        ) {
          walls.push([nnr, nnc]);
        }
      }
    }
  }

  // Add additional paths based on complexity and density
  for (let i = 0; i < complexity; i++) {
    if (Math.random() < density) {
      const row = Math.floor(Math.random() * (MAP_ROWS - 2)) + 1;
      const col = Math.floor(Math.random() * (MAP_COLS - 2)) + 1;
      if (maze[row][col] === 1) {
        maze[row][col] = 0;
        // Ensure connectivity by connecting to an adjacent path if possible
        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && maze[nr][nc] === 0) {
            break; // Already connected
          }
        }
      }
    }
  }

  // Verify connectivity - retry if not connected
  let attempts = 0;
  while (!isMazeConnected(maze) && attempts < 5) {
    console.log(`Maze not connected, attempt ${attempts + 1}`);
    // Add some connecting paths
    for (let i = 0; i < 10; i++) {
      const row = Math.floor(Math.random() * (MAP_ROWS - 2)) + 1;
      const col = Math.floor(Math.random() * (MAP_COLS - 2)) + 1;
      maze[row][col] = 0;
    }
    attempts++;
  }

  // If still not connected after attempts, create emergency connections
  if (!isMazeConnected(maze)) {
    console.warn("Creating emergency maze connections");
    // Create horizontal and vertical corridors to ensure connectivity
    const midRow = Math.floor(MAP_ROWS / 2);
    const midCol = Math.floor(MAP_COLS / 2);
    
    // Horizontal corridor
    for (let c = 1; c < MAP_COLS - 1; c++) {
      maze[midRow][c] = 0;
    }
    
    // Vertical corridor
    for (let r = 1; r < MAP_ROWS - 1; r++) {
      maze[r][midCol] = 0;
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
        ],
        texturePath: brickWallTexture,
      },
      {
        id: 'scholar_medium_2',
        name: 'The Knowledge Labyrinth',
        difficulty: 'medium',
        mind: 'scholar',
        layout: generateMaze(25, 0.4),
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
        ],
        texturePath: brickWallTexture,
      },
      {
        id: 'scholar_hard_2',
        name: "The Master's Vault",
        difficulty: 'hard',
        mind: 'scholar',
        layout: generateMaze(35, 0.3),
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
  // Add mystic mind to match gameConfig
 {/* mystic: {
    easy: [
      {
        id: 'mystic_easy_1',
        name: 'The Ethereal Shrine',
        difficulty: 'easy',
        mind: 'mystic',
        layout: generateMaze(12, 0.7),
        texturePath: glassWallTexture,
      },
      {
        id: 'mystic_easy_2',
        name: 'The Spirit Chamber',
        difficulty: 'easy',
        mind: 'mystic',
        layout: generateMaze(14, 0.65),
        texturePath: glassWallTexture,
      },
    ],
    medium: [
      {
        id: 'mystic_medium_1',
        name: 'The Astral Maze',
        difficulty: 'medium',
        mind: 'mystic',
        layout: generateMaze(22, 0.45),
        texturePath: glassWallTexture,
      },
      {
        id: 'mystic_medium_2',
        name: 'The Oracle’s Path',
        difficulty: 'medium',
        mind: 'mystic',
        layout: generateMaze(26, 0.4),
        texturePath: glassWallTexture,
      },
    ],
    hard: [
      {
        id: 'mystic_hard_1',
        name: 'The Celestial Vault',
        difficulty: 'hard',
        mind: 'mystic',
        layout: generateMaze(32, 0.35),
        texturePath: glassWallTexture,
      },
      {
        id: 'mystic_hard_2',
        name: 'The Eternal Sanctum',
        difficulty: 'hard',
        mind: 'mystic',
        layout: generateMaze(38, 0.25),
        texturePath: glassWallTexture,
      },
    ],
  },
};*/}

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

/**
 * =============================================================================
 * GAME LOGIC MODULE - Core Go Game Mechanics
 * =============================================================================
 *
 * This module contains all the core game logic for the Go game including:
 * - Game state management
 * - Move validation and execution
 * - Capture detection and removal
 * - Board analysis functions
 * - Game ending conditions
 *
 * Key Concepts in Go:
 * - Stones: Black and white pieces placed on board intersections
 * - Groups: Connected stones of the same color
 * - Liberties: Empty adjacent points to a group
 * - Capture: Remove opponent groups with no liberties
 * - Ko Rule: Prevents immediate recapture (not implemented in this version)
 * - Suicide Rule: Cannot place stone that kills own group unless it captures
 */

// =============================================================================
// GAME CONSTANTS AND STATE
// =============================================================================

/**
 * Board state constants representing different cell states
 */
const EMPTY = 0; // Empty intersection
const BLACK = 1; // Black stone
const WHITE = 2; // White stone

/**
 * Default board size - can be changed dynamically
 * Standard sizes: 9x9 (beginner), 13x13 (intermediate), 19x19 (professional)
 */
let BOARD_SIZE = 13;

/**
 * Main game state object containing all game information
 * This object is the single source of truth for the current game
 */
let game = {
  // 2D array representing the board state
  // board[row][col] contains EMPTY, BLACK, or WHITE
  board: [],

  // Current player turn (BLACK or WHITE)
  currentPlayer: BLACK,

  // Count of captured stones for each player
  // Higher captured count means more territory/points
  captured: {
    [BLACK]: 0, // Stones captured by black player
    [WHITE]: 0, // Stones captured by white player
  },

  // Counter for consecutive passes
  // Game ends when both players pass (consecutivePasses >= 2)
  consecutivePasses: 0,

  // Flag indicating if the game has ended
  gameOver: false,
};

// =============================================================================
// BOARD INITIALIZATION AND BASIC OPERATIONS
// =============================================================================

/**
 * Initialize an empty board with the current BOARD_SIZE
 * Creates a 2D array filled with EMPTY values
 *
 * @returns {Array} 2D array representing empty board
 */
function initializeBoard() {
  const board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[row][col] = EMPTY;
    }
  }
  return board;
}

/**
 * Reset the game to initial state
 * Clears the board and resets all game variables
 */
function resetGame() {
  // Initialize empty board
  game.board = initializeBoard();

  // Black always starts in Go
  game.currentPlayer = BLACK;

  // Reset capture counters
  game.captured = { [BLACK]: 0, [WHITE]: 0 };

  // Reset pass counter
  game.consecutivePasses = 0;

  // Game is active
  game.gameOver = false;

  // Suppress non-error console output
}

/**
 * Check if given coordinates are within board boundaries
 *
 * @param {number} row - Row coordinate (0-based)
 * @param {number} col - Column coordinate (0-based)
 * @returns {boolean} True if coordinates are valid
 */
function isValidPosition(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Create a deep copy of the board state
 * Useful for AI algorithms that need to test moves without affecting real game
 *
 * @param {Array} board - 2D board array to copy
 * @returns {Array} Deep copy of the board
 */
function copyBoard(board) {
  return board.map((row) => [...row]);
}

// =============================================================================
// NEIGHBOR AND GROUP ANALYSIS
// =============================================================================

/**
 * Get all orthogonal neighbors of a position (up, down, left, right)
 * In Go, only orthogonally adjacent stones are connected (not diagonal)
 *
 * @param {number} row - Row coordinate
 * @param {number} col - Column coordinate
 * @returns {Array} Array of [row, col] coordinate pairs for valid neighbors
 */
function getNeighbors(row, col) {
  const neighbors = [];

  // Check all four orthogonal directions
  const directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1], // Right
  ];

  for (const [deltaRow, deltaCol] of directions) {
    const newRow = row + deltaRow;
    const newCol = col + deltaCol;

    // Only include neighbors within board boundaries
    if (isValidPosition(newRow, newCol)) {
      neighbors.push([newRow, newCol]);
    }
  }

  return neighbors;
}

/**
 * Find all stones in the same group (connected component) as the given position
 * A group consists of stones of the same color that are connected orthogonally
 * Uses depth-first search to find all connected stones
 *
 * @param {Array} board - 2D board array
 * @param {number} row - Starting row position
 * @param {number} col - Starting column position
 * @returns {Array} Array of [row, col] positions for all stones in the group
 */
function getGroup(board, row, col) {
  const color = board[row][col];

  // Empty positions don't form groups
  if (color === EMPTY) return [];

  const visited = new Set(); // Track visited positions to avoid cycles
  const stack = [[row, col]]; // Stack for depth-first search
  const group = []; // Result array of group positions

  while (stack.length > 0) {
    const [currentRow, currentCol] = stack.pop();
    const positionKey = `${currentRow},${currentCol}`;

    // Skip if already visited
    if (visited.has(positionKey)) continue;

    // Mark as visited and add to group
    visited.add(positionKey);
    group.push([currentRow, currentCol]);

    // Check all neighbors for same-colored stones
    for (const [neighborRow, neighborCol] of getNeighbors(
      currentRow,
      currentCol
    )) {
      const neighborKey = `${neighborRow},${neighborCol}`;

      // Add unvisited same-color neighbors to search stack
      if (
        board[neighborRow][neighborCol] === color &&
        !visited.has(neighborKey)
      ) {
        stack.push([neighborRow, neighborCol]);
      }
    }
  }

  return group;
}

/**
 * Count the liberties (empty adjacent spaces) of a group
 * A group with zero liberties will be captured
 *
 * @param {Array} board - 2D board array
 * @param {Array} group - Array of [row, col] positions in the group
 * @returns {number} Number of liberties for the group
 */
function countLiberties(board, group) {
  const liberties = new Set(); // Use Set to avoid counting same liberty multiple times

  // Check all positions around each stone in the group
  for (const [row, col] of group) {
    for (const [neighborRow, neighborCol] of getNeighbors(row, col)) {
      // If neighbor is empty, it's a liberty
      if (board[neighborRow][neighborCol] === EMPTY) {
        liberties.add(`${neighborRow},${neighborCol}`);
      }
    }
  }

  return liberties.size;
}

// =============================================================================
// CAPTURE MECHANICS
// =============================================================================

/**
 * Remove all captured groups of the specified color from the board
 * A group is captured when it has zero liberties
 *
 * @param {Array} board - 2D board array (modified in place)
 * @param {number} opponentColor - Color of stones to check for capture
 * @returns {number} Total number of stones captured
 */
function removeCapturedGroups(board, opponentColor) {
  let capturedCount = 0;
  const visited = new Set(); // Track which stones we've already checked

  // Scan entire board for opponent stones
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const positionKey = `${row},${col}`;

      // Check unvisited opponent stones
      if (board[row][col] === opponentColor && !visited.has(positionKey)) {
        // Find the complete group this stone belongs to
        const group = getGroup(board, row, col);

        // Mark all stones in this group as visited
        for (const [groupRow, groupCol] of group) {
          visited.add(`${groupRow},${groupCol}`);
        }

        // Check if group has any liberties
        if (countLiberties(board, group) === 0) {
          // Group is captured - remove all stones
          for (const [capturedRow, capturedCol] of group) {
            board[capturedRow][capturedCol] = EMPTY;
            capturedCount++;
          }

          // Non-error logging suppressed
        }
      }
    }
  }

  return capturedCount;
}

// =============================================================================
// MOVE VALIDATION AND EXECUTION
// =============================================================================

/**
 * Check if a move is legal according to Go rules
 *
 * Rules checked:
 * 1. Position must be empty
 * 2. Move must not be suicide (placing stone that immediately dies)
 *    Exception: Suicide is allowed if it captures opponent stones
 *
 * Note: Ko rule (preventing immediate recapture) is not implemented
 *
 * @param {Array} board - Current board state
 * @param {number} row - Row to place stone
 * @param {number} col - Column to place stone
 * @param {number} player - Player color (BLACK or WHITE)
 * @returns {boolean} True if move is legal
 */
function isLegalMove(board, row, col, player) {
  // Basic validation: position must be empty
  if (board[row][col] !== EMPTY) {
    return false;
  }

  // Create test board to simulate the move
  const testBoard = copyBoard(board);
  testBoard[row][col] = player;

  // Remove any captured opponent groups
  const opponent = player === BLACK ? WHITE : BLACK;
  const capturedCount = removeCapturedGroups(testBoard, opponent);

  // Check suicide rule: placed stone's group must have liberties
  // unless the move captured opponent stones
  const playerGroup = getGroup(testBoard, row, col);
  const playerLiberties = countLiberties(testBoard, playerGroup);

  if (playerLiberties === 0 && capturedCount === 0) {
    // This would be suicide with no captures - illegal
    return false;
  }

  return true;
}

/**
 * Execute a move on the game board
 * This function handles the complete move sequence:
 * 1. Validate the move
 * 2. Place the stone
 * 3. Remove captured opponent groups
 * 4. Update game state
 * 5. Switch to next player
 *
 * @param {number} row - Row to place stone
 * @param {number} col - Column to place stone
 * @param {number} player - Player making the move
 * @returns {boolean} True if move was successful, false if illegal
 */
function makeMove(row, col, player) {
  // Validate move legality
  if (!isLegalMove(game.board, row, col, player)) {
    // Illegal move attempted; return false without logging
    return false;
  }

  // Place the stone
  game.board[row][col] = player;

  // Remove captured opponent groups and update capture count
  const opponent = player === BLACK ? WHITE : BLACK;
  const capturedCount = removeCapturedGroups(game.board, opponent);
  game.captured[player] += capturedCount;

  // Reset consecutive pass counter since a move was made
  game.consecutivePasses = 0;

  // Switch to next player
  game.currentPlayer = opponent;

  return true;
}

/**
 * Handle a pass move
 * In Go, players can pass their turn if they don't want to make a move
 * The game ends when both players pass consecutively
 */
function passMove() {
  // Non-error logging suppressed

  // Increment pass counter
  game.consecutivePasses++;

  // Switch to next player
  game.currentPlayer = game.currentPlayer === BLACK ? WHITE : BLACK;

  // Check for game end (two consecutive passes)
  if (game.consecutivePasses >= 2) {
    endGame();
    return;
  }
}

// =============================================================================
// GAME ENDING AND SCORING
// =============================================================================

/**
 * End the current game and calculate final scores
 *
 * Scoring method used here is simplified:
 * - Count stones on board for each player
 * - Add captured stones to score
 * - Player with higher total wins
 *
 * Note: This doesn't include territory scoring which is more complex
 * and requires analysis of surrounded empty areas
 */
function endGame() {
  game.gameOver = true;

  // Count stones remaining on board
  const blackStones = game.board.flat().filter((cell) => cell === BLACK).length;
  const whiteStones = game.board.flat().filter((cell) => cell === WHITE).length;

  // Calculate total scores (stones + captures)
  const blackScore = blackStones + game.captured[BLACK];
  const whiteScore = whiteStones + game.captured[WHITE];

  // Determine winner
  let winner, historyWinner;
  if (blackScore > whiteScore) {
    winner = "Black";
    historyWinner = "black";
  } else if (whiteScore > blackScore) {
    winner = "White";
    historyWinner = "white";
  } else {
    winner = "Tie";
    historyWinner = "draw";
  }

  // Non-error logging suppressed

  // Return game result for UI and history tracking
  return {
    blackScore,
    whiteScore,
    winner,
    historyWinner,
  };
}

// =============================================================================
// UTILITY FUNCTIONS FOR AI AND ANALYSIS
// =============================================================================

/**
 * Get all legal moves for a player on the current board
 * Used by AI algorithms to determine available moves
 *
 * @param {Array} board - Board state to analyze
 * @param {number} player - Player to get moves for
 * @returns {Array} Array of [row, col] coordinates for legal moves
 */
function getLegalMoves(board, player) {
  const moves = [];

  // Check every position on the board
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isLegalMove(board, row, col, player)) {
        moves.push([row, col]);
      }
    }
  }

  return moves;
}

/**
 * Calculate a simple position evaluation for AI purposes
 * This is a basic heuristic - more sophisticated evaluation
 * would consider patterns, territory, and strategic positions
 *
 * @param {Array} board - Board state to evaluate
 * @param {number} player - Player from whose perspective to evaluate
 * @returns {number} Evaluation score (positive = good for player)
 */
function evaluatePosition(board, player) {
  let score = 0;
  const opponent = player === BLACK ? WHITE : BLACK;

  // Count stones on board
  const playerStones = board.flat().filter((cell) => cell === player).length;
  const opponentStones = board
    .flat()
    .filter((cell) => cell === opponent).length;

  // Basic evaluation: more stones = better position
  score += (playerStones - opponentStones) * 10;

  // Add some positional bonuses for center and corner control
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === player) {
        // Center positions are generally more valuable
        const centerDistance =
          Math.abs(row - BOARD_SIZE / 2) + Math.abs(col - BOARD_SIZE / 2);
        score += Math.max(0, BOARD_SIZE / 2 - centerDistance);

        // Corner positions can also be valuable
        if (
          (row === 0 || row === BOARD_SIZE - 1) &&
          (col === 0 || col === BOARD_SIZE - 1)
        ) {
          score += 5;
        }
      }
    }
  }

  return score;
}

/**
 * Check if the game should end due to board state
 * (All legal moves exhausted, etc.)
 *
 * @returns {boolean} True if game should end
 */
function shouldGameEnd() {
  // Game ends if already marked as over
  if (game.gameOver) return true;

  // Game ends with two consecutive passes
  if (game.consecutivePasses >= 2) return true;

  // Could add other ending conditions here
  // (e.g., no legal moves for either player)

  return false;
}

// =============================================================================
// EXPORT FUNCTIONS FOR OTHER MODULES
// =============================================================================

// Export functions that other modules need to access
// This allows other files to use these functions while keeping
// internal implementation details private

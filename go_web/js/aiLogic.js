/**
 * =============================================================================
 * AI LOGIC MODULE - Minimax and Alpha-Beta Pruning Algorithms
 * =============================================================================
 *
 * This module implements AI decision-making algorithms for the Go game:
 * - Minimax Algorithm: Exhaustive search of game tree
 * - Alpha-Beta Pruning: Optimized minimax with branch pruning
 * - Move evaluation and position assessment
 * - Performance tracking and statistics
 * - Time budget per move and candidate move ordering
 *
 * Dependencies
 * ------------
 * - heuristics.js: evaluatePosition(), getCandidateMoves(), scoreMoveHeuristic()
 * - gameLogic.js: board representation and rules helpers
 *
 * Public API (globals)
 * --------------------
 * - setAIAlgorithm(name: 'minimax'|'alphabeta')
 * - setAIDepth(depth: number)
 * - setGameMode(mode: 'humanVsAi'|'humanVsHuman')
 * - shouldAIMove(): boolean
 * - makeAIMove(): Promise<{type:'move'|'pass', row?:number, col?:number, player:'Black'|'White'}>
 * - findBestMove(board, player): [row, col] | null
 * - getAIStats(): { nodesEvaluated, timeUsed, nodesPerSecond, actualDepth }
 *
 * Algorithm Overview:
 *
 * MINIMAX:
 * - Explores all possible moves to a given depth
 * - Assumes both players play optimally
 * - Maximizing player tries to maximize score
 * - Minimizing player tries to minimize score
 * - Time complexity: O(b^d) where b=branching factor, d=depth
 *
 * ALPHA-BETA PRUNING:
 * - Same logic as minimax but with early termination
 * - Maintains alpha (best maximizer score) and beta (best minimizer score)
 * - Prunes branches that can't improve the result
 * - Can reduce time complexity to O(b^(d/2)) in best case
 */

// =============================================================================
// AI CONFIGURATION AND SETTINGS
// =============================================================================

/**
 * AI configuration object containing algorithm settings.
 * Tunable via UI controls in index.html.
 * @typedef {Object} AISettings
 * @property {'minimax'|'alphabeta'} algorithm Search algorithm to use
 * @property {number} depth Search depth (plies)
 * @property {'humanVsAi'|'humanVsHuman'} gameMode Controls whether AI should move
 * @property {number} maxTimeMs Per-move time budget in ms; 0 disables
 * @property {number} maxCandidatesBase Base cap for root candidate trimming
 */
let aiSettings = {
  // Algorithm type: "minimax" or "alphabeta"
  algorithm: "alphabeta",

  // Search depth: how many moves ahead the AI looks
  // Higher depth = stronger play but exponentially slower
  depth: 2,

  // Game mode: determines when AI should move
  // "humanVsAi" - Human vs AI, "humanVsHuman" - Human vs Human
  gameMode: "humanVsAi",

  // Optional time budget per AI move (milliseconds). If 0, no time cap.
  maxTimeMs: 1200,

  // Base cap for candidate moves considered at top levels (reduced as depth increases)
  maxCandidatesBase: 16,
};

/**
 * Performance tracking for AI search.
 * @typedef {Object} AIStats
 * @property {number} nodesEvaluated Number of nodes visited last move
 * @property {number} timeUsed Milliseconds consumed by the last move
 * @property {number} nodesPerSecond Throughput for the last move
 * @property {number} actualDepth Depth used in last search
 */
let performanceStats = {
  // Total number of board positions evaluated
  nodesEvaluated: 0,

  // Time taken for last AI move (in milliseconds)
  timeUsed: 0,

  // Nodes evaluated per second (calculated)
  nodesPerSecond: 0,

  // Depth reached in last search
  actualDepth: 0,
};

/** Reset AI performance statistics so UI reflects current state. */
function resetAIStats() {
  performanceStats.nodesEvaluated = 0;
  performanceStats.timeUsed = 0;
  performanceStats.nodesPerSecond = 0;
  performanceStats.actualDepth = 0;
}

// =============================================================================
// CORE MINIMAX ALGORITHM
// =============================================================================

/**
 * Minimax algorithm (no pruning).
 *
 * @param {number[][]} board Current board state
 * @param {number} depth Remaining depth to search
 * @param {number} player Current player (BLACK or WHITE)
 * @param {boolean} isMaximizing True if node is maximizing for originalPlayer
 * @param {number} originalPlayer Root player this search scores for
 * @returns {[number, [number,number]|null]} [bestScore, bestMove]
 */
function minimax(board, depth, player, isMaximizing, originalPlayer) {
  // Increment node counter for performance tracking
  performanceStats.nodesEvaluated++;

  // BASE CASE: Stop recursion at maximum depth or if game is over
  if (depth === 0) {
    // Evaluate position from AI's perspective
    return [evaluatePosition(board, originalPlayer), null];
  }

  // Get all possible legal moves for current player
  const possibleMoves = getLegalMoves(board, player);

  // If no legal moves available, evaluate current position
  if (possibleMoves.length === 0) {
    return [evaluatePosition(board, originalPlayer), null];
  }

  // MAXIMIZING PLAYER: AI trying to maximize its score
  if (isMaximizing) {
    let maxScore = -Infinity; // Start with worst possible score
    let bestMove = null; // Track which move gives best score

    // Try each possible move
    for (const [row, col] of possibleMoves) {
      // Create copy of board to test this move
      const newBoard = copyBoard(board);
      newBoard[row][col] = player;

      // Remove any stones captured by this move
      const opponent = player === BLACK ? WHITE : BLACK;
      removeCapturedGroups(newBoard, opponent);

      // Recursively evaluate this move
      // Next level will be minimizing (opponent's turn)
      const [score] = minimax(
        newBoard,
        depth - 1,
        opponent,
        false,
        originalPlayer
      );

      // Keep track of best move found so far
      if (score > maxScore) {
        maxScore = score;
        bestMove = [row, col];
      }
    }

    return [maxScore, bestMove];
  }

  // MINIMIZING PLAYER: Opponent trying to minimize AI's score
  else {
    let minScore = Infinity; // Start with best possible score for AI
    let bestMove = null; // Track which move minimizes AI's advantage

    // Try each possible move
    for (const [row, col] of possibleMoves) {
      // Create copy of board to test this move
      const newBoard = copyBoard(board);
      newBoard[row][col] = player;

      // Remove any stones captured by this move
      const opponent = player === BLACK ? WHITE : BLACK;
      removeCapturedGroups(newBoard, opponent);

      // Recursively evaluate this move
      // Next level will be maximizing (AI's turn)
      const [score] = minimax(
        newBoard,
        depth - 1,
        opponent,
        true,
        originalPlayer
      );

      // Keep track of move that gives lowest score for AI
      if (score < minScore) {
        minScore = score;
        bestMove = [row, col];
      }
    }

    return [minScore, bestMove];
  }
}

// =============================================================================
// ALPHA-BETA PRUNING ALGORITHM
// =============================================================================

/**
 * Alpha–beta pruning minimax with optional deadline for time control.
 *
 * @param {number[][]} board Current board state
 * @param {number} depth Search depth remaining
 * @param {number} player Current player
 * @param {boolean} isMaximizing True if maximizing player's turn
 * @param {number} alpha Best score for maximizing player so far
 * @param {number} beta Best score for minimizing player so far
 * @param {number} originalPlayer Root player this search scores for
 * @param {number|null} deadline performance.now() cutoff; if exceeded, return static eval
 * @returns {[number, [number,number]|null]} [bestScore, bestMove]
 */
function minimaxAlphaBeta(
  board,
  depth,
  player,
  isMaximizing,
  alpha,
  beta,
  originalPlayer,
  deadline // number | null (performance.now() cutoff)
) {
  // Performance tracking
  performanceStats.nodesEvaluated++;

  // BASE CASE: Terminal depth or game over
  if (depth === 0) {
    return [evaluatePosition(board, originalPlayer), null];
  }

  // Time cutoff
  if (deadline && performance.now() > deadline) {
    // Return a static evaluation to unwind quickly
    return [evaluatePosition(board, originalPlayer), null];
  }

  // Get all legal moves for current player
  const possibleMoves = getCandidateMoves(board, player);

  // No moves available - evaluate current position
  if (possibleMoves.length === 0) {
    return [evaluatePosition(board, originalPlayer), null];
  }

  // MAXIMIZING PLAYER (AI's turn)
  if (isMaximizing) {
    let maxScore = -Infinity;
    let bestMove = null;

    for (const [row, col] of possibleMoves) {
      if (deadline && performance.now() > deadline) break;
      // Test this move
      const newBoard = copyBoard(board);
      newBoard[row][col] = player;

      const opponent = player === BLACK ? WHITE : BLACK;
      removeCapturedGroups(newBoard, opponent);

      // Recursive call for opponent's response
      const [score] = minimaxAlphaBeta(
        newBoard,
        depth - 1,
        opponent,
        false, // Next level is minimizing
        alpha, // Pass current alpha
        beta, // Pass current beta
        originalPlayer,
        deadline
      );

      // Update best score and move
      if (score > maxScore) {
        maxScore = score;
        bestMove = [row, col];
      }

      // Update alpha (best score for maximizer)
      alpha = Math.max(alpha, score);

      // ALPHA-BETA PRUNING: If alpha >= beta, prune remaining moves
      // This means the minimizer already has a better option elsewhere,
      // so they won't allow this branch to occur
      if (beta <= alpha) {
        break; // Beta cutoff - stop evaluating remaining moves
      }
    }

    return [maxScore, bestMove];
  }

  // MINIMIZING PLAYER (Opponent's turn)
  else {
    let minScore = Infinity;
    let bestMove = null;

    for (const [row, col] of possibleMoves) {
      if (deadline && performance.now() > deadline) break;
      // Test this move
      const newBoard = copyBoard(board);
      newBoard[row][col] = player;

      const opponent = player === BLACK ? WHITE : BLACK;
      removeCapturedGroups(newBoard, opponent);

      // Recursive call for AI's response
      const [score] = minimaxAlphaBeta(
        newBoard,
        depth - 1,
        opponent,
        true, // Next level is maximizing
        alpha, // Pass current alpha
        beta, // Pass current beta
        originalPlayer,
        deadline
      );

      // Update best score and move
      if (score < minScore) {
        minScore = score;
        bestMove = [row, col];
      }

      // Update beta (best score for minimizer)
      beta = Math.min(beta, score);

      // ALPHA-BETA PRUNING: If beta <= alpha, prune remaining moves
      // The maximizer already has a better option, so this branch won't occur
      if (beta <= alpha) {
        break; // Alpha cutoff - stop evaluating remaining moves
      }
    }

    return [minScore, bestMove];
  }
}

// =============================================================================
// MAIN AI DECISION FUNCTION
// =============================================================================

/**
 * Find the best move using the configured algorithm and time budget.
 *
 * @param {number[][]} board Current board state
 * @param {number} player AI player color (BLACK or WHITE)
 * @returns {[number,number]|null} Best move or null
 */
function findBestMove(board, player) {
  // Suppress non-error console output

  // Reset performance tracking
  performanceStats.nodesEvaluated = 0;
  performanceStats.actualDepth = aiSettings.depth;

  // Record start time for performance measurement
  const startTime = performance.now();
  const deadline =
    aiSettings.maxTimeMs && aiSettings.maxTimeMs > 0
      ? startTime + aiSettings.maxTimeMs
      : null;

  let bestMove = null;
  let bestScore = -Infinity;

  // Choose algorithm based on settings
  const rootMoves = getCandidateMoves(board, player, /*forRoot*/ true);
  for (const [row, col] of rootMoves) {
    // Time check before expanding a root child
    if (deadline && performance.now() > deadline) break;

    const newBoard = copyBoard(board);
    newBoard[row][col] = player;
    const opponent = player === BLACK ? WHITE : BLACK;
    removeCapturedGroups(newBoard, opponent);

    let score;
    if (aiSettings.algorithm === "minimax") {
      [score] = minimax(
        newBoard,
        aiSettings.depth - 1,
        opponent,
        false,
        player
      );
    } else {
      [score] = minimaxAlphaBeta(
        newBoard,
        aiSettings.depth - 1,
        opponent,
        false,
        -Infinity,
        Infinity,
        player,
        deadline
      );
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = [row, col];
    }
  }

  // Calculate performance statistics
  performanceStats.timeUsed = performance.now() - startTime;
  performanceStats.nodesPerSecond = Math.round(
    performanceStats.nodesEvaluated / (performanceStats.timeUsed / 1000)
  );

  // Log AI decision
  // No non-error logging; UI may display stats elsewhere

  // Fallback if timeout happened before any move evaluated
  if (!bestMove && rootMoves.length > 0) return rootMoves[0];
  return bestMove;
}

// =============================================================================
// POSITION EVALUATION HEURISTICS
// =============================================================================

// =============================================================================
// MOVE CANDIDATES AND ORDERING (PERFORMANCE)
// =============================================================================

/**
 * Generate and order promising candidate moves to reduce branching.
 * - Prefer moves near existing stones
 * - Prefer captures
 * - Prefer center/stronger influence positions
 * Optionally trims to a top-N set that depends on depth and board size.
 */
function getCandidateMoves(board, player, forRoot = false) {
  const legal = getLegalMoves(board, player);
  if (legal.length <= 1) return legal;

  // Heuristic score for move ordering
  const scored = legal.map(([r, c]) => {
    const h = scoreMoveHeuristic(board, r, c, player);
    return { move: [r, c], score: h };
  });

  // Sort desc by heuristic score
  scored.sort((a, b) => b.score - a.score);

  // Limit number of candidates, tighter caps for deeper searches
  const size = BOARD_SIZE;
  const base = aiSettings.maxCandidatesBase || 16;
  const depth = aiSettings.depth || 2;
  let cap = base - Math.max(0, depth - 2) * 3; // reduce 3 per extra depth
  if (size >= 19) cap += 2; // allow a couple more on 19x19
  cap = Math.max(6, Math.min(cap, base));

  const trimmed = forRoot
    ? scored.slice(0, cap)
    : scored.slice(0, Math.max(8, Math.floor(cap * 0.75)));
  return trimmed.map((s) => s.move);
}

function scoreMoveHeuristic(board, row, col, player) {
  // Simulate to measure captures and local strength
  const opponent = player === BLACK ? WHITE : BLACK;
  const b = copyBoard(board);
  b[row][col] = player;
  const captured = removeCapturedGroups(b, opponent); // number

  // Center/edge influence
  const centerDist =
    Math.abs(row - BOARD_SIZE / 2) + Math.abs(col - BOARD_SIZE / 2);
  const centerBonus = Math.max(0, BOARD_SIZE / 3 - centerDist / 2);

  // Neighbor density (more nearby stones is usually more relevant)
  const neighbors = getNeighbors(row, col);
  let friend = 0,
    foe = 0;
  for (const [nr, nc] of neighbors) {
    if (board[nr][nc] === player) friend++;
    else if (board[nr][nc] === opponent) foe++;
  }

  // Weighting: captures dominate ordering, then center/neighbor
  return captured * 100 + centerBonus * 2 + friend * 3 + foe;
}

/**
 * Find all groups of stones for a specific player
 * Used for advanced position evaluation
 *
 * @param {Array} board - Board to analyze
 * @param {number} player - Player color to find groups for
 * @returns {Array} Array of groups, where each group is array of [row,col] positions
 */
// evaluatePosition and findAllGroups are now provided by heuristics.js

// =============================================================================
// AI MOVE EXECUTION AND GAME MODE DETECTION
// =============================================================================

/**
 * Determine if the AI should make a move based on current game state.
 * @returns {boolean}
 */
function shouldAIMove() {
  // Don't move if game is over
  if (game.gameOver) return false;

  // Check game mode and current player
  switch (aiSettings.gameMode) {
    case "humanVsAi":
      // AI plays as White (second player)
      return game.currentPlayer === WHITE;
    case "humanVsHuman":
      // No AI moves in human vs human
      return false;
    default:
      return false;
  }
}

/**
 * Execute one AI move.
 * Finds the best move, applies it, or passes if none.
 * Returns a small summary object for UI.
 * @returns {Promise<{type:'move'|'pass', row?:number, col?:number, player:'Black'|'White'}>}
 */
async function makeAIMove() {
  if (game.gameOver) return;

  try {
    // Find the best move using AI algorithms
    const bestMove = findBestMove(game.board, game.currentPlayer);

    if (bestMove) {
      // Execute the move
      const [row, col] = bestMove;
      const success = makeMove(row, col, game.currentPlayer);

      if (!success) {
        console.error("AI attempted illegal move - passing instead");
        passMove();
        return {
          type: "pass",
          player: game.currentPlayer === BLACK ? "White" : "Black",
        };
      }
      // Return the move that was played (player is the AI who just played before the switch)
      const aiPlayer = game.currentPlayer === BLACK ? "White" : "Black";
      return { type: "move", row, col, player: aiPlayer };
    } else {
      // No good moves found - AI passes
      passMove();
      return {
        type: "pass",
        player: game.currentPlayer === BLACK ? "White" : "Black",
      };
    }
  } catch (error) {
    console.error("Error in AI move calculation:", error);
    // Fall back to passing if there's an error
    passMove();
    return {
      type: "pass",
      player: game.currentPlayer === BLACK ? "White" : "Black",
    };
  }
}

// =============================================================================
// AI SETTINGS AND CONFIGURATION
// =============================================================================

/**
 * Update AI algorithm setting.
 * @param {'minimax'|'alphabeta'} algorithm
 */
function setAIAlgorithm(algorithm) {
  if (algorithm === "minimax" || algorithm === "alphabeta") {
    aiSettings.algorithm = algorithm;
    // setting applied
    resetAIStats();
  } else {
    console.error(`Invalid algorithm: ${algorithm}`);
  }
}

/**
 * Update AI search depth.
 * @param {number} depth 1–6 recommended
 */
function setAIDepth(depth) {
  if (depth >= 1 && depth <= 6) {
    aiSettings.depth = depth;
    // setting applied
    resetAIStats();
  } else {
    console.error(`Invalid depth: ${depth}. Must be between 1 and 6.`);
  }
}

/**
 * Update game mode.
 * @param {'humanVsAi'|'humanVsHuman'} mode
 */
function setGameMode(mode) {
  const validModes = ["humanVsAi", "humanVsHuman"];
  if (validModes.includes(mode)) {
    aiSettings.gameMode = mode;
    // setting applied
    resetAIStats();
  } else {
    console.error(`Invalid game mode: ${mode}`);
  }
}

/**
 * Get current AI performance statistics.
 * @returns {AIStats}
 */
function getAIStats() {
  return { ...performanceStats }; // Return copy to prevent modification
}

// =============================================================================
// EXPORT FUNCTIONS FOR OTHER MODULES
// =============================================================================

// These functions will be available to other modules that import this file

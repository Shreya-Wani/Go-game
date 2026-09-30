/**
 * =============================================================================
 * HEURISTICS MODULE - Evaluation and Move Ordering
 * =============================================================================
 *
 * Purpose
 * -------
 * Centralizes AI heuristics used by the search in aiLogic.js:
 * 1) Position evaluation (evaluatePosition)
 * 2) Group discovery for evaluation (findAllGroups)
 * 3) Candidate move generation and ordering (getCandidateMoves)
 * 4) Per-move heuristic scoring for ordering (scoreMoveHeuristic)
 *
 * Design
 * ------
 * - This app loads scripts as non-module globals. Therefore, functions are
 *   attached to the global scope by simple function declarations.
 * - aiLogic.js depends on these functions and must be loaded AFTER this file.
 * - We use fast, explainable heuristics (stones, liberties, influence) rather than
 *   full territory scoring to keep the AI responsive in the browser.
 *
 * Quick mental model
 * ------------------
 * - evaluatePosition: Scores a board snapshot for a given player.
 * - findAllGroups: Helper to get connected components for liberty counting.
 * - getCandidateMoves: Orders legal moves so alpha–beta prunes more;
 *   also trims to top-N to reduce branching.
 * - scoreMoveHeuristic: Captures >> central influence >> local support.
 */

/**
 * Evaluate a board position for a given player.
 *
 * Heuristic factors (simple and fast):
 * - Stones: more own stones vs opponent (×10)
 * - Group safety: own groups with >=3 liberties are rewarded; groups in atari penalized
 * - Pressure: opponent groups in atari rewarded; safe opponent groups penalized
 * - Influence: central positions get small bonuses; corners/edges have fixed tweaks
 *
 * Note: This does NOT perform full territory scoring; it’s designed for speed and
 * alpha–beta compatibility. It correlates reasonably with short-term tactics.
 *
 * @param {number[][]} board 2D array of EMPTY/BLACK/WHITE
 * @param {number} player BLACK or WHITE
 * @returns {number} positive = good for player
 */
function evaluatePosition(board, player) {
  let score = 0;
  const opponent = player === BLACK ? WHITE : BLACK;

  // Stone balance
  const playerStones = board.flat().filter((c) => c === player).length;
  const oppStones = board.flat().filter((c) => c === opponent).length;
  score += (playerStones - oppStones) * 10;

  // Group safety/pressure via liberties
  const playerGroups = findAllGroups(board, player);
  const opponentGroups = findAllGroups(board, opponent);

  for (const g of playerGroups) {
    const libs = countLiberties(board, g);
    if (libs === 1) score -= g.length * 5; // in atari
    else if (libs >= 3) score += g.length * 2; // safe
  }
  for (const g of opponentGroups) {
    const libs = countLiberties(board, g);
    if (libs === 1) score += g.length * 5; // opponent in atari
    else if (libs >= 3) score -= g.length * 2; // safe opponent
  }

  // Positional influence: center/edges/corners
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        const cd = Math.abs(r - BOARD_SIZE / 2) + Math.abs(c - BOARD_SIZE / 2);
        const centerBonus = Math.max(0, BOARD_SIZE / 3 - cd / 2);
        score += centerBonus;

        const ed = Math.min(r, c, BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c);
        if (ed === 0) score += 3; // edge
        if (
          (r === 0 || r === BOARD_SIZE - 1) &&
          (c === 0 || c === BOARD_SIZE - 1)
        )
          score += 5; // corner
      } else if (board[r][c] === opponent) {
        const cd = Math.abs(r - BOARD_SIZE / 2) + Math.abs(c - BOARD_SIZE / 2);
        const centerBonus = Math.max(0, BOARD_SIZE / 3 - cd / 2);
        score -= centerBonus;

        const ed = Math.min(r, c, BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c);
        if (ed === 0) score -= 3;
        if (
          (r === 0 || r === BOARD_SIZE - 1) &&
          (c === 0 || c === BOARD_SIZE - 1)
        )
          score -= 5;
      }
    }
  }

  return score;
}

/**
 * Find all connected groups (orthogonal connectivity) for a player.
 *
 * @param {number[][]} board
 * @param {number} player
 * @returns {Array<Array<[number,number]>>} list of groups, each a list of [row,col]
 */
function findAllGroups(board, player) {
  const groups = [];
  const visited = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = `${r},${c}`;
      if (board[r][c] === player && !visited.has(key)) {
        const g = getGroup(board, r, c);
        groups.push(g);
        for (const [gr, gc] of g) visited.add(`${gr},${gc}`);
      }
    }
  }
  return groups;
}

/**
 * Return ordered, trimmed candidate moves to reduce branching.
 *
 * Strategy:
 * - Score each legal move with scoreMoveHeuristic
 * - Sort descending by score (best first)
 * - Trim to a cap that depends on board size and current AI depth (from aiSettings)
 *
 * @param {number[][]} board
 * @param {number} player
 * @param {boolean} [forRoot=false] true to use the larger cap for root level
 * @returns {Array<[number,number]>} ordered candidate coordinates
 */
function getCandidateMoves(board, player, forRoot = false) {
  const legal = getLegalMoves(board, player);
  if (legal.length <= 1) return legal;

  const scored = legal.map(([r, c]) => ({
    move: [r, c],
    score: scoreMoveHeuristic(board, r, c, player),
  }));
  scored.sort((a, b) => b.score - a.score);

  const size = BOARD_SIZE;
  const base = (window.aiSettings && window.aiSettings.maxCandidatesBase) || 16;
  const depth = (window.aiSettings && window.aiSettings.depth) || 2;
  let cap = base - Math.max(0, depth - 2) * 3;
  if (size >= 19) cap += 2;
  cap = Math.max(6, Math.min(cap, base));

  const trimmed = forRoot
    ? scored.slice(0, cap)
    : scored.slice(0, Math.max(8, Math.floor(cap * 0.75)));
  return trimmed.map((s) => s.move);
}

/**
 * Score a candidate move for ordering.
 *
 * Components:
 * - Captures (dominant): simulate the move and count captured opponent stones
 * - Central influence: manhattan distance to center (smaller is better)
 * - Local support: number of friendly/foe neighbors around the move
 *
 * @param {number[][]} board
 * @param {number} row
 * @param {number} col
 * @param {number} player
 * @returns {number} higher score = order earlier
 */
function scoreMoveHeuristic(board, row, col, player) {
  const opponent = player === BLACK ? WHITE : BLACK;
  const b = copyBoard(board);
  b[row][col] = player;
  const captured = removeCapturedGroups(b, opponent);

  const cd = Math.abs(row - BOARD_SIZE / 2) + Math.abs(col - BOARD_SIZE / 2);
  const centerBonus = Math.max(0, BOARD_SIZE / 3 - cd / 2);

  const neighbors = getNeighbors(row, col);
  let friend = 0,
    foe = 0;
  for (const [nr, nc] of neighbors) {
    if (board[nr][nc] === player) friend++;
    else if (board[nr][nc] === opponent) foe++;
  }

  return captured * 100 + centerBonus * 2 + friend * 3 + foe;
}

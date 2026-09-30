/**
 * =============================================================================
 * GAME HISTORY MODULE - Statistics and Historical Data Management
 * =============================================================================
 *
 * This module manages game history, statistics, and persistent data storage:
 * - Game result tracking and statistics
 * - Local storage management for persistent data
 * - Performance analytics and trends
 * - Session management and recovery
 * - Historical game data analysis
 *
 * Features:
 * - Tracks wins/losses for different game modes
 * - Maintains AI performance statistics
 * - Saves interrupted games for recovery
 * - Provides detailed analytics and insights
 * - Handles data migration and versioning
 */

// =============================================================================
// HISTORY DATA STRUCTURE AND CONSTANTS
// =============================================================================

/**
 * Current version of the history data format
 * Used for data migration when format changes
 */
const HISTORY_DATA_VERSION = "1.2.0";

/**
 * Keys for localStorage persistence
 */
const STORAGE_KEYS = {
  GAME_HISTORY: "goGameHistory",
  INTERRUPTED_GAME: "goGameInterrupted",
  USER_PREFERENCES: "goGamePreferences",
  AI_ANALYTICS: "goGameAIAnalytics",
};

/**
 * Main game history object containing all statistical data
 * This is the central data structure for tracking game progress
 */
let gameHistory = {
  // Metadata
  version: HISTORY_DATA_VERSION,
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),

  // Overall statistics
  totalGames: 0,
  totalPlayTime: 0, // in milliseconds

  // Human vs AI mode statistics
  humanVsAi: {
    total: 0, // Total games played
    humanWins: 0, // Human victories
    aiWins: 0, // AI victories
    draws: 0, // Tied games
    averageGameLength: 0, // Average moves per game
    humanWinRate: 0, // Calculated win percentage

    // AI performance breakdown by algorithm
    algorithmStats: {
      minimax: {
        gamesPlayed: 0,
        humanWins: 0,
        aiWins: 0,
        draws: 0,
        avgNodesEvaluated: 0,
        avgTimePerMove: 0,
      },
      alphabeta: {
        gamesPlayed: 0,
        humanWins: 0,
        aiWins: 0,
        draws: 0,
        avgNodesEvaluated: 0,
        avgTimePerMove: 0,
      },
    },

    // Performance by difficulty (depth)
    difficultyStats: {
      1: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
      2: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
      3: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
      4: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
    },
  },

  // Human vs Human mode statistics
  humanVsHuman: {
    total: 0,
    blackWins: 0,
    whiteWins: 0,
    draws: 0,
    averageGameLength: 0,
  },

  // Session tracking
  currentSession: {
    startTime: null,
    gamesPlayed: 0,
    lastActivity: null,
  },

  // Most recent game information
  lastGameResult: null,

  // Game settings preferences
  preferences: {
    defaultBoardSize: 13,
    defaultAIAlgorithm: "alphabeta",
    defaultAIDepth: 2,
    preferredGameMode: "humanVsAi",
  },

  // Achievement tracking
  achievements: {
    firstWin: null, // Date of first victory
    winStreak: 0, // Current win streak
    maxWinStreak: 0, // Longest win streak
    gamesWithoutLoss: 0, // Current no-loss streak
    totalCapturedStones: 0, // Lifetime captured stones
    perfectGames: 0, // Games won without losing stones
  },

  // Detailed game records (limited to last N games)
  recentGames: [], // Array of game objects with full details
};

/**
 * AI performance analytics for detailed analysis
 */
let aiAnalytics = {
  // Performance trends over time
  performanceTrends: {
    nodesPerSecond: [], // Array of {timestamp, value} objects
    timePerMove: [], // Array of {timestamp, value} objects
    searchDepthEfficiency: [], // Nodes evaluated per depth level
  },

  // Algorithm comparison data
  algorithmComparison: {
    speedComparison: {}, // Relative speed metrics
    accuracyComparison: {}, // Win rate comparisons
    nodeEfficiency: {}, // Nodes per good move ratio
  },

  // Common move patterns and preferences
  movePatterns: {
    openingMoves: {}, // Frequency of opening moves
    responsePatterns: {}, // Common responses to human moves
    endgameBehavior: {}, // End game tendencies
  },
};

// =============================================================================
// INITIALIZATION AND DATA LOADING
// =============================================================================

/**
 * Initialize the game history system
 * Loads existing data from localStorage and sets up tracking
 *
 * @returns {boolean} True if initialization successful
 */
function initializeGameHistory() {
  Logger.info("Initializing game history system...");

  try {
    // Load existing game history
    loadGameHistory();

    // Load AI analytics
    loadAIAnalytics();

    // Start new session
    startNewSession();

    // Clean up old data if necessary
    performDataMaintenance();

    Logger.info("Game history system initialized successfully");
    return true;
  } catch (error) {
    Logger.error("Failed to initialize game history:", error);
    return false;
  }
}

/**
 * Load game history from localStorage with migration support
 * Handles data format upgrades and validation
 */
function loadGameHistory() {
  const savedData = loadFromLocalStorage(STORAGE_KEYS.GAME_HISTORY, null);

  if (!savedData) {
    Logger.info("No existing game history found, using defaults");
    return;
  }

  try {
    // Check data version and migrate if necessary
    if (!savedData.version || savedData.version !== HISTORY_DATA_VERSION) {
      Logger.info(
        `Migrating game history from version ${
          savedData.version || "unknown"
        } to ${HISTORY_DATA_VERSION}`
      );
      const migratedData = migrateHistoryData(savedData);
      gameHistory = { ...gameHistory, ...migratedData };
    } else {
      // Merge loaded data with defaults to handle new fields
      gameHistory = deepMergeObjects(gameHistory, savedData);
    }

    // Validate and fix any inconsistencies
    validateAndFixHistoryData();

    Logger.info(`Loaded game history: ${gameHistory.totalGames} total games`);
  } catch (error) {
    Logger.error("Error loading game history:", error);
    Logger.warn("Using default game history");
  }
}

/**
 * Migrate older data formats to current version
 *
 * @param {Object} oldData - Old format data
 * @returns {Object} Migrated data
 */
function migrateHistoryData(oldData) {
  let migratedData = deepCopy(oldData);

  // Add version if missing
  if (!migratedData.version) {
    migratedData.version = "1.0.0";
  }

  // Migration from 1.0.0 to 1.1.0
  if (migratedData.version === "1.0.0") {
    migratedData.achievements = gameHistory.achievements;
    migratedData.preferences = gameHistory.preferences;
    migratedData.version = "1.1.0";
    Logger.info(
      "Migrated to version 1.1.0: Added achievements and preferences"
    );
  }

  // Migration from 1.1.0 to 1.2.0
  if (migratedData.version === "1.1.0") {
    migratedData.currentSession = gameHistory.currentSession;
    migratedData.recentGames = [];
    migratedData.version = "1.2.0";
    Logger.info(
      "Migrated to version 1.2.0: Added session tracking and detailed game records"
    );
  }

  // Update timestamps
  migratedData.lastUpdated = new Date().toISOString();

  return migratedData;
}

/**
 * Validate and fix inconsistencies in history data
 */
function validateAndFixHistoryData() {
  // Recalculate derived statistics
  recalculateWinRates();

  // Ensure data consistency
  if (
    gameHistory.humanVsAi.total !==
    gameHistory.humanVsAi.humanWins +
      gameHistory.humanVsAi.aiWins +
      gameHistory.humanVsAi.draws
  ) {
    Logger.warn("Inconsistent humanVsAi totals detected, recalculating...");
    gameHistory.humanVsAi.total =
      gameHistory.humanVsAi.humanWins +
      gameHistory.humanVsAi.aiWins +
      gameHistory.humanVsAi.draws;
  }

  if (
    gameHistory.humanVsHuman.total !==
    gameHistory.humanVsHuman.blackWins +
      gameHistory.humanVsHuman.whiteWins +
      gameHistory.humanVsHuman.draws
  ) {
    Logger.warn("Inconsistent humanVsHuman totals detected, recalculating...");
    gameHistory.humanVsHuman.total =
      gameHistory.humanVsHuman.blackWins +
      gameHistory.humanVsHuman.whiteWins +
      gameHistory.humanVsHuman.draws;
  }

  // Validate achievement data
  if (
    gameHistory.achievements.maxWinStreak < gameHistory.achievements.winStreak
  ) {
    gameHistory.achievements.maxWinStreak = gameHistory.achievements.winStreak;
  }
}

/**
 * Load AI analytics data from storage
 */
function loadAIAnalytics() {
  const savedAnalytics = loadFromLocalStorage(STORAGE_KEYS.AI_ANALYTICS, null);

  if (savedAnalytics) {
    aiAnalytics = deepMergeObjects(aiAnalytics, savedAnalytics);
    Logger.info("Loaded AI analytics data");
  }
}

// =============================================================================
// GAME RESULT RECORDING
// =============================================================================

/**
 * Record the result of a completed game
 * Updates all relevant statistics and saves to storage
 *
 * @param {string} winner - Winner: "human", "ai", "black", "white", or "draw"
 * @param {string} gameMode - Game mode: "humanVsAi" or "humanVsHuman"
 * @param {Object} gameDetails - Additional game information
 */
function recordGameResult(winner, gameMode, gameDetails = {}) {
  Logger.info(`Recording game result: ${winner} wins in ${gameMode} mode`);

  try {
    // Update timestamps
    gameHistory.lastUpdated = new Date().toISOString();
    gameHistory.currentSession.lastActivity = new Date().toISOString();
    gameHistory.currentSession.gamesPlayed++;

    // Increment total games
    gameHistory.totalGames++;

    // Create detailed game record
    const gameRecord = createGameRecord(winner, gameMode, gameDetails);

    // Record based on game mode
    if (gameMode === "humanVsAi") {
      recordHumanVsAIResult(winner, gameDetails);
    } else if (gameMode === "humanVsHuman") {
      recordHumanVsHumanResult(winner, gameDetails);
    }

    // Update achievements
    updateAchievements(winner, gameMode, gameDetails);

    // Add to recent games (keep last 50 games)
    gameHistory.recentGames.unshift(gameRecord);
    if (gameHistory.recentGames.length > 50) {
      gameHistory.recentGames = gameHistory.recentGames.slice(0, 50);
    }

    // Save last game result for quick reference
    gameHistory.lastGameResult = {
      winner,
      gameMode,
      timestamp: new Date().toISOString(),
      boardSize: BOARD_SIZE,
      details: gameDetails,
    };

    // Recalculate statistics
    recalculateWinRates();

    // Save to storage
    saveGameHistory();

    Logger.info("Game result recorded successfully");
  } catch (error) {
    Logger.error("Error recording game result:", error);
  }
}

/**
 * Record Human vs AI game result with detailed AI performance tracking
 *
 * @param {string} winner - "human", "ai", or "draw"
 * @param {Object} gameDetails - Game details including AI performance
 */
function recordHumanVsAIResult(winner, gameDetails) {
  const aiStats = gameHistory.humanVsAi;

  // Update main counters
  aiStats.total++;
  if (winner === "human") {
    aiStats.humanWins++;
    gameHistory.achievements.winStreak++;
    gameHistory.achievements.gamesWithoutLoss++;
  } else if (winner === "ai") {
    aiStats.aiWins++;
    gameHistory.achievements.winStreak = 0;
    gameHistory.achievements.gamesWithoutLoss = 0;
  } else {
    aiStats.draws++;
    gameHistory.achievements.winStreak = 0;
    gameHistory.achievements.gamesWithoutLoss++;
  }

  // Update algorithm-specific statistics
  const algorithm = gameDetails.algorithm || aiSettings.algorithm;
  if (aiStats.algorithmStats[algorithm]) {
    const algoStats = aiStats.algorithmStats[algorithm];
    algoStats.gamesPlayed++;

    if (winner === "human") algoStats.humanWins++;
    else if (winner === "ai") algoStats.aiWins++;
    else algoStats.draws++;

    // Update AI performance metrics
    if (gameDetails.aiPerformance) {
      const perf = gameDetails.aiPerformance;
      algoStats.avgNodesEvaluated = updateRunningAverage(
        algoStats.avgNodesEvaluated,
        perf.totalNodesEvaluated,
        algoStats.gamesPlayed
      );
      algoStats.avgTimePerMove = updateRunningAverage(
        algoStats.avgTimePerMove,
        perf.averageTimePerMove,
        algoStats.gamesPlayed
      );
    }
  }

  // Update difficulty-specific statistics
  const depth = gameDetails.aiDepth || aiSettings.depth;
  if (aiStats.difficultyStats[depth]) {
    const diffStats = aiStats.difficultyStats[depth];
    diffStats.gamesPlayed++;

    if (winner === "human") diffStats.humanWins++;
    else if (winner === "ai") diffStats.aiWins++;
    else diffStats.draws++;
  }

  // Record AI analytics
  recordAIAnalytics(gameDetails);
}

/**
 * Record Human vs Human game result
 *
 * @param {string} winner - "black", "white", or "draw"
 * @param {Object} gameDetails - Game details
 */
function recordHumanVsHumanResult(winner, gameDetails) {
  const humanStats = gameHistory.humanVsHuman;

  humanStats.total++;

  if (winner === "black") {
    humanStats.blackWins++;
  } else if (winner === "white") {
    humanStats.whiteWins++;
  } else {
    humanStats.draws++;
  }

  // Update average game length
  if (gameDetails.totalMoves) {
    humanStats.averageGameLength = updateRunningAverage(
      humanStats.averageGameLength,
      gameDetails.totalMoves,
      humanStats.total
    );
  }
}

/**
 * Create a detailed game record for storage
 *
 * @param {string} winner - Game winner
 * @param {string} gameMode - Game mode
 * @param {Object} gameDetails - Additional details
 * @returns {Object} Complete game record
 */
function createGameRecord(winner, gameMode, gameDetails) {
  return {
    id: generateGameId(),
    timestamp: new Date().toISOString(),
    winner,
    gameMode,
    boardSize: BOARD_SIZE,
    totalMoves: gameDetails.totalMoves || 0,
    finalScore: gameDetails.finalScore || { black: 0, white: 0 },
    capturedStones: gameDetails.capturedStones || { black: 0, white: 0 },
    gameDuration: gameDetails.gameDuration || 0,

    // AI-specific data
    aiAlgorithm: gameDetails.algorithm,
    aiDepth: gameDetails.aiDepth,
    aiPerformance: gameDetails.aiPerformance,

    // Session information
    sessionId: gameHistory.currentSession.startTime,
    gameInSession: gameHistory.currentSession.gamesPlayed,
  };
}

/**
 * Generate a unique game ID
 *
 * @returns {string} Unique game identifier
 */
function generateGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// STATISTICS CALCULATION AND ANALYSIS
// =============================================================================

/**
 * Recalculate win rates and derived statistics
 */
function recalculateWinRates() {
  // Human vs AI win rate
  const aiStats = gameHistory.humanVsAi;
  if (aiStats.total > 0) {
    aiStats.humanWinRate = (aiStats.humanWins / aiStats.total) * 100;
  } else {
    aiStats.humanWinRate = 0;
  }

  // Update achievement records
  if (
    gameHistory.achievements.winStreak > gameHistory.achievements.maxWinStreak
  ) {
    gameHistory.achievements.maxWinStreak = gameHistory.achievements.winStreak;
  }
}

/**
 * Update a running average with a new value
 *
 * @param {number} currentAverage - Current average value
 * @param {number} newValue - New value to incorporate
 * @param {number} count - Total count including new value
 * @returns {number} Updated average
 */
function updateRunningAverage(currentAverage, newValue, count) {
  if (count <= 1) return newValue;
  return (currentAverage * (count - 1) + newValue) / count;
}

/**
 * Get comprehensive game statistics
 *
 * @returns {Object} Complete statistics object
 */
function getGameStatistics() {
  return {
    overview: {
      totalGames: gameHistory.totalGames,
      totalPlayTime: formatDuration(gameHistory.totalPlayTime),
      averageGameLength: calculateAverageGameLength(),
      currentSession: {
        duration: formatDuration(getCurrentSessionDuration()),
        gamesPlayed: gameHistory.currentSession.gamesPlayed,
      },
    },

    humanVsAI: {
      total: gameHistory.humanVsAi.total,
      humanWins: gameHistory.humanVsAi.humanWins,
      aiWins: gameHistory.humanVsAi.aiWins,
      draws: gameHistory.humanVsAi.draws,
      humanWinRate: gameHistory.humanVsAi.humanWinRate.toFixed(1) + "%",

      byAlgorithm: Object.entries(gameHistory.humanVsAi.algorithmStats).map(
        ([algo, stats]) => ({
          algorithm: algo,
          ...stats,
          winRate:
            stats.gamesPlayed > 0
              ? ((stats.humanWins / stats.gamesPlayed) * 100).toFixed(1) + "%"
              : "N/A",
        })
      ),

      byDifficulty: Object.entries(gameHistory.humanVsAi.difficultyStats).map(
        ([depth, stats]) => ({
          depth: parseInt(depth),
          ...stats,
          winRate:
            stats.gamesPlayed > 0
              ? ((stats.humanWins / stats.gamesPlayed) * 100).toFixed(1) + "%"
              : "N/A",
        })
      ),
    },

    humanVsHuman: {
      total: gameHistory.humanVsHuman.total,
      blackWins: gameHistory.humanVsHuman.blackWins,
      whiteWins: gameHistory.humanVsHuman.whiteWins,
      draws: gameHistory.humanVsHuman.draws,
      averageGameLength: gameHistory.humanVsHuman.averageGameLength.toFixed(1),
    },

    achievements: {
      ...gameHistory.achievements,
      firstWin: gameHistory.achievements.firstWin
        ? new Date(gameHistory.achievements.firstWin).toLocaleDateString()
        : "None yet",
    },
  };
}

/**
 * Calculate average game length across all modes
 *
 * @returns {number} Average moves per game
 */
function calculateAverageGameLength() {
  const recentGames = gameHistory.recentGames;
  if (recentGames.length === 0) return 0;

  const totalMoves = recentGames.reduce(
    (sum, game) => sum + (game.totalMoves || 0),
    0
  );
  return (totalMoves / recentGames.length).toFixed(1);
}

/**
 * Get current session duration in milliseconds
 *
 * @returns {number} Session duration
 */
function getCurrentSessionDuration() {
  if (!gameHistory.currentSession.startTime) return 0;
  return Date.now() - new Date(gameHistory.currentSession.startTime).getTime();
}

// =============================================================================
// AI ANALYTICS AND PERFORMANCE TRACKING
// =============================================================================

/**
 * Record detailed AI performance analytics
 *
 * @param {Object} gameDetails - Game details with AI performance data
 */
function recordAIAnalytics(gameDetails) {
  if (!gameDetails.aiPerformance) return;

  const perf = gameDetails.aiPerformance;
  const timestamp = new Date().toISOString();

  // Record performance trends
  aiAnalytics.performanceTrends.nodesPerSecond.push({
    timestamp,
    value: perf.nodesPerSecond,
    algorithm: gameDetails.algorithm,
    depth: gameDetails.aiDepth,
  });

  aiAnalytics.performanceTrends.timePerMove.push({
    timestamp,
    value: perf.averageTimePerMove,
    algorithm: gameDetails.algorithm,
    depth: gameDetails.aiDepth,
  });

  // Limit trend data size
  const maxTrendPoints = 1000;
  if (aiAnalytics.performanceTrends.nodesPerSecond.length > maxTrendPoints) {
    aiAnalytics.performanceTrends.nodesPerSecond =
      aiAnalytics.performanceTrends.nodesPerSecond.slice(-maxTrendPoints);
  }
  if (aiAnalytics.performanceTrends.timePerMove.length > maxTrendPoints) {
    aiAnalytics.performanceTrends.timePerMove =
      aiAnalytics.performanceTrends.timePerMove.slice(-maxTrendPoints);
  }

  // Save analytics data
  saveAIAnalytics();
}

/**
 * Get AI performance analytics
 *
 * @returns {Object} AI analytics data
 */
function getAIAnalytics() {
  return {
    performanceTrends: aiAnalytics.performanceTrends,
    algorithmComparison: calculateAlgorithmComparison(),
    recentPerformance: getRecentAIPerformance(),
  };
}

/**
 * Calculate algorithm comparison metrics
 *
 * @returns {Object} Algorithm comparison data
 */
function calculateAlgorithmComparison() {
  const minimax = gameHistory.humanVsAi.algorithmStats.minimax;
  const alphabeta = gameHistory.humanVsAi.algorithmStats.alphabeta;

  return {
    speed: {
      minimax: minimax.avgTimePerMove,
      alphabeta: alphabeta.avgTimePerMove,
      speedupFactor:
        minimax.avgTimePerMove > 0
          ? (minimax.avgTimePerMove / alphabeta.avgTimePerMove).toFixed(2)
          : "N/A",
    },
    efficiency: {
      minimax: minimax.avgNodesEvaluated,
      alphabeta: alphabeta.avgNodesEvaluated,
      nodeReduction:
        minimax.avgNodesEvaluated > 0
          ? (
              ((minimax.avgNodesEvaluated - alphabeta.avgNodesEvaluated) /
                minimax.avgNodesEvaluated) *
              100
            ).toFixed(1) + "%"
          : "N/A",
    },
    winRates: {
      minimax:
        minimax.gamesPlayed > 0
          ? ((minimax.aiWins / minimax.gamesPlayed) * 100).toFixed(1) + "%"
          : "N/A",
      alphabeta:
        alphabeta.gamesPlayed > 0
          ? ((alphabeta.aiWins / alphabeta.gamesPlayed) * 100).toFixed(1) + "%"
          : "N/A",
    },
  };
}

/**
 * Get recent AI performance summary
 *
 * @returns {Object} Recent performance data
 */
function getRecentAIPerformance() {
  const recentGames = gameHistory.recentGames.slice(0, 10); // Last 10 games
  const aiGames = recentGames.filter((game) => game.gameMode === "humanVsAi");

  if (aiGames.length === 0) {
    return { message: "No recent AI games found" };
  }

  const totalNodes = aiGames.reduce(
    (sum, game) => sum + (game.aiPerformance?.totalNodesEvaluated || 0),
    0
  );
  const totalTime = aiGames.reduce(
    (sum, game) => sum + (game.aiPerformance?.totalTimeUsed || 0),
    0
  );
  const aiWins = aiGames.filter((game) => game.winner === "ai").length;

  return {
    gamesAnalyzed: aiGames.length,
    averageNodes: Math.round(totalNodes / aiGames.length),
    averageTime: Math.round(totalTime / aiGames.length),
    recentWinRate: ((aiWins / aiGames.length) * 100).toFixed(1) + "%",
    performance:
      totalTime > 0
        ? Math.round((totalNodes / totalTime) * 1000) + " nodes/sec"
        : "N/A",
  };
}

// =============================================================================
// ACHIEVEMENT SYSTEM
// =============================================================================

/**
 * Update achievement progress based on game result
 *
 * @param {string} winner - Game winner
 * @param {string} gameMode - Game mode
 * @param {Object} gameDetails - Game details
 */
function updateAchievements(winner, gameMode, gameDetails) {
  const achievements = gameHistory.achievements;

  // First win achievement
  if (
    !achievements.firstWin &&
    ((gameMode === "humanVsAi" && winner === "human") ||
      (gameMode === "humanVsHuman" &&
        (winner === "black" || winner === "white")))
  ) {
    achievements.firstWin = new Date().toISOString();
    Logger.info("Achievement unlocked: First Win!");
  }

  // Update captured stones total
  if (gameDetails.capturedStones) {
    const totalCaptured =
      (gameDetails.capturedStones.black || 0) +
      (gameDetails.capturedStones.white || 0);
    achievements.totalCapturedStones += totalCaptured;
  }

  // Perfect game (no stones lost)
  if (
    gameMode === "humanVsAi" &&
    winner === "human" &&
    gameDetails.capturedStones
  ) {
    const humanColor = gameDetails.humanColor || BLACK;
    const humanCaptured =
      humanColor === BLACK
        ? gameDetails.capturedStones.white
        : gameDetails.capturedStones.black;

    if (humanCaptured === 0) {
      achievements.perfectGames++;
      Logger.info(
        "Achievement: Perfect Game (no stones captured by opponent)!"
      );
    }
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Start a new game session
 */
function startNewSession() {
  gameHistory.currentSession = {
    startTime: new Date().toISOString(),
    gamesPlayed: 0,
    lastActivity: new Date().toISOString(),
  };

  Logger.info("New game session started");
}

/**
 * End the current session
 */
function endCurrentSession() {
  if (gameHistory.currentSession.startTime) {
    const sessionDuration = getCurrentSessionDuration();
    gameHistory.totalPlayTime += sessionDuration;

    Logger.info(
      `Session ended. Duration: ${formatDuration(sessionDuration)}, Games: ${
        gameHistory.currentSession.gamesPlayed
      }`
    );

    gameHistory.currentSession = {
      startTime: null,
      gamesPlayed: 0,
      lastActivity: null,
    };

    saveGameHistory();
  }
}

// =============================================================================
// DATA PERSISTENCE AND STORAGE
// =============================================================================

/**
 * Save game history to localStorage
 *
 * @returns {boolean} True if successful
 */
function saveGameHistory() {
  gameHistory.lastUpdated = new Date().toISOString();
  return saveToLocalStorage(STORAGE_KEYS.GAME_HISTORY, gameHistory);
}

/**
 * Save AI analytics to localStorage
 *
 * @returns {boolean} True if successful
 */
function saveAIAnalytics() {
  return saveToLocalStorage(STORAGE_KEYS.AI_ANALYTICS, aiAnalytics);
}

/**
 * Export game history as JSON for backup
 *
 * @returns {string} JSON string of complete history
 */
function exportGameHistory() {
  const exportData = {
    gameHistory,
    aiAnalytics,
    exportDate: new Date().toISOString(),
    version: HISTORY_DATA_VERSION,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import game history from JSON backup
 *
 * @param {string} jsonData - JSON string to import
 * @returns {boolean} True if successful
 */
function importGameHistory(jsonData) {
  try {
    const importedData = JSON.parse(jsonData);

    if (importedData.gameHistory) {
      gameHistory = importedData.gameHistory;
      validateAndFixHistoryData();
    }

    if (importedData.aiAnalytics) {
      aiAnalytics = importedData.aiAnalytics;
    }

    saveGameHistory();
    saveAIAnalytics();

    Logger.info("Game history imported successfully");
    return true;
  } catch (error) {
    Logger.error("Failed to import game history:", error);
    return false;
  }
}

/**
 * Clear all game history data
 *
 * @param {boolean} confirm - Confirmation flag
 * @returns {boolean} True if cleared
 */
function clearGameHistory(confirm = false) {
  if (!confirm) {
    Logger.warn("Clear game history requires confirmation");
    return false;
  }

  // Reset to defaults
  gameHistory = {
    ...gameHistory,
    totalGames: 0,
    totalPlayTime: 0,
    humanVsAi: {
      total: 0,
      humanWins: 0,
      aiWins: 0,
      draws: 0,
      averageGameLength: 0,
      humanWinRate: 0,
      algorithmStats: {
        minimax: {
          gamesPlayed: 0,
          humanWins: 0,
          aiWins: 0,
          draws: 0,
          avgNodesEvaluated: 0,
          avgTimePerMove: 0,
        },
        alphabeta: {
          gamesPlayed: 0,
          humanWins: 0,
          aiWins: 0,
          draws: 0,
          avgNodesEvaluated: 0,
          avgTimePerMove: 0,
        },
      },
      difficultyStats: {
        1: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
        2: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
        3: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
        4: { gamesPlayed: 0, humanWins: 0, aiWins: 0, draws: 0 },
      },
    },
    humanVsHuman: {
      total: 0,
      blackWins: 0,
      whiteWins: 0,
      draws: 0,
      averageGameLength: 0,
    },
    lastGameResult: null,
    achievements: {
      firstWin: null,
      winStreak: 0,
      maxWinStreak: 0,
      gamesWithoutLoss: 0,
      totalCapturedStones: 0,
      perfectGames: 0,
    },
    recentGames: [],
  };

  aiAnalytics = {
    performanceTrends: {
      nodesPerSecond: [],
      timePerMove: [],
      searchDepthEfficiency: [],
    },
    algorithmComparison: {
      speedComparison: {},
      accuracyComparison: {},
      nodeEfficiency: {},
    },
    movePatterns: {
      openingMoves: {},
      responsePatterns: {},
      endgameBehavior: {},
    },
  };

  // Clear storage
  removeFromLocalStorage(STORAGE_KEYS.GAME_HISTORY);
  removeFromLocalStorage(STORAGE_KEYS.AI_ANALYTICS);

  Logger.info("Game history cleared");
  return true;
}

// =============================================================================
// DATA MAINTENANCE AND CLEANUP
// =============================================================================

/**
 * Perform routine data maintenance
 * Cleans up old data and optimizes storage
 */
function performDataMaintenance() {
  // Remove very old performance trend data (keep last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  aiAnalytics.performanceTrends.nodesPerSecond =
    aiAnalytics.performanceTrends.nodesPerSecond.filter(
      (point) => new Date(point.timestamp) > sixMonthsAgo
    );

  aiAnalytics.performanceTrends.timePerMove =
    aiAnalytics.performanceTrends.timePerMove.filter(
      (point) => new Date(point.timestamp) > sixMonthsAgo
    );

  Logger.info("Data maintenance completed");
}

/**
 * Deep merge two objects, with the second object taking precedence
 *
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMergeObjects(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMergeObjects(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

// =============================================================================
// PUBLIC API FOR OTHER MODULES
// =============================================================================

// Export functions for use by other modules
// These functions provide the interface for the history system

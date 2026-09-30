/**
 * =============================================================================
 * MAIN APPLICATION MODULE - Application Coordinator and Entry Point
 * =============================================================================
 *
 * This is the main entry point for the Go game application. It coordinates
 * all other modules and manages the overall application flow:
 * - Application initialization and startup
 * - Module coordination and communication
 * - Global error handling and recovery
 * - Application state management
 * - Event orchestration between modules
 *
 * This module acts as the "conductor" that ensures all parts of the
 * application work together harmoniously.
 */

// =============================================================================
// APPLICATION STATE AND CONFIGURATION
// =============================================================================

/**
 * Application configuration and settings
 * Centralized configuration makes it easy to adjust behavior
 */
const appConfig = {
  // Application metadata
  name: "Go Game - AI vs Human",
  version: "2.0.0",

  // Default settings
  defaults: {
    boardSize: 13,
    aiAlgorithm: "alphabeta",
    aiDepth: 2,
    gameMode: "humanVsAi",
  },

  // Feature flags for enabling/disabling functionality
  features: {
    gameHistory: true,
    aiAnalytics: true,
    achievements: true,
    autoSave: true,
    debugMode: false,
  },

  // Performance settings
  performance: {
    aiMoveDelay: 300, // Delay before AI move (ms)
    uiUpdateDelay: 100, // Delay for UI updates (ms)
    autoSaveInterval: 30000, // Auto-save interval (ms)
  },
};

/**
 * Application state tracking
 * Keeps track of the overall application status
 */
let appState = {
  initialized: false,
  modulesLoaded: [],
  currentGameId: null,
  lastActivity: Date.now(),

  // Error recovery state
  errorCount: 0,
  lastError: null,
  recoveryAttempts: 0,
};

// Module dependency graph removed (unused)

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Initialize the entire application
 * This is the main entry point called when the page loads
 */
async function initializeApplication() {
  Logger.info(`Initializing ${appConfig.name} v${appConfig.version}`);

  try {
    // Show loading indicator
    showLoadingIndicator("Initializing application...");

    // Initialize modules in dependency order
    await initializeModulesSequentially();

    // Set up global error handling
    setupGlobalErrorHandling();

    // Initialize auto-save if enabled
    if (appConfig.features.autoSave) {
      setupAutoSave();
    }

    // Set up activity tracking
    setupActivityTracking();

    // Mark application as initialized
    appState.initialized = true;
    appState.lastActivity = Date.now();

    // Hide loading indicator
    hideLoadingIndicator();

    // Apply saved preferences (board size, AI, mode) and sync UI
    if (typeof loadUserPreferences === "function") {
      loadUserPreferences();
    }

    // Show welcome message or restore session
    handleApplicationStartup();

    Logger.info("Application initialization complete");
  } catch (error) {
    Logger.error("Failed to initialize application:", error);
    handleInitializationError(error);
  }
}

/**
 * Initialize all modules in the correct dependency order
 */
async function initializeModulesSequentially() {
  const initializationOrder = [
    "utils",
    "gameLogic",
    "gameHistory",
    "aiLogic",
    "uiComponents",
  ];

  for (const moduleName of initializationOrder) {
    try {
      Logger.info(`Initializing module: ${moduleName}`);
      await initializeModule(moduleName);
      appState.modulesLoaded.push(moduleName);
    } catch (error) {
      Logger.error(`Failed to initialize module ${moduleName}:`, error);
      throw new Error(`Module initialization failed: ${moduleName}`);
    }
  }
}

/**
 * Initialize a specific module
 *
 * @param {string} moduleName - Name of the module to initialize
 */
async function initializeModule(moduleName) {
  switch (moduleName) {
    case "utils":
      // Utils module doesn't need explicit initialization
      Logger.debug("Utils module loaded");
      break;

    case "gameLogic":
      // Initialize game logic
      resetGame();
      Logger.debug("Game logic initialized");
      break;

    case "gameHistory":
      // Initialize game history system
      if (appConfig.features.gameHistory) {
        initializeGameHistory();
      }
      Logger.debug("Game history initialized");
      break;

    case "aiLogic":
      // AI logic doesn't need explicit initialization beyond defaults
      Logger.debug("AI logic initialized");
      break;

    case "uiComponents":
      // Initialize UI components
      const uiInitialized = initializeUI();
      if (!uiInitialized) {
        throw new Error("UI initialization failed");
      }
      Logger.debug("UI components initialized");
      break;

    default:
      Logger.warn(`Unknown module: ${moduleName}`);
  }
}

/**
 * Handle post-initialization startup
 * Decides what to show the user when the app starts
 */
function handleApplicationStartup() {
  // Check if there's an interrupted game to restore
  const interruptedGame = loadFromLocalStorage("goGameInterrupted", null);

  if (interruptedGame && interruptedGame.wasInProgress) {
    // Auto-restore silently without showing confirm/alert dialogs
    restoreGameState(interruptedGame);
  } else {
    // Show welcome message for new users in a modal
    if (gameHistory.totalGames === 0) {
      if (typeof showWelcomeModal === "function") {
        // Fire and forget; user can dismiss and continue
        showWelcomeModal();
      }
    } else {
      // Returning user - just start normally
      updateAllUI();
      drawBoard();
    }
  }

  // If AI should move first, trigger it
  if (shouldAIMove()) {
    setTimeout(() => {
      makeAIMove().then(() => {
        updateAllUI();
        drawBoard();
      });
    }, appConfig.performance.aiMoveDelay);
  }
}

// =============================================================================
// GAME FLOW COORDINATION
// =============================================================================

/**
 * Coordinate a complete game turn
 * This function orchestrates the interaction between all modules
 *
 * @param {number} row - Row of the move
 * @param {number} col - Column of the move
 * @param {number} player - Player making the move
 */
async function coordinateGameTurn(row, col, player) {
  try {
    // Record the move attempt
    Logger.debug(
      `Turn coordination: ${getPlayerName(
        player
      )} attempts move at (${row}, ${col})`
    );

    // Validate and execute the move via game logic
    const moveSuccess = makeMove(row, col, player);

    if (!moveSuccess) {
      Logger.warn("Illegal move attempted");
      showUserMessage(
        "Illegal move! Please try a different position.",
        "warning"
      );
      return false;
    }

    // Update UI to reflect the move
    updateAllUI();
    drawBoard();

    // Move log disabled; skip logging

    // Check if game ended
    if (game.gameOver) {
      await handleGameEnd();
      return true;
    }

    // Handle AI response if needed
    if (shouldAIMove() && !game.gameOver) {
      await handleAITurn();
    }

    // Update activity tracking
    appState.lastActivity = Date.now();

    return true;
  } catch (error) {
    Logger.error("Error coordinating game turn:", error);
    handleGameError(error);
    return false;
  }
}

/**
 * Handle AI turn coordination
 */
async function handleAITurn() {
  try {
    Logger.debug("Coordinating AI turn");

    // Show AI thinking status
    updatePlayerStatusForAIThinking();

    // Small delay for better UX
    await delay(appConfig.performance.aiMoveDelay);

    // Get AI performance tracking data
    const aiStartTime = performance.now();

    // Execute AI move
    const aiAction = await makeAIMove();

    // Calculate AI performance metrics
    const aiEndTime = performance.now();
    const aiStats = getAIStats();

    // Record detailed AI performance for history
    const aiPerformance = {
      totalNodesEvaluated: aiStats.nodesEvaluated,
      totalTimeUsed: aiEndTime - aiStartTime,
      averageTimePerMove: aiEndTime - aiStartTime,
      nodesPerSecond: aiStats.nodesPerSecond,
      algorithm: aiSettings.algorithm,
      depth: aiSettings.depth,
    };

    // Update UI
    updateAllUI();
    drawBoard();

    // Move log disabled; skip logging

    // Check if game ended after AI move
    if (game.gameOver) {
      await handleGameEnd(aiPerformance);
    }
  } catch (error) {
    Logger.error("Error in AI turn coordination:", error);
    handleGameError(error);
  }
}

/**
 * Handle pass move coordination
 *
 * @param {number} player - Player who is passing
 */
async function coordinatePassMove(player) {
  try {
    Logger.debug(`Pass coordination: ${getPlayerName(player)} passes`);

    // Execute pass via game logic
    passMove();

    // Update UI
    updateAllUI();

    // Check if game ended (two consecutive passes)
    if (game.gameOver) {
      await handleGameEnd();
      return;
    }

    // Move log disabled; skip logging

    // Handle AI response if needed
    if (shouldAIMove() && !game.gameOver) {
      await handleAITurn();
    }

    appState.lastActivity = Date.now();
  } catch (error) {
    Logger.error("Error coordinating pass move:", error);
    handleGameError(error);
  }
}

/**
 * Handle game end coordination
 *
 * @param {Object} aiPerformance - AI performance data if available
 */
async function handleGameEnd(aiPerformance = null) {
  try {
    Logger.info("Game ended - coordinating end sequence");

    // Get final game results
    const gameResult = endGame();

    // Calculate additional game statistics
    const gameStats = calculateGameStatistics();

    // Record in game history if enabled
    if (appConfig.features.gameHistory) {
      const gameDetails = {
        totalMoves: calculateTotalMoves(),
        finalScore: {
          black: gameResult.blackScore,
          white: gameResult.whiteScore,
        },
        capturedStones: {
          black: game.captured[BLACK],
          white: game.captured[WHITE],
        },
        gameDuration: gameStats.duration,
        algorithm: aiSettings.algorithm,
        aiDepth: aiSettings.depth,
        aiPerformance: aiPerformance,
      };

      // Map winner to 'human'/'ai' for AI modes so stats are correct
      let winnerForHistory = gameResult.historyWinner; // 'black' | 'white' | 'draw'
      if (aiSettings.gameMode === "humanVsAi") {
        if (winnerForHistory === "black") winnerForHistory = "human";
        else if (winnerForHistory === "white") winnerForHistory = "ai";
      }

      recordGameResult(winnerForHistory, aiSettings.gameMode, gameDetails);
    }

    // Update UI with final results
    updateAllUI();

    // Show game end dialog
    await showGameEndDialog(gameResult, gameStats);
    // Start new game only after user confirms in the result modal
    startNewGame();
  } catch (error) {
    Logger.error("Error handling game end:", error);
    handleGameError(error);
  }
}

/**
 * Start a new game
 */
function startNewGame() {
  try {
    Logger.info("Starting new game");

    // Reset game state
    resetGame();

    // Reset AI stats so the performance panel shows fresh values
    if (typeof resetAIStats === "function") {
      resetAIStats();
    }

    // Move log disabled; skip clearing

    // Generate new game ID
    appState.currentGameId = generateGameId();

    // Update UI
    updateAllUI();
    drawBoard();

    // Clear any interrupted game data
    removeFromLocalStorage("goGameInterrupted");

    // If AI should start, trigger AI move
    if (shouldAIMove()) {
      setTimeout(() => {
        handleAITurn();
      }, appConfig.performance.aiMoveDelay);
    }

    appState.lastActivity = Date.now();
  } catch (error) {
    Logger.error("Error starting new game:", error);
    handleGameError(error);
  }
}

// =============================================================================
// SETTINGS AND CONFIGURATION MANAGEMENT
// =============================================================================

/**
 * Update game settings
 * Coordinates changes across all relevant modules
 *
 * @param {Object} newSettings - New settings to apply
 */
function updateGameSettings(newSettings) {
  try {
    Logger.info("Updating game settings:", newSettings);

    // Update board size if changed
    if (newSettings.boardSize && newSettings.boardSize !== BOARD_SIZE) {
      BOARD_SIZE = newSettings.boardSize;
      startNewGame(); // Reset game with new board size
    }

    // Update AI settings
    if (newSettings.aiAlgorithm) {
      setAIAlgorithm(newSettings.aiAlgorithm);
    }

    if (newSettings.aiDepth) {
      setAIDepth(newSettings.aiDepth);
    }

    // Update game mode
    if (newSettings.gameMode && newSettings.gameMode !== aiSettings.gameMode) {
      const oldMode = aiSettings.gameMode;
      setGameMode(newSettings.gameMode);

      // Restart game if mode changed during play
      if (game.board.some((row) => row.some((cell) => cell !== EMPTY))) {
        showUserMessage(
          `Game mode changed to ${newSettings.gameMode}. Starting new game...`,
          "info"
        );
        startNewGame();
      }
    }

    // Save preferences if history is enabled
    if (appConfig.features.gameHistory) {
      gameHistory.preferences = {
        ...gameHistory.preferences,
        ...newSettings,
      };
      saveGameHistory();
    }

    // Update UI to reflect changes
    updateAllUI();
  } catch (error) {
    Logger.error("Error updating game settings:", error);
    handleGameError(error);
  }
}

/**
 * Load user preferences from history
 */
function loadUserPreferences() {
  if (!appConfig.features.gameHistory || !gameHistory.preferences) {
    return;
  }

  const prefs = gameHistory.preferences;

  // Apply saved preferences
  updateGameSettings({
    boardSize: prefs.defaultBoardSize || appConfig.defaults.boardSize,
    aiAlgorithm: prefs.defaultAIAlgorithm || appConfig.defaults.aiAlgorithm,
    aiDepth: prefs.defaultAIDepth || appConfig.defaults.aiDepth,
    gameMode: prefs.preferredGameMode || appConfig.defaults.gameMode,
  });

  Logger.info("User preferences loaded and applied");
}

// =============================================================================
// ERROR HANDLING AND RECOVERY
// =============================================================================

/**
 * Set up global error handling for the application
 */
function setupGlobalErrorHandling() {
  // Handle uncaught JavaScript errors
  window.addEventListener("error", (event) => {
    Logger.error("Uncaught error:", event.error);
    handleGlobalError(event.error);
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    Logger.error("Unhandled promise rejection:", event.reason);
    handleGlobalError(event.reason);
    event.preventDefault(); // Prevent console logging
  });

  Logger.info("Global error handling set up");
}

/**
 * Handle global application errors
 *
 * @param {Error} error - The error that occurred
 */
function handleGlobalError(error) {
  appState.errorCount++;
  appState.lastError = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };

  // Attempt recovery based on error count
  if (appState.errorCount <= 3) {
    Logger.warn(`Attempting error recovery (attempt ${appState.errorCount}/3)`);
    attemptErrorRecovery();
  } else {
    Logger.error("Too many errors, entering safe mode");
    enterSafeMode();
  }
}

/**
 * Handle game-specific errors
 *
 * @param {Error} error - The error that occurred
 */
function handleGameError(error) {
  Logger.error("Game error occurred:", error);

  // Save current game state for recovery
  saveCurrentGameState();

  // Try to recover by resetting to a known good state
  try {
    resetGame();
    updateAllUI();
    drawBoard();
    showUserMessage("A game error occurred. The game has been reset.", "error");
  } catch (recoveryError) {
    Logger.error("Failed to recover from game error:", recoveryError);
    enterSafeMode();
  }
}

/**
 * Handle initialization errors
 *
 * @param {Error} error - The initialization error
 */
function handleInitializationError(error) {
  // Show error message to user
  const errorMessage = `
        <div style="text-align: center; padding: 20px; color: #e74c3c;">
            <h2>Application Failed to Load</h2>
            <p>There was an error initializing the Go game:</p>
            <p><strong>${error.message}</strong></p>
            <p>Please refresh the page to try again.</p>
            <button onclick="location.reload()">Refresh Page</button>
        </div>
    `;

  document.body.innerHTML = errorMessage;
}

/**
 * Attempt to recover from errors
 */
function attemptErrorRecovery() {
  appState.recoveryAttempts++;

  try {
    // Reset game state
    resetGame();

    // Re-initialize UI
    updateAllUI();
    drawBoard();

    // Reset error count on successful recovery
    appState.errorCount = 0;

    Logger.info("Error recovery successful");
    showUserMessage("Recovered from error. Game has been reset.", "info");
  } catch (recoveryError) {
    Logger.error("Error recovery failed:", recoveryError);
    enterSafeMode();
  }
}

/**
 * Enter safe mode with minimal functionality
 */
function enterSafeMode() {
  Logger.warn("Entering safe mode");

  // Disable advanced features
  appConfig.features.gameHistory = false;
  appConfig.features.aiAnalytics = false;
  appConfig.features.achievements = false;

  // Show safe mode message
  showUserMessage(
    "Application is running in safe mode due to errors. Some features may be unavailable.",
    "warning"
  );

  // Try basic functionality
  try {
    resetGame();
    updateAllUI();
    drawBoard();
  } catch (error) {
    Logger.error("Even safe mode failed:", error);
    handleInitializationError(error);
  }
}

// =============================================================================
// AUTO-SAVE AND SESSION MANAGEMENT
// =============================================================================

/**
 * Set up automatic saving of game state
 */
function setupAutoSave() {
  setInterval(() => {
    if (appState.initialized && !game.gameOver) {
      saveCurrentGameState();
    }
  }, appConfig.performance.autoSaveInterval);

  Logger.info("Auto-save enabled");
}

/**
 * Save current game state for recovery
 */
function saveCurrentGameState() {
  if (!appState.initialized) return;

  try {
    const gameState = {
      wasInProgress: true,
      board: deepCopy(game.board),
      currentPlayer: game.currentPlayer,
      captured: { ...game.captured },
      consecutivePasses: game.consecutivePasses,
      gameMode: aiSettings.gameMode,
      aiSettings: { ...aiSettings },
      timestamp: new Date().toISOString(),
      boardSize: BOARD_SIZE,
      gameId: appState.currentGameId,
    };

    saveToLocalStorage("goGameInterrupted", gameState);
  } catch (error) {
    Logger.warn("Failed to save game state:", error);
  }
}

/**
 * Set up activity tracking
 */
function setupActivityTracking() {
  // Track user activity
  const trackActivity = () => {
    appState.lastActivity = Date.now();
  };

  document.addEventListener("click", trackActivity);
  document.addEventListener("keypress", trackActivity);
  document.addEventListener("mousemove", throttle(trackActivity, 1000));

  // Check for inactivity
  setInterval(() => {
    const inactiveTime = Date.now() - appState.lastActivity;
    const fiveMinutes = 5 * 60 * 1000;

    if (inactiveTime > fiveMinutes && !game.gameOver) {
      Logger.info("User inactive for 5+ minutes, saving state");
      saveCurrentGameState();
    }
  }, 60000); // Check every minute
}

// =============================================================================
// UI COORDINATION HELPERS
// =============================================================================

/**
 * Show loading indicator
 *
 * @param {string} message - Loading message
 */
function showLoadingIndicator(message = "Loading...") {
  // Create or update loading overlay
  let overlay = document.getElementById("loadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); color: white;
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; font-size: 18px;
        `;
    document.body.appendChild(overlay);
  }
  overlay.textContent = message;
  overlay.style.display = "flex";
}

/**
 * Hide loading indicator
 */
function hideLoadingIndicator() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

/**
 * Show welcome message for new users
 */
// Legacy inline welcome removed in favor of modal in uiComponents.js

/**
 * Show game recovery dialog
 *
 * @param {Object} interruptedGame - Saved game state
 */
// Game recovery dialog removed (unused)

/**
 * Restore game state from saved data
 *
 * @param {Object} savedState - Saved game state
 */
function restoreGameState(savedState) {
  try {
    // Restore game variables
    BOARD_SIZE = savedState.boardSize;
    game.board = savedState.board;
    game.currentPlayer = savedState.currentPlayer;
    game.captured = savedState.captured;
    game.consecutivePasses = savedState.consecutivePasses;
    game.gameOver = false;

    // Restore AI settings
    if (savedState.aiSettings) {
      Object.assign(aiSettings, savedState.aiSettings);
    }

    // Update UI
    updateGameSettings({ gameMode: savedState.gameMode });
    updateAllUI();
    drawBoard();
    Logger.info("Game state restored from interruption");
  } catch (error) {
    Logger.error("Failed to restore game state:", error);
    showUserMessage(
      "Failed to restore previous game. Starting new game.",
      "error"
    );
    startNewGame();
  }
}

/**
 * Show game end dialog
 *
 * @param {Object} gameResult - Game result information
 * @param {Object} gameStats - Game statistics
 */
async function showGameEndDialog(gameResult, gameStats) {
  // Use a modal popup with winner details instead of alert/toast
  if (typeof showGameResultModal === "function") {
    await showGameResultModal(gameResult, gameStats);
  } else {
    // Fallback: silently proceed without console output
  }
}

/**
 * Update player status for AI thinking
 */
function updatePlayerStatusForAIThinking() {
  if (uiElements.currentPlayer) {
    const playerName = game.currentPlayer === BLACK ? "Black" : "White";
    uiElements.currentPlayer.textContent = `${playerName} (AI) is thinking...`;
    uiElements.currentPlayer.style.color = "#f39c12"; // Orange for thinking
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate total moves played in current game
 *
 * @returns {number} Total moves
 */
function calculateTotalMoves() {
  let totalMoves = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (game.board[row][col] !== EMPTY) {
        totalMoves++;
      }
    }
  }
  return totalMoves;
}

/**
 * Calculate game statistics
 *
 * @returns {Object} Game statistics
 */
function calculateGameStatistics() {
  const currentTime = Date.now();
  const sessionStart = gameHistory.currentSession.startTime
    ? new Date(gameHistory.currentSession.startTime).getTime()
    : currentTime;

  return {
    totalMoves: calculateTotalMoves(),
    duration: currentTime - sessionStart,
    capturesBlack: game.captured[BLACK],
    capturesWhite: game.captured[WHITE],
  };
}

/**
 * Delay function for async operations
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// APPLICATION ENTRY POINT
// =============================================================================

/**
 * Main application entry point
 * This function is called when the DOM is ready
 */
document.addEventListener("DOMContentLoaded", function () {
  Logger.info("DOM loaded, starting application initialization");
  initializeApplication();
});

/**
 * Handle page unload to save state
 */
window.addEventListener("beforeunload", function () {
  if (appState.initialized) {
    // Save current game state
    saveCurrentGameState();

    // End current session
    if (appConfig.features.gameHistory) {
      endCurrentSession();
    }

    Logger.info("Application shutting down gracefully");
  }
});

// =============================================================================
// EXPORT APPLICATION API
// =============================================================================

// Export key functions for use by other modules or debugging
window.GoGameApp = {
  // Core functions
  startNewGame,
  updateGameSettings,

  // State access
  getAppState: () => ({ ...appState }),
  getAppConfig: () => ({ ...appConfig }),

  // Debugging functions (only available in debug mode)
  ...(appConfig.features.debugMode && {
    resetErrorCount: () => {
      appState.errorCount = 0;
    },
    triggerError: (message) => {
      throw new Error(message);
    },
    enterSafeMode,
    exportGameHistory,
    clearGameHistory,
  }),
};

Logger.info("Main application module loaded");

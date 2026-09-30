/**
 * =============================================================================
 * UI COMPONENTS MODULE - User Interface and Rendering
 * =============================================================================
 *
 * This module handles all user interface elements and visual rendering:
 * - Canvas-based board rendering with visual effects
 * - Mouse event handling for user interactions
 * - Game status display and updates
 * - Control panel management
 * - Visual feedback and animations
 * - Responsive design and layout management
 *
 * Key UI Components:
 * - Game Board Canvas: Interactive playing surface
 * - Status Displays: Current player, score, game state
 * - Control Panels: Settings, statistics, game controls
 * - Hover Effects: Visual feedback for move preview
 */

// =============================================================================
// UI STATE AND CONFIGURATION
// =============================================================================

/**
 * Canvas and rendering context
 * These are the main elements for drawing the game board
 */
let canvas; // HTML5 Canvas element for the game board
let ctx; // 2D rendering context for drawing operations

/**
 * DOM element references for efficient UI updates
 * Cached to avoid repeated DOM queries
 */
let uiElements = {
  // Game status elements
  currentPlayer: null, // Shows whose turn it is
  gameScore: null, // Displays current score
  aiStats: null, // Shows AI performance metrics

  // Control elements
  boardSizeSelector: null, // Dropdown for board size selection
  passButton: null, // Button to pass turn
  resetButton: null, // Button to start new game

  // Settings elements
  algorithmRadios: null, // Radio buttons for AI algorithm selection
  depthSlider: null, // Slider for AI search depth
  depthValue: null, // Display for current depth value
  gameModeRadios: null, // Radio buttons for game mode selection
};

/**
 * Hover preview state for move visualization
 * Provides visual feedback when user hovers over board
 */
let hoverPreview = {
  row: -1, // Current hover row (-1 if no hover)
  col: -1, // Current hover column (-1 if no hover)
  isVisible: false, // Whether preview should be displayed
  player: EMPTY, // Which player's stone to preview
};

/**
 * Visual styling configuration for the board
 * Centralized styling makes it easy to customize appearance
 */
const visualConfig = {
  // Board appearance
  boardColors: {
    background: "#D4A574", // Light honey wood
    backgroundGradient: [
      // Wood grain gradient stops
      { stop: 0, color: "#D4A574" }, // Light honey
      { stop: 0.3, color: "#C19A6B" }, // Medium honey
      { stop: 0.6, color: "#CD853F" }, // Peru/darker wood
      { stop: 1, color: "#B8860B" }, // Dark golden wood
    ],
    gridLines: "#654321", // Dark brown for grid
    starPoints: "#2F1B14", // Very dark brown for star points
  },

  // Stone appearance
  stones: {
    black: {
      fill: "#1a1a1a", // Nearly black
      stroke: "#000000", // Pure black border
      shadowColor: "rgba(0,0,0,0.4)",
    },
    white: {
      fill: "#f8f8f8", // Nearly white
      stroke: "#cccccc", // Light gray border
      shadowColor: "rgba(0,0,0,0.3)",
    },
    preview: {
      opacity: 0.6, // Semi-transparent for hover
      pulseEffect: true, // Whether to animate preview
    },
  },

  // Layout and sizing
  layout: {
    stoneRadius: 12, // Base stone radius
    starPointRadius: 4, // Radius of star point markers
    gridLineWidth: 2, // Thickness of grid lines
    shadowBlur: 3, // Stone shadow blur amount
    hoverTolerance: 15, // Mouse distance tolerance for hover
  },
};

// Toast notification container reference
let toastContainer = null;

// Result modal overlay reference
let resultModalOverlay = null;
// Welcome modal overlay reference
let welcomeModalOverlay = null;
// Move log disabled; removed unused state

// =============================================================================
// INITIALIZATION AND DOM SETUP
// =============================================================================

/**
 * Initialize the user interface
 * Sets up all DOM references and initial state
 * Should be called once when the page loads
 */
function initializeUI() {
  // UI initialization started

  // Get canvas and context for board rendering
  canvas = document.getElementById("gameBoard");
  if (!canvas) {
    console.error("Game board canvas not found!");
    return false;
  }

  ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Could not get 2D rendering context!");
    return false;
  }

  // Cache DOM element references
  cacheDOMElements();

  // Ensure board size selector reflects current board size (e.g., after restore)
  if (uiElements.boardSizeSelector) {
    const current = String(BOARD_SIZE);
    if (uiElements.boardSizeSelector.value !== current) {
      uiElements.boardSizeSelector.value = current;
    }
  }

  // Hide move log container if present (feature disabled)
  const moveLogEl = document.getElementById("moveLog");
  if (moveLogEl) {
    moveLogEl.style.display = "none";
  }

  // Set up event listeners
  setupEventListeners();

  // Handle responsive sizing
  setupResizeHandling();

  // Initial UI update and draw
  updateAllUI();
  drawBoard();

  // UI initialization complete
  return true;
}

/**
 * Setup responsive canvas resizing on window changes
 */
function setupResizeHandling() {
  try {
    const handler = debounce(() => {
      resizeCanvas();
    }, 100);
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    // Initial sync
    resizeCanvas();
  } catch (e) {
    // Non-error logging suppressed
  }
}

/**
 * Cache references to frequently accessed DOM elements
 * This improves performance by avoiding repeated document.getElementById calls
 */
function cacheDOMElements() {
  // Game status displays
  uiElements.currentPlayer = document.getElementById("currentPlayer");
  uiElements.gameScore = document.getElementById("gameScore");
  uiElements.aiStats = document.getElementById("aiStats");

  // Game controls
  uiElements.boardSizeSelector = document.getElementById("boardSize");
  uiElements.passButton = document.getElementById("pass");
  uiElements.resetButton = document.getElementById("reset");
  // History controls
  uiElements.resetHistoryButton = document.getElementById("resetHistory");

  // AI settings
  uiElements.algorithmRadios = document.querySelectorAll(
    'input[name="algorithm"]'
  );
  uiElements.depthSlider = document.getElementById("depth");
  uiElements.depthValue = document.getElementById("depthValue");
  uiElements.gameModeRadios = document.querySelectorAll(
    'input[name="gameMode"]'
  );

  // Log any missing elements for debugging
  for (const [key, element] of Object.entries(uiElements)) {
    if (!element || element.length === 0) {
      // Suppress warnings in console
    }
  }
}

/**
 * Set up all event listeners for user interface interactions
 * Centralizes event handling logic for easier maintenance
 */
function setupEventListeners() {
  // Canvas interactions for game moves
  if (canvas) {
    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseleave", handleCanvasMouseLeave);

    // Prevent context menu on right-click
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // Game control buttons
  if (uiElements.passButton) {
    uiElements.passButton.addEventListener("click", handlePassButtonClick);
  }

  if (uiElements.resetButton) {
    uiElements.resetButton.addEventListener("click", handleResetButtonClick);
  }

  // Reset game history
  if (uiElements.resetHistoryButton) {
    uiElements.resetHistoryButton.addEventListener(
      "click",
      handleResetHistoryClick
    );
  }

  // Board size selection
  if (uiElements.boardSizeSelector) {
    uiElements.boardSizeSelector.addEventListener(
      "change",
      handleBoardSizeChange
    );
  }

  // AI algorithm selection
  uiElements.algorithmRadios.forEach((radio) => {
    radio.addEventListener("change", handleAlgorithmChange);
  });

  // AI depth setting
  if (uiElements.depthSlider) {
    uiElements.depthSlider.addEventListener("input", handleDepthChange);
  }

  // Game mode selection
  uiElements.gameModeRadios.forEach((radio) => {
    radio.addEventListener("change", handleGameModeChange);
  });

  // Event listeners set up
}

// =============================================================================
// BOARD RENDERING AND VISUAL EFFECTS
// =============================================================================

/**
 * Main board drawing function
 * Renders the complete game board with all visual elements
 * This is called whenever the board needs to be redrawn
 */
function drawBoard() {
  if (!canvas || !ctx) {
    console.error("Canvas or context not available for drawing");
    return;
  }

  // Calculate layout dimensions
  const layout = calculateBoardLayout();

  // Clear and prepare canvas
  clearCanvas();

  // Draw background with wood grain effect
  drawBackground(layout);

  // Draw grid lines
  drawGrid(layout);

  // Draw star points (handicap markers)
  drawStarPoints(layout);

  // Draw all stones on the board
  drawStones(layout);

  // Draw hover preview if active
  if (hoverPreview.isVisible) {
    drawHoverPreview(layout);
  }
}

/**
 * Calculate board layout dimensions based on canvas size
 * Returns an object with all layout measurements
 *
 * @returns {Object} Layout configuration object
 */
function calculateBoardLayout() {
  const canvasSize = Math.min(canvas.width, canvas.height);
  const cellSize = canvasSize / (BOARD_SIZE + 1); // Add padding
  const margin = cellSize;
  const boardWidth = (BOARD_SIZE - 1) * cellSize;

  return {
    canvasSize,
    cellSize,
    margin,
    boardWidth,
    stoneRadius: Math.min(cellSize * 0.4, visualConfig.layout.stoneRadius),
  };
}

/**
 * Clear the entire canvas
 */
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw the wooden board background with grain texture
 *
 * @param {Object} layout - Layout configuration
 */
function drawBackground(layout) {
  // Create realistic wood grain gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

  visualConfig.boardColors.backgroundGradient.forEach(({ stop, color }) => {
    gradient.addColorStop(stop, color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add subtle wood grain texture
  ctx.globalAlpha = 0.1;

  // Vertical grain lines
  for (let i = 0; i < canvas.width; i += 20) {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(i, 0, 2, canvas.height);
  }

  // Horizontal grain lines
  for (let i = 0; i < canvas.height; i += 15) {
    ctx.fillStyle = "#A0522D";
    ctx.fillRect(0, i, canvas.width, 1);
  }

  ctx.globalAlpha = 1.0; // Reset opacity
}

/**
 * Draw the grid lines for the Go board
 *
 * @param {Object} layout - Layout configuration
 */
function drawGrid(layout) {
  ctx.strokeStyle = visualConfig.boardColors.gridLines;
  ctx.lineWidth = visualConfig.layout.gridLineWidth;
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 1;

  // Draw vertical and horizontal lines
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = layout.margin + i * layout.cellSize;

    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(pos, layout.margin);
    ctx.lineTo(pos, layout.margin + layout.boardWidth);
    ctx.stroke();

    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(layout.margin, pos);
    ctx.lineTo(layout.margin + layout.boardWidth, pos);
    ctx.stroke();
  }

  // Reset shadow for other elements
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

/**
 * Draw star points (handicap markers) on the board
 * Star point positions depend on board size
 *
 * @param {Object} layout - Layout configuration
 */
function drawStarPoints(layout) {
  ctx.fillStyle = visualConfig.boardColors.starPoints;

  const starPositions = getStarPointPositions();

  for (const [row, col] of starPositions) {
    const x = layout.margin + col * layout.cellSize;
    const y = layout.margin + row * layout.cellSize;

    ctx.beginPath();
    ctx.arc(x, y, visualConfig.layout.starPointRadius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * Get star point positions based on board size
 * Different board sizes have different standard star point patterns
 *
 * @returns {Array} Array of [row, col] positions for star points
 */
function getStarPointPositions() {
  const positions = [];

  if (BOARD_SIZE === 19) {
    // Standard 19x19 star points
    const points = [3, 9, 15];
    for (const row of points) {
      for (const col of points) {
        positions.push([row, col]);
      }
    }
  } else if (BOARD_SIZE === 13) {
    // Standard 13x13 star points
    const points = [3, 6, 9];
    for (const row of points) {
      for (const col of points) {
        positions.push([row, col]);
      }
    }
  } else if (BOARD_SIZE === 9) {
    // Standard 9x9 star points
    positions.push([2, 2], [2, 6], [4, 4], [6, 2], [6, 6]);
  } else if (BOARD_SIZE === 7) {
    // 7x7: use center star point
    const c = Math.floor(BOARD_SIZE / 2);
    positions.push([c, c]);
  } else if (BOARD_SIZE >= 11 && BOARD_SIZE % 2 === 1) {
    // Generic odd board sizes >= 11: similar pattern to 13/19
    const center = Math.floor(BOARD_SIZE / 2);
    const margin = 3;
    const inner = center;
    const outer = BOARD_SIZE - 1 - margin;
    const points = [margin, inner, outer];
    for (const row of points) {
      for (const col of points) {
        positions.push([row, col]);
      }
    }
  }

  return positions;
}

/**
 * Draw all stones currently on the board
 *
 * @param {Object} layout - Layout configuration
 */
function drawStones(layout) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const stone = game.board[row][col];
      if (stone !== EMPTY) {
        drawStone(layout, row, col, stone, false);
      }
    }
  }
}

/**
 * Draw a single stone at the specified position
 *
 * @param {Object} layout - Layout configuration
 * @param {number} row - Row position
 * @param {number} col - Column position
 * @param {number} stoneColor - BLACK or WHITE
 * @param {boolean} isPreview - Whether this is a hover preview
 */
function drawStone(layout, row, col, stoneColor, isPreview = false) {
  const x = layout.margin + col * layout.cellSize;
  const y = layout.margin + row * layout.cellSize;

  const config =
    stoneColor === BLACK
      ? visualConfig.stones.black
      : visualConfig.stones.white;

  // Set up stone appearance
  if (isPreview) {
    ctx.globalAlpha = visualConfig.stones.preview.opacity;
  }

  // Draw stone shadow
  ctx.shadowColor = config.shadowColor;
  ctx.shadowBlur = visualConfig.layout.shadowBlur;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Draw stone body
  ctx.fillStyle = config.fill;
  ctx.beginPath();
  ctx.arc(x, y, layout.stoneRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Draw stone border
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = config.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reset opacity
  if (isPreview) {
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Draw hover preview stone
 *
 * @param {Object} layout - Layout configuration
 */
function drawHoverPreview(layout) {
  if (hoverPreview.row >= 0 && hoverPreview.col >= 0) {
    // Determine which player's stone to preview
    const previewColor = game.currentPlayer;
    drawStone(layout, hoverPreview.row, hoverPreview.col, previewColor, true);
  }
}

// =============================================================================
// MOUSE EVENT HANDLING
// =============================================================================

/**
 * Handle mouse clicks on the game board
 * Converts screen coordinates to board coordinates and attempts to make a move
 *
 * @param {MouseEvent} event - Mouse click event
 */
function handleCanvasClick(event) {
  if (game.gameOver) {
    // Click ignored: game over
    return;
  }

  // Don't allow moves if it's AI's turn
  if (shouldAIMove()) {
    // Click ignored: AI's turn
    return;
  }

  const coordinates = getMouseBoardCoordinates(event);
  if (!coordinates) return;

  const { row, col } = coordinates;

  // Human attempts move

  // Use main coordinator so history, modal, and AI flow work correctly
  if (typeof coordinateGameTurn === "function") {
    coordinateGameTurn(row, col, game.currentPlayer).then((success) => {
      if (success) {
        hoverPreview.isVisible = false;
        updateAllUI();
        drawBoard();
      } else {
        // Illegal move attempted
      }
    });
  } else {
    // Fallback to direct makeMove
    const success = makeMove(row, col, game.currentPlayer);
    if (success) {
      hoverPreview.isVisible = false;
      updateAllUI();
      drawBoard();
    }
  }
}

/**
 * Handle mouse movement over the board for hover preview
 *
 * @param {MouseEvent} event - Mouse move event
 */
function handleCanvasMouseMove(event) {
  if (game.gameOver || shouldAIMove()) {
    // Hide preview if game over or AI's turn
    if (hoverPreview.isVisible) {
      hoverPreview.isVisible = false;
      drawBoard();
    }
    return;
  }

  const coordinates = getMouseBoardCoordinates(event);

  if (coordinates) {
    const { row, col } = coordinates;

    // Check if this is a new position
    if (hoverPreview.row !== row || hoverPreview.col !== col) {
      // Validate that this would be a legal move
      if (isLegalMove(game.board, row, col, game.currentPlayer)) {
        hoverPreview.row = row;
        hoverPreview.col = col;
        hoverPreview.isVisible = true;
        hoverPreview.player = game.currentPlayer;
        drawBoard(); // Redraw with preview
      } else {
        // Illegal move position - hide preview
        if (hoverPreview.isVisible) {
          hoverPreview.isVisible = false;
          drawBoard();
        }
      }
    }
  } else {
    // Mouse outside valid area
    if (hoverPreview.isVisible) {
      hoverPreview.isVisible = false;
      drawBoard();
    }
  }
}

/**
 * Handle mouse leaving the canvas area
 *
 * @param {MouseEvent} event - Mouse leave event
 */
function handleCanvasMouseLeave(event) {
  if (hoverPreview.isVisible) {
    hoverPreview.isVisible = false;
    drawBoard();
  }
}

/**
 * Convert mouse event coordinates to board grid coordinates
 *
 * @param {MouseEvent} event - Mouse event
 * @returns {Object|null} {row, col} coordinates or null if outside board
 */
function getMouseBoardCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  // Map from CSS pixels to canvas coordinate space
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const layout = calculateBoardLayout();

  // Convert to board coordinates
  const boardX = x - layout.margin;
  const boardY = y - layout.margin;

  // Find nearest intersection
  const col = Math.round(boardX / layout.cellSize);
  const row = Math.round(boardY / layout.cellSize);

  // Check if within board bounds
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return null;
  }

  // Check if close enough to intersection
  const exactX = col * layout.cellSize;
  const exactY = row * layout.cellSize;
  const distance = Math.sqrt((boardX - exactX) ** 2 + (boardY - exactY) ** 2);

  if (distance > visualConfig.layout.hoverTolerance) {
    return null;
  }

  return { row, col };
}

// =============================================================================
// UI STATUS UPDATES
// =============================================================================

/**
 * Update all UI elements to reflect current game state
 * This is the main function for keeping the UI in sync with the game
 */
function updateAllUI() {
  updatePlayerStatus();
  updateScoreDisplay();
  updateAIStatsDisplay();
  updateControlStates();
  // Move log disabled; do not render
  // Also refresh history sidebar widgets
  if (typeof updateHistorySidebar === "function") {
    updateHistorySidebar();
  }
}

/**
 * Update the current player status display
 * Shows whose turn it is and what type of player (Human/AI)
 */
function updatePlayerStatus() {
  if (!uiElements.currentPlayer) return;

  const playerName = game.currentPlayer === BLACK ? "Black" : "White";
  let statusText = "";
  let statusColor = "";

  if (game.gameOver) {
    statusText = "Game Over";
    statusColor = "#e74c3c"; // Red
  } else {
    // Determine player type based on game mode
    switch (aiSettings.gameMode) {
      case "humanVsAi":
        statusText =
          game.currentPlayer === BLACK
            ? `${playerName} (Human) to play`
            : `${playerName} (AI) to play`;
        break;
      case "humanVsHuman":
        statusText = `${playerName} (Human) to play`;
        break;
      default:
        statusText = `${playerName} to play`;
    }

    // Color coding for current player
    statusColor = game.currentPlayer === BLACK ? "#27ae60" : "#3498db";
  }

  uiElements.currentPlayer.textContent = statusText;
  uiElements.currentPlayer.style.color = statusColor;
}

/**
 * Update the score display
 * Shows current stone count and captured stones for each player
 */
function updateScoreDisplay() {
  if (!uiElements.gameScore) return;

  // Count stones on board
  const blackStones = game.board.flat().filter((cell) => cell === BLACK).length;
  const whiteStones = game.board.flat().filter((cell) => cell === WHITE).length;

  // Calculate total scores including captures
  const blackTotal = blackStones + game.captured[BLACK];
  const whiteTotal = whiteStones + game.captured[WHITE];

  uiElements.gameScore.textContent = `Black: ${blackTotal} | White: ${whiteTotal}`;

  // Add capture information if any captures have occurred
  if (game.captured[BLACK] > 0 || game.captured[WHITE] > 0) {
    uiElements.gameScore.title =
      `Black: ${blackStones} stones + ${game.captured[BLACK]} captured\n` +
      `White: ${whiteStones} stones + ${game.captured[WHITE]} captured`;
  } else {
    uiElements.gameScore.title = "";
  }
}

// Move log functionality removed as not used

/**
 * Update AI performance statistics display
 * Shows algorithm info, nodes evaluated, time taken, etc.
 */
function updateAIStatsDisplay() {
  if (!uiElements.aiStats) return;

  const stats = getAIStats();

  const algorithmName =
    aiSettings.algorithm === "minimax" ? "Minimax" : "Alpha-Beta";

  const hasStats = stats.nodesEvaluated > 0 && stats.timeUsed > 0;

  uiElements.aiStats.innerHTML = `
    <div class="stat-row">
      <span class="stat-label">Algorithm:</span>
      <span class="stat-value">${algorithmName}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Nodes:</span>
      <span class="stat-value">${
        hasStats ? stats.nodesEvaluated.toLocaleString() : "-"
      }</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Time:</span>
      <span class="stat-value">${
        hasStats ? stats.timeUsed.toFixed(1) + "ms" : "-"
      }</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Rate:</span>
      <span class="stat-value">${
        hasStats ? stats.nodesPerSecond.toLocaleString() + "/s" : "-"
      }</span>
    </div>
  `;
}

/**
 * Update control button states based on game state
 * Enable/disable buttons as appropriate
 */
function updateControlStates() {
  // Pass button - enabled only during human player's turn
  if (uiElements.passButton) {
    uiElements.passButton.disabled = game.gameOver || shouldAIMove();
  }

  // Reset button - always enabled
  if (uiElements.resetButton) {
    uiElements.resetButton.disabled = false;
  }

  // Board size selector - disabled during active game
  if (uiElements.boardSizeSelector) {
    const gameInProgress =
      !game.gameOver &&
      game.board.some((row) => row.some((cell) => cell !== EMPTY));
    // Keep selector value in sync with BOARD_SIZE
    const current = String(BOARD_SIZE);
    if (uiElements.boardSizeSelector.value !== current) {
      uiElements.boardSizeSelector.value = current;
    }
    uiElements.boardSizeSelector.disabled = gameInProgress;
  }
}

/**
 * Handle reset history button click
 */
function handleResetHistoryClick() {
  try {
    // Confirm without using window.confirm; use a lightweight toast flow
    // Optionally, this can be replaced by a custom modal for better UX
    const confirmed = true; // fallback to immediate confirm to avoid blocking dialogs
    if (typeof clearGameHistory === "function") {
      const ok = clearGameHistory(confirmed);
      if (ok) {
        showUserMessage("Game history cleared.", "success", 2000);
        // refresh history widgets
        if (typeof updateHistorySidebar === "function") {
          updateHistorySidebar();
        }
        updateAllUI();
      } else {
        showUserMessage("History reset canceled.", "info", 2000);
      }
    }
  } catch (e) {
    // Show an error toast on failure
    showUserMessage("Failed to clear game history.", "error");
  }
}

// =============================================================================
// EVENT HANDLER FUNCTIONS
// =============================================================================

/**
 * Handle pass button click
 */
function handlePassButtonClick() {
  if (!game.gameOver && !shouldAIMove()) {
    // Human passes
    if (typeof coordinatePassMove === "function") {
      coordinatePassMove(game.currentPlayer).then(() => {
        updateAllUI();
        drawBoard();
      });
    } else {
      passMove();
      updateAllUI();
      drawBoard();
    }
  }
}

/**
 * Handle reset button click
 */
function handleResetButtonClick() {
  // Game reset requested
  if (typeof startNewGame === "function") {
    startNewGame();
  } else {
    resetGame();
    updateAllUI();
    drawBoard();
    if (shouldAIMove()) {
      setTimeout(() => {
        makeAIMove().then(() => {
          updateAllUI();
          drawBoard();
        });
      }, 500);
    }
  }
}

/**
 * Handle board size change
 *
 * @param {Event} event - Change event
 */
function handleBoardSizeChange(event) {
  const newSize = parseInt(event.target.value);
  // Board size changed
  // Route through centralized settings so preferences persist
  if (typeof updateGameSettings === "function") {
    updateGameSettings({ boardSize: newSize });
  } else {
    BOARD_SIZE = newSize;
    if (typeof startNewGame === "function") {
      startNewGame();
    } else {
      resetGame();
      if (typeof resetAIStats === "function") resetAIStats();
      updateAllUI();
      drawBoard();
    }
  }
}

/**
 * Handle AI algorithm change
 *
 * @param {Event} event - Change event
 */
function handleAlgorithmChange(event) {
  const algorithm = event.target.value;
  // AI algorithm changed
  setAIAlgorithm(algorithm);
  // Refresh UI so performance panel reflects new algorithm immediately
  updateAllUI();
}

/**
 * Handle AI depth change
 *
 * @param {Event} event - Input event
 */
function handleDepthChange(event) {
  const depth = parseInt(event.target.value);
  setAIDepth(depth);

  if (uiElements.depthValue) {
    uiElements.depthValue.textContent = depth;
  }

  // AI search depth changed
  updateAllUI();
}

/**
 * Handle game mode change
 *
 * @param {Event} event - Change event
 */
function handleGameModeChange(event) {
  const oldMode = aiSettings.gameMode;
  const newMode = event.target.value;

  // Game mode changed

  setGameMode(newMode);

  // Reset game when mode changes
  resetGame();
  updateAllUI();
  drawBoard();

  // Show user feedback
  const modeNames = {
    humanVsAi: "Human vs AI",
    humanVsHuman: "Human vs Human",
  };

  // New game started

  // If AI should start, trigger AI move
  if (shouldAIMove()) {
    setTimeout(() => {
      makeAIMove().then(() => {
        updateAllUI();
        drawBoard();
      });
    }, 500);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Show a temporary message to the user
 *
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'info', 'success', 'warning', 'error'
 * @param {number} duration - How long to show (milliseconds)
 */
function showUserMessage(message, type = "info", duration = 3000) {
  // Implement non-blocking toast notifications (no native alerts)
  try {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.style.cssText = `
        position: fixed; right: 16px; bottom: 16px; z-index: 10000;
        display: flex; flex-direction: column; gap: 10px; pointer-events: none;`;
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    const bg =
      {
        info: "#2d6cdf",
        success: "#2ecc71",
        warning: "#f39c12",
        error: "#e74c3c",
      }[type] || "#2d6cdf";

    toast.style.cssText = `
      background: ${bg}; color: #fff; padding: 10px 14px; border-radius: 6px;
      box-shadow: 0 6px 20px rgba(0,0,0,.25); max-width: 340px; font-size: 14px;
      opacity: 0; transform: translateY(10px); transition: all .2s ease; pointer-events: auto;`;
    toast.textContent = message.replace(/\s+/g, " ").trim();
    toastContainer.appendChild(toast);

    // animate in
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    // auto remove
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 200);
    }, Math.max(1500, duration));
  } catch (e) {
    // Suppress non-error console output
  }
}

/**
 * Resize canvas to fit container
 * Call this if the layout changes or window is resized
 */
function resizeCanvas() {
  if (!canvas) return;

  // Get container size
  const container = canvas.parentElement;
  if (!container) return;

  // Use bounding rect to handle cases where clientHeight is 0
  const rect = container.getBoundingClientRect();
  const cw = Math.max(0, Math.floor(rect.width || container.clientWidth || 0));
  let ch = Math.max(0, Math.floor(rect.height || container.clientHeight || 0));
  if (!ch) ch = cw; // fallback to square using width if height is not measurable

  const size = Math.min(cw || 0, ch || 0, 500) || cw || 400;

  canvas.width = size;
  canvas.height = size;

  // Redraw after resize
  drawBoard();
}

/**
 * Update the left sidebar history summary values
 */
function updateHistorySidebar() {
  try {
    const card = document.querySelector("#gameHistoryStats");
    if (!card) return;

    const stats =
      typeof getGameStatistics === "function" ? getGameStatistics() : null;
    if (!stats) return;

    const hvai = stats.humanVsAI;
    const hvh = stats.humanVsHuman;
    const last = gameHistory.lastGameResult;
    const lastText = last
      ? `Winner: ${(last.winner || "").toString().toUpperCase()} (${
          last.gameMode === "humanVsAi" ? "vs AI" : "vs Human"
        })`
      : "-";

    const gamesRow = `
      <div class="history-item"><span class="title">Games Played</span><span class="meta">${stats.overview.totalGames}</span></div>
    `;
    const vsAiRow = `
        <div class="history-item"><span class="title">Vs AI</span><span class="meta">Human ${
          hvai.humanWins
        } | AI ${hvai.aiWins}${
      hvai.draws ? ` | Draw ${hvai.draws}` : ""
    }</span></div>
      `;
    const vsHumanRow =
      hvh.blackWins || hvh.whiteWins || hvh.draws
        ? `
        <div class="history-item"><span class="title">Vs Human</span><span class="meta">B ${
          hvh.blackWins
        } | W ${hvh.whiteWins}${
            hvh.draws ? ` | Draw ${hvh.draws}` : ""
          }</span></div>
      `
        : "";
    const lastRow = `
      <div class="history-item"><span class="title">Last</span><span class="meta">${lastText}</span></div>
    `;

    card.innerHTML = `<div class=\"history-list\">${gamesRow}${vsAiRow}${vsHumanRow}${lastRow}</div>`;
  } catch (e) {
    // Suppress non-error console output
  }
}

// =============================================================================
// RESULT MODAL POPUP
// =============================================================================

function showGameResultModal(gameResult, gameStats) {
  return new Promise((resolve) => {
    try {
      // Remove any existing modal
      if (resultModalOverlay) {
        resultModalOverlay.remove();
        resultModalOverlay = null;
      }

      resultModalOverlay = document.createElement("div");
      resultModalOverlay.id = "resultModalOverlay";
      resultModalOverlay.className = "modal-overlay";

      const panel = document.createElement("div");
      panel.className = "modal-panel";

      // Determine winner details
      const winner = gameResult.winner; // "Black" | "White" | "Tie"
      const blackScore = gameResult.blackScore;
      const whiteScore = gameResult.whiteScore;

      let winnerType = ""; // Human or AI or Both
      if (winner !== "Tie") {
        if (aiSettings.gameMode === "humanVsAi") {
          winnerType = winner === "Black" ? "Human" : "AI";
        } else {
          winnerType = "Human"; // human vs human
        }
      } else {
        winnerType = aiSettings.gameMode === "humanVsHuman" ? "Draw" : "Draw";
      }

      const header = document.createElement("div");
      header.className = "modal-header";
      const title = document.createElement("h3");
      title.textContent = winner === "Tie" ? "Game Tied" : `${winner} Wins!`;
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Cancel";
      closeBtn.className = "btn btn-ghost";
      closeBtn.onclick = () => {
        resultModalOverlay.remove();
        resultModalOverlay = null;
        resolve();
      };
      header.appendChild(title);
      header.appendChild(closeBtn);

      const body = document.createElement("div");
      body.className = "modal-body";

      const badgeColor =
        winner === "Black"
          ? "badge badge--black"
          : winner === "White"
          ? "badge badge--white"
          : "badge badge--draw";
      const whoBadge =
        winner === "Tie"
          ? "badge badge--draw"
          : winnerType === "AI"
          ? "badge badge--ai"
          : "badge badge--human";

      const detailHTML = `
        <div class="history-list">
          <div class="history-item"><span class="title">Mode</span><span class="meta">${
            aiSettings.gameMode
          }</span></div>
          <div class="history-item"><span class="title">Winner</span><span class="meta"><span class="${badgeColor}">${winner}</span> ${
        winner !== "Tie"
          ? `&nbsp;<span class="${whoBadge}">${winnerType}</span>`
          : ""
      }</span></div>
          <div class="history-item"><span class="title">Final Score</span><span class="meta">Black: ${blackScore} • White: ${whiteScore}</span></div>
          <div class="history-item"><span class="title">Captured</span><span class="meta">Black: ${
            game.captured[BLACK]
          } • White: ${game.captured[WHITE]}</span></div>
          <div class="history-item"><span class="title">Summary</span><span class="meta">Moves: ${
            gameStats.totalMoves
          } • Duration: ${formatDuration(gameStats.duration)}</span></div>
        </div>
      `;
      body.innerHTML = detailHTML;

      const footer = document.createElement("div");
      footer.className = "modal-footer";
      const okBtn = document.createElement("button");
      okBtn.textContent = "Start New Game";
      okBtn.className = "btn btn-primary";
      okBtn.onclick = () => {
        if (resultModalOverlay) {
          resultModalOverlay.remove();
          resultModalOverlay = null;
        }
        resolve();
      };
      footer.appendChild(okBtn);

      panel.appendChild(header);
      panel.appendChild(body);
      panel.appendChild(footer);
      resultModalOverlay.appendChild(panel);
      document.body.appendChild(resultModalOverlay);

      // Keep modal open until user clicks OK or close (no auto close)
    } catch (e) {
      // Suppress non-error console output
      resolve();
    }
  });
}

// Expose for other modules
window.showGameResultModal = showGameResultModal;

// =============================================================================
// EXPORT FUNCTIONS FOR OTHER MODULES
// =============================================================================

// These functions will be available to other modules

// =============================================================================
// WELCOME MODAL POPUP
// =============================================================================

function showWelcomeModal() {
  return new Promise((resolve) => {
    try {
      // Clean up any existing welcome modal
      if (welcomeModalOverlay) {
        welcomeModalOverlay.remove();
        welcomeModalOverlay = null;
      }

      welcomeModalOverlay = document.createElement("div");
      welcomeModalOverlay.id = "welcomeModalOverlay";
      welcomeModalOverlay.className = "modal-overlay";

      const panel = document.createElement("div");
      panel.className = "modal-panel";

      // Header
      const header = document.createElement("div");
      header.className = "modal-header";
      const title = document.createElement("h3");
      title.textContent = "Welcome to Go Game!";
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.className = "btn btn-ghost";
      closeBtn.onclick = () => {
        if (welcomeModalOverlay) {
          welcomeModalOverlay.remove();
          welcomeModalOverlay = null;
        }
        resolve();
      };
      header.appendChild(title);
      header.appendChild(closeBtn);

      // Body
      const body = document.createElement("div");
      body.className = "modal-body";
      body.innerHTML = `
        <div class="tips" style="font-size: 0.9rem; color: #374151;">
          <p>This is an implementation of the ancient board game Go with AI opponents.</p>
          <p>You can play against AI using either Minimax or Alpha-Beta pruning algorithms.</p>
          <p>Click on board intersections to place stones. Capture opponent stones by surrounding them!</p>
          <p style="margin-top:8px; color:#6b7280;">Tip: Two consecutive passes end the game. Use the left sidebar to change board size and AI difficulty.</p>
        </div>
      `;

      // Footer
      const footer = document.createElement("div");
      footer.className = "modal-footer";
      const startBtn = document.createElement("button");
      startBtn.textContent = "Start Playing";
      startBtn.className = "btn btn-primary";
      startBtn.onclick = () => {
        if (welcomeModalOverlay) {
          welcomeModalOverlay.remove();
          welcomeModalOverlay = null;
        }
        resolve();
      };
      footer.appendChild(startBtn);

      panel.appendChild(header);
      panel.appendChild(body);
      panel.appendChild(footer);
      welcomeModalOverlay.appendChild(panel);
      document.body.appendChild(welcomeModalOverlay);
    } catch (e) {
      // Fail open without blocking
      resolve();
    }
  });
}

// Expose for main.js
window.showWelcomeModal = showWelcomeModal;

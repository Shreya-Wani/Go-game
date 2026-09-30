/**
 * =============================================================================
 * UTILITY FUNCTIONS MODULE - Helper Functions and Common Operations
 * =============================================================================
 *
 * This module contains utility functions that are used across the application:
 * - Data manipulation and validation helpers
 * - Mathematical and geometric calculations
 * - Array and object manipulation utilities
 * - Performance monitoring tools
 * - Debugging and logging helpers
 * - Common game-related calculations
 *
 * These utilities help keep the main modules clean and focused on their
 * primary responsibilities while providing reusable functionality.
 */

// =============================================================================
// ARRAY AND DATA MANIPULATION UTILITIES
// =============================================================================

/**
 * Create a deep copy of a nested array or object
 * Useful for creating independent copies of game state
 *
 * @param {*} obj - Object or array to deep copy
 * @returns {*} Deep copy of the input
 */
function deepCopy(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepCopy(item));
  }

  if (typeof obj === "object") {
    const copy = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = deepCopy(obj[key]);
      }
    }
    return copy;
  }

  return obj;
}

/**
 * Check if two arrays are equal (shallow comparison)
 * Useful for comparing coordinates and move lists
 *
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {boolean} True if arrays are equal
 */
function arraysEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    return false;
  }

  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * Useful for randomizing move order in AI algorithms
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Remove duplicates from an array
 * Useful for cleaning up coordinate lists
 *
 * @param {Array} array - Array with potential duplicates
 * @param {Function} keyFunction - Optional function to generate comparison key
 * @returns {Array} Array with duplicates removed
 */
function removeDuplicates(array, keyFunction = null) {
  if (!keyFunction) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter((item) => {
    const key = keyFunction(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Chunk an array into smaller arrays of specified size
 * Useful for processing large datasets in batches
 *
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// =============================================================================
// MATHEMATICAL AND GEOMETRIC UTILITIES
// =============================================================================

/**
 * Calculate Euclidean distance between two points
 * Useful for determining proximity and spatial relationships
 *
 * @param {number} x1 - X coordinate of first point
 * @param {number} y1 - Y coordinate of first point
 * @param {number} x2 - X coordinate of second point
 * @param {number} y2 - Y coordinate of second point
 * @returns {number} Distance between the points
 */
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Manhattan distance between two points
 * Useful for grid-based movement calculations
 *
 * @param {number} x1 - X coordinate of first point
 * @param {number} y1 - Y coordinate of first point
 * @param {number} x2 - X coordinate of second point
 * @param {number} y2 - Y coordinate of second point
 * @returns {number} Manhattan distance
 */
function calculateManhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Clamp a value between minimum and maximum bounds
 * Ensures values stay within valid ranges
 *
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * Useful for animations and gradual transitions
 *
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(start, end, t) {
  return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Convert degrees to radians
 *
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 *
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Generate a random integer between min and max (inclusive)
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer in range
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float in range
 */
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// =============================================================================
// STRING AND FORMATTING UTILITIES
// =============================================================================

/**
 * Format a number with thousands separators
 * Makes large numbers more readable
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Format time duration in milliseconds to human-readable string
 *
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(1)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Capitalize the first letter of a string
 *
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to kebab-case
 *
 * @param {string} str - camelCase string
 * @returns {string} kebab-case string
 */
function camelToKebab(str) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 *
 * @param {string} str - kebab-case string
 * @returns {string} camelCase string
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

// =============================================================================
// PERFORMANCE MONITORING UTILITIES
// =============================================================================

/**
 * Simple performance timer for measuring execution time
 */
class PerformanceTimer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start timing
   */
  start() {
    this.startTime = performance.now();
    this.endTime = null;
  }

  /**
   * Stop timing and return elapsed time
   *
   * @returns {number} Elapsed time in milliseconds
   */
  stop() {
    this.endTime = performance.now();
    return this.getElapsed();
  }

  /**
   * Get elapsed time without stopping
   *
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsed() {
    if (this.startTime === null) return 0;
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }

  /**
   * Reset the timer
   */
  reset() {
    this.startTime = null;
    this.endTime = null;
  }
}

/**
 * Create a debounced version of a function
 * Prevents function from being called too frequently
 *
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Create a throttled version of a function
 * Limits function execution to at most once per interval
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// =============================================================================
// VALIDATION AND TYPE CHECKING UTILITIES
// =============================================================================

/**
 * Check if a value is a valid number
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a valid number
 */
function isValidNumber(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

/**
 * Check if a value is a valid integer
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a valid integer
 */
function isValidInteger(value) {
  return isValidNumber(value) && Number.isInteger(value);
}

/**
 * Check if coordinates are within board bounds
 *
 * @param {number} row - Row coordinate
 * @param {number} col - Column coordinate
 * @param {number} boardSize - Size of the board
 * @returns {boolean} True if coordinates are valid
 */
function isValidCoordinate(row, col, boardSize = BOARD_SIZE) {
  return (
    isValidInteger(row) &&
    isValidInteger(col) &&
    row >= 0 &&
    row < boardSize &&
    col >= 0 &&
    col < boardSize
  );
}

/**
 * Validate an array of coordinates
 *
 * @param {Array} coordinates - Array of [row, col] pairs
 * @param {number} boardSize - Size of the board
 * @returns {boolean} True if all coordinates are valid
 */
function validateCoordinates(coordinates, boardSize = BOARD_SIZE) {
  if (!Array.isArray(coordinates)) return false;

  return coordinates.every((coord) => {
    if (!Array.isArray(coord) || coord.length !== 2) return false;
    const [row, col] = coord;
    return isValidCoordinate(row, col, boardSize);
  });
}

/**
 * Sanitize user input to prevent XSS attacks
 *
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== "string") return "";

  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

// =============================================================================
// LOCAL STORAGE UTILITIES
// =============================================================================

/**
 * Safely save data to localStorage with error handling
 *
 * @param {string} key - Storage key
 * @param {*} data - Data to store
 * @returns {boolean} True if successful
 */
function saveToLocalStorage(key, data) {
  try {
    const jsonString = JSON.stringify(data);
    localStorage.setItem(key, jsonString);
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Safely load data from localStorage with error handling
 *
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if loading fails
 * @returns {*} Loaded data or default value
 */
function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const jsonString = localStorage.getItem(key);
    if (jsonString === null) return defaultValue;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`Failed to load from localStorage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Remove data from localStorage with error handling
 *
 * @param {string} key - Storage key
 * @returns {boolean} True if successful
 */
function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove from localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Check if localStorage is available
 *
 * @returns {boolean} True if localStorage is available
 */
function isLocalStorageAvailable() {
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

// =============================================================================
// GAME-SPECIFIC UTILITIES
// =============================================================================

/**
 * Convert player number to readable name
 *
 * @param {number} player - Player constant (BLACK or WHITE)
 * @returns {string} Player name
 */
function getPlayerName(player) {
  switch (player) {
    case BLACK:
      return "Black";
    case WHITE:
      return "White";
    case EMPTY:
      return "Empty";
    default:
      return "Unknown";
  }
}

/**
 * Get the opposite player color
 *
 * @param {number} player - Current player (BLACK or WHITE)
 * @returns {number} Opposite player
 */
function getOpponent(player) {
  if (player === BLACK) return WHITE;
  if (player === WHITE) return BLACK;
  return EMPTY; // Invalid input
}

/**
 * Convert board coordinates to algebraic notation
 * Similar to chess notation (e.g., "A1", "B2")
 *
 * @param {number} row - Row coordinate (0-based)
 * @param {number} col - Column coordinate (0-based)
 * @returns {string} Algebraic notation
 */
function coordinatesToAlgebraic(row, col) {
  if (!isValidCoordinate(row, col)) return "??";

  const colLetter = String.fromCharCode(65 + col); // A, B, C, ...
  const rowNumber = row + 1; // 1-based numbering
  return colLetter + rowNumber;
}

/**
 * Convert algebraic notation to board coordinates
 *
 * @param {string} algebraic - Algebraic notation (e.g., "A1")
 * @returns {Array|null} [row, col] coordinates or null if invalid
 */
function algebraicToCoordinates(algebraic) {
  if (typeof algebraic !== "string" || algebraic.length < 2) return null;

  const colLetter = algebraic.charAt(0).toUpperCase();
  const rowNumber = parseInt(algebraic.slice(1));

  const col = colLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, ...
  const row = rowNumber - 1; // Convert to 0-based

  if (isValidCoordinate(row, col)) {
    return [row, col];
  }

  return null;
}

/**
 * Calculate the center coordinates of the board
 *
 * @param {number} boardSize - Size of the board
 * @returns {Array} [row, col] coordinates of center
 */
function getBoardCenter(boardSize = BOARD_SIZE) {
  const center = Math.floor(boardSize / 2);
  return [center, center];
}

/**
 * Get all corner coordinates of the board
 *
 * @param {number} boardSize - Size of the board
 * @returns {Array} Array of [row, col] corner coordinates
 */
function getBoardCorners(boardSize = BOARD_SIZE) {
  const max = boardSize - 1;
  return [
    [0, 0], // Top-left
    [0, max], // Top-right
    [max, 0], // Bottom-left
    [max, max], // Bottom-right
  ];
}

/**
 * Check if a coordinate is on the edge of the board
 *
 * @param {number} row - Row coordinate
 * @param {number} col - Column coordinate
 * @param {number} boardSize - Size of the board
 * @returns {boolean} True if coordinate is on edge
 */
function isEdgeCoordinate(row, col, boardSize = BOARD_SIZE) {
  if (!isValidCoordinate(row, col, boardSize)) return false;

  return (
    row === 0 || row === boardSize - 1 || col === 0 || col === boardSize - 1
  );
}

/**
 * Check if a coordinate is in a corner of the board
 *
 * @param {number} row - Row coordinate
 * @param {number} col - Column coordinate
 * @param {number} boardSize - Size of the board
 * @returns {boolean} True if coordinate is in corner
 */
function isCornerCoordinate(row, col, boardSize = BOARD_SIZE) {
  if (!isValidCoordinate(row, col, boardSize)) return false;

  const max = boardSize - 1;
  return (row === 0 || row === max) && (col === 0 || col === max);
}

// =============================================================================
// ERROR HANDLING AND LOGGING UTILITIES
// =============================================================================

/**
 * Enhanced console logging with timestamps and levels
 */
const Logger = {
  /**
   * Log debug information
   *
   * @param {...*} args - Arguments to log
   */
  debug(...args) {
    // Suppressed: no console output for debug
    return;
  },

  /**
   * Log informational messages
   *
   * @param {...*} args - Arguments to log
   */
  info(...args) {
    // Suppressed: no console output for info
    return;
  },

  /**
   * Log warnings
   *
   * @param {...*} args - Arguments to log
   */
  warn(...args) {
    // Suppressed: no console output for warnings
    return;
  },

  /**
   * Log errors
   *
   * @param {...*} args - Arguments to log
   */
  error(...args) {
    console.error(`[${new Date().toISOString()}] ERROR:`, ...args);
  },
};

/**
 * Create a safe wrapper for potentially throwing functions
 *
 * @param {Function} func - Function to wrap
 * @param {*} defaultValue - Value to return on error
 * @param {string} context - Context description for error logging
 * @returns {Function} Wrapped function
 */
function createSafeWrapper(func, defaultValue = null, context = "function") {
  return function (...args) {
    try {
      return func.apply(this, args);
    } catch (error) {
      Logger.error(`Error in ${context}:`, error);
      return defaultValue;
    }
  };
}

// =============================================================================
// EXPORT UTILITIES FOR OTHER MODULES
// =============================================================================

// All utility functions are ready to be used by other modules

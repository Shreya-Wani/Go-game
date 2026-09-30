"""
Configuration settings for the Go game.

This module contains all game constants, default values, and configuration
parameters that control the behavior and appearance of the Go game application.
"""

from typing import List

# =============================================================================
# GAME CONSTANTS
# =============================================================================

# Board state constants
EMPTY: int = 0
BLACK: int = 1
WHITE: int = 2

# =============================================================================
# GAME SETTINGS
# =============================================================================

# Board configuration
DEFAULT_BOARD_SIZE: int = 9
SUPPORTED_BOARD_SIZES: List[int] = [5, 9, 13, 19]

# AI configuration
DEFAULT_AI_DEPTH: int = 3
MIN_AI_DEPTH: int = 1
MAX_AI_DEPTH: int = 5

# =============================================================================
# GUI APPEARANCE SETTINGS
# =============================================================================

# Window appearance
DEFAULT_APPEARANCE_MODE: str = "dark"
DEFAULT_COLOR_THEME: str = "dark-blue"

# Window dimensions
MIN_WINDOW_WIDTH: int = 1000
MIN_WINDOW_HEIGHT: int = 700
DEFAULT_WINDOW_WIDTH: int = 1200
DEFAULT_WINDOW_HEIGHT: int = 800

# Control panel sizing
CONTROL_PANEL_MIN_WIDTH: int = 320
CONTROL_PANEL_MAX_WIDTH: int = 400

# =============================================================================
# VISUAL STYLING
# =============================================================================

# Board colors
CANVAS_BACKGROUND: str = "#EECFA1"  # Light tan background
BOARD_BACKGROUND: str = "#E6CBA8"   # Slightly darker board surface
GRID_COLOR: str = "#5A3E1B"         # Dark brown grid lines
STAR_POINT_COLOR: str = "#5A3E1B"   # Star point markers
HIGHLIGHT_COLOR: str = "#ff3333"    # Red highlight for last move

# Stone appearance
BLACK_STONE_COLOR: str = "black"
WHITE_STONE_COLOR: str = "white"
STONE_OUTLINE_COLOR: str = "#333"   # Dark gray outline

# Interactive elements
HOVER_STONE_ALPHA: float = 0.5      # Transparency for move preview
POSSIBLE_MOVE_COLOR: str = "#FFD700"  # Gold for valid moves
INVALID_MOVE_COLOR: str = "#FF6B6B"   # Red for invalid moves

# =============================================================================
# PERFORMANCE & TIMING SETTINGS
# =============================================================================

# Animation delays (in milliseconds)
AI_MOVE_DELAY_MS: int = 50          # UI update frequency during AI thinking
AI_VS_AI_DELAY_MS: int = 1          # Delay between AI vs AI moves
STATUS_UPDATE_DELAY_MS: int = 500   # Status bar update frequency

# AI performance optimization
AI_VS_AI_DEPTH: int = 1             # Reduced depth for fast AI vs AI games
AI_TIME_LIMIT_SECONDS: float = 0.1  # Time limit per AI move
AI_MOVE_CACHE_SIZE: int = 100       # Number of positions to cache
MAX_MOVES_TO_CONSIDER: int = 3      # Limit moves considered per position
EARLY_MOVE_LIMIT: int = 10          # Focus on fewer moves in opening

# =============================================================================
# AI EVALUATION WEIGHTS
# =============================================================================

# These weights determine how the AI evaluates positions
TERRITORY_WEIGHT: float = 0.3       # Importance of controlling territory
CAPTURE_WEIGHT: float = 1.0         # Importance of capturing stones
CENTER_PREFERENCE_WEIGHT: float = 0.5  # Preference for center positions

# =============================================================================
# GAME RULES CONFIGURATION
# =============================================================================

# Rule variations
ENABLE_SUPERKO: bool = False        # Simplified version doesn't use superko
KOMI: float = 0.5                   # Compensation points for white player
ENABLE_TERRITORY_SCORING: bool = True  # Enable automatic territory calculation

# Visual feedback options
SHOW_MOVE_HINTS: bool = False       # Show possible moves (disabled for performance)

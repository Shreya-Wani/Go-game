"""
Board visualization and rendering components for the Go GUI.

This module provides classes for rendering the Go board, stones, and game
information display. It handles all visual aspects of the game including
board drawing, stone placement visualization, move hints, and game statistics.
"""

import math
from typing import Tuple, Optional, Dict, Any, List

import customtkinter as ctk

from ..config import (
    CANVAS_BACKGROUND, BOARD_BACKGROUND, GRID_COLOR, 
    STAR_POINT_COLOR, HIGHLIGHT_COLOR, 
    BLACK_STONE_COLOR, WHITE_STONE_COLOR, STONE_OUTLINE_COLOR,
    BLACK, WHITE, EMPTY,
    HOVER_STONE_ALPHA, POSSIBLE_MOVE_COLOR, INVALID_MOVE_COLOR
)
from ..core.board import Board


class BoardRenderer:
    """
    Handles rendering of the Go board and all visual elements on a canvas.
    
    This class manages:
    - Board grid and background rendering
    - Stone placement visualization
    - Move hints and hover effects
    - Last move highlighting
    - Coordinate system and geometry calculations
    """
    
    def __init__(self, canvas: ctk.CTkCanvas) -> None:
        """
        Initialize the board renderer with a canvas widget.
        
        Args:
            canvas: Canvas widget where the board will be drawn
        """
        self.canvas: ctk.CTkCanvas = canvas
        self.geometry: Dict[str, Any] = {}
        
        # Visual state
        self.hover_position: Optional[Tuple[int, int]] = None
        self.hover_player: Optional[int] = None
        self.possible_moves: List[Tuple[int, int]] = []
        self.show_hints: bool = True
        
    def render_board(self, board: Board) -> None:
        """
        Render the complete board state including all visual elements.
        
        This method clears the canvas and redraws everything from scratch,
        including the board background, grid, stones, and visual indicators.
        
        Args:
            board: Board state to render
        """
        # Clear canvas and recalculate layout
        self.canvas.delete("all")
        self._calculate_geometry(board.size)
        
        # Draw board elements in proper order
        self._draw_board_background()
        self._draw_grid_lines(board.size)
        self._draw_star_points(board.size)
        
        # Draw game elements
        if self.show_hints:
            self._draw_possible_moves(board)
        self._draw_stones(board)
        self._draw_hover_stone(board)
        self._highlight_last_move(board)
    
    def _calculate_geometry(self, board_size: int) -> None:
        """
        Calculate rendering geometry based on current canvas size.
        
        This method determines the optimal layout for the board to fit
        within the available canvas space while maintaining proper proportions.
        
        Args:
            board_size: Number of lines on the board (e.g., 9, 13, 19)
        """
        # Get current canvas dimensions
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        # Use smaller dimension to ensure square board fits
        available_size = min(canvas_width, canvas_height)
        margin = max(20, int(available_size * 0.06))  # 6% margin
        board_area = available_size - (2 * margin)
        
        # Calculate cell size (distance between grid intersections)
        if board_size > 1:
            cell_size = board_area // (board_size - 1)
            actual_board_size = cell_size * (board_size - 1)
        else:
            cell_size = board_area
            actual_board_size = cell_size
        
        # Center the board in the canvas
        origin_x = (canvas_width - actual_board_size) // 2
        origin_y = (canvas_height - actual_board_size) // 2
        
        # Store geometry for use by other methods
        self.geometry = {
            'origin_x': origin_x,
            'origin_y': origin_y,
            'cell_size': cell_size,
            'board_size_px': actual_board_size,
            'stone_radius': max(6, int(cell_size * 0.4))  # Stones are 40% of cell size
        }
    
    def _draw_board_background(self) -> None:
        """Draw the board background."""
        if not self.geometry:
            return
            
        margin = 8
        x1 = self.geometry['origin_x'] - margin
        y1 = self.geometry['origin_y'] - margin
        x2 = x1 + self.geometry['board_size_px'] + 2 * margin
        y2 = y1 + self.geometry['board_size_px'] + 2 * margin
        
        self.canvas.create_rectangle(
            x1, y1, x2, y2,
            fill=BOARD_BACKGROUND,
            outline=""
        )
    
    def _draw_grid_lines(self, board_size: int) -> None:
        """Draw the grid lines."""
        if not self.geometry:
            return
            
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        
        # Horizontal lines
        for i in range(board_size):
            y = origin_y + i * cell_size
            x1 = origin_x
            x2 = origin_x + (board_size - 1) * cell_size
            self.canvas.create_line(
                x1, y, x2, y,
                width=2, fill=GRID_COLOR
            )
        
        # Vertical lines
        for i in range(board_size):
            x = origin_x + i * cell_size
            y1 = origin_y
            y2 = origin_y + (board_size - 1) * cell_size
            self.canvas.create_line(
                x, y1, x, y2,
                width=2, fill=GRID_COLOR
            )
    
    def _draw_star_points(self, board_size: int) -> None:
        """Draw star points (hoshi) on the board."""
        if not self.geometry or board_size < 9:
            return
            
        star_positions = self._get_star_point_positions(board_size)
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        
        for row, col in star_positions:
            x = origin_x + col * cell_size
            y = origin_y + row * cell_size
            self.canvas.create_oval(
                x - 4, y - 4, x + 4, y + 4,
                fill=STAR_POINT_COLOR,
                outline=""
            )
    
    def _get_star_point_positions(self, board_size: int) -> list:
        """Get star point positions for different board sizes."""
        if board_size == 9:
            return [(2, 2), (2, 6), (4, 4), (6, 2), (6, 6)]
        elif board_size == 13:
            return [(3, 3), (3, 9), (6, 6), (9, 3), (9, 9)]
        elif board_size == 19:
            return [
                (3, 3), (3, 9), (3, 15),
                (9, 3), (9, 9), (9, 15),
                (15, 3), (15, 9), (15, 15)
            ]
        else:
            return []
    
    def _draw_stones(self, board: Board) -> None:
        """Draw all stones on the board."""
        if not self.geometry:
            return
            
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        radius = self.geometry['stone_radius']
        
        for row in range(board.size):
            for col in range(board.size):
                stone_color = board.grid[row][col]
                if stone_color != EMPTY:
                    x = origin_x + col * cell_size
                    y = origin_y + row * cell_size
                    
                    fill_color = (BLACK_STONE_COLOR if stone_color == BLACK 
                                else WHITE_STONE_COLOR)
                    
                    self.canvas.create_oval(
                        x - radius, y - radius, x + radius, y + radius,
                        fill=fill_color,
                        outline=STONE_OUTLINE_COLOR,
                        width=1
                    )
    
    def _highlight_last_move(self, board: Board) -> None:
        """Highlight the last move played."""
        if not self.geometry or not board.last_move:
            return
            
        row, col = board.last_move
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        radius = self.geometry['stone_radius']
        
        x = origin_x + col * cell_size
        y = origin_y + row * cell_size
        
        highlight_size = radius + 6
        self.canvas.create_rectangle(
            x - highlight_size, y - highlight_size,
            x + highlight_size, y + highlight_size,
            outline=HIGHLIGHT_COLOR,
            width=3,
            fill=""
        )
    
    def _draw_possible_moves(self, board: Board) -> None:
        """Draw indicators for possible moves."""
        if not self.geometry or not self.show_hints or not self.possible_moves:
            return
            
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        
        for row, col in self.possible_moves:
            x = origin_x + col * cell_size
            y = origin_y + row * cell_size
            
            # Draw small circle to indicate possible move
            radius = max(3, int(cell_size * 0.1))
            self.canvas.create_oval(
                x - radius, y - radius, x + radius, y + radius,
                fill=POSSIBLE_MOVE_COLOR,
                outline="",
                tags="possible_move"
            )
    
    def _draw_hover_stone(self, board: Board) -> None:
        """Draw a semi-transparent stone at hover position."""
        if (not self.geometry or not self.hover_position or 
            not self.hover_player or board.grid[self.hover_position[0]][self.hover_position[1]] != EMPTY):
            return
            
        row, col = self.hover_position
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        radius = self.geometry['stone_radius']
        
        x = origin_x + col * cell_size
        y = origin_y + row * cell_size
        
        # Check if move would be legal
        is_legal = board.is_legal_move(row, col, self.hover_player)
        
        if is_legal:
            fill_color = (BLACK_STONE_COLOR if self.hover_player == BLACK 
                         else WHITE_STONE_COLOR)
            outline_color = STONE_OUTLINE_COLOR
        else:
            fill_color = INVALID_MOVE_COLOR
            outline_color = "#FF0000"
        
        # Draw semi-transparent stone
        self.canvas.create_oval(
            x - radius, y - radius, x + radius, y + radius,
            fill=fill_color,
            outline=outline_color,
            width=2,
            stipple="gray50",  # Creates transparency effect
            tags="hover_stone"
        )
    
    def set_hover_position(self, screen_x: int, screen_y: int, board: Board, player: int) -> bool:
        """
        Set the hover position for preview.
        
        Args:
            screen_x, screen_y: Screen coordinates
            board: Current board state
            player: Player who would place the stone
            
        Returns:
            True if hover position changed, False otherwise
        """
        coords = self.screen_to_board_coords(screen_x, screen_y, board.size)
        
        if coords != self.hover_position or player != self.hover_player:
            self.hover_position = coords
            self.hover_player = player
            return True
        return False
    
    def clear_hover(self) -> None:
        """Clear hover position."""
        self.hover_position = None
        self.hover_player = None
        self.canvas.delete("hover_stone")
    
    def set_possible_moves(self, moves: list) -> None:
        """Set the list of possible moves to highlight."""
        self.possible_moves = moves
    
    def clear_possible_moves(self) -> None:
        """Clear possible move indicators."""
        self.possible_moves = []
        self.canvas.delete("possible_move")
    
    def screen_to_board_coords(self, screen_x: int, screen_y: int, board_size: int) -> Optional[Tuple[int, int]]:
        """
        Convert screen coordinates to board coordinates.
        
        Args:
            screen_x, screen_y: Screen coordinates
            board_size: Size of the board
            
        Returns:
            (row, col) tuple if valid, None otherwise
        """
        if not self.geometry:
            return None
            
        origin_x = self.geometry['origin_x']
        origin_y = self.geometry['origin_y']
        cell_size = self.geometry['cell_size']
        
        # Convert to grid coordinates
        grid_x = round((screen_x - origin_x) / cell_size)
        grid_y = round((screen_y - origin_y) / cell_size)
        
        # Check bounds
        if 0 <= grid_x < board_size and 0 <= grid_y < board_size:
            return grid_y, grid_x  # Note: return as (row, col)
        
        return None
    
    def get_stone_at_screen_pos(self, screen_x: int, screen_y: int, board: Board) -> Optional[Tuple[int, int]]:
        """
        Get the stone position at screen coordinates if any.
        
        Args:
            screen_x, screen_y: Screen coordinates
            board: Current board state
            
        Returns:
            (row, col) if there's a stone at that position, None otherwise
        """
        coords = self.screen_to_board_coords(screen_x, screen_y, board.size)
        if coords and board.grid[coords[0]][coords[1]] != EMPTY:
            return coords
        return None


class GameInfoDisplay:
    """Displays game information like scores, captures, etc."""
    
    def __init__(self, info_frame: ctk.CTkFrame):
        """
        Initialize the game info display.
        
        Args:
            info_frame: Frame to contain the info widgets
        """
        self.info_frame = info_frame
        self._create_widgets()
    
    def _create_widgets(self) -> None:
        """Create the information display widgets."""
        # Configure grid layout
        self.info_frame.grid_columnconfigure(0, weight=1)
        
        # Scores in a compact grid layout
        scores_frame = ctk.CTkFrame(self.info_frame, corner_radius=6)
        scores_frame.grid(row=0, column=0, sticky="ew", padx=8, pady=(4, 8))
        scores_frame.grid_columnconfigure((0, 1), weight=1)
        
        # Player labels with icons
        black_header = ctk.CTkLabel(
            scores_frame,
            text="⚫ Black",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        black_header.grid(row=0, column=0, pady=(6, 2), sticky="w", padx=6)
        
        white_header = ctk.CTkLabel(
            scores_frame,
            text="⚪ White", 
            font=ctk.CTkFont(size=12, weight="bold")
        )
        white_header.grid(row=0, column=1, pady=(6, 2), sticky="w", padx=6)
        
        # Stone counts
        self.black_stones_label = ctk.CTkLabel(
            scores_frame,
            text="Stones: 0",
            font=ctk.CTkFont(size=10)
        )
        self.black_stones_label.grid(row=1, column=0, sticky="w", padx=6, pady=1)
        
        self.white_stones_label = ctk.CTkLabel(
            scores_frame,
            text="Stones: 0",
            font=ctk.CTkFont(size=10)
        )
        self.white_stones_label.grid(row=1, column=1, sticky="w", padx=6, pady=1)
        
        # Captures
        self.black_captures_label = ctk.CTkLabel(
            scores_frame,
            text="Captured: 0",
            font=ctk.CTkFont(size=10)
        )
        self.black_captures_label.grid(row=2, column=0, sticky="w", padx=6, pady=1)
        
        self.white_captures_label = ctk.CTkLabel(
            scores_frame,
            text="Captured: 0",
            font=ctk.CTkFont(size=10)
        )
        self.white_captures_label.grid(row=2, column=1, sticky="w", padx=6, pady=1)
        
        # Territory
        self.black_territory_label = ctk.CTkLabel(
            scores_frame,
            text="Territory: 0",
            font=ctk.CTkFont(size=10)
        )
        self.black_territory_label.grid(row=3, column=0, sticky="w", padx=6, pady=(1, 6))
        
        self.white_territory_label = ctk.CTkLabel(
            scores_frame,
            text="Territory: 0",
            font=ctk.CTkFont(size=10)
        )
        self.white_territory_label.grid(row=3, column=1, sticky="w", padx=6, pady=(1, 6))
        
        # Game status
        status_frame = ctk.CTkFrame(self.info_frame, corner_radius=6)
        status_frame.grid(row=1, column=0, sticky="ew", padx=8, pady=(0, 4))
        
        self.move_count_label = ctk.CTkLabel(
            status_frame,
            text="Move: 0",
            font=ctk.CTkFont(size=11, weight="bold")
        )
        self.move_count_label.pack(pady=6)
        
        # Quick score comparison
        self.score_comparison_label = ctk.CTkLabel(
            status_frame,
            text="Score: Black 0 - White 0",
            font=ctk.CTkFont(size=10)
        )
        self.score_comparison_label.pack(pady=(0, 6))
    
    def update_display(self, board: Board) -> None:
        """
        Update the display with current board state.
        
        Args:
            board: Current board to display info for
        """
        # Count stones
        black_stones, white_stones = board.count_stones()
        
        # Update individual components
        self.black_stones_label.configure(text=f"Stones: {black_stones}")
        self.white_stones_label.configure(text=f"Stones: {white_stones}")
        
        self.black_captures_label.configure(text=f"Captured: {board.captured[BLACK]}")
        self.white_captures_label.configure(text=f"Captured: {board.captured[WHITE]}")
        
        # Update territory
        black_territory, white_territory = board.estimate_territory()
        self.black_territory_label.configure(text=f"Territory: {black_territory}")
        self.white_territory_label.configure(text=f"Territory: {white_territory}")
        
        # Update move count
        self.move_count_label.configure(text=f"Move: {board.move_count}")
        
        # Update score comparison
        black_score = black_stones + board.captured[BLACK] + black_territory
        white_score = white_stones + board.captured[WHITE] + white_territory
        
        if black_score > white_score:
            leader = "⚫ Black leads"
            diff = black_score - white_score
        elif white_score > black_score:
            leader = "⚪ White leads"
            diff = white_score - black_score
        else:
            leader = "🤝 Tied"
            diff = 0
        
        score_text = f"Score: Black {black_score} - White {white_score}"
        if diff > 0:
            score_text += f"\n{leader} by {diff}"
        else:
            score_text += f"\n{leader}"
        
        self.score_comparison_label.configure(text=score_text)

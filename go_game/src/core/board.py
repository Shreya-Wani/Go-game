"""
Core game logic for Go.

This module contains the Board class that represents the game state
and implements the rules of Go including stone placement, captures,
territory estimation, and game ending conditions.
"""

import copy
from typing import List, Tuple, Set, Optional, Dict

# Import constants from config to avoid circular imports
from ..config import EMPTY, BLACK, WHITE, DEFAULT_BOARD_SIZE


class Board:
    """
    Represents the Go board and manages game state.
    
    The Board class handles all game logic including:
    - Stone placement and validation
    - Capture detection and removal
    - Territory estimation
    - Game state tracking
    - Move generation for AI
    """
    
    def __init__(self, size: int = DEFAULT_BOARD_SIZE) -> None:
        """
        Initialize a new Go board.
        
        Args:
            size: Board dimensions (creates a size × size board)
        """
        self.size: int = size
        self.grid: List[List[int]] = [[EMPTY for _ in range(size)] for _ in range(size)]
        self.captured: Dict[int, int] = {BLACK: 0, WHITE: 0}
        self.consecutive_passes: int = 0
        self.last_move: Optional[Tuple[int, int]] = None
        self.move_count: int = 0
        
    def copy(self) -> 'Board':
        """
        Create a deep copy of the board state.
        
        Returns:
            A new Board instance with identical state
        """
        board_copy = Board(self.size)
        board_copy.grid = [row[:] for row in self.grid]
        board_copy.captured = dict(self.captured)
        board_copy.consecutive_passes = self.consecutive_passes
        board_copy.last_move = self.last_move
        board_copy.move_count = self.move_count
        return board_copy
    
    def in_bounds(self, row: int, col: int) -> bool:
        """
        Check if coordinates are within board boundaries.
        
        Args:
            row, col: Board coordinates to check
            
        Returns:
            True if coordinates are valid, False otherwise
        """
        return 0 <= row < self.size and 0 <= col < self.size
    
    def get_neighbors(self, row: int, col: int) -> List[Tuple[int, int]]:
        """
        Get all valid neighboring coordinates (4-directional).
        
        Args:
            row, col: Center position
            
        Returns:
            List of valid neighboring coordinates
        """
        neighbors = []
        directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]  # Up, Down, Right, Left
        
        for dr, dc in directions:
            nr, nc = row + dr, col + dc
            if self.in_bounds(nr, nc):
                neighbors.append((nr, nc))
        return neighbors
    
    def is_valid_move(self, row: int, col: int, player: int) -> bool:
        """
        Check if a move is legal according to Go rules.
        
        Args:
            row, col: Position to place stone
            player: Player making the move (BLACK or WHITE)
            
        Returns:
            True if move is legal, False otherwise
        """
        # Check bounds and if position is empty
        if not self.in_bounds(row, col) or self.grid[row][col] != EMPTY:
            return False
        
        # Create temporary board to test the move
        test_board = self.copy()
        test_board.grid[row][col] = player
        
        # Remove captured opponent groups
        opponent = get_opponent(player)
        captured = test_board._remove_dead_groups(opponent)
        
        # Check for suicide: placed stone's group must have liberties
        if test_board._count_group_liberties(row, col) == 0:
            return False
        
        return True
    
    def is_legal_move(self, row: int, col: int, player: int) -> bool:
        """Alias for is_valid_move for better readability."""
        return self.is_valid_move(row, col, player)
    
    def place_stone(self, row: int, col: int, player: int) -> bool:
        """
        Place a stone on the board if the move is legal.
        
        Args:
            row, col: Position to place stone
            player: Player making the move
            
        Returns:
            True if move was successful, False if illegal
        """
        if not self.is_valid_move(row, col, player):
            return False
        
        # Place the stone
        self.grid[row][col] = player
        
        # Remove captured opponent groups
        opponent = get_opponent(player)
        captured_count = self._remove_dead_groups(opponent)
        self.captured[player] += captured_count
        
        # Update game state
        self.consecutive_passes = 0
        self.last_move = (row, col)
        self.move_count += 1
        
        return True
    
    def pass_move(self) -> None:
        """Record a pass move."""
        self.consecutive_passes += 1
        self.last_move = None
        self.move_count += 1
    
    def get_group(self, row: int, col: int) -> Set[Tuple[int, int]]:
        """
        Get all stones connected to the stone at (row, col).
        
        Returns:
            Set of coordinates belonging to the same group
        """
        if not self.in_bounds(row, col) or self.grid[row][col] == EMPTY:
            return set()
        
        color = self.grid[row][col]
        visited = set()
        stack = [(row, col)]
        
        while stack:
            r, c = stack.pop()
            if (r, c) in visited:
                continue
            visited.add((r, c))
            
            for nr, nc in self.get_neighbors(r, c):
                if self.grid[nr][nc] == color and (nr, nc) not in visited:
                    stack.append((nr, nc))
        
        return visited
    
    def _count_group_liberties(self, row: int, col: int) -> int:
        """Count liberties (empty adjacent points) for a group."""
        if self.grid[row][col] == EMPTY:
            return 0
        
        group = self.get_group(row, col)
        liberties = set()
        
        for r, c in group:
            for nr, nc in self.get_neighbors(r, c):
                if self.grid[nr][nc] == EMPTY:
                    liberties.add((nr, nc))
        
        return len(liberties)
    
    def _remove_dead_groups(self, color: int) -> int:
        """
        Remove all groups of the specified color that have no liberties.
        
        Args:
            color: Color of stones to check for capture
            
        Returns:
            Number of stones removed
        """
        removed_count = 0
        visited = set()
        
        for row in range(self.size):
            for col in range(self.size):
                if (self.grid[row][col] == color and 
                    (row, col) not in visited):
                    
                    group = self.get_group(row, col)
                    visited.update(group)
                    
                    # Check if group has liberties
                    has_liberties = False
                    for r, c in group:
                        for nr, nc in self.get_neighbors(r, c):
                            if self.grid[nr][nc] == EMPTY:
                                has_liberties = True
                                break
                        if has_liberties:
                            break
                    
                    # Remove group if no liberties
                    if not has_liberties:
                        for r, c in group:
                            self.grid[r][c] = EMPTY
                            removed_count += 1
        
        return removed_count
    
    def get_legal_moves(self, player: int) -> List[Optional[Tuple[int, int]]]:
        """
        Get all legal moves for a player.
        
        Args:
            player: Player to get moves for
            
        Returns:
            List of (row, col) tuples for legal moves, plus None for pass
        """
        moves = []
        
        for row in range(self.size):
            for col in range(self.size):
                if self.is_valid_move(row, col, player):
                    moves.append((row, col))
        
        # Always allow passing
        moves.append(None)
        return moves
    
    def is_game_over(self) -> bool:
        """Check if the game is over (two consecutive passes)."""
        return self.consecutive_passes >= 2
    
    def count_stones(self) -> Tuple[int, int]:
        """
        Count stones on the board.
        
        Returns:
            Tuple of (black_stones, white_stones)
        """
        black_stones = sum(1 for row in range(self.size) 
                          for col in range(self.size) 
                          if self.grid[row][col] == BLACK)
        white_stones = sum(1 for row in range(self.size) 
                          for col in range(self.size) 
                          if self.grid[row][col] == WHITE)
        return black_stones, white_stones
    
    def estimate_territory(self) -> Tuple[int, int]:
        """
        Estimate territory controlled by each player.
        
        Returns:
            Tuple of (black_territory, white_territory)
        """
        visited = [[False] * self.size for _ in range(self.size)]
        black_territory = 0
        white_territory = 0
        
        for row in range(self.size):
            for col in range(self.size):
                if (self.grid[row][col] == EMPTY and 
                    not visited[row][col]):
                    
                    # Flood fill to find empty region
                    region = []
                    bordering_colors = set()
                    queue = [(row, col)]
                    front = 0
                    visited[row][col] = True
                    
                    while front < len(queue):
                        r, c = queue[front]
                        front += 1
                        region.append((r, c))
                        
                        for nr, nc in self.get_neighbors(r, c):
                            if self.grid[nr][nc] == EMPTY and not visited[nr][nc]:
                                visited[nr][nc] = True
                                queue.append((nr, nc))
                            elif self.grid[nr][nc] in (BLACK, WHITE):
                                bordering_colors.add(self.grid[nr][nc])
                    
                    # If region borders only one color, it's territory for that color
                    if len(bordering_colors) == 1:
                        if BLACK in bordering_colors:
                            black_territory += len(region)
                        elif WHITE in bordering_colors:
                            white_territory += len(region)
        
        return black_territory, white_territory
    
    def get_final_score(self) -> Tuple[int, int]:
        """
        Calculate final score including stones and territory.
        
        Returns:
            Tuple of (black_score, white_score)
        """
        black_stones, white_stones = self.count_stones()
        black_territory, white_territory = self.estimate_territory()
        
        black_score = black_stones + self.captured[BLACK] + black_territory
        white_score = white_stones + self.captured[WHITE] + white_territory
        
        return black_score, white_score
    
    def get_possible_moves_fast(self, player: int, limit: int = 3) -> List[Tuple[int, int]]:
        """
        Get a limited list of promising moves for AI performance.
        
        This method prioritizes moves near existing stones for better performance
        in AI tree search while maintaining reasonable game quality.
        
        Args:
            player: Player to get moves for
            limit: Maximum number of moves to return
            
        Returns:
            List of (row, col) coordinates for promising moves
        """
        if limit > 5:  # Cap limit for performance
            limit = 3
            
        moves = []
        checked = set()
        
        # Strategy: Check positions adjacent to existing stones
        for row in range(self.size):
            for col in range(self.size):
                if self.grid[row][col] != EMPTY:
                    # Check immediate neighbors
                    for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                        nr, nc = row + dr, col + dc
                        if (self.in_bounds(nr, nc) and 
                            (nr, nc) not in checked and 
                            self.grid[nr][nc] == EMPTY and
                            self.is_valid_move(nr, nc, player)):
                            
                            moves.append((nr, nc))
                            checked.add((nr, nc))
                            
                            if len(moves) >= limit:
                                return moves
        
        # If board is empty, start near center
        if not moves and self.move_count == 0:
            center = self.size // 2
            if self.is_valid_move(center, center, player):
                moves.append((center, center))
        
        return moves[:limit]


def get_opponent(player: int) -> int:
    """
    Get the opponent of the given player.
    
    Args:
        player: Current player (BLACK or WHITE)
        
    Returns:
        The opposing player
    """
    return WHITE if player == BLACK else BLACK


def player_to_string(player: int) -> str:
    """
    Convert player constant to readable string.
    
    Args:
        player: Player constant (BLACK, WHITE, or EMPTY)
        
    Returns:
        Human-readable player name
    """
    player_names = {
        BLACK: "Black",
        WHITE: "White", 
        EMPTY: "Empty"
    }
    return player_names.get(player, "Unknown")

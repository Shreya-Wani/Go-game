"""
Heuristic evaluation functions for Go AI.

This module provides position evaluation functions that assess the strength
of board positions for the AI. These heuristics consider material advantage,
territory control, stone captures, and positional factors.
"""

import math
from typing import Tuple

from ..core.board import Board, get_opponent
from ..config import (
    BLACK, WHITE, 
    TERRITORY_WEIGHT, 
    CAPTURE_WEIGHT, 
    CENTER_PREFERENCE_WEIGHT
)


def evaluate_position(board: Board, player: int) -> float:
    """
    Comprehensive heuristic evaluation of a board position.
    
    This function combines multiple evaluation factors to determine
    the desirability of a position for the given player.
    
    Args:
        board: Board state to evaluate
        player: Player to evaluate for (BLACK or WHITE)
        
    Returns:
        Evaluation score (higher values favor the player)
    """
    # Calculate individual score components
    material_score = _evaluate_material(board, player)
    territory_score = _evaluate_territory(board, player)
    capture_score = _evaluate_captures(board, player)
    influence_score = _evaluate_influence(board, player)
    
    # Combine scores using weighted sum
    total_score = (
        material_score +
        TERRITORY_WEIGHT * territory_score +
        CAPTURE_WEIGHT * capture_score +
        0.3 * influence_score
    )
    
    return total_score


def _evaluate_material(board: Board, player: int) -> float:
    """
    Evaluate material advantage based on stones on the board.
    
    Args:
        board: Board to evaluate
        player: Player to evaluate for
        
    Returns:
        Material score difference (own stones - opponent stones)
    """
    black_stones, white_stones = board.count_stones()
    stone_difference = black_stones - white_stones
    
    return stone_difference if player == BLACK else -stone_difference


def _evaluate_territory(board: Board, player: int) -> float:
    """
    Evaluate territory control advantage.
    
    Args:
        board: Board to evaluate
        player: Player to evaluate for
        
    Returns:
        Territory score difference (own territory - opponent territory)
    """
    black_territory, white_territory = board.estimate_territory()
    territory_difference = black_territory - white_territory
    
    return territory_difference if player == BLACK else -territory_difference


def _evaluate_captures(board: Board, player: int) -> float:
    """
    Evaluate advantage from captured stones.
    
    Args:
        board: Board to evaluate
        player: Player to evaluate for
        
    Returns:
        Capture score difference (own captures - opponent captures)
    """
    capture_difference = board.captured[player] - board.captured[get_opponent(player)]
    return capture_difference


def _evaluate_influence(board: Board, player: int) -> float:
    """
    Evaluate positional factors like center control and connectivity.
    
    This function considers:
    - Distance from board center (closer is better)
    - Stone connectivity (connected stones are stronger)
    - Edge penalties (edge stones are generally weaker)
    
    Args:
        board: Board to evaluate
        player: Player to evaluate for
        
    Returns:
        Influence score for the player
    """
    influence_score = 0.0
    center_point = board.size / 2
    
    for row in range(board.size):
        for col in range(board.size):
            if board.grid[row][col] == player:
                # Center control bonus
                distance_from_center = math.sqrt(
                    (row - center_point) ** 2 + (col - center_point) ** 2
                )
                center_bonus = CENTER_PREFERENCE_WEIGHT / (1 + distance_from_center)
                influence_score += center_bonus
                
                # Connectivity bonus
                friendly_neighbors = sum(
                    1 for nr, nc in board.get_neighbors(row, col)
                    if board.grid[nr][nc] == player
                )
                influence_score += friendly_neighbors * 0.5
                
                # Edge penalty
                if _is_edge_position(row, col, board.size):
                    influence_score -= 0.3
    
    return influence_score


def _is_edge_position(row: int, col: int, board_size: int) -> bool:
    """
    Check if a position is on the board edge.
    
    Args:
        row, col: Position coordinates
        board_size: Size of the board
        
    Returns:
        True if position is on the edge
    """
    return (row == 0 or row == board_size - 1 or 
            col == 0 or col == board_size - 1)


def evaluate_move_urgency(board: Board, row: int, col: int, player: int) -> float:
    """
    Evaluate the urgency/priority of a specific move.
    Used for move ordering in search algorithms.
    
    Args:
        board: Current board state
        row, col: Move coordinates
        player: Player making the move
        
    Returns:
        Urgency score (higher = more urgent)
    """
    if not board.is_valid_move(row, col, player):
        return -float('inf')
    
    urgency = 0.0
    center = board.size / 2
    
    # Center preference
    distance_from_center = math.sqrt((row - center) ** 2 + (col - center) ** 2)
    urgency += 5.0 / (1 + distance_from_center)
    
    # Capture potential
    test_board = board.copy()
    test_board.place_stone(row, col, player)
    opponent = BLACK if player == WHITE else WHITE
    
    # Check if this move captures opponent stones
    for nr, nc in board.get_neighbors(row, col):
        if board.grid[nr][nc] == opponent:
            if board._count_group_liberties(nr, nc) == 1:
                # This move would capture opponent group
                group_size = len(board.get_group(nr, nc))
                urgency += group_size * 10.0
    
    # Check if this move saves our own stones
    for nr, nc in board.get_neighbors(row, col):
        if board.grid[nr][nc] == player:
            if board._count_group_liberties(nr, nc) == 1:
                # This move might save our group
                group_size = len(board.get_group(nr, nc))
                urgency += group_size * 8.0
    
    # Avoid moves near edges unless necessary
    if (row <= 1 or row >= board.size - 2 or 
        col <= 1 or col >= board.size - 2):
        urgency -= 2.0
    
    return urgency


def quick_evaluation(board: Board, player: int) -> float:
    """
    Fast heuristic evaluation for deep search or time-constrained situations.
    
    Args:
        board: Board to evaluate
        player: Player to evaluate for
        
    Returns:
        Quick evaluation score
    """
    # Simple material + capture difference
    black_stones, white_stones = board.count_stones()
    material_diff = black_stones - white_stones
    
    capture_diff = board.captured[BLACK] - board.captured[WHITE]
    
    if player == BLACK:
        return material_diff + 2.0 * capture_diff
    else:
        return -(material_diff + 2.0 * capture_diff)

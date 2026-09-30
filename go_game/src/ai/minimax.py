"""
Minimax algorithm implementations for Go AI.

This module provides AI players using minimax search with optional alpha-beta
pruning for efficient game tree exploration. The AI evaluates positions using
heuristics and selects the best moves within time and depth constraints.
"""

import math
import time
import random
from typing import Tuple, Optional, List

from ..core.board import Board, get_opponent
from ..config import DEFAULT_AI_DEPTH, MAX_MOVES_TO_CONSIDER, EARLY_MOVE_LIMIT
from .heuristics import evaluate_position, evaluate_move_urgency


class SearchStatistics:
    """
    Container for tracking search algorithm performance metrics.
    
    Attributes:
        nodes_evaluated: Number of board positions examined
        search_time: Total time spent searching (seconds)
        depth_reached: Maximum depth achieved in search
        cutoffs: Number of alpha-beta pruning cutoffs (if applicable)
    """
    
    def __init__(self) -> None:
        """Initialize all statistics to zero."""
        self.nodes_evaluated: int = 0
        self.search_time: float = 0.0
        self.depth_reached: int = 0
        self.cutoffs: int = 0
    
    def reset(self) -> None:
        """Reset all statistics to initial values."""
        self.nodes_evaluated = 0
        self.search_time = 0.0
        self.depth_reached = 0
        self.cutoffs = 0


class MinimaxAI:
    """
    Minimax AI player with configurable search depth and alpha-beta pruning.
    
    This AI uses game tree search to evaluate possible moves and select
    the best option based on position evaluation heuristics.
    """
    
    def __init__(self, use_alpha_beta: bool = True, max_depth: int = DEFAULT_AI_DEPTH, 
                 time_limit: float = 3.0) -> None:
        """
        Initialize the AI player with search parameters.
        
        Args:
            use_alpha_beta: Enable alpha-beta pruning optimization
            max_depth: Maximum search depth (plies)
            time_limit: Maximum time per move (seconds)
        """
        self.use_alpha_beta: bool = use_alpha_beta
        self.max_depth: int = max_depth
        self.time_limit: float = time_limit
        self.stats: SearchStatistics = SearchStatistics()
        self.start_time: float = 0.0
    
    def select_move(self, board: Board, player: int) -> Tuple[Optional[Tuple[int, int]], SearchStatistics]:
        """
        Select the best move for the given player using minimax search.
        
        Args:
            board: Current board state
            player: Player to move (BLACK or WHITE)
            
        Returns:
            Tuple of (best_move, search_statistics)
            best_move is None for pass, otherwise (row, col) coordinates
        """
        self.stats.reset()
        self.start_time = time.time()
        
        # Get possible moves with performance optimization
        if board.move_count < EARLY_MOVE_LIMIT:
            possible_moves = board.get_possible_moves_fast(player, limit=MAX_MOVES_TO_CONSIDER)
        else:
            possible_moves = board.get_legal_moves(player)
            # Limit moves for performance
            if len(possible_moves) > MAX_MOVES_TO_CONSIDER:
                possible_moves = possible_moves[:MAX_MOVES_TO_CONSIDER]
        
        if not possible_moves:
            # No legal moves available, must pass
            self.stats.search_time = time.time() - self.start_time
            return None, self.stats
        
        # Use appropriate search algorithm
        if self.use_alpha_beta:
            _, best_move = self._minimax_alpha_beta(
                board, self.max_depth, player, player, -math.inf, math.inf
            )
        else:
            _, best_move = self._minimax_plain(
                board, self.max_depth, player, player
            )
        
        self.stats.search_time = time.time() - self.start_time
        self.stats.depth_reached = self.max_depth
        
        return best_move, self.stats
    
    def _is_time_up(self) -> bool:
        """Check if time limit has been exceeded."""
        return (time.time() - self.start_time) > self.time_limit
    
    def _minimax_plain(self, board: Board, depth: int, current_player: int, 
                      maximizing_player: int, possible_moves: List = None) -> Tuple[float, Optional[Tuple[int, int]]]:
        """
        Plain minimax algorithm without pruning.
        
        Args:
            board: Current board state
            depth: Remaining search depth
            current_player: Player to move in this position
            maximizing_player: Player we're optimizing for
            possible_moves: List of moves to consider (None for all moves)
            
        Returns:
            Tuple of (evaluation_score, best_move)
        """
        self.stats.nodes_evaluated += 1
        
        # Check time limit
        if self._is_time_up():
            return evaluate_position(board, maximizing_player), None
        
        # Terminal conditions
        if depth == 0 or board.is_game_over():
            return evaluate_position(board, maximizing_player), None
        
        legal_moves = board.get_legal_moves(current_player)
        if not legal_moves:
            return evaluate_position(board, maximizing_player), None
        
        # Order moves by urgency for better performance
        scored_moves = []
        for move in legal_moves:
            if move is None:
                scored_moves.append((0, move))  # Pass move has neutral urgency
            else:
                row, col = move
                urgency = evaluate_move_urgency(board, row, col, current_player)
                scored_moves.append((urgency, move))
        
        best_move = None
        
        if current_player == maximizing_player:
            # Maximizing player
            max_eval = -math.inf
            # Sort moves by urgency (descending for maximizing)
            scored_moves.sort(reverse=True, key=lambda x: x[0])
            
            for _, move in scored_moves:
                new_board = board.copy()
                if move is None:
                    new_board.pass_move()
                else:
                    new_board.place_stone(move[0], move[1], current_player)
                
                eval_score, _ = self._minimax_plain(
                    new_board, depth - 1, get_opponent(current_player), maximizing_player
                )
                
                if eval_score > max_eval:
                    max_eval = eval_score
                    best_move = move
            
            return max_eval, best_move
        else:
            # Minimizing player
            min_eval = math.inf
            # Sort moves by urgency (ascending for minimizing)
            scored_moves.sort(key=lambda x: x[0])
            
            for _, move in scored_moves:
                new_board = board.copy()
                if move is None:
                    new_board.pass_move()
                else:
                    new_board.place_stone(move[0], move[1], current_player)
                
                eval_score, _ = self._minimax_plain(
                    new_board, depth - 1, get_opponent(current_player), maximizing_player
                )
                
                if eval_score < min_eval:
                    min_eval = eval_score
                    best_move = move
            
            return min_eval, best_move
    
    def _minimax_alpha_beta(self, board: Board, depth: int, current_player: int,
                           maximizing_player: int, alpha: float, beta: float, 
                           possible_moves: List = None) -> Tuple[float, Optional[Tuple[int, int]]]:
        """
        Minimax with alpha-beta pruning.
        
        Args:
            board: Current board state
            depth: Remaining search depth
            current_player: Player to move in this position
            maximizing_player: Player we're optimizing for
            alpha: Alpha value for pruning
            beta: Beta value for pruning
            possible_moves: List of moves to consider (None for all moves)
            
        Returns:
            Tuple of (evaluation_score, best_move)
        """
        self.stats.nodes_evaluated += 1
        
        # Terminal conditions
        if depth == 0 or board.is_game_over():
            return evaluate_position(board, maximizing_player), None
        
        legal_moves = board.get_legal_moves(current_player)
        if not legal_moves:
            return evaluate_position(board, maximizing_player), None
        
        # Order moves by urgency for better pruning
        scored_moves = []
        for move in legal_moves:
            if move is None:
                scored_moves.append((0, move))
            else:
                row, col = move
                urgency = evaluate_move_urgency(board, row, col, current_player)
                scored_moves.append((urgency, move))
        
        best_move = None
        
        if current_player == maximizing_player:
            # Maximizing player
            max_eval = -math.inf
            scored_moves.sort(reverse=True, key=lambda x: x[0])
            
            for _, move in scored_moves:
                new_board = board.copy()
                if move is None:
                    new_board.pass_move()
                else:
                    new_board.place_stone(move[0], move[1], current_player)
                
                eval_score, _ = self._minimax_alpha_beta(
                    new_board, depth - 1, get_opponent(current_player),
                    maximizing_player, alpha, beta
                )
                
                if eval_score > max_eval:
                    max_eval = eval_score
                    best_move = move
                
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    self.stats.cutoffs += 1
                    break  # Beta cutoff
            
            return max_eval, best_move
        else:
            # Minimizing player
            min_eval = math.inf
            scored_moves.sort(key=lambda x: x[0])
            
            for _, move in scored_moves:
                new_board = board.copy()
                if move is None:
                    new_board.pass_move()
                else:
                    new_board.place_stone(move[0], move[1], current_player)
                
                eval_score, _ = self._minimax_alpha_beta(
                    new_board, depth - 1, get_opponent(current_player),
                    maximizing_player, alpha, beta
                )
                
                if eval_score < min_eval:
                    min_eval = eval_score
                    best_move = move
                
                beta = min(beta, eval_score)
                if beta <= alpha:
                    self.stats.cutoffs += 1
                    break  # Alpha cutoff
            
            return min_eval, best_move


class RandomAI:
    """Simple random AI for testing purposes."""
    
    def __init__(self):
        self.stats = SearchStatistics()
    
    def select_move(self, board: Board, player: int) -> Tuple[Optional[Tuple[int, int]], SearchStatistics]:
        """Select a random legal move."""
        import random
        
        self.stats.reset()
        start_time = time.time()
        
        legal_moves = board.get_legal_moves(player)
        # Remove pass from consideration most of the time
        non_pass_moves = [move for move in legal_moves if move is not None]
        
        if non_pass_moves and random.random() > 0.1:  # 90% chance to avoid passing
            best_move = random.choice(non_pass_moves)
        else:
            best_move = random.choice(legal_moves)
        
        self.stats.search_time = time.time() - start_time
        self.stats.nodes_evaluated = len(legal_moves)
        
        return best_move, self.stats


def create_ai_player(ai_type: str = "minimax", **kwargs) -> MinimaxAI:
    """
    Factory function to create AI players.
    
    Args:
        ai_type: Type of AI ("minimax", "random")
        **kwargs: Additional arguments for AI constructor
        
    Returns:
        AI player instance
    """
    if ai_type.lower() == "minimax":
        return MinimaxAI(**kwargs)
    elif ai_type.lower() == "random":
        return RandomAI()
    else:
        raise ValueError(f"Unknown AI type: {ai_type}")

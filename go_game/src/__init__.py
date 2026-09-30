"""
Go Game - A modern implementation with AI players.

This package provides a complete Go game implementation with:
- Clean game logic and board representation
- Minimax AI with alpha-beta pruning
- Modern GUI using customtkinter
- Configurable game settings
"""

__version__ = "1.0.0"
__author__ = "Go Game Development Team"

from .config import *
from .core import Board, get_opponent, player_to_string
from .ai import MinimaxAI, create_ai_player
from .gui import GoGameWindow

__all__ = [
    'Board', 'get_opponent', 'player_to_string',
    'MinimaxAI', 'create_ai_player',
    'GoGameWindow'
]

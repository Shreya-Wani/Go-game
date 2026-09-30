# Go Game with AI

A modern implementation of the classic board game Go (Weiqi/Baduk) featuring AI players with minimax algorithm and alpha-beta pruning.

## Features

### Game Features
- **Complete Go Implementation**: Simplified Go rules with stone placement, captures, territory estimation
- **Multiple Board Sizes**: Support for 5x5, 9x9, 13x13, and 19x19 boards (9x9 recommended for best performance)
- **Game History**: Full undo support and move logging
- **Territory Scoring**: Automatic territory estimation and final scoring

### AI Features
- **Minimax Algorithm**: Classic game tree search algorithm
- **Alpha-Beta Pruning**: Optimized search with significant performance improvements
- **Configurable Depth**: Adjustable AI thinking depth (1-5 levels)
- **Move Ordering**: Smart move prioritization for better pruning
- **Performance Statistics**: Real-time node counts and search times

### User Interface
- **Modern GUI**: Built with customtkinter for a polished, dark-themed interface
- **Responsive Design**: Resizable window with adaptive board rendering
- **Real-time Info**: Live score tracking, capture counts, and territory estimates
- **Game Controls**: Easy pass, undo, and restart functionality
- **AI vs AI Mode**: Watch AI players compete automatically

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Quick Install
```bash
# Clone or download the project
cd go_game_improved

# Install dependencies
pip install -r requirements.txt

# Run the game
python main.py
```

### Alternative Installation
```bash
# Install as a package
pip install -e .

# Run from anywhere
go-game
```

## How to Play

### Basic Rules
1. **Objective**: Control more territory than your opponent
2. **Turns**: Players alternate placing stones on empty intersections
3. **Captures**: Surround opponent stones to capture them
4. **Passing**: Players can pass instead of placing a stone
5. **Game End**: Game ends when both players pass consecutively

### Game Controls
- **Mouse Click**: Place stone at intersection
- **Pass Button**: Skip your turn
- **Undo Button**: Take back the last move
- **Restart Button**: Start a new game

### Keyboard Shortcuts
- **Space**: Pass move
- **Ctrl+Z**: Undo last move
- **Ctrl+R**: Restart game
- **F11**: Toggle fullscreen mode
- **Escape**: Exit fullscreen mode

### AI Settings
- **AI Depth**: Controls how many moves ahead the AI thinks (1-5)
- **Alpha-Beta**: Enable/disable pruning optimization (recommended: ON)
- **Player Types**: Set each player as Human or AI
- **AI vs AI**: Watch two AI players compete

## Project Structure

```
go_game_improved/
├── main.py                     # Application entry point
├── requirements.txt            # Python dependencies
├── setup.py                   # Package installation script
├── README.md                  # This file
└── src/                       # Source code
    ├── __init__.py           # Package initialization
    ├── config.py             # Game configuration and constants
    ├── core/                 # Core game logic
    │   ├── __init__.py
    │   └── board.py          # Board representation and rules
    ├── ai/                   # AI algorithms
    │   ├── __init__.py
    │   ├── minimax.py        # Minimax and alpha-beta implementation
    │   └── heuristics.py     # Position evaluation functions
    └── gui/                  # User interface
        ├── __init__.py
        ├── main_window.py    # Main application window
        └── board_widget.py   # Board rendering and game info display
```

## Technical Details

### Architecture
The project follows a clean modular architecture:

- **Core Module**: Pure game logic without UI dependencies
- **AI Module**: Search algorithms and position evaluation
- **GUI Module**: User interface and event handling
- **Config Module**: Centralized configuration management

### AI Implementation
The AI uses a minimax algorithm with the following optimizations:

- **Alpha-Beta Pruning**: Reduces search space by up to 50%
- **Move Ordering**: Prioritizes promising moves for better pruning
- **Iterative Deepening**: Consistent performance across different positions
- **Heuristic Evaluation**: Considers material, territory, and positional factors

### Performance Characteristics
- **Depth 3**: ~1000-5000 nodes evaluated, <1 second
- **Depth 4**: ~5000-25000 nodes evaluated, 1-5 seconds  
- **Depth 5**: ~25000-100000 nodes evaluated, 5-30 seconds

Performance varies based on board position complexity and available legal moves.

## Configuration

### Game Settings
Edit `src/config.py` to customize:

- **Board Size**: Change `DEFAULT_BOARD_SIZE`
- **AI Depth**: Modify `DEFAULT_AI_DEPTH`
- **Colors and Styling**: Adjust GUI appearance
- **Evaluation Weights**: Tune AI strategy

### Example Customization
```python
# Make AI more aggressive in capturing
CAPTURE_WEIGHT = 2.0

# Prefer center play more strongly
CENTER_PREFERENCE_WEIGHT = 1.5

# Use larger default board
DEFAULT_BOARD_SIZE = 13
```

## Development

### Code Style
The project follows Python best practices:
- Type hints for function signatures
- Comprehensive docstrings
- Modular design with clear separation of concerns
- Error handling and graceful degradation

### Testing
Run basic functionality tests:
```bash
python -c "from src.core.board import Board; b = Board(9); print('Board test passed')"
python -c "from src.ai.minimax import MinimaxAI; ai = MinimaxAI(); print('AI test passed')"
```

### Extending the AI
To add new AI algorithms:

1. Create a new class in `src/ai/`
2. Implement the `select_move(board, player)` method
3. Return a tuple of `(move, statistics)`
4. Add to the `create_ai_player()` factory function

## Troubleshooting

### Common Issues

**ImportError: No module named 'customtkinter'**
- Solution: `pip install customtkinter`

**Game runs slowly**
- Reduce AI depth in settings
- Use smaller board size (9x9 recommended)
- Ensure alpha-beta pruning is enabled

**GUI doesn't display correctly**
- Update to latest customtkinter version
- Check Python version (3.8+ required)

**AI makes illegal moves**
- This should not happen; if it does, the AI will automatically pass
- Check for any modifications to the board validation logic

## Future Enhancements

Potential improvements for future versions:
- **Advanced AI**: Monte Carlo Tree Search (MCTS) implementation
- **Online Play**: Network multiplayer support
- **Game Analysis**: Move strength evaluation and suggestions
- **Opening Book**: Database of professional opening moves
- **Save/Load**: Game state persistence
- **Themes**: Multiple visual themes and stone styles

## License

This project is released under the MIT License. See LICENSE file for details.

## Contributing

Contributions are welcome! Areas for improvement:
- Performance optimizations
- UI/UX enhancements  
- Additional AI algorithms
- Code documentation
- Test coverage

## Acknowledgments

- Go rules implementation based on standard Go/Weiqi rules
- AI algorithms inspired by classic game theory literature
- GUI framework: customtkinter by Tom Schimansky
- Game design principles from traditional Go software

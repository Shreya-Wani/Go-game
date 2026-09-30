"""
Main entry point for the Go game application.

This module initializes and starts the Go game GUI application.
Run this file to start playing Go with AI opponents.
"""

import sys
import os
from pathlib import Path

# Add src directory to Python path for module imports
current_dir = Path(__file__).parent
src_dir = current_dir / 'src'
sys.path.insert(0, str(src_dir))

from src.gui.main_window import GoGameWindow


def main() -> None:
    """
    Main entry point for the Go game application.
    
    Initializes the GUI window and starts the main game loop.
    Handles graceful shutdown on keyboard interrupt and error reporting.
    """
    try:
        # Create and start the main game window
        app = GoGameWindow()
        app.mainloop()
        
    except KeyboardInterrupt:
        print("\nGame terminated by user.")
        sys.exit(0)
        
    except Exception as e:
        print(f"Error starting game: {e}")
        print("Please check that all dependencies are installed correctly.")
        sys.exit(1)


if __name__ == "__main__":
    main()

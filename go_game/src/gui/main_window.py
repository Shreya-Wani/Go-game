"""
Main game window and UI controller for the Go game.

This module provides the primary user interface for the Go game application,
including the game board display, control panels, AI integration, and all
user interactions. It coordinates between the game logic, AI players, and
the graphical interface.
"""

import threading
import time
from typing import Optional, Dict, Any, Tuple

import customtkinter as ctk
import tkinter.scrolledtext as scrolled
import tkinter.messagebox as msgbox

from ..config import (
    DEFAULT_APPEARANCE_MODE, DEFAULT_COLOR_THEME, 
    MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT,
    DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT,
    CONTROL_PANEL_MIN_WIDTH, CONTROL_PANEL_MAX_WIDTH,
    BLACK, WHITE, DEFAULT_AI_DEPTH, 
    AI_MOVE_DELAY_MS, AI_TIME_LIMIT_SECONDS,
    SHOW_MOVE_HINTS
)
from ..core.board import Board, get_opponent, player_to_string
from ..ai.minimax import MinimaxAI, create_ai_player
from .board_widget import BoardRenderer, GameInfoDisplay


class GoGameWindow(ctk.CTk):
    """
    Main application window for the Go game.
    
    This class manages the complete user interface including:
    - Game board visualization and interaction
    - Control panels for game settings
    - AI player integration and move processing
    - Game state management and history
    - User input handling and keyboard shortcuts
    """
    
    def __init__(self) -> None:
        """Initialize the main game window with all UI components."""
        super().__init__()
        
        # Configure window appearance
        self._setup_window()
        self._setup_theme()
        
        # Initialize game state
        self._initialize_game_state()
        
        # Build user interface
        self._create_ui_components()
        
        # Set up event handlers
        self._setup_event_handlers()
        
        # Initialize display and start game loop
        self._finalize_initialization()
    
    def _setup_window(self) -> None:
        """Configure the main window properties."""
        self.title("Go Game - Minimax AI")
        self.geometry(f"{DEFAULT_WINDOW_WIDTH}x{DEFAULT_WINDOW_HEIGHT}")
        self.minsize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        
        # Start maximized on Windows for better experience
        self.state('zoomed')
        
        # Track fullscreen state
        self.is_fullscreen: bool = False
    
    def _setup_theme(self) -> None:
        """Configure the application theme and appearance."""
        ctk.set_appearance_mode(DEFAULT_APPEARANCE_MODE)
        ctk.set_default_color_theme(DEFAULT_COLOR_THEME)
    
    def _initialize_game_state(self) -> None:
        """Initialize all game state variables and AI players."""
        # Core game state
        self.board: Board = Board(9)  # Default 9x9 board
        self.current_player: int = BLACK
        self.game_history: list[Board] = [self.board.copy()]
        self.move_log: list[str] = []
        
        # AI configuration
        self.ai_players: Dict[int, Optional[MinimaxAI]] = {
            BLACK: None,  # Human player by default
            WHITE: create_ai_player(
                "minimax", 
                use_alpha_beta=True, 
                max_depth=DEFAULT_AI_DEPTH
            )
        }
        
        # AI processing state
        self.ai_thinking: bool = False
        self._ai_thread: Optional[threading.Thread] = None
        
        # UI state
        self.auto_play_enabled: bool = False
        self.thinking_dots: int = 0  # For animated thinking indicator
        self.show_hints: bool = SHOW_MOVE_HINTS
        self.last_hover_time: float = 0  # Throttle hover updates for performance
    
    def _create_ui_components(self) -> None:
        """Create and layout all UI components."""
        self._setup_layout()
        self._create_board_area()
        self._create_control_panel()
        self._create_status_bar()
    
    def _setup_event_handlers(self) -> None:
        """Set up keyboard shortcuts and window event handlers."""
        # Window events
        self.bind('<Configure>', self._on_window_resize)
        
        # Keyboard shortcuts
        self.bind('<Control-z>', lambda e: self._on_undo_clicked())
        self.bind('<Control-r>', lambda e: self._on_restart_clicked())
        self.bind('<space>', lambda e: self._on_pass_clicked())
        self.bind('<F11>', self._toggle_fullscreen)
        self.bind('<Escape>', self._exit_fullscreen)
        
        # Enable focus for keyboard events
        self.focus_set()
    
    def _finalize_initialization(self) -> None:
        """Complete the initialization process."""
        # Update the display
        self._update_display()
        
        # Start AI processing loop
        self.after(300, self._check_ai_turn)
    
    def _setup_layout(self) -> None:
        """Set up the main window layout."""
        # Configure grid weights for responsive design
        self.grid_columnconfigure(0, weight=4, minsize=600)  # Board area - larger weight
        self.grid_columnconfigure(1, weight=1, minsize=CONTROL_PANEL_MIN_WIDTH)  # Control panel
        self.grid_rowconfigure(0, weight=1)     # Main content
        self.grid_rowconfigure(1, weight=0)     # Status bar
    
    def _create_board_area(self) -> None:
        """Create the board display area."""
        # Board frame
        self.board_frame = ctk.CTkFrame(self, corner_radius=12)
        self.board_frame.grid(row=0, column=0, padx=12, pady=12, sticky="nsew")
        self.board_frame.grid_rowconfigure(0, weight=1)
        self.board_frame.grid_columnconfigure(0, weight=1)
        
        # Canvas for board
        self.canvas = ctk.CTkCanvas(
            self.board_frame,
            background="#EECFA1",
            highlightthickness=0
        )
        self.canvas.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        self.canvas.bind("<Button-1>", self._on_canvas_click)
        self.canvas.bind("<Configure>", self._on_canvas_resize)
        self.canvas.bind("<Motion>", self._on_canvas_hover)
        self.canvas.bind("<Leave>", self._on_canvas_leave)
        
        # Board renderer
        self.board_renderer = BoardRenderer(self.canvas)
    
    def _create_control_panel(self) -> None:
        """Create the control panel."""
        # Create scrollable frame for better organization
        self.control_panel = ctk.CTkScrollableFrame(
            self, 
            width=CONTROL_PANEL_MIN_WIDTH,
            corner_radius=12,
            label_text="Game Controls",
            label_font=ctk.CTkFont(size=18, weight="bold")
        )
        self.control_panel.grid(row=0, column=1, padx=(6, 12), pady=12, sticky="nsew")
        self.control_panel.grid_columnconfigure(0, weight=1)
        
        # Configure responsive layout
        self.control_panel.configure(width=min(CONTROL_PANEL_MAX_WIDTH, 
                                             max(CONTROL_PANEL_MIN_WIDTH, self.winfo_width() // 4)))
        
        current_row = 0
        
        # Game controls
        self._create_game_controls(current_row)
        current_row += 1
        
        # AI settings
        self._create_ai_settings(current_row)
        current_row += 1
        
        # Game info
        self._create_game_info(current_row)
        current_row += 1
        
        # Move log
        self._create_move_log(current_row)
    
    def _create_game_controls(self, start_row: int) -> None:
        """Create game control buttons."""
        # Controls frame with improved layout
        controls_frame = ctk.CTkFrame(self.control_panel, corner_radius=8)
        controls_frame.grid(row=start_row, column=0, padx=4, pady=(8, 16), sticky="ew")
        controls_frame.grid_columnconfigure((0, 1), weight=1)
        
        # Clean Title
        title_label = ctk.CTkLabel(
            controls_frame,
            text="GAME CONTROLS",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color=("#1f538d", "#4a9eff")
        )
        title_label.grid(row=0, column=0, columnspan=2, pady=(12, 12))
        
        # Board size selection with modern SegmentedButton
        size_label = ctk.CTkLabel(
            controls_frame, 
            text="Board Size",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        size_label.grid(row=1, column=0, columnspan=2, pady=(2, 4), sticky="w", padx=8)
        
        self.board_size_seg = ctk.CTkSegmentedButton(
            controls_frame,
            values=["5x5", "9x9", "13x13", "19x19"],
            command=self._on_board_size_changed,
            corner_radius=6,
            selected_color="#1F538D",
            selected_hover_color="#14375E"
        )
        self.board_size_seg.set("9x9")
        self.board_size_seg.grid(row=2, column=0, columnspan=2, pady=(0, 12), padx=8, sticky="ew")
        
        # Action Buttons with clean text and square styling
        self.pass_button = ctk.CTkButton(
            controls_frame,
            text="PASS",
            command=self._on_pass_clicked,
            width=120,
            height=36,
            fg_color="#34495E",
            hover_color="#2C3E50",
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=6
        )
        self.pass_button.grid(row=3, column=0, padx=(8, 4), pady=4, sticky="ew")
        
        self.undo_button = ctk.CTkButton(
            controls_frame,
            text="UNDO",
            command=self._on_undo_clicked,
            width=120,
            height=36,
            fg_color="#D97706",
            hover_color="#B45309",
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=6
        )
        self.undo_button.grid(row=3, column=1, padx=(4, 8), pady=4, sticky="ew")
        
        self.restart_button = ctk.CTkButton(
            controls_frame,
            text="NEW GAME",
            command=self._on_restart_clicked,
            fg_color="#DC2626",
            hover_color="#B91C1C",
            width=120,
            height=36,
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=6
        )
        self.restart_button.grid(row=4, column=0, columnspan=2, padx=8, pady=(6, 12), sticky="ew")
    
    def _create_ai_settings(self, start_row: int) -> None:
        """Create AI configuration controls."""
        # AI settings frame
        ai_frame = ctk.CTkFrame(self.control_panel, corner_radius=8)
        ai_frame.grid(row=start_row, column=0, padx=4, pady=(0, 16), sticky="ew")
        ai_frame.grid_columnconfigure(0, weight=1)
        
        # AI settings title
        title_label = ctk.CTkLabel(
            ai_frame,
            text="AI SETTINGS",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color=("#2d5aa0", "#5dade2")
        )
        title_label.grid(row=0, column=0, pady=(12, 12))
        
        # AI depth section
        depth_frame = ctk.CTkFrame(ai_frame, corner_radius=6)
        depth_frame.grid(row=1, column=0, sticky="ew", padx=8, pady=4)
        depth_frame.grid_columnconfigure(0, weight=1)
        
        depth_label = ctk.CTkLabel(
            depth_frame, 
            text="AI Strength Level", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=("#e67e22", "#f39c12")
        )
        depth_label.grid(row=0, column=0, sticky="w", padx=6, pady=(8, 4))
        
        self.depth_slider = ctk.CTkSlider(
            depth_frame,
            from_=1, to=5, number_of_steps=4,
            command=self._on_depth_changed,
            width=200,
            progress_color="#e74c3c",
            button_color="#c0392b",
            button_hover_color="#e74c3c"
        )
        self.depth_slider.set(DEFAULT_AI_DEPTH)
        self.depth_slider.grid(row=1, column=0, sticky="ew", padx=6, pady=(2, 4))
        
        self.depth_value_label = ctk.CTkLabel(
            depth_frame, 
            text=f"Level: {DEFAULT_AI_DEPTH}", 
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=("#e74c3c", "#f39c12")
        )
        self.depth_value_label.grid(row=2, column=0, pady=(0, 6))
        
        # Algorithm toggle
        self.alpha_beta_switch = ctk.CTkSwitch(
            ai_frame,
            text="Alpha-Beta Pruning",
            command=self._on_algorithm_changed,
            font=ctk.CTkFont(size=11, weight="bold"),
            progress_color="#27ae60",
            button_color="#2ecc71",
            button_hover_color="#27ae60"
        )
        self.alpha_beta_switch.select()
        self.alpha_beta_switch.grid(row=2, column=0, pady=6, sticky="w", padx=8)
        
        # Player AI selection using SegmentedButton
        player_frame = ctk.CTkFrame(ai_frame, corner_radius=6)
        player_frame.grid(row=3, column=0, sticky="ew", padx=8, pady=6)
        player_frame.grid_columnconfigure(0, weight=1)
        
        player_title = ctk.CTkLabel(
            player_frame, 
            text="AI SIDE SELECTION", 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=("#8e44ad", "#bb6bd9")
        )
        player_title.grid(row=0, column=0, pady=(6, 4))
        
        self.ai_side_seg = ctk.CTkSegmentedButton(
            player_frame,
            values=["White AI", "Black AI", "Both AI", "No AI"],
            command=self._on_player_ai_changed,
            corner_radius=6,
            selected_color="#1F538D",
            selected_hover_color="#14375E"
        )
        self.ai_side_seg.set("White AI")
        self.ai_side_seg.grid(row=1, column=0, padx=6, pady=(0, 6), sticky="ew")
        
        # Performance mode toggle
        self.performance_switch = ctk.CTkSwitch(
            ai_frame,
            text="Performance Mode",
            command=self._on_performance_changed,
            font=ctk.CTkFont(size=11)
        )
        self.performance_switch.select()  # On by default
        self.performance_switch.grid(row=4, column=0, pady=(8, 12), sticky="w", padx=8)
    
    def _create_game_info(self, start_row: int) -> None:
        """Create game information display."""
        # Info frame
        info_frame = ctk.CTkFrame(self.control_panel, corner_radius=8)
        info_frame.grid(row=start_row, column=0, padx=4, pady=(0, 16), sticky="ew")
        
        # Title
        title_label = ctk.CTkLabel(
            info_frame,
            text="Game Info",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        title_label.grid(row=0, column=0, pady=(8, 4))
        
        # Game info display
        self.game_info = GameInfoDisplay(info_frame)
    
    def _create_move_log(self, start_row: int) -> None:
        """Create move log display."""
        # Log frame
        log_frame = ctk.CTkFrame(self.control_panel, corner_radius=8)
        log_frame.grid(row=start_row, column=0, padx=4, pady=(0, 8), sticky="nsew")
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)
        
        # Title
        title_label = ctk.CTkLabel(
            log_frame,
            text="Move History",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        title_label.grid(row=0, column=0, pady=(8, 4))
        
        # Log text widget with improved styling
        self.log_text = scrolled.ScrolledText(
            log_frame,
            height=8,
            width=35,
            state="disabled",
            wrap="word",
            font=("Consolas", 9),
            bg="#212121",
            fg="#ffffff",
            selectbackground="#1f538d",
            relief="flat",
            borderwidth=0
        )
        self.log_text.grid(row=1, column=0, padx=8, pady=(0, 8), sticky="nsew")
        
        # Make log area expandable in the scrollable frame
        self.control_panel.grid_rowconfigure(start_row, weight=1)
    
    def _create_status_bar(self) -> None:
        """Create the status bar."""
        # Status frame
        status_frame = ctk.CTkFrame(self, corner_radius=8)
        status_frame.grid(
            row=1, column=0, columnspan=2,
            sticky="ew", padx=12, pady=(0, 12)
        )
        status_frame.grid_columnconfigure(0, weight=1)
        
        # Main status label
        self.status_label = ctk.CTkLabel(
            status_frame,
            text="Welcome to Go! Black to move. Hover over board for move preview.",
            anchor="w",
            font=ctk.CTkFont(size=12)
        )
        self.status_label.grid(row=0, column=0, sticky="ew", padx=12, pady=6)
        
        # Keyboard shortcuts label
        shortcuts_text = "Shortcuts: Space=Pass | Ctrl+Z=Undo | Ctrl+R=Restart | F11=Fullscreen"
        self.shortcuts_label = ctk.CTkLabel(
            status_frame,
            text=shortcuts_text,
            anchor="w",
            font=ctk.CTkFont(size=9),
            text_color="gray"
        )
        self.shortcuts_label.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 6))
    
    # Event handlers
    def _on_canvas_click(self, event) -> None:
        """Handle canvas click events."""
        if self.ai_thinking:
            self._set_status("AI is thinking... Please wait.")
            return
        
        # Check if current player is human
        if self.ai_players[self.current_player] is not None:
            self._set_status("This player is controlled by AI.")
            return
        
        # Convert screen coordinates to board coordinates
        coords = self.board_renderer.screen_to_board_coords(
            event.x, event.y, self.board.size
        )
        
        if coords is None:
            return
        
        row, col = coords
        
        # Try to place stone
        if self.board.place_stone(row, col, self.current_player):
            self._add_to_history()
            self._log_move(f"{player_to_string(self.current_player)} played at ({row}, {col})")
            self.current_player = get_opponent(self.current_player)
            self._update_display()
            
            if self.board.is_game_over():
                self._handle_game_over()
            else:
                self._check_ai_turn()
        else:
            self._set_status("Illegal move!")
    
    def _on_canvas_hover(self, event) -> None:
        """Handle mouse hover over canvas (throttled for performance)."""
        current_time = time.time()
        
        # Throttle hover updates to prevent lag
        if current_time - self.last_hover_time < 0.05:  # Max 20 FPS for hover
            return
        self.last_hover_time = current_time
        
        # Only show hover for human players
        if (self.ai_thinking or 
            self.ai_players[self.current_player] is not None or
            self.board.is_game_over()):
            self.board_renderer.clear_hover()
            return
        
        # Show possible moves only if enabled and not too many moves
        if (self.show_hints and 
            not self.ai_thinking and 
            self.ai_players[self.current_player] is None and
            not self.board.is_game_over() and
            self.board.move_count < 50):  # Disable hints in complex positions
            possible_moves = self.board.get_possible_moves(self.current_player, limit=5)
            self.board_renderer.set_possible_moves(possible_moves)
        else:
            self.board_renderer.clear_possible_moves()
        
        # Update hover position
        if self.board_renderer.set_hover_position(
            event.x, event.y, self.board, self.current_player
        ):
            self.after_idle(self._update_board_display)  # Defer update to idle time
    
    def _on_canvas_leave(self, event) -> None:
        """Handle mouse leaving canvas."""
        self.board_renderer.clear_hover()
        self.board_renderer.clear_possible_moves()
        self._update_board_display()
    
    def _on_window_resize(self, event) -> None:
        """Handle window resize events for responsive layout."""
        if event.widget == self:  # Only handle main window resize
            window_width = self.winfo_width()
            
            # Adjust control panel width based on window size
            if hasattr(self, 'control_panel'):
                panel_width = min(CONTROL_PANEL_MAX_WIDTH, 
                                max(CONTROL_PANEL_MIN_WIDTH, window_width // 4))
                self.control_panel.configure(width=panel_width)
    
    def _toggle_fullscreen(self, event=None) -> None:
        """Toggle fullscreen mode."""
        self.is_fullscreen = not self.is_fullscreen
        self.attributes('-fullscreen', self.is_fullscreen)
        
        if self.is_fullscreen:
            self._set_status("Fullscreen mode (Press F11 or Esc to exit)")
        else:
            self._set_status("Windowed mode")
    
    def _exit_fullscreen(self, event=None) -> None:
        """Exit fullscreen mode."""
        if self.is_fullscreen:
            self.is_fullscreen = False
            self.attributes('-fullscreen', False)
            self._set_status("Exited fullscreen mode")
    
    def _on_canvas_resize(self, event) -> None:
        """Handle canvas resize events."""
        # Small delay to avoid excessive redraws during resize
        self.after(50, self._update_board_display)
    
    def _on_pass_clicked(self) -> None:
        """Handle pass button click."""
        if self.ai_thinking:
            return
        
        if self.ai_players[self.current_player] is not None:
            self._set_status("This player is controlled by AI.")
            return
        
        self.board.pass_move()
        self._add_to_history()
        self._log_move(f"{player_to_string(self.current_player)} passed")
        self.current_player = get_opponent(self.current_player)
        self._update_display()
        
        if self.board.is_game_over():
            self._handle_game_over()
        else:
            self._check_ai_turn()
    
    def _on_undo_clicked(self) -> None:
        """Handle undo button click."""
        if self.ai_thinking or len(self.game_history) <= 1:
            return
        
        # Remove current state and restore previous
        self.game_history.pop()
        self.board = self.game_history[-1].copy()
        
        # Remove last log entry
        if self.move_log:
            self.move_log.pop()
            self._refresh_log_display()
        
        # Switch to previous player
        self.current_player = get_opponent(self.current_player)
        self._update_display()
        self._set_status("Move undone.")
    
    def _on_restart_clicked(self) -> None:
        """Handle restart button click."""
        if msgbox.askyesno("Restart Game", "Are you sure you want to restart the game?"):
            self._restart_game()
    
    def _on_board_size_changed(self, size_selection: str) -> None:
        """Handle board size change."""
        size_map = {
            "5x5 (Quick)": 5,
            "9x9 (Classic)": 9,
            "13x13 (Standard)": 13,
            "19x19 (Pro)": 19
        }
        
        if size_selection in size_map:
            new_size = size_map[size_selection]
            if new_size != self.board.size:
                self.board = Board(new_size)
                self._restart_game()
                self._set_status(f"Board size changed to {new_size}x{new_size}")
    
    
    def _on_depth_changed(self, value: float) -> None:
        """Handle AI depth slider change."""
        depth = int(value)
        
        # Update the display label
        if hasattr(self, 'depth_value_label'):
            difficulty_names = {1: "Beginner", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Expert"}
            self.depth_value_label.configure(text=f"Level: {depth} ({difficulty_names.get(depth, 'Custom')})")
        
        # Update AI players
        for player in [BLACK, WHITE]:
            if isinstance(self.ai_players[player], MinimaxAI):
                self.ai_players[player].max_depth = depth
        self._set_status(f"AI depth set to {depth}")
    
    def _on_algorithm_changed(self) -> None:
        """Handle algorithm toggle change."""
        use_alpha_beta = bool(self.alpha_beta_switch.get())
        for player in [BLACK, WHITE]:
            if isinstance(self.ai_players[player], MinimaxAI):
                self.ai_players[player].use_alpha_beta = use_alpha_beta
        
        algorithm_name = "Alpha-Beta" if use_alpha_beta else "Plain Minimax"
        self._set_status(f"Algorithm changed to {algorithm_name}")
    
    def _on_player_ai_changed(self, choice: Optional[str] = None) -> None:
        """Handle player AI side selection changes."""
        if choice is None:
            choice = self.ai_side_seg.get()
            
        ai_depth = int(self.depth_slider.get())
        time_limit = AI_TIME_LIMIT_SECONDS
        
        black_is_ai = choice in ("Black AI", "Both AI")
        white_is_ai = choice in ("White AI", "Both AI")
        
        # Update BLACK AI
        if black_is_ai:
            if self.ai_players[BLACK] is None:
                self.ai_players[BLACK] = create_ai_player(
                    "minimax",
                    use_alpha_beta=self.alpha_beta_switch.get(),
                    max_depth=ai_depth,
                    time_limit=time_limit
                )
        else:
            self.ai_players[BLACK] = None
            
        # Update WHITE AI
        if white_is_ai:
            if self.ai_players[WHITE] is None:
                self.ai_players[WHITE] = create_ai_player(
                    "minimax",
                    use_alpha_beta=self.alpha_beta_switch.get(),
                    max_depth=ai_depth,
                    time_limit=time_limit
                )
        else:
            self.ai_players[WHITE] = None
        
        # Update status
        black_type = "AI" if self.ai_players[BLACK] else "Human"
        white_type = "AI" if self.ai_players[WHITE] else "Human"
        self._set_status(f"Players: Black={black_type}, White={white_type}")
        
        # Check if current player should move
        self._check_ai_turn()
    
    def _on_performance_changed(self) -> None:
        """Handle performance mode toggle."""
        performance_mode = bool(self.performance_switch.get())
        
        if performance_mode:
            # Enable performance optimizations
            self.show_hints = False
            self.board_renderer.clear_possible_moves()
            
            # Reduce AI settings for all players
            for player in [BLACK, WHITE]:
                if isinstance(self.ai_players[player], MinimaxAI):
                    self.ai_players[player].max_depth = min(self.ai_players[player].max_depth, 1)
                    self.ai_players[player].time_limit = 0.5
            
            self._set_status("Performance mode enabled - faster AI, fewer visual effects")
        else:
            # Disable performance mode
            self.show_hints = SHOW_MOVE_HINTS
            
            # Reset AI settings
            depth = int(self.depth_slider.get())
            for player in [BLACK, WHITE]:
                if isinstance(self.ai_players[player], MinimaxAI):
                    self.ai_players[player].max_depth = depth
                    self.ai_players[player].time_limit = AI_TIME_LIMIT_SECONDS
            
            self._set_status("Performance mode disabled - normal AI strength and effects")
    
    def _on_speed_changed(self, value: float) -> None:
        """Handle AI speed slider change."""
        # This method can be removed since speed slider is removed
        pass
    
    # Game logic methods
    def _check_ai_turn(self) -> None:
        """Check if it's an AI player's turn and start AI move if needed."""
        if (not self.ai_thinking and 
            not self.board.is_game_over() and
            self.ai_players[self.current_player] is not None):
            
            self._start_ai_move()
    
    def _start_ai_move(self) -> None:
        """Start AI move calculation in a background thread."""
        if self.ai_thinking:
            return
        
        self.ai_thinking = True
        self.thinking_dots = 0
        self._update_thinking_status()
        
        # Start AI calculation in background thread
        self._ai_thread = threading.Thread(
            target=self._calculate_ai_move,
            daemon=True
        )
        self._ai_thread.start()
    
    def _update_thinking_status(self) -> None:
        """Update the thinking status with animated dots."""
        if not self.ai_thinking:
            return
        
        try:
            player_name = player_to_string(self.current_player)
            dots = "." * (self.thinking_dots % 4)
            self._set_status(f"{player_name} AI is thinking{dots}")
            
            self.thinking_dots += 1
            self.after(300, self._update_thinking_status)
        except Exception:
            # If there's an error, just stop the animation
            pass
    
    def _calculate_ai_move(self) -> None:
        """Calculate AI move in background thread."""
        try:
            ai_player = self.ai_players[self.current_player]
            move, stats = ai_player.select_move(self.board, self.current_player)
            
            # Schedule UI update on main thread
            self.after(10, lambda: self._apply_ai_move(move, stats))
            
        except Exception as e:
            print(f"AI calculation error: {e}")
            self.after(10, lambda: self._handle_ai_error())
    
    def _apply_ai_move(self, move, stats) -> None:
        """Apply AI move and update UI."""
        self.ai_thinking = False
        
        player_name = player_to_string(self.current_player)
        
        if move is None:
            # AI chose to pass
            self.board.pass_move()
            self._log_move(f"{player_name} (AI) passed [{stats.nodes_evaluated} nodes, {stats.search_time:.2f}s]")
        else:
            # AI made a move
            row, col = move
            if self.board.place_stone(row, col, self.current_player):
                self._log_move(f"{player_name} (AI) played at ({row},{col}) [{stats.nodes_evaluated} nodes, {stats.search_time:.2f}s]")
            else:
                # Illegal move (should not happen)
                self.board.pass_move()
                self._log_move(f"{player_name} (AI) made illegal move, passed instead")
        
        self._add_to_history()
        self.current_player = get_opponent(self.current_player)
        self._update_display()
        
        if self.board.is_game_over():
            self._handle_game_over()
        else:
            self._check_ai_turn()
    
    def _handle_ai_error(self) -> None:
        """Handle AI calculation errors."""
        self.ai_thinking = False
        self._set_status("AI encountered an error. Making pass move.")
        
        self.board.pass_move()
        self._add_to_history()
        self._log_move(f"{player_to_string(self.current_player)} (AI) error - passed")
        self.current_player = get_opponent(self.current_player)
        self._update_display()
        
        if not self.board.is_game_over():
            self._check_ai_turn()
    
    def _handle_game_over(self) -> None:
        """Handle game over condition."""
        black_score, white_score = self.board.get_final_score()
        
        if black_score > white_score:
            winner = "Black"
        elif white_score > black_score:
            winner = "White"
        else:
            winner = "Tie"
        
        # Show results
        result_message = (
            f"Game Over!\n\n"
            f"Final Scores:\n"
            f"Black: {black_score} points\n"
            f"White: {white_score} points\n\n"
            f"Winner: {winner}"
        )
        
        msgbox.showinfo("Game Over", result_message)
        self._set_status(f"Game Over - {winner} wins!")
        self._log_move("Game finished")
    
    def _restart_game(self) -> None:
        """Restart the game."""
        self.board = Board(self.board.size)
        self.current_player = BLACK
        self.game_history = [self.board.copy()]
        self.move_log = []
        self.ai_thinking = False
        
        self._refresh_log_display()
        self._update_display()
        self._set_status("Game restarted. Black to move.")
        
        # Check if AI should make first move
        self.after(300, self._check_ai_turn)
    
    # UI update methods
    def _update_display(self) -> None:
        """Update all display elements."""
        self._update_board_display()
        self._update_game_info()
        self._update_status()
    
    def _update_board_display(self) -> None:
        """Update the board visual display."""
        self.board_renderer.render_board(self.board)
    
    def _update_game_info(self) -> None:
        """Update the game information display."""
        self.game_info.update_display(self.board)
    
    def _update_status(self) -> None:
        """Update the status bar."""
        if self.board.is_game_over():
            return  # Don't override game over status
        
        player_name = player_to_string(self.current_player)
        player_type = "AI" if self.ai_players[self.current_player] else "Human"
        
        if self.ai_thinking:
            self._set_status(f"{player_name} AI is thinking...")
        else:
            self._set_status(f"{player_name} ({player_type}) to move")
    
    def _set_status(self, message: str) -> None:
        """Set the status bar message."""
        self.status_label.configure(text=message)
    
    def _add_to_history(self) -> None:
        """Add current board state to history."""
        self.game_history.append(self.board.copy())
        # Limit history size to prevent memory issues
        if len(self.game_history) > 200:
            self.game_history.pop(0)
    
    def _log_move(self, message: str) -> None:
        """Add a message to the move log."""
        self.move_log.append(message)
        self._refresh_log_display()
    
    def _refresh_log_display(self) -> None:
        """Refresh the move log display."""
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.insert("1.0", "\n".join(self.move_log))
        self.log_text.see("end")
        self.log_text.config(state="disabled")

"""
Modern Go (simplified) — Python + customtkinter
Features:
- Resizable dynamic board (default 9x9)
- Minimax (plain) & Minimax with Alpha-Beta pruning (toggle)
- Move log + node counter
- Undo, Pass, Restart, AI-vs-AI autoplay
- Bottom status bar, polished sidebar UI
- Final scoring: stones + captures + territory estimate
Notes:
- This is a simplified Go implementation (no superko / komi / final dead-stone negotiation).
- Designed for demo / learning and small boards (9x9 recommended).
"""

import copy
import math
import random
import time
import threading
import customtkinter as ctk
import tkinter.scrolledtext as scrolled
import tkinter.messagebox as msgbox

# ------------------ Configuration ------------------
BOARD_SIZE = 9           # default board (9x9). You can change to 5 or 13 (19 will be slow)
EMPTY, BLACK, WHITE = 0, 1, 2
DEFAULT_AI_DEPTH = 3

# Node counting for analysis
NODE_COUNT = 0


# ------------------ Board & Game Logic ------------------
class Board:
    def __init__(self, size=BOARD_SIZE):
        self.size = size
        self.grid = [[EMPTY for _ in range(size)] for _ in range(size)]
        self.captured = {BLACK: 0, WHITE: 0}
        self.consecutive_passes = 0
        self.last_move = None

    def copy(self):
        b = Board(self.size)
        b.grid = [row[:] for row in self.grid]
        b.captured = dict(self.captured)
        b.consecutive_passes = self.consecutive_passes
        b.last_move = self.last_move
        return b

    def in_bounds(self, r, c):
        return 0 <= r < self.size and 0 <= c < self.size

    def neighbors(self, r, c):
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if self.in_bounds(nr, nc):
                yield nr, nc

    def place_stone(self, r, c, player):
        # illegal if out of bounds or occupied
        if not self.in_bounds(r, c) or self.grid[r][c] != EMPTY:
            return False
        # simulate to check suicide
        test = self.copy()
        test.grid[r][c] = player
        removed = test.remove_dead_groups(opponent(player))
        # suicide check: placed stone's group must have liberties
        if test.group_liberties(r, c) == 0:
            return False
        # apply move
        self.grid[r][c] = player
        removed_real = self.remove_dead_groups(opponent(player))
        self.captured[player] += removed_real
        self.consecutive_passes = 0
        self.last_move = (r, c)
        return True

    def pass_move(self):
        self.consecutive_passes += 1
        self.last_move = None

    def group_at(self, r, c):
        color = self.grid[r][c]
        if color == EMPTY:
            return []
        visited = set()
        stack = [(r, c)]
        while stack:
            x, y = stack.pop()
            if (x, y) in visited:
                continue
            visited.add((x, y))
            for nx, ny in self.neighbors(x, y):
                if self.grid[nx][ny] == color and (nx, ny) not in visited:
                    stack.append((nx, ny))
        return list(visited)

    def group_liberties(self, r, c):
        if self.grid[r][c] == EMPTY:
            return 0
        group = self.group_at(r, c)
        libs = set()
        for x, y in group:
            for nx, ny in self.neighbors(x, y):
                if self.grid[nx][ny] == EMPTY:
                    libs.add((nx, ny))
        return len(libs)

    def remove_dead_groups(self, color):
        removed = 0
        visited = set()
        for r in range(self.size):
            for c in range(self.size):
                if self.grid[r][c] == color and (r, c) not in visited:
                    group = self.group_at(r, c)
                    for g in group:
                        visited.add(g)
                    # check liberties
                    has_lib = False
                    for x, y in group:
                        for nx, ny in self.neighbors(x, y):
                            if self.grid[nx][ny] == EMPTY:
                                has_lib = True
                                break
                        if has_lib:
                            break
                    if not has_lib:
                        for x, y in group:
                            self.grid[x][y] = EMPTY
                            removed += 1
        return removed

    def legal_moves(self, player):
        moves = []
        for r in range(self.size):
            for c in range(self.size):
                if self.grid[r][c] != EMPTY:
                    continue
                test = self.copy()
                if test.place_stone(r, c, player):
                    moves.append((r, c))
        moves.append(None)  # pass
        return moves

    def is_game_over(self):
        return self.consecutive_passes >= 2

    def score(self):
        black_stones = sum(1 for r in range(self.size) for c in range(self.size) if self.grid[r][c] == BLACK)
        white_stones = sum(1 for r in range(self.size) for c in range(self.size) if self.grid[r][c] == WHITE)
        return black_stones + self.captured[BLACK], white_stones + self.captured[WHITE]

    def territory_estimate(self):
        visited = [[False]*self.size for _ in range(self.size)]
        b_terr, w_terr = 0, 0
        for r in range(self.size):
            for c in range(self.size):
                if self.grid[r][c] != EMPTY or visited[r][c]:
                    continue
                queue = [(r, c)]
                front = 0
                visited[r][c] = True
                area = []
                bordering = set()
                while front < len(queue):
                    x, y = queue[front]; front += 1
                    area.append((x, y))
                    for nx, ny in self.neighbors(x, y):
                        if self.grid[nx][ny] == EMPTY and not visited[nx][ny]:
                            visited[nx][ny] = True
                            queue.append((nx, ny))
                        elif self.grid[nx][ny] in (BLACK, WHITE):
                            bordering.add(self.grid[nx][ny])
                if len(bordering) == 1:
                    if BLACK in bordering:
                        b_terr += len(area)
                    elif WHITE in bordering:
                        w_terr += len(area)
        return b_terr, w_terr


def opponent(p):
    return BLACK if p == WHITE else WHITE


# ------------------ Heuristic ------------------
def heuristic(board: Board, player):
    b_score, w_score = board.score()
    b_t, w_t = board.territory_estimate()
    # weights can be tuned
    return (b_score - w_score) + 0.5*(b_t - w_t) if player == BLACK else (w_score - b_score) + 0.5*(w_t - b_t)


# ------------------ Minimax & Alpha-Beta (with node counts) ------------------
def minimax_plain(board: Board, depth: int, player: int, maximizing_player: int):
    global NODE_COUNT
    NODE_COUNT += 1
    if board.is_game_over() or depth == 0:
        return heuristic(board, maximizing_player), None

    legal = board.legal_moves(player)
    if not legal:
        return heuristic(board, maximizing_player), None

    best_move = None
    if player == maximizing_player:
        value = -math.inf
        # simple ordering: prefer captures & center
        scored = []
        for m in legal:
            if m is None:
                scored.append((0, m))
            else:
                r, c = m
                center_pref = -(((r - board.size/2)**2 + (c - board.size/2)**2))
                scored.append((center_pref, m))
        scored.sort(reverse=True)
        for _, move in scored:
            newb = board.copy()
            if move is None:
                newb.pass_move()
            else:
                newb.place_stone(move[0], move[1], player)
            val, _ = minimax_plain(newb, depth-1, opponent(player), maximizing_player)
            if val > value:
                value = val
                best_move = move
        return value, best_move
    else:
        value = math.inf
        scored = []
        for m in legal:
            if m is None:
                scored.append((0, m))
            else:
                r, c = m
                center_pref = -(((r - board.size/2)**2 + (c - board.size/2)**2))
                scored.append((center_pref, m))
        scored.sort()
        for _, move in scored:
            newb = board.copy()
            if move is None:
                newb.pass_move()
            else:
                newb.place_stone(move[0], move[1], player)
            val, _ = minimax_plain(newb, depth-1, opponent(player), maximizing_player)
            if val < value:
                value = val
                best_move = move
        return value, best_move


def minimax_alpha_beta(board: Board, depth: int, player: int, maximizing_player: int, alpha=-math.inf, beta=math.inf):
    global NODE_COUNT
    NODE_COUNT += 1
    if board.is_game_over() or depth == 0:
        return heuristic(board, maximizing_player), None

    legal = board.legal_moves(player)
    if not legal:
        return heuristic(board, maximizing_player), None

    best_move = None
    if player == maximizing_player:
        value = -math.inf
        scored = []
        for m in legal:
            if m is None:
                scored.append((0, m))
            else:
                r, c = m
                center_pref = -(((r - board.size/2)**2 + (c - board.size/2)**2))
                scored.append((center_pref, m))
        scored.sort(reverse=True)
        for _, move in scored:
            newb = board.copy()
            if move is None:
                newb.pass_move()
            else:
                newb.place_stone(move[0], move[1], player)
            val, _ = minimax_alpha_beta(newb, depth-1, opponent(player), maximizing_player, alpha, beta)
            if val > value:
                value = val
                best_move = move
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value, best_move
    else:
        value = math.inf
        scored = []
        for m in legal:
            if m is None:
                scored.append((0, m))
            else:
                r, c = m
                center_pref = -(((r - board.size/2)**2 + (c - board.size/2)**2))
                scored.append((center_pref, m))
        scored.sort()
        for _, move in scored:
            newb = board.copy()
            if move is None:
                newb.pass_move()
            else:
                newb.place_stone(move[0], move[1], player)
            val, _ = minimax_alpha_beta(newb, depth-1, opponent(player), maximizing_player, alpha, beta)
            if val < value:
                value = val
                best_move = move
            beta = min(beta, value)
            if beta <= alpha:
                break
        return value, best_move


def ai_select_move(board: Board, player: int, depth=DEFAULT_AI_DEPTH, use_alpha_beta=True):
    global NODE_COUNT
    NODE_COUNT = 0
    start = time.time()
    if use_alpha_beta:
        val, move = minimax_alpha_beta(board, depth, player, player, -math.inf, math.inf)
    else:
        val, move = minimax_plain(board, depth, player, player)
    duration = time.time() - start
    return move, NODE_COUNT, duration


# ------------------ GUI ------------------
class GoApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Go — Minimax & Alpha-Beta (Polished)")
        self.minsize(900, 620)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        # Game state
        self.board = Board(BOARD_SIZE)
        self.current_player = BLACK  # human is black by default
        self.ai_depth = DEFAULT_AI_DEPTH
        self.use_alpha_beta = True
        self.ai_vs_ai = False
        self.ai_enabled = {BLACK: False, WHITE: True}
        self.move_history = []  # history of boards for undo
        self.move_log = []      # human readable log strings
        self.hover_pos = None   # (r, c) hovered intersection

        # Layout configuration
        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Left: board canvas
        self.canvas_frame = ctk.CTkFrame(self, corner_radius=12)
        self.canvas_frame.grid(row=0, column=0, padx=12, pady=12, sticky="nsew")
        self.canvas_frame.grid_rowconfigure(0, weight=1)
        self.canvas_frame.grid_columnconfigure(0, weight=1)

        self.canvas = ctk.CTkCanvas(self.canvas_frame, background="#EECFA1", highlightthickness=0)
        self.canvas.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<Motion>", self.on_canvas_motion)
        self.canvas.bind("<Leave>", self.on_canvas_leave)
        # redraw on resize
        self.canvas.bind("<Configure>", lambda e: self.redraw_board())

        # Right: controls
        self.side_frame = ctk.CTkScrollableFrame(self, width=320, corner_radius=12, label_text="Game Panel")
        self.side_frame.grid(row=0, column=1, padx=12, pady=12, sticky="nsew")
        self.side_frame.grid_columnconfigure(0, weight=1)

        # Board Size Selection
        ctk.CTkLabel(self.side_frame, text="Board Size", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, pady=(8, 4), sticky="w", padx=8)
        self.board_size_seg = ctk.CTkSegmentedButton(
            self.side_frame,
            values=["5x5", "9x9", "13x13", "19x19"],
            command=self.on_board_size_select,
            corner_radius=6,
            selected_color="#1F538D",
            selected_hover_color="#14375E"
        )
        self.board_size_seg.set(f"{BOARD_SIZE}x{BOARD_SIZE}")
        self.board_size_seg.grid(row=1, column=0, padx=8, pady=(0, 12), sticky="ew")

        # Game Controls grouping
        ctk.CTkLabel(self.side_frame, text="Actions", font=ctk.CTkFont(size=14, weight="bold")).grid(row=2, column=0, pady=(4, 4), sticky="w", padx=8)
        controls_frame = ctk.CTkFrame(self.side_frame, corner_radius=8)
        controls_frame.grid(row=3, column=0, padx=8, pady=(0, 12), sticky="ew")
        controls_frame.grid_columnconfigure((0, 1), weight=1)

        # Sleek Square Action Buttons
        self.btn_pass = ctk.CTkButton(
            controls_frame, text="PASS", command=self.on_pass,
            corner_radius=6, height=36, font=ctk.CTkFont(weight="bold"),
            fg_color="#34495E", hover_color="#2C3E50"
        )
        self.btn_pass.grid(row=0, column=0, padx=6, pady=6, sticky="ew")

        self.btn_undo = ctk.CTkButton(
            controls_frame, text="UNDO", command=self.on_undo,
            corner_radius=6, height=36, font=ctk.CTkFont(weight="bold"),
            fg_color="#D97706", hover_color="#B45309"
        )
        self.btn_undo.grid(row=0, column=1, padx=6, pady=6, sticky="ew")

        self.btn_restart = ctk.CTkButton(
            controls_frame, text="NEW GAME", command=self.on_restart,
            corner_radius=6, height=36, font=ctk.CTkFont(weight="bold"),
            fg_color="#DC2626", hover_color="#B91C1C"
        )
        self.btn_restart.grid(row=1, column=0, columnspan=2, padx=6, pady=(0, 6), sticky="ew")

        # AI settings
        ctk.CTkLabel(self.side_frame, text="AI Settings", font=ctk.CTkFont(size=14, weight="bold")).grid(row=4, column=0, pady=(4, 4), sticky="w", padx=8)
        ai_frame = ctk.CTkFrame(self.side_frame, corner_radius=8)
        ai_frame.grid(row=5, column=0, padx=8, pady=(0, 12), sticky="ew")
        ai_frame.grid_columnconfigure(0, weight=1)

        # Depth slider
        self.depth_label = ctk.CTkLabel(ai_frame, text=f"AI Strength: Level {self.ai_depth}", font=ctk.CTkFont(size=12, weight="bold"))
        self.depth_label.grid(row=0, column=0, sticky="w", padx=8, pady=(6, 2))
        self.depth_slider = ctk.CTkSlider(ai_frame, from_=1, to=5, number_of_steps=4, command=self.on_depth_change)
        self.depth_slider.set(self.ai_depth)
        self.depth_slider.grid(row=1, column=0, sticky="ew", padx=8, pady=(0, 8))

        # Algorithm toggle
        self.algo_switch = ctk.CTkSwitch(ai_frame, text="Use Alpha-Beta (faster)", command=self.on_algo_toggle)
        self.algo_switch.select()
        self.algo_switch.grid(row=2, column=0, pady=4, padx=8, sticky="w")

        # AI vs AI toggle
        self.ai_vs_ai_switch = ctk.CTkSwitch(ai_frame, text="AI vs AI autoplay", command=self.on_ai_vs_ai_toggle)
        self.ai_vs_ai_switch.deselect()
        self.ai_vs_ai_switch.grid(row=3, column=0, pady=(4, 8), padx=8, sticky="w")

        # Player Setup
        ctk.CTkLabel(self.side_frame, text="AI Side Selection", font=ctk.CTkFont(size=14, weight="bold")).grid(row=6, column=0, pady=(4, 4), sticky="w", padx=8)
        self.player_ai_frame = ctk.CTkFrame(self.side_frame, corner_radius=8)
        self.player_ai_frame.grid(row=7, column=0, padx=8, pady=(0, 12), sticky="ew")
        self.player_ai_frame.grid_columnconfigure(0, weight=1)

        self.ai_side_seg = ctk.CTkSegmentedButton(
            self.player_ai_frame,
            values=["White AI", "Black AI", "Both AI", "No AI"],
            command=self.on_ai_side_select,
            corner_radius=6,
            selected_color="#1F538D",
            selected_hover_color="#14375E"
        )
        self.ai_side_seg.set("White AI")
        self.ai_side_seg.grid(row=0, column=0, padx=6, pady=8, sticky="ew")

        # Move log & node counter
        ctk.CTkLabel(self.side_frame, text="Move History", font=ctk.CTkFont(size=14, weight="bold")).grid(row=8, column=0, pady=(4, 4), sticky="w", padx=8)
        self.log_box = scrolled.ScrolledText(
            self.side_frame, height=9, state="disabled", wrap="word",
            bg="#121212", fg="#00FF9D", insertbackground="#00FF9D",
            font=("Consolas", 9), relief="flat"
        )
        self.log_box.grid(row=9, column=0, padx=8, pady=(0, 8), sticky="nsew")

        # Bottom status bar
        self.status_bar = ctk.CTkLabel(self, text="Welcome — Black to play", anchor="w", font=ctk.CTkFont(size=13, weight="bold"))
        self.status_bar.grid(row=1, column=0, columnspan=2, sticky="ew", padx=12, pady=(0, 12))

        # initial render
        self.push_history("Game start")
        self.redraw_board()

        # If AI to move at start, trigger
        self._ai_thread = None
        self.after(300, self.check_ai_turn)

    # ------------- UI helpers -------------
    def on_board_size_select(self, choice: str):
        size = int(choice.split('x')[0])
        if size != self.board.size:
            self.board = Board(size)
            self.current_player = BLACK
            self.move_history.clear()
            self.move_log.clear()
            self.log_box.config(state="normal")
            self.log_box.delete("1.0", "end")
            self.log_box.config(state="disabled")
            self.push_history(f"Board size changed to {size}x{size}")
            self.set_status(f"New {size}x{size} game started — Black to play")
            self.redraw_board()

    def redraw_board(self):
        self.canvas.delete("all")
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()
        size_px = min(w, h)
        margin = int(size_px * 0.06)
        board_px = size_px - 2*margin
        cell = board_px // (self.board.size - 1) if self.board.size > 1 else board_px
        origin_x = (w - board_px) // 2
        origin_y = (h - board_px) // 2

        # store geometry for click mapping
        self._geometry = dict(origin_x=origin_x, origin_y=origin_y, cell=cell, margin=margin)

        # background
        self.canvas.create_rectangle(origin_x-4, origin_y-4, origin_x+board_px+4, origin_y+board_px+4, fill="#E6CBA8", outline="")

        # grid lines
        for i in range(self.board.size):
            x = origin_x + i*cell
            y0 = origin_y
            y1 = origin_y + (self.board.size-1)*cell
            self.canvas.create_line(x, y0, x, y1, width=2, fill="#5A3E1B")
            y = origin_y + i*cell
            x0 = origin_x
            x1 = origin_x + (self.board.size-1)*cell
            self.canvas.create_line(x0, y, x1, y, width=2, fill="#5A3E1B")

        # hoshi / star points for common sizes
        star_points = []
        if self.board.size >= 9:
            coords = [2, self.board.size//2, self.board.size-3]
            star_points = [(r, c) for r in coords for c in coords]
        elif self.board.size >= 5:
            coords = [1, self.board.size//2, self.board.size-2] if self.board.size >= 7 else [1, self.board.size-2]
            star_points = [(r, c) for r in coords for c in coords]
        for r, c in star_points:
            cx = origin_x + c*cell
            cy = origin_y + r*cell
            self.canvas.create_oval(cx-4, cy-4, cx+4, cy+4, fill="#5A3E1B")

        # draw stones
        radius = max(6, int(cell*0.38))
        for r in range(self.board.size):
            for c in range(self.board.size):
                val = self.board.grid[r][c]
                if val != EMPTY:
                    cx = origin_x + c*cell
                    cy = origin_y + r*cell
                    if val == BLACK:
                        self.canvas.create_oval(cx-radius, cy-radius, cx+radius, cy+radius, fill="black", outline="#333", width=1)
                    else:
                        self.canvas.create_oval(cx-radius, cy-radius, cx+radius, cy+radius, fill="white", outline="#333", width=1)
        # highlight last move
        if self.board.last_move:
            r, c = self.board.last_move
            cx = origin_x + c*cell
            cy = origin_y + r*cell
            self.canvas.create_rectangle(cx-radius-3, cy-radius-3, cx+radius+3, cy+radius+3, outline="#EF4444", width=2)

        # draw ghost stone hover preview
        if self.hover_pos and not self.ai_enabled.get(self.current_player, False):
            hr, hc = self.hover_pos
            if self.board.in_bounds(hr, hc) and self.board.grid[hr][hc] == EMPTY:
                cx = origin_x + hc*cell
                cy = origin_y + hr*cell
                ghost_color = "#444444" if self.current_player == BLACK else "#FAFAFA"
                outline_color = "#3B82F6"
                self.canvas.create_oval(cx-radius, cy-radius, cx+radius, cy+radius, fill="", outline=outline_color, width=2, dash=(4, 4))

    def on_canvas_motion(self, event):
        geo = getattr(self, "_geometry", None)
        if not geo:
            return
        ox, oy, cell = geo["origin_x"], geo["origin_y"], geo["cell"]
        x = round((event.x - ox) / cell)
        y = round((event.y - oy) / cell)
        if 0 <= x < self.board.size and 0 <= y < self.board.size:
            if self.hover_pos != (y, x):
                self.hover_pos = (y, x)
                self.redraw_board()
        else:
            if self.hover_pos is not None:
                self.hover_pos = None
                self.redraw_board()

    def on_canvas_leave(self, event):
        if self.hover_pos is not None:
            self.hover_pos = None
            self.redraw_board()

    def push_history(self, log_msg=None):
        # store a copy for undo
        self.move_history.append(self.board.copy())
        if log_msg:
            self.append_log(log_msg)

    def append_log(self, text):
        self.move_log.append(text)
        self.log_box.config(state="normal")
        self.log_box.insert("end", text + "\n")
        self.log_box.see("end")
        self.log_box.config(state="disabled")

    def set_status(self, text):
        self.status_bar.configure(text=text)

    # ------------- controls -------------
    def on_depth_change(self, val):
        self.ai_depth = int(float(val))
        if hasattr(self, 'depth_label'):
            self.depth_label.configure(text=f"AI Strength: Level {self.ai_depth}")
        self.set_status(f"AI depth set to level {self.ai_depth}")

    def on_algo_toggle(self):
        self.use_alpha_beta = bool(self.algo_switch.get())
        self.set_status(f"Algorithm: {'Alpha-Beta' if self.use_alpha_beta else 'Plain Minimax'}")

    def on_ai_side_select(self, choice: str):
        if choice == "White AI":
            self.ai_enabled[BLACK] = False
            self.ai_enabled[WHITE] = True
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()
            self.set_status("AI plays White (You play Black)")
        elif choice == "Black AI":
            self.ai_enabled[BLACK] = True
            self.ai_enabled[WHITE] = False
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()
            self.set_status("AI plays Black (You play White)")
        elif choice == "Both AI":
            self.ai_enabled[BLACK] = True
            self.ai_enabled[WHITE] = True
            self.ai_vs_ai = True
            self.ai_vs_ai_switch.select()
            self.set_status("AI vs AI Autoplay enabled")
        elif choice == "No AI":
            self.ai_enabled[BLACK] = False
            self.ai_enabled[WHITE] = False
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()
            self.set_status("2 Players Mode (Human vs Human)")
        self.after(200, self.check_ai_turn)

    def on_ai_vs_ai_toggle(self):
        self.ai_vs_ai = bool(self.ai_vs_ai_switch.get())
        if self.ai_vs_ai:
            self.ai_side_seg.set("Both AI")
            self.ai_enabled[BLACK] = self.ai_enabled[WHITE] = True
            self.set_status("AI vs AI autoplay enabled")
            self.after(200, self.check_ai_turn)
        else:
            self.ai_side_seg.set("White AI")
            self.ai_enabled[BLACK] = False; self.ai_enabled[WHITE] = True
            self.set_status("AI vs AI disabled — AI plays White")

    def on_pass(self):
        self.push_history(f"{'Black' if self.current_player==BLACK else 'White'} passed")
        self.board.pass_move()
        self.append_log(f"{'Black' if self.current_player==BLACK else 'White'} passed")
        self.current_player = opponent(self.current_player)
        self.redraw_board()
        if self.board.is_game_over():
            self.finish_game()
        else:
            self.check_ai_turn()

    def on_undo(self):
        if len(self.move_history) <= 1:
            self.set_status("Nothing to undo")
            return
        # pop current state, revert to previous
        self.move_history.pop()
        self.board = self.move_history[-1].copy()
        # also remove last log (best-effort)
        if self.move_log:
            self.move_log.pop()
            self.log_box.config(state="normal")
            self.log_box.delete("1.0", "end")
            self.log_box.insert("1.0", "\n".join(self.move_log))
            self.log_box.config(state="disabled")
        self.current_player = BLACK if self.current_player == WHITE else WHITE
        self.set_status("Undo successful")
        self.redraw_board()

    def on_restart(self):
        # confirmation
        if msgbox.askyesno("Restart", "Restart the game?"):
            self.board = Board(self.board.size)
            self.current_player = BLACK
            self.move_history.clear()
            self.move_log.clear()
            self.log_box.config(state="normal")
            self.log_box.delete("1.0", "end")
            self.log_box.config(state="disabled")
            self.push_history("Game restarted")
            self.set_status("Game restarted — Black to move")
            self.redraw_board()

    # ------------- clicking & mapping -------------
    def on_canvas_click(self, event):
        if self._ai_thread and self._ai_thread.is_alive():
            # ignore clicks while AI thinking
            self.set_status("AI is thinking — please wait")
            return
        geo = getattr(self, "_geometry", None)
        if not geo:
            return
        ox, oy, cell = geo["origin_x"], geo["origin_y"], geo["cell"]
        # map click to nearest intersection
        x = round((event.x - ox) / cell)
        y = round((event.y - oy) / cell)
        # bounds check
        if not (0 <= x < self.board.size and 0 <= y < self.board.size):
            return
        r, c = y, x  # note: we used c as horizontal
        # only allow human to play if their side is not AI
        if self.ai_enabled.get(self.current_player, False):
            self.set_status("This side is controlled by AI — toggle AI off to play")
            return
        moved = self.board.place_stone(r, c, self.current_player)
        if not moved:
            self.set_status("Illegal move")
            return
        # record
        who = "Black" if self.current_player == BLACK else "White"
        self.push_history(f"{who} played at ({r}, {c})")
        self.append_log(f"{who} played at ({r}, {c})")
        self.current_player = opponent(self.current_player)
        self.set_status(f"{who} moved — now {'Black' if self.current_player==BLACK else 'White'} to move")
        self.redraw_board()
        if self.board.is_game_over():
            self.finish_game()
            return
        self.check_ai_turn()

    # ------------- AI thread handling -------------
    def check_ai_turn(self):
        # If AI vs AI or current player's side is AI, trigger AI
        if self.ai_enabled.get(self.current_player, False):
            # run AI move in background thread to keep UI responsive
            if not (self._ai_thread and self._ai_thread.is_alive()):
                self._ai_thread = threading.Thread(target=self.run_ai_move, daemon=True)
                self._ai_thread.start()

    def run_ai_move(self):
        # disable interactions while AI thinking
        self.set_status(f"AI thinking... (depth {self.ai_depth})")
        # get move and node counts
        temp_board = self.board.copy()
        move, nodes, duration = ai_select_move(temp_board, self.current_player, depth=self.ai_depth, use_alpha_beta=self.use_alpha_beta)
        # apply result on main thread
        def apply_move():
            nonlocal move, nodes, duration
            who = "Black" if self.current_player == BLACK else "White"
            if move is None:
                self.board.pass_move()
                self.append_log(f"{who} (AI) passed [{nodes} nodes, {duration:.2f}s]")
            else:
                r, c = move
                ok = self.board.place_stone(r, c, self.current_player)
                if not ok:
                    # rare: AI found illegal due to race; treat as pass
                    self.board.pass_move()
                    self.append_log(f"{who} (AI) attempted illegal move and passed [{nodes} nodes]")
                else:
                    self.append_log(f"{who} (AI) played at ({r},{c}) [{nodes} nodes, {duration:.2f}s]")
            self.push_history(f"{who} move applied by AI (nodes={nodes})")
            # update node info in log as well (already included)
            self.current_player = opponent(self.current_player)
            self.redraw_board()
            if self.board.is_game_over():
                self.finish_game()
                return
            # if AI-vs-AI continue
            if self.ai_vs_ai:
                self.after(200, self.check_ai_turn)
            else:
                self.set_status(f"{'Black' if self.current_player==BLACK else 'White'} to move")
        # schedule apply_move on main loop
        self.after(1, apply_move)

    # ------------- Endgame & scoring -------------
    def finish_game(self):
        b, w = self.board.score()
        bt, wt = self.board.territory_estimate()
        total_b = b + bt
        total_w = w + wt
        winner = "Black" if total_b > total_w else "White" if total_w > total_b else "Tie"
        summary = (
            f"Game Over\n\n"
            f"Black stones: {b}\nWhite stones: {w}\n\n"
            f"Estimated territory — Black: {bt}, White: {wt}\n\n"
            f"Final score — Black: {total_b}, White: {total_w}\n\nWinner: {winner}"
        )
        self.append_log("Game finished")
        msgbox.showinfo("Game Over", summary)
        self.set_status("Game over — " + winner)

# ------------------ Utility: AI wrapper (calls minimax functions) ------------------
def ai_select_move(board: Board, player: int, depth=DEFAULT_AI_DEPTH, use_alpha_beta=True):
    global NODE_COUNT
    NODE_COUNT = 0
    start = time.time()
    if use_alpha_beta:
        val, move = minimax_alpha_beta(board, depth, player, player, -math.inf, math.inf)
    else:
        val, move = minimax_plain(board, depth, player, player)
    duration = time.time() - start
    return move, NODE_COUNT, duration


# ------------------ Run app ------------------
if __name__ == "__main__":
    app = GoApp()
    app.mainloop()

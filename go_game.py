"""
Modern Go Game — Python + CustomTkinter

Features:
- Resizable Go board: 5x5, 9x9, 13x13, 19x19
- Minimax and Alpha-Beta pruning
- Adjustable AI depth
- Human vs AI, Human vs Human, AI vs AI
- Move history, undo, pass, restart
- Final score breakdown
- Winner, draw, and winning margin
- Area scoring with komi

Note:
This is a simplified Go implementation for learning purposes.
It does not implement superko or dead-stone negotiation.
"""

import math
import time
import threading
import customtkinter as ctk
import tkinter.scrolledtext as scrolled
import tkinter.messagebox as msgbox


# ---------------- Configuration ----------------

BOARD_SIZE = 9
EMPTY, BLACK, WHITE = 0, 1, 2
DEFAULT_AI_DEPTH = 3
WHITE_KOMI = 6.5

NODE_COUNT = 0


# ---------------- Board Logic ----------------

def opponent(player):
    return WHITE if player == BLACK else BLACK


class Board:
    def __init__(self, size=BOARD_SIZE):
        self.size = size
        self.grid = [[EMPTY for _ in range(size)]
                     for _ in range(size)]
        self.captured = {BLACK: 0, WHITE: 0}
        self.consecutive_passes = 0
        self.last_move = None

    def copy(self):
        board = Board(self.size)
        board.grid = [row[:] for row in self.grid]
        board.captured = dict(self.captured)
        board.consecutive_passes = self.consecutive_passes
        board.last_move = self.last_move
        return board

    def in_bounds(self, r, c):
        return 0 <= r < self.size and 0 <= c < self.size

    def neighbors(self, r, c):
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if self.in_bounds(nr, nc):
                yield nr, nc

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
                if (
                    self.grid[nx][ny] == color
                    and (nx, ny) not in visited
                ):
                    stack.append((nx, ny))

        return list(visited)

    def group_liberties(self, r, c):
        if self.grid[r][c] == EMPTY:
            return 0

        liberties = set()

        for x, y in self.group_at(r, c):
            for nx, ny in self.neighbors(x, y):
                if self.grid[nx][ny] == EMPTY:
                    liberties.add((nx, ny))

        return len(liberties)

    def remove_dead_groups(self, color):
        removed = 0
        visited = set()

        for r in range(self.size):
            for c in range(self.size):
                if (
                    self.grid[r][c] != color
                    or (r, c) in visited
                ):
                    continue

                group = self.group_at(r, c)
                visited.update(group)

                has_liberty = any(
                    self.grid[nx][ny] == EMPTY
                    for x, y in group
                    for nx, ny in self.neighbors(x, y)
                )

                if not has_liberty:
                    for x, y in group:
                        self.grid[x][y] = EMPTY
                        removed += 1

        return removed

    def place_stone(self, r, c, player):
        if not self.in_bounds(r, c):
            return False

        if self.grid[r][c] != EMPTY:
            return False

        test = self.copy()
        test.grid[r][c] = player
        test.remove_dead_groups(opponent(player))

        # Prevent suicide.
        if test.group_liberties(r, c) == 0:
            return False

        self.grid[r][c] = player

        captured = self.remove_dead_groups(opponent(player))
        self.captured[player] += captured

        self.consecutive_passes = 0
        self.last_move = (r, c)

        return True

    def pass_move(self):
        self.consecutive_passes += 1
        self.last_move = None

    def is_game_over(self):
        return self.consecutive_passes >= 2

    def legal_moves(self, player):
        moves = []

        for r in range(self.size):
            for c in range(self.size):
                if self.grid[r][c] != EMPTY:
                    continue

                test = self.copy()

                if test.place_stone(r, c, player):
                    moves.append((r, c))

        moves.append(None)  # Passing is also a move.
        return moves

    def score(self):
        black_stones = sum(
            cell == BLACK
            for row in self.grid
            for cell in row
        )

        white_stones = sum(
            cell == WHITE
            for row in self.grid
            for cell in row
        )

        return black_stones, white_stones

    def territory_estimate(self):
        visited = [
            [False] * self.size
            for _ in range(self.size)
        ]

        black_territory = 0
        white_territory = 0

        for r in range(self.size):
            for c in range(self.size):
                if (
                    self.grid[r][c] != EMPTY
                    or visited[r][c]
                ):
                    continue

                queue = [(r, c)]
                visited[r][c] = True
                area = []
                bordering = set()
                front = 0

                while front < len(queue):
                    x, y = queue[front]
                    front += 1
                    area.append((x, y))

                    for nx, ny in self.neighbors(x, y):
                        cell = self.grid[nx][ny]

                        if cell == EMPTY and not visited[nx][ny]:
                            visited[nx][ny] = True
                            queue.append((nx, ny))

                        elif cell in (BLACK, WHITE):
                            bordering.add(cell)

                # Count an empty region only if surrounded
                # by stones of one color.
                if len(bordering) == 1:
                    if BLACK in bordering:
                        black_territory += len(area)
                    else:
                        white_territory += len(area)

        return black_territory, white_territory


# ---------------- Evaluation Function ----------------

def heuristic(board, player):
    black_stones, white_stones = board.score()

    black_territory, white_territory = (
        board.territory_estimate()
    )

    black_score = black_stones + black_territory
    white_score = (
        white_stones + white_territory + WHITE_KOMI
    )

    difference = black_score - white_score

    return difference if player == BLACK else -difference


# ---------------- Minimax ----------------

def minimax_plain(board, depth, player, maximizing_player):
    global NODE_COUNT
    NODE_COUNT += 1

    if board.is_game_over() or depth == 0:
        return heuristic(board, maximizing_player), None

    legal = board.legal_moves(player)

    best_move = None

    if player == maximizing_player:
        value = -math.inf

        for move in legal:
            new_board = board.copy()

            if move is None:
                new_board.pass_move()
            else:
                new_board.place_stone(*move, player)

            score, _ = minimax_plain(
                new_board,
                depth - 1,
                opponent(player),
                maximizing_player
            )

            if score > value:
                value = score
                best_move = move

        return value, best_move

    value = math.inf

    for move in legal:
        new_board = board.copy()

        if move is None:
            new_board.pass_move()
        else:
            new_board.place_stone(*move, player)

        score, _ = minimax_plain(
            new_board,
            depth - 1,
            opponent(player),
            maximizing_player
        )

        if score < value:
            value = score
            best_move = move

    return value, best_move


# ---------------- Alpha-Beta Pruning ----------------

def minimax_alpha_beta(
    board, depth, player, maximizing_player,
    alpha=-math.inf, beta=math.inf
):
    global NODE_COUNT
    NODE_COUNT += 1

    if board.is_game_over() or depth == 0:
        return heuristic(board, maximizing_player), None

    legal = board.legal_moves(player)
    best_move = None

    if player == maximizing_player:
        value = -math.inf

        for move in legal:
            new_board = board.copy()

            if move is None:
                new_board.pass_move()
            else:
                new_board.place_stone(*move, player)

            score, _ = minimax_alpha_beta(
                new_board,
                depth - 1,
                opponent(player),
                maximizing_player,
                alpha,
                beta
            )

            if score > value:
                value = score
                best_move = move

            alpha = max(alpha, value)

            if beta <= alpha:
                break

        return value, best_move

    value = math.inf

    for move in legal:
        new_board = board.copy()

        if move is None:
            new_board.pass_move()
        else:
            new_board.place_stone(*move, player)

        score, _ = minimax_alpha_beta(
            new_board,
            depth - 1,
            opponent(player),
            maximizing_player,
            alpha,
            beta
        )

        if score < value:
            value = score
            best_move = move

        beta = min(beta, value)

        if beta <= alpha:
            break

    return value, best_move


def ai_select_move(
    board, player,
    depth=DEFAULT_AI_DEPTH,
    use_alpha_beta=True
):
    global NODE_COUNT

    NODE_COUNT = 0
    start = time.time()

    if use_alpha_beta:
        _, move = minimax_alpha_beta(
            board, depth, player, player
        )
    else:
        _, move = minimax_plain(
            board, depth, player, player
        )

    duration = time.time() - start

    return move, NODE_COUNT, duration


# ---------------- GUI Application ----------------

class GoApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Go Game — Minimax & Alpha-Beta")
        self.geometry("1100x750")
        self.minsize(850, 600)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        self.board = Board(BOARD_SIZE)
        self.current_player = BLACK
        self.ai_depth = DEFAULT_AI_DEPTH
        self.use_alpha_beta = True
        self.ai_vs_ai = False

        self.ai_enabled = {
            BLACK: False,
            WHITE: True
        }

        self.move_history = []
        self.move_log = []
        self.hover_pos = None
        self.game_finished = False
        self._ai_thread = None

        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Board canvas.
        self.canvas_frame = ctk.CTkFrame(self)
        self.canvas_frame.grid(
            row=0, column=0,
            padx=10, pady=10, sticky="nsew"
        )

        self.canvas_frame.grid_rowconfigure(0, weight=1)
        self.canvas_frame.grid_columnconfigure(0, weight=1)

        self.canvas = ctk.CTkCanvas(
            self.canvas_frame,
            background="#EECFA1",
            highlightthickness=0
        )

        self.canvas.grid(
            row=0, column=0,
            padx=10, pady=10, sticky="nsew"
        )

        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<Motion>", self.on_canvas_motion)
        self.canvas.bind("<Leave>", self.on_canvas_leave)
        self.canvas.bind("<Configure>", lambda event: self.redraw_board())

        # Sidebar.
        self.side_frame = ctk.CTkScrollableFrame(
            self,
            width=290,
            label_text="Game Panel"
        )

        self.side_frame.grid(
            row=0, column=1,
            padx=10, pady=10, sticky="nsew"
        )

        self.side_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            self.side_frame,
            text="Board Size"
        ).grid(row=0, column=0, padx=8, pady=4, sticky="w")

        self.board_size_seg = ctk.CTkSegmentedButton(
            self.side_frame,
            values=["5x5", "9x9", "13x13", "19x19"],
            command=self.on_board_size_select
        )

        self.board_size_seg.set("9x9")
        self.board_size_seg.grid(
            row=1, column=0, padx=8, pady=5, sticky="ew"
        )

        ctk.CTkLabel(
            self.side_frame,
            text="Actions"
        ).grid(row=2, column=0, padx=8, pady=4, sticky="w")

        actions = ctk.CTkFrame(self.side_frame)
        actions.grid(
            row=3, column=0,
            padx=8, pady=5, sticky="ew"
        )

        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions, text="PASS",
            command=self.on_pass
        ).grid(row=0, column=0, padx=4, pady=4, sticky="ew")

        ctk.CTkButton(
            actions, text="UNDO",
            command=self.on_undo
        ).grid(row=0, column=1, padx=4, pady=4, sticky="ew")

        ctk.CTkButton(
            actions, text="NEW GAME",
            command=self.on_restart,
            fg_color="#B91C1C"
        ).grid(
            row=1, column=0, columnspan=2,
            padx=4, pady=4, sticky="ew"
        )

        ctk.CTkLabel(
            self.side_frame,
            text="AI Settings"
        ).grid(row=4, column=0, padx=8, pady=4, sticky="w")

        self.depth_label = ctk.CTkLabel(
            self.side_frame,
            text=f"AI Strength: Level {self.ai_depth}"
        )
        self.depth_label.grid(row=5, column=0, padx=8, pady=4)

        self.depth_slider = ctk.CTkSlider(
            self.side_frame,
            from_=1, to=5,
            number_of_steps=4,
            command=self.on_depth_change
        )
        self.depth_slider.set(self.ai_depth)
        self.depth_slider.grid(
            row=6, column=0, padx=8, pady=4, sticky="ew"
        )

        self.algo_switch = ctk.CTkSwitch(
            self.side_frame,
            text="Use Alpha-Beta",
            command=self.on_algo_toggle
        )
        self.algo_switch.select()
        self.algo_switch.grid(
            row=7, column=0, padx=8, pady=4, sticky="w"
        )

        self.ai_vs_ai_switch = ctk.CTkSwitch(
            self.side_frame,
            text="AI vs AI autoplay",
            command=self.on_ai_vs_ai_toggle
        )
        self.ai_vs_ai_switch.grid(
            row=8, column=0, padx=8, pady=4, sticky="w"
        )

        ctk.CTkLabel(
            self.side_frame,
            text="AI Side Selection"
        ).grid(row=9, column=0, padx=8, pady=4, sticky="w")

        self.ai_side_seg = ctk.CTkSegmentedButton(
            self.side_frame,
            values=["White AI", "Black AI", "Both AI", "No AI"],
            command=self.on_ai_side_select
        )
        self.ai_side_seg.set("White AI")
        self.ai_side_seg.grid(
            row=10, column=0, padx=8, pady=5, sticky="ew"
        )

        ctk.CTkLabel(
            self.side_frame,
            text="Move History"
        ).grid(row=11, column=0, padx=8, pady=4, sticky="w")

        self.log_box = scrolled.ScrolledText(
            self.side_frame,
            height=12,
            bg="#121212",
            fg="#00FF9D",
            wrap="word",
            font=("Consolas", 9)
        )
        self.log_box.grid(
            row=12, column=0,
            padx=8, pady=5, sticky="ew"
        )
        self.log_box.configure(state="disabled")

        self.status_bar = ctk.CTkLabel(
            self,
            text="Black to play",
            anchor="w"
        )
        self.status_bar.grid(
            row=1, column=0, columnspan=2,
            padx=12, pady=(0, 10), sticky="ew"
        )

        self.push_history("Game started")
        self.redraw_board()

    # ---------------- UI Helpers ----------------

    def set_status(self, text):
        self.status_bar.configure(text=text)

    def append_log(self, text):
        self.move_log.append(text)

        self.log_box.configure(state="normal")
        self.log_box.insert("end", text + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def refresh_log(self):
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.insert("1.0", "\n".join(self.move_log))
        self.log_box.configure(state="disabled")

    def push_history(self, message=None):
        self.move_history.append({
            "board": self.board.copy(),
            "player": self.current_player,
            "log_length": len(self.move_log)
        })

        if message:
            self.append_log(message)

    def save_move(self, message):
        self.move_history.append({
            "board": self.board.copy(),
            "player": self.current_player,
            "log_length": len(self.move_log)
        })
        self.append_log(message)

    # ---------------- Board Drawing ----------------

    def redraw_board(self):
        self.canvas.delete("all")

        width = self.canvas.winfo_width()
        height = self.canvas.winfo_height()

        size_px = min(width, height)

        if size_px <= 1:
            return

        margin = int(size_px * 0.07)
        board_px = size_px - 2 * margin
        cell = board_px / max(1, self.board.size - 1)

        origin_x = (width - board_px) / 2
        origin_y = (height - board_px) / 2

        self._geometry = {
            "origin_x": origin_x,
            "origin_y": origin_y,
            "cell": cell
        }

        self.canvas.create_rectangle(
            origin_x - 4, origin_y - 4,
            origin_x + board_px + 4,
            origin_y + board_px + 4,
            fill="#E6CBA8",
            outline=""
        )

        for i in range(self.board.size):
            x = origin_x + i * cell
            y = origin_y + i * cell

            self.canvas.create_line(
                x, origin_y,
                x, origin_y + board_px,
                fill="#5A3E1B", width=1
            )

            self.canvas.create_line(
                origin_x, y,
                origin_x + board_px, y,
                fill="#5A3E1B", width=1
            )

        if self.board.size >= 9:
            coords = [2, self.board.size // 2, self.board.size - 3]
        else:
            coords = [1, self.board.size // 2, self.board.size - 2]

        for r in coords:
            for c in coords:
                if self.board.in_bounds(r, c):
                    x = origin_x + c * cell
                    y = origin_y + r * cell

                    self.canvas.create_oval(
                        x - 3, y - 3, x + 3, y + 3,
                        fill="#5A3E1B", outline=""
                    )

        radius = max(4, int(cell * 0.38))

        for r in range(self.board.size):
            for c in range(self.board.size):
                stone = self.board.grid[r][c]

                if stone == EMPTY:
                    continue

                x = origin_x + c * cell
                y = origin_y + r * cell

                color = "black" if stone == BLACK else "white"

                self.canvas.create_oval(
                    x - radius, y - radius,
                    x + radius, y + radius,
                    fill=color, outline="#333333"
                )

        if self.board.last_move:
            r, c = self.board.last_move
            x = origin_x + c * cell
            y = origin_y + r * cell

            self.canvas.create_rectangle(
                x - radius - 3, y - radius - 3,
                x + radius + 3, y + radius + 3,
                outline="#EF4444", width=2
            )

        if (
            self.hover_pos
            and not self.ai_enabled.get(self.current_player, False)
            and not self.game_finished
        ):
            r, c = self.hover_pos

            if (
                self.board.in_bounds(r, c)
                and self.board.grid[r][c] == EMPTY
            ):
                x = origin_x + c * cell
                y = origin_y + r * cell

                color = "#444444" if self.current_player == BLACK else "#FAFAFA"

                self.canvas.create_oval(
                    x - radius, y - radius,
                    x + radius, y + radius,
                    fill=color, outline="#3B82F6",
                    width=2, dash=(4, 4)
                )

    def on_canvas_motion(self, event):
        geo = getattr(self, "_geometry", None)

        if not geo:
            return

        c = round((event.x - geo["origin_x"]) / geo["cell"])
        r = round((event.y - geo["origin_y"]) / geo["cell"])

        if self.board.in_bounds(r, c):
            if self.hover_pos != (r, c):
                self.hover_pos = (r, c)
                self.redraw_board()
        elif self.hover_pos is not None:
            self.hover_pos = None
            self.redraw_board()

    def on_canvas_leave(self, event):
        self.hover_pos = None
        self.redraw_board()

    # ---------------- Player Moves ----------------

    def on_canvas_click(self, event):
        if self.game_finished:
            return

        if self._ai_thread and self._ai_thread.is_alive():
            self.set_status("AI is thinking. Please wait.")
            return

        if self.ai_enabled.get(self.current_player, False):
            self.set_status("This side is controlled by AI.")
            return

        geo = getattr(self, "_geometry", None)

        if not geo:
            return

        c = round((event.x - geo["origin_x"]) / geo["cell"])
        r = round((event.y - geo["origin_y"]) / geo["cell"])

        if not self.board.in_bounds(r, c):
            return

        player = self.current_player

        if not self.board.place_stone(r, c, player):
            self.set_status("Illegal move")
            return

        self.save_move(
            f"{self.player_name(player)} played at ({r}, {c})"
        )

        self.current_player = opponent(player)
        self.redraw_board()

        self.set_status(
            f"{self.player_name(self.current_player)} to play"
        )

        self.check_game_over()
        self.check_ai_turn()

    def on_pass(self):
        if self.game_finished:
            return

        if self.ai_enabled.get(self.current_player, False):
            self.set_status("Wait for the AI to finish.")
            return

        player = self.current_player

        self.board.pass_move()
        self.save_move(f"{self.player_name(player)} passed")

        self.current_player = opponent(player)
        self.redraw_board()

        if self.check_game_over():
            return

        self.set_status(
            f"{self.player_name(self.current_player)} to play"
        )
        self.check_ai_turn()

    def on_undo(self):
        if self.game_finished:
            self.set_status("Start a new game to continue playing.")
            return

        if len(self.move_history) <= 1:
            self.set_status("Nothing to undo")
            return

        self.move_history.pop()
        previous = self.move_history[-1]

        self.board = previous["board"].copy()
        self.current_player = previous["player"]

        self.move_log = self.move_log[:previous["log_length"]]
        self.refresh_log()
        self.redraw_board()

        self.set_status(
            f"Undo successful — {self.player_name(self.current_player)} to play"
        )

    def on_restart(self):
        if not msgbox.askyesno("Restart", "Start a new game?"):
            return

        if self._ai_thread and self._ai_thread.is_alive():
            self.set_status("Wait for the AI to finish before restarting.")
            return

        self.board = Board(self.board.size)
        self.current_player = BLACK
        self.game_finished = False

        self.move_history.clear()
        self.move_log.clear()

        self.refresh_log()
        self.push_history("New game started")
        self.redraw_board()

        self.set_status("Black to play")
        self.check_ai_turn()

    # ---------------- AI Controls ----------------

    def on_depth_change(self, value):
        self.ai_depth = int(float(value))
        self.depth_label.configure(
            text=f"AI Strength: Level {self.ai_depth}"
        )
        self.set_status(f"AI depth set to {self.ai_depth}")

    def on_algo_toggle(self):
        self.use_alpha_beta = bool(self.algo_switch.get())

        name = "Alpha-Beta" if self.use_alpha_beta else "Plain Minimax"
        self.set_status(f"Algorithm: {name}")

    def on_ai_side_select(self, choice):
        if choice == "White AI":
            self.ai_enabled = {BLACK: False, WHITE: True}
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()

        elif choice == "Black AI":
            self.ai_enabled = {BLACK: True, WHITE: False}
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()

        elif choice == "Both AI":
            self.ai_enabled = {BLACK: True, WHITE: True}
            self.ai_vs_ai = True
            self.ai_vs_ai_switch.select()

        else:
            self.ai_enabled = {BLACK: False, WHITE: False}
            self.ai_vs_ai = False
            self.ai_vs_ai_switch.deselect()

        self.set_status(f"Player setup: {choice}")
        self.check_ai_turn()

    def on_ai_vs_ai_toggle(self):
        self.ai_vs_ai = bool(self.ai_vs_ai_switch.get())

        if self.ai_vs_ai:
            self.ai_enabled = {BLACK: True, WHITE: True}
            self.ai_side_seg.set("Both AI")
        else:
            self.ai_enabled = {BLACK: False, WHITE: True}
            self.ai_side_seg.set("White AI")

        self.set_status(
            "AI vs AI enabled" if self.ai_vs_ai
            else "AI plays White"
        )
        self.check_ai_turn()

    def check_ai_turn(self):
        if self.game_finished:
            return

        if not self.ai_enabled.get(self.current_player, False):
            return

        if self._ai_thread and self._ai_thread.is_alive():
            return

        player = self.current_player
        board_copy = self.board.copy()
        depth = self.ai_depth
        use_alpha_beta = self.use_alpha_beta

        self._ai_thread = threading.Thread(
            target=self.run_ai_move,
            args=(board_copy, player, depth, use_alpha_beta),
            daemon=True
        )
        self._ai_thread.start()

    def run_ai_move(self, board_copy, player, depth, use_alpha_beta):
        self.after(
            0,
            lambda: self.set_status(
                f"{self.player_name(player)} AI is thinking..."
            )
        )

        move, nodes, duration = ai_select_move(
            board_copy,
            player,
            depth,
            use_alpha_beta
        )

        self.after(
            0,
            lambda: self.apply_ai_move(
                move, nodes, duration, player
            )
        )

    def apply_ai_move(self, move, nodes, duration, player):
        if self.game_finished or self.current_player != player:
            return

        if move is None:
            self.board.pass_move()
            message = f"{self.player_name(player)} AI passed"
        else:
            r, c = move

            if not self.board.place_stone(r, c, player):
                self.board.pass_move()
                message = f"{self.player_name(player)} AI passed (illegal move)"
            else:
                message = (
                    f"{self.player_name(player)} AI played ({r}, {c})"
                )

        message += f" [{nodes} nodes, {duration:.2f}s]"

        self.save_move(message)
        self.current_player = opponent(player)

        self.redraw_board()

        if self.check_game_over():
            return

        self.set_status(
            f"{self.player_name(self.current_player)} to play"
        )

        if self.ai_enabled.get(self.current_player, False):
            self.after(200, self.check_ai_turn)

    # ---------------- Board Size ----------------

    def on_board_size_select(self, choice):
        if self._ai_thread and self._ai_thread.is_alive():
            self.set_status("Wait for the AI to finish.")
            return

        size = int(choice.split("x")[0])

        if size == self.board.size:
            return

        self.board = Board(size)
        self.current_player = BLACK
        self.game_finished = False

        self.move_history.clear()
        self.move_log.clear()

        self.refresh_log()
        self.push_history(f"New {size}x{size} game started")
        self.redraw_board()

        self.set_status(f"New {size}x{size} game — Black to play")
        self.check_ai_turn()

    # ---------------- Final Scoring ----------------

    @staticmethod
    def player_name(player):
        return "Black" if player == BLACK else "White"

    def check_game_over(self):
        if self.board.is_game_over():
            self.finish_game()
            return True

        return False

    def finish_game(self):
        if self.game_finished:
            return

        self.game_finished = True

        black_stones, white_stones = self.board.score()

        black_territory, white_territory = (
            self.board.territory_estimate()
        )

        # Area scoring: stones + controlled territory.
        black_score = black_stones + black_territory
        white_score = (
            white_stones + white_territory + WHITE_KOMI
        )

        margin = abs(black_score - white_score)

        if black_score > white_score:
            winner = "Black"
            result = f"BLACK WINS BY {margin:.1f} POINTS!"
        elif white_score > black_score:
            winner = "White"
            result = f"WHITE WINS BY {margin:.1f} POINTS!"
        else:
            winner = "Draw"
            result = "THE GAME ENDED IN A DRAW!"

        summary = (
            "GAME OVER\n\n"
            "========== BLACK ==========\n"
            f"Stones on board: {black_stones}\n"
            f"Territory: {black_territory}\n"
            f"Captured stones: {self.board.captured[BLACK]}\n"
            f"Final score: {black_score:.1f}\n\n"
            "========== WHITE ==========\n"
            f"Stones on board: {white_stones}\n"
            f"Territory: {white_territory}\n"
            f"Captured stones: {self.board.captured[WHITE]}\n"
            f"Komi bonus: {WHITE_KOMI:.1f}\n"
            f"Final score: {white_score:.1f}\n\n"
            "========== RESULT ==========\n"
            f"{result}\n\n"
            f"Black: {black_score:.1f} points\n"
            f"White: {white_score:.1f} points\n"
            f"Winning margin: {margin:.1f} points"
        )

        self.append_log("Game finished")
        self.append_log(
            f"Final score — Black: {black_score:.1f}, "
            f"White: {white_score:.1f}"
        )
        self.append_log(f"Result: {result}")

        self.set_status(f"Game over — {winner}")

        msgbox.showinfo("Go Game Result", summary)


# ---------------- Run Application ----------------

if __name__ == "__main__":
    app = GoApp()
    app.mainloop()
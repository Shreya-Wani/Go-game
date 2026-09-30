# Go Game (Web)

Modern, responsive Go (Weiqi/Baduk) played in the browser with an AI opponent (Minimax and Alpha–Beta). Cleanly organized JS modules, a polished UI, local history/stats, and simple local hosting.

## Quick start

Run a tiny web server and open the app:

1) From the project root, serve the folder

```powershell
cd "e:\Shivam\Learning\Clg\Sem 7\AI\Projects\Game\go_web"
python -m http.server 8080
```

2) Open http://localhost:8080 in your browser

Notes
- A web server is recommended (instead of opening index.html directly) so localStorage and loading work consistently in all browsers.
- Tested on modern Chromium/Firefox/Edge.

## Features

- Play Human vs AI or Human vs Human
- AI algorithms: Minimax and Alpha–Beta (selectable)
- Adjustable search depth (difficulty)
- Multiple board sizes (7×7, 9×9, 13×13, 19×19)
- Canvas-based board with wood styling and star points
- Pass moves and automatic end after two consecutive passes
- Game-end modal with winner and score summary
- Local history and basic analytics (stored in localStorage)
- Responsive layout (3-column desktop, single-column mobile)

## Controls

- Click an intersection to place a stone
- Pass Turn button to pass
- New Game button to reset the current game
- Left sidebar: choose AI algorithm and depth; switch game mode; change board size
- Reset (history) to clear stored results and stats

## Project structure

```
go_web/
├── index.html          # Page layout and script loading order
├── style.css           # Responsive 3‑column UI, board and modal styles
└── js/
    ├── utils.js        # Helpers (deepCopy, debounce, formatters, storage utils)
    ├── gameLogic.js    # Core rules: groups, liberties, captures, legal moves, endGame
    ├── gameHistory.js  # Local history/stats, analytics, achievements
    ├── aiLogic.js      # Minimax + Alpha–Beta search and evaluation
    ├── uiComponents.js # Canvas rendering, inputs, modals, sidebars
    └── main.js         # App coordinator: init, orchestration, autosave
```

Script load order in index.html matters (utils → gameLogic → gameHistory → aiLogic → uiComponents → main). Each file uses top-level function declarations so functions are available globally without ES module imports.

## How it works (high level)

1) Initialization (main.js)
- Resets the game, initializes history, hooks up the UI, sets timers

2) Human turn (uiComponents.js + gameLogic.js)
- Click converts to row/col; gameLogic validates and applies move; UI redraws

3) AI turn (aiLogic.js)
- Chooses best move using selected algorithm and depth; plays or passes

4) Game end (gameLogic.js + main.js + uiComponents.js)
- Two consecutive passes trigger endGame; modal shows winner; history records the result

Scoring used here is simplified: stones on board + stones captured (territory counting is not implemented).

## Configuration tips

- AI color: In Human vs AI, the AI plays White by default.
- Depth: Higher depth is stronger but slower; start at 1–2 on large boards.
- Board size: Changing board size starts a new game (13×13 by default).

## Development notes

Coding style
- Clear function headers and small, focused helpers
- No frameworks; vanilla JS + Canvas
- Globals are used intentionally (non-module scripts) for simplicity

Common entry points
- main.initializeApplication() – called on DOMContentLoaded
- uiComponents.initializeUI() – caches DOM and binds events
- gameLogic.makeMove(row, col, player) – validates and applies a move
- aiLogic.findBestMove(board, player) – returns [row, col] or null (pass)

Gotchas
- Two files define evaluatePosition (one in gameLogic, a richer one in aiLogic). The AI uses the one in aiLogic since it loads later.
- localStorage stores history and preferences. Use the Reset button (left sidebar) to clear.

## Troubleshooting

- White page or UI missing: Ensure you opened via http://localhost:8080, not file://.
- Nothing happens on click: It may be AI’s turn (AI plays White in Human vs AI). Pass or wait for AI.
- Very slow AI: Reduce search depth or use a smaller board.
- History not updating: Your browser may block third‑party cookies/storage in some modes; try a normal profile.

## Extending

- Improve evaluation in aiLogic.js (territory/influence heuristics)
- Add a color switcher to let AI play Black
- Implement Ko rule and full territory scoring
- Animate captures and add sound effects in uiComponents.js

## License

Educational use. Review repository license for details.
# Sudoku Versus 🎮

A real-time multiplayer Sudoku game where two players compete to complete the puzzle first!

## Features

- ✅ Real-time multiplayer gameplay via WebSockets
- ✅ Live board synchronization between players
- ✅ Individual scoring and move tracking
- ✅ Candidate number pencil marks
- ✅ Keyboard navigation and input
- ✅ Game completion detection
- ✅ Share room IDs to invite friends

## Setup

### Prerequisites
- Node.js (v14+)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ansolidruse/sudoku-versus.git
cd sudoku-versus
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```
(or `npm run dev` for development with auto-reload)

4. Open your browser to `http://localhost:3000`

## How to Play

1. **Create a Game**: Click "Create Game" and share your Room ID with a friend
2. **Join a Game**: Enter a Room ID and click "Join Game"
3. **Play**: 
   - Click cells to select them
   - Type `1-9` to enter numbers
   - Press `Backspace` to clear
   - Use arrow keys to navigate
   - Right-click to select a cell
   - Toggle candidates with "Toggle Candidates" button
4. **Win**: Be the first to complete the puzzle!

## Controls

- **Number Keys (1-9)**: Enter number or toggle candidate
- **Arrow Keys**: Navigate the board
- **Backspace/Delete**: Clear selected cell
- **Candidates Button**: Toggle pencil mark mode
- **Check Complete**: Verify if your puzzle is solved

## Project Structure

```
sudoku-versus/
├── server.js           # Express + Socket.IO server
├── package.json        # Dependencies
├── public/
│   ├── index.html      # Main HTML
│   ├── styles.css      # CSS styling
│   └── game.js         # Frontend game logic
└── README.md
```

## API Events

### Client → Server
- `create-game`: Create a new game room
- `join-game`: Join an existing room
- `make-move`: Send a player's move (row, col, value)
- `update-candidates`: Update pencil marks
- `check-complete`: Check if puzzle is solved
- `get-game-state`: Fetch current game state

### Server → Client
- `player-joined`: Another player joined the room
- `game-started`: Game is now active (2 players)
- `move-made`: Opponent made a move
- `candidates-updated`: Opponent updated candidates
- `player-completed`: A player finished the puzzle
- `player-left`: A player disconnected
- `completion-status`: Response to check-complete event

## Test Puzzle

The game includes a built-in test Sudoku puzzle. Each cell is represented as an array:
- Single number `[5]` = given clue (visible at start)
- Array of numbers `[1,2,3,4,5,6,7,8,9]` = empty cell to fill

## Development

To enable hot reload during development:
```bash
npm run dev
```

This uses `nodemon` to automatically restart the server on file changes.

## Future Enhancements

- [ ] Difficulty selection (Easy, Medium, Hard)
- [ ] Puzzle generation algorithm
- [ ] Leaderboards
- [ ] Chat between players
- [ ] Game statistics
- [ ] Dark mode
- [ ] Undo/Redo functionality
- [ ] Hint system

## License

MIT

## Support

For issues or suggestions, please open a GitHub issue!

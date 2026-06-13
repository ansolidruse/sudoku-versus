const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const gameRooms = {};
const allowedPlayerColors = new Set(['pink', 'cyan', 'purple', 'amber', 'green']);

// Test sudoku puzzle
const testPuzzle = [
  [[1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [2], [1,2,3,4,5,6,7,8,9], [7], [1,2,3,4,5,6,7,8,9], [6], [1,2,3,4,5,6,7,8,9], [4]],
  [[7], [6], [1,2,3,4,5,6,7,8,9], [8], [1], [1,2,3,4,5,6,7,8,9], [9], [5], [3]],
  [[1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [4], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [7], [8], [1,2,3,4,5,6,7,8,9]],
  [[1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [8], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [1], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9]],
  [[2], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [9], [1,2,3,4,5,6,7,8,9], [3], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [8]],
  [[1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [7], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [2], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9]],
  [[1,2,3,4,5,6,7,8,9], [8], [7], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [4], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9]],
  [[4], [9], [1], [1,2,3,4,5,6,7,8,9], [5], [8], [1,2,3,4,5,6,7,8,9], [6], [7]],
  [[6], [1,2,3,4,5,6,7,8,9], [5], [1,2,3,4,5,6,7,8,9], [9], [1,2,3,4,5,6,7,8,9], [8], [1,2,3,4,5,6,7,8,9], [1,2,3,4,5,6,7,8,9]]
];

// Convert puzzle to initial state
function initializePuzzle() {
  return testPuzzle.map(row =>
    row.map(cell => ({
      candidates: cell,
      value: cell.length === 1 ? cell[0] : null,
      isGiven: cell.length === 1
    }))
  );
}

// Create a new game room
function createGameRoom() {
  const roomId = uuidv4().substring(0, 8);
  gameRooms[roomId] = {
    id: roomId,
    players: [],
    puzzle: initializePuzzle(),
    gameState: 'waiting', // waiting, active, completed
    createdAt: Date.now()
  };
  return roomId;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new game
  socket.on('create-game', (callback) => {
    const roomId = createGameRoom();
    socket.join(roomId);
    gameRooms[roomId].players.push({
      id: socket.id,
      nickname: `Player ${gameRooms[roomId].players.length + 1}`,
      color: 'pink',
      board: JSON.parse(JSON.stringify(gameRooms[roomId].puzzle))
    });
    
    console.log('Game created:', roomId);
    callback({ roomId, success: true });
  });

  // Join an existing game
  socket.on('join-game', (roomId, callback) => {
    if (!gameRooms[roomId]) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const room = gameRooms[roomId];
    if (room.players.length >= 2) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    socket.join(roomId);
    room.players.push({
      id: socket.id,
      nickname: `Player ${room.players.length + 1}`,
      color: 'cyan',
      board: JSON.parse(JSON.stringify(room.puzzle))
    });

    if (room.players.length === 2) {
      room.gameState = 'active';
      room.startedAt = Date.now();
    }

    // Notify all players in the room
    io.to(roomId).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, nickname: p.nickname, color: p.color })),
      totalPlayers: room.players.length,
      puzzle: room.puzzle,
      gameState: room.gameState
    });

    if (room.players.length === 2) {
      io.to(roomId).emit('game-started', { gameState: 'active' });
    }

    callback({ success: true, roomId, gameState: room.gameState });
  });

  // Player makes a move
  socket.on('make-move', (data) => {
    const { roomId, row, col, value } = data;
    const room = gameRooms[roomId];

    if (!room) return;

    // Update the player's board
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.board[row][col].value = value;
    }

    // Only tell opponents whether a square has been filled, not the value.
    socket.to(roomId).emit('move-made', {
      playerId: socket.id,
      row,
      col,
      filled: value !== null,
      playerNickname: player.nickname
    });
  });

  // Update candidate pencil marks
  socket.on('update-candidates', (data) => {
    const { roomId, row, col, candidates } = data;
    const room = gameRooms[roomId];

    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.board[row][col].candidates = candidates;
    }

    socket.to(roomId).emit('candidates-updated', {
      playerId: socket.id,
      row,
      col,
      hasCandidates: candidates.length > 0 && candidates.length < 9
    });
  });

  socket.on('update-player-color', (data) => {
    const { roomId, color } = data;
    const room = gameRooms[roomId];

    if (!room || !allowedPlayerColors.has(color)) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.color = color;
    io.to(roomId).emit('player-color-updated', {
      playerId: socket.id,
      color
    });
  });

  // Check if puzzle is solved
  socket.on('check-complete', (data) => {
    const { roomId } = data;
    const room = gameRooms[roomId];

    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      const isComplete = checkPuzzleComplete(player.board);
      
      if (isComplete) {
        player.completedAt = Date.now();
        io.to(roomId).emit('player-completed', {
          playerId: socket.id,
          playerNickname: player.nickname,
          elapsedMs: room.startedAt ? player.completedAt - room.startedAt : null,
          timestamp: player.completedAt
        });
      }

      socket.emit('completion-status', { isComplete });
    }
  });

  // Get game state
  socket.on('get-game-state', (roomId, callback) => {
    const room = gameRooms[roomId];
    if (room) {
      callback({
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname, color: p.color })),
        gameState: room.gameState,
        puzzle: room.puzzle
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from all rooms
    Object.keys(gameRooms).forEach(roomId => {
      const room = gameRooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          delete gameRooms[roomId];
        } else {
          io.to(roomId).emit('player-left', {
          players: room.players.map(p => ({ id: p.id, nickname: p.nickname, color: p.color })),
            totalPlayers: room.players.length
          });
        }
      }
    });
  });
});

function checkPuzzleComplete(board) {
  // Check if all cells are filled
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j].value === null) return false;
    }
  }

  // Check rows
  for (let i = 0; i < 9; i++) {
    const seen = new Set();
    for (let j = 0; j < 9; j++) {
      const val = board[i][j].value;
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }

  // Check columns
  for (let j = 0; j < 9; j++) {
    const seen = new Set();
    for (let i = 0; i < 9; i++) {
      const val = board[i][j].value;
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }

  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Set();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const val = board[boxRow * 3 + i][boxCol * 3 + j].value;
          if (seen.has(val)) return false;
          seen.add(val);
        }
      }
    }
  }

  return true;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

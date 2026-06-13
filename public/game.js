// Game State
const gameState = {
  socket: null,
  roomId: null,
  playerId: null,
  playerName: null,
  board: null,
  opponentBoard: null,
  selectedCell: null,
  showCandidates: false,
  gameActive: false,
  startTime: null,
  timerInterval: null,
  players: []
};

// Initialize Socket.IO
function initSocket() {
  gameState.socket = io();

  gameState.socket.on('player-joined', (data) => {
    console.log('Player joined:', data);
    gameState.players = data.players;
    gameState.board = JSON.parse(JSON.stringify(data.puzzle));
    gameState.opponentBoard = JSON.parse(JSON.stringify(data.puzzle));
    
    updatePlayersList(data.totalPlayers);
    
    if (data.totalPlayers === 2) {
      startGame();
    }
  });

  gameState.socket.on('game-started', (data) => {
    console.log('Game started');
    gameState.gameActive = true;
    startGame();
  });

  gameState.socket.on('move-made', (data) => {
    console.log('Move made by opponent:', data);
    gameState.opponentBoard[data.row][data.col].value = data.value;
    renderOpponentBoard();
  });

  gameState.socket.on('candidates-updated', (data) => {
    gameState.opponentBoard[data.row][data.col].candidates = data.candidates;
    renderOpponentBoard();
  });

  gameState.socket.on('player-completed', (data) => {
    console.log('Player completed:', data);
    showCompletionMessage(data.playerNickname);
  });

  gameState.socket.on('player-left', (data) => {
    console.log('Player left:', data);
    updatePlayersList(data.totalPlayers);
    if (data.totalPlayers === 0) {
      alert('Game ended - opponent left');
      goToMenu();
    }
  });
}

// Menu Screen Handlers
document.getElementById('create-btn').addEventListener('click', () => {
  const playerName = document.getElementById('player-name').value || 'Player';
  gameState.playerName = playerName;
  
  gameState.socket.emit('create-game', (response) => {
    if (response.success) {
      gameState.roomId = response.roomId;
      document.getElementById('current-room-id').textContent = gameState.roomId;
      showScreen('waiting-screen');
    }
  });
});

document.getElementById('join-btn').addEventListener('click', () => {
  const roomId = document.getElementById('room-id').value;
  const playerName = document.getElementById('player-name').value || 'Player';
  
  if (!roomId) {
    alert('Please enter a room ID');
    return;
  }

  gameState.playerName = playerName;
  gameState.socket.emit('join-game', roomId, (response) => {
    if (response.success) {
      gameState.roomId = response.roomId;
      document.getElementById('current-room-id').textContent = gameState.roomId;
      showScreen('waiting-screen');
    } else {
      alert(response.error);
    }
  });
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  if (gameState.socket) {
    gameState.socket.disconnect();
    gameState.socket.connect();
  }
  goToMenu();
});

// Game Controls
document.getElementById('clear-btn').addEventListener('click', () => {
  if (gameState.selectedCell) {
    const [row, col] = gameState.selectedCell;
    if (!gameState.board[row][col].isGiven) {
      gameState.board[row][col].value = null;
      renderBoard();
      gameState.socket.emit('make-move', {
        roomId: gameState.roomId,
        row,
        col,
        value: null
      });
    }
  }
});

document.getElementById('candidates-btn').addEventListener('click', () => {
  gameState.showCandidates = !gameState.showCandidates;
  renderBoard();
});

document.getElementById('check-btn').addEventListener('click', () => {
  gameState.socket.emit('check-complete', { roomId: gameState.roomId });
});

// UI Functions
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function goToMenu() {
  showScreen('menu-screen');
  document.getElementById('player-name').value = '';
  document.getElementById('room-id').value = '';
  gameState.gameActive = false;
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
}

function startGame() {
  showScreen('game-screen');
  gameState.startTime = Date.now();
  startTimer();
  renderBoard();
  renderOpponentBoard();
}

function updatePlayersList(count) {
  document.getElementById('player-count').textContent = count;
}

function startTimer() {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  
  gameState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('timer').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

function showCompletionMessage(playerName) {
  const msg = document.getElementById('completion-message');
  const text = document.getElementById('completion-text');
  text.textContent = `🎉 ${playerName} completed the puzzle!`;
  msg.classList.remove('hidden');
  setTimeout(() => {
    msg.classList.add('hidden');
  }, 3000);
}

// Board Rendering
function renderBoard() {
  const boardContainer = document.getElementById('sudoku-board');
  boardContainer.innerHTML = '';

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = gameState.board[row][col];
      const cellEl = document.createElement('div');
      cellEl.className = 'sudoku-cell';
      
      if (cell.isGiven) {
        cellEl.classList.add('given');
        cellEl.textContent = cell.value;
      } else {
        cellEl.setAttribute('data-row', row);
        cellEl.setAttribute('data-col', col);
        
        if (cell.value) {
          cellEl.textContent = cell.value;
        } else if (gameState.showCandidates && cell.candidates && cell.candidates.length > 1) {
          cellEl.innerHTML = createCandidatesGrid(cell.candidates);
        }
        
        if (gameState.selectedCell && gameState.selectedCell[0] === row && gameState.selectedCell[1] === col) {
          cellEl.classList.add('selected');
        }
        
        cellEl.addEventListener('click', () => selectCell(row, col, cellEl));
        cellEl.addEventListener('contextmenu', (e) => handleRightClick(e, row, col));
      }
      
      boardContainer.appendChild(cellEl);
    }
  }
}

function renderOpponentBoard() {
  const boardContainer = document.getElementById('opponent-board');
  boardContainer.innerHTML = '';

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = gameState.opponentBoard[row][col];
      const cellEl = document.createElement('div');
      cellEl.className = 'sudoku-cell';
      
      if (cell.isGiven) {
        cellEl.classList.add('given');
        cellEl.textContent = cell.value;
      } else {
        if (cell.value) {
          cellEl.textContent = cell.value;
        } else if (gameState.showCandidates && cell.candidates && cell.candidates.length > 1) {
          cellEl.innerHTML = createCandidatesGrid(cell.candidates);
        }
      }
      
      boardContainer.appendChild(cellEl);
    }
  }
}

function createCandidatesGrid(candidates) {
  let html = '<div class="candidates-grid">';
  for (let i = 1; i <= 9; i++) {
    const isActive = candidates.includes(i);
    html += `<div class="candidate ${isActive ? 'active' : ''}">${isActive ? i : ''}</div>`;
  }
  html += '</div>';
  return html;
}

function selectCell(row, col, cellEl) {
  const cell = gameState.board[row][col];
  if (cell.isGiven) return;

  gameState.selectedCell = [row, col];
  renderBoard();
}

function handleRightClick(e, row, col) {
  e.preventDefault();
  const cell = gameState.board[row][col];
  if (cell.isGiven) return;
  
  gameState.selectedCell = [row, col];
  renderBoard();
}

// Global keyboard listener - works when any cell is selected
document.addEventListener('keydown', (e) => {
  if (!gameState.selectedCell || !gameState.gameActive) return;
  
  const [row, col] = gameState.selectedCell;
  const cell = gameState.board[row][col];
  
  if (cell.isGiven) return;

  const key = e.key;
  
  if (key >= '1' && key <= '9') {
    e.preventDefault();
    const value = parseInt(key);
    
    if (gameState.showCandidates) {
      // Toggle candidate
      if (cell.candidates.includes(value)) {
        cell.candidates = cell.candidates.filter(c => c !== value);
      } else {
        cell.candidates = [...cell.candidates, value].sort((a, b) => a - b);
      }
      gameState.socket.emit('update-candidates', {
        roomId: gameState.roomId,
        row,
        col,
        candidates: cell.candidates
      });
    } else {
      // Set value
      cell.value = value;
      gameState.socket.emit('make-move', {
        roomId: gameState.roomId,
        row,
        col,
        value
      });
    }
    
    renderBoard();
  } else if (key === 'Backspace' || key === 'Delete') {
    e.preventDefault();
    cell.value = null;
    gameState.socket.emit('make-move', {
      roomId: gameState.roomId,
      row,
      col,
      value: null
    });
    renderBoard();
  } else if (key === 'ArrowUp') {
    e.preventDefault();
    navigateToCell(row - 1, col);
  } else if (key === 'ArrowDown') {
    e.preventDefault();
    navigateToCell(row + 1, col);
  } else if (key === 'ArrowLeft') {
    e.preventDefault();
    navigateToCell(row, col - 1);
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    navigateToCell(row, col + 1);
  }
});

// Navigate to cell, including given cells (but don't allow editing them)
function navigateToCell(row, col) {
  if (row < 0 || row > 8 || col < 0 || col > 8) return;
  
  gameState.selectedCell = [row, col];
  renderBoard();
}

// Initialize on load
window.addEventListener('load', () => {
  initSocket();
  showScreen('menu-screen');
});

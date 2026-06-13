const PLAYER_COLORS = {
  pink: '#ec4899',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  green: '#22c55e'
};

const DEFAULT_PLAYER_COLORS = ['pink', 'cyan'];

// Game State
const gameState = {
  socket: null,
  roomId: null,
  playerId: null,
  playerName: null,
  playerColor: null,
  board: null,
  opponentBoard: null,
  solvedBoard: null,
  selectedCell: null,
  showCandidates: false,
  gameActive: false,
  startTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  messageTimeout: null,
  popupPausedTimer: false,
  ownCompleted: false,
  players: []
};

// Initialize Socket.IO
function initSocket() {
  gameState.socket = io();

  gameState.socket.on('connect', () => {
    gameState.playerId = gameState.socket.id;
  });

  gameState.socket.on('player-joined', (data) => {
    console.log('Player joined:', data);
    gameState.players = data.players;
    ensureBoards(data.puzzle);
    updatePlayerInfo();
    
    updatePlayersList(data.totalPlayers);
    
    if (data.gameState === 'active' || data.totalPlayers === 2) {
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
    if (data.playerId === gameState.playerId) return;
    gameState.opponentBoard[data.row][data.col].opponentFilled = data.filled;
    renderOpponentBoard();
  });

  gameState.socket.on('candidates-updated', (data) => {
    if (data.playerId === gameState.playerId) return;
    gameState.opponentBoard[data.row][data.col].opponentHasCandidates = data.hasCandidates;
    renderOpponentBoard();
  });

  gameState.socket.on('player-color-updated', (data) => {
    const player = gameState.players.find(player => player.id === data.playerId);
    if (!player || !PLAYER_COLORS[data.color]) return;

    player.color = data.color;
    if (data.playerId === gameState.playerId) {
      gameState.playerColor = data.color;
      updateSelectedColorSwatch();
      renderBoard();
    }

    updatePlayerInfo();
  });

  gameState.socket.on('player-completed', (data) => {
    console.log('Player completed:', data);
    markPlayerCompleted(data.playerId, data.elapsedMs);

    if (data.playerId === gameState.playerId) return;

    showCompletionMessage(
      `${data.playerNickname} completed the puzzle!`,
      true,
      { pauseTimer: !gameState.ownCompleted }
    );
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
      if (response.gameState === 'active') {
        startGame();
      } else {
        showScreen('waiting-screen');
      }
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
  if (!gameState.board) return;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = gameState.board[row][col];
      if (!cell.isGiven && cell.value !== null && !cell.solved) {
        cell.value = null;
        cell.solved = false;
        gameState.socket.emit('make-move', {
          roomId: gameState.roomId,
          row,
          col,
          value: null
        });
      }
    }
  }

  renderBoard();
});

document.getElementById('check-btn').addEventListener('click', () => {
  const isComplete = checkUserSolution();
  showCompletionMessage(
    isComplete ? 'Your solution is correct!' : 'Solution is wrong or incomplete.',
    isComplete
  );

  if (isComplete) {
    gameState.ownCompleted = true;
    stopTimer();
    markPlayerCompleted(gameState.playerId, gameState.elapsedSeconds * 1000);
    gameState.socket.emit('check-complete', { roomId: gameState.roomId });
  }
});

document.getElementById('completion-message').addEventListener('click', hideCompletionMessage);

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    updateOwnColor(swatch.dataset.color);
  });
});

document.addEventListener('keydown', (e) => {
  const msg = document.getElementById('completion-message');
  if (!msg.classList.contains('hidden') && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    hideCompletionMessage();
  }
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
  gameState.gameActive = true;
  showScreen('game-screen');
  gameState.startTime = Date.now();
  gameState.elapsedSeconds = 0;
  updateTimerDisplay();
  startTimer();
  renderBoard();
  renderOpponentBoard();
}

function updatePlayersList(count) {
  document.getElementById('player-count').textContent = count;
}

function updatePlayerInfo() {
  gameState.players.forEach((player, index) => {
    const playerInfo = document.getElementById(`player-${index + 1}-info`);
    if (!playerInfo) return;

    const playerColor = getPlayerColor(player, index);
    playerInfo.querySelector('.player-name').textContent = player.nickname;
    playerInfo.querySelector('.player-status').innerHTML = getPlayerStatus(player, playerColor);

    if (player.id === gameState.playerId) {
      gameState.playerColor = playerColor;
      playerInfo.classList.add('current-player');
      updateSelectedColorSwatch();
    } else {
      playerInfo.classList.remove('current-player');
    }
  });
}

function getPlayerStatus(player, playerColor) {
  if (player.completedElapsedMs !== undefined && player.completedElapsedMs !== null) {
    return `Completed in ${formatElapsedTime(Math.floor(player.completedElapsedMs / 1000))}`;
  }

  return `<span class="color-dot" style="background: ${PLAYER_COLORS[playerColor]};"></span>${playerColor} inputs`;
}

function getPlayerColor(player, index = 0) {
  if (player.color && PLAYER_COLORS[player.color]) {
    return player.color;
  }

  return DEFAULT_PLAYER_COLORS[index] || 'cyan';
}

function updateOwnColor(color) {
  if (!PLAYER_COLORS[color]) return;

  gameState.playerColor = color;
  const player = gameState.players.find(player => player.id === gameState.playerId);
  if (player) {
    player.color = color;
  }

  updateSelectedColorSwatch();
  updatePlayerInfo();
  renderBoard();

  if (gameState.roomId) {
    gameState.socket.emit('update-player-color', {
      roomId: gameState.roomId,
      color
    });
  }
}

function updateSelectedColorSwatch() {
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('selected', swatch.dataset.color === gameState.playerColor);
  });
}

function markPlayerCompleted(playerId, elapsedMs) {
  const player = gameState.players.find(player => player.id === playerId);
  if (player) {
    player.completedElapsedMs = elapsedMs;
  }
  updatePlayerInfo();
}

function startTimer() {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  
  gameState.timerInterval = setInterval(() => {
    gameState.elapsedSeconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timer').textContent = formatElapsedTime(gameState.elapsedSeconds);
}

function formatElapsedTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function showCompletionMessage(message, isSuccess = true, options = {}) {
  const msg = document.getElementById('completion-message');
  const text = document.getElementById('completion-text');

  if (gameState.messageTimeout) {
    clearTimeout(gameState.messageTimeout);
  }

  if (options.pauseTimer && gameState.timerInterval) {
    stopTimer();
    gameState.popupPausedTimer = true;
  } else {
    gameState.popupPausedTimer = false;
  }

  msg.classList.toggle('error', !isSuccess);
  text.textContent = message;
  msg.classList.remove('hidden');
  gameState.messageTimeout = setTimeout(hideCompletionMessage, 3000);
}

function hideCompletionMessage() {
  const msg = document.getElementById('completion-message');
  msg.classList.add('hidden');

  if (gameState.messageTimeout) {
    clearTimeout(gameState.messageTimeout);
    gameState.messageTimeout = null;
  }

  if (gameState.popupPausedTimer && !gameState.ownCompleted && gameState.gameActive) {
    startTimer();
  }

  gameState.popupPausedTimer = false;
}

function ensureBoards(puzzle) {
  if (!gameState.board) {
    gameState.board = JSON.parse(JSON.stringify(puzzle));
  }
  if (!gameState.opponentBoard) {
    gameState.opponentBoard = JSON.parse(JSON.stringify(puzzle));
  }
  if (!gameState.solvedBoard) {
    gameState.solvedBoard = solvePuzzleFromCells(puzzle);
  }
}

function isFullCandidateSet(candidates) {
  return Array.isArray(candidates) &&
    candidates.length === 9 &&
    candidates.every((candidate, index) => candidate === index + 1);
}

function shouldShowCandidates(cell) {
  return gameState.showCandidates &&
    cell.candidates &&
    cell.candidates.length > 0 &&
    !isFullCandidateSet(cell.candidates);
}

function cloneCandidateBoard(cells) {
  return cells.map(row =>
    row.map(cell => {
      if (Array.isArray(cell)) {
        return [...cell];
      }

      if (cell.value !== null && cell.value !== undefined) {
        return [cell.value];
      }

      return isFullCandidateSet(cell.candidates)
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
        : [...cell.candidates];
    })
  );
}

function calcBoxList(row, col) {
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  const coords = [];

  for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
    for (let colOffset = 0; colOffset < 3; colOffset++) {
      coords.push([startRow + rowOffset, startCol + colOffset]);
    }
  }

  return coords;
}

function solvePuzzleFromCells(cells) {
  const board = cloneCandidateBoard(cells);
  const ghostBoard = board.map(row => row.map(cell => cell.length === 1 ? [0] : [1]));
  solveSudoku(board, ghostBoard, 0);

  return board.every(row => row.every(cell => cell.length === 1)) ? board : null;
}

function solveSudoku(board, ghostBoard, depth) {
  const completedSpaces = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (ghostBoard[row][col][0] === 0) {
        completedSpaces.push([board[row][col][0], row, col]);
      }
    }
  }

  solveByCompletedSpaces(board, ghostBoard, completedSpaces, depth);
}

function solveByCompletedSpaces(board, ghostBoard, completedSpaces, depth) {
  if (depth === 200 || completedSpaces.length === 0) return;

  const newCompleted = [];

  completedSpaces.forEach(([number, row, col]) => {
    for (let targetCol = 0; targetCol < 9; targetCol++) {
      removeCandidate(board, ghostBoard, newCompleted, row, targetCol, number);
    }

    for (let targetRow = 0; targetRow < 9; targetRow++) {
      removeCandidate(board, ghostBoard, newCompleted, targetRow, col, number);
    }

    calcBoxList(row, col).forEach(([targetRow, targetCol]) => {
      removeCandidate(board, ghostBoard, newCompleted, targetRow, targetCol, number);
    });
  });

  const remaining = ghostBoard.flat().reduce((total, cell) => total + cell[0], 0);
  if (remaining > 0) {
    solveByCompletedSpaces(board, ghostBoard, newCompleted, depth + 1);
  }
}

function removeCandidate(board, ghostBoard, newCompleted, row, col, number) {
  if (!board[row][col].includes(number) || board[row][col].length <= 1) return;

  board[row][col] = board[row][col].filter(candidate => candidate !== number);
  if (board[row][col].length === 1) {
    ghostBoard[row][col] = [0];
    newCompleted.push([board[row][col][0], row, col]);
  }
}

function checkUserSolution() {
  if (!gameState.solvedBoard) return false;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (gameState.board[row][col].value !== gameState.solvedBoard[row][col][0]) {
        return false;
      }
    }
  }

  return true;
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
      cellEl.setAttribute('data-row', row);
      cellEl.setAttribute('data-col', col);
      
      if (cell.isGiven) {
        cellEl.classList.add('given');
        cellEl.textContent = cell.value;
      } else {
        if (cell.value) {
          if (cell.solved) {
            cellEl.classList.add('solved-value');
          } else {
            cellEl.style.color = PLAYER_COLORS[gameState.playerColor || 'cyan'];
          }
          cellEl.textContent = cell.value;
        } else if (shouldShowCandidates(cell)) {
          cellEl.innerHTML = createCandidatesGrid(cell.candidates);
        }

        cellEl.addEventListener('click', () => selectCell(row, col, cellEl));
        cellEl.addEventListener('contextmenu', (e) => handleRightClick(e, row, col));
      }

      if (gameState.selectedCell && gameState.selectedCell[0] === row && gameState.selectedCell[1] === col) {
        cellEl.classList.add('selected');
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
        if (cell.opponentFilled) {
          cellEl.classList.add('opponent-filled');
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

  const key = e.key;

  if (key === 'ArrowUp') {
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
  } else if (cell.isGiven) {
    return;
  } else if (key >= '1' && key <= '9') {
    e.preventDefault();
    const value = parseInt(key);
    
    if (gameState.showCandidates) {
      // Toggle candidate
      if (isFullCandidateSet(cell.candidates)) {
        cell.candidates = [value];
      } else if (cell.candidates.includes(value)) {
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
      cell.solved = false;
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
    cell.solved = false;
    gameState.socket.emit('make-move', {
      roomId: gameState.roomId,
      row,
      col,
      value: null
    });
    renderBoard();
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

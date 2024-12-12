import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const port = 4000;

const gridSize = 10;
let grid: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
let players: { id: string; playerNumber: number; unicode: string }[] = [];
let playerTurn = 1; // Starting with Player 1
let history: { time: string; row: number; col: number; char: string; player: number; gridSnapshot: string[][] }[] = [];
const uniqueUnicodes = new Set(); // Track assigned unicodes

// Generate a unique Unicode
const generateUniqueUnicode = () => {
  let char;
  do {
    char = String.fromCodePoint(0x1f600 + Math.floor(Math.random() * 0x80));
  } while (uniqueUnicodes.has(char));
  uniqueUnicodes.add(char);
  return char;
};

// Helper function to assign player numbers
const assignPlayerNumber = (id: string) => {
  const existingPlayer = players.find((p) => p.id === id);
  if (existingPlayer) return existingPlayer.playerNumber;

  const availableNumbers = Array.from(
    { length: players.length + 1 },
    (_, i) => i + 1
  ).filter((n) => !players.some((p) => p.playerNumber === n));

  const newPlayerNumber = availableNumbers[0] || players.length + 1;
  players.push({ id, playerNumber: newPlayerNumber, unicode: '' });
  return newPlayerNumber;
};

// Helper function to get the next active player
const getNextPlayerTurn = () => {
  const activePlayers = players.map((p) => p.playerNumber).sort((a, b) => a - b);
  const currentIndex = activePlayers.indexOf(playerTurn);
  return activePlayers[(currentIndex + 1) % activePlayers.length];
};

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Assign player details
  const playerNumber = assignPlayerNumber(socket.id);
  const unicode = generateUniqueUnicode();

  // Update the player's Unicode in the array
  const playerIndex = players.findIndex((p) => p.id === socket.id);
  if (playerIndex !== -1) players[playerIndex].unicode = unicode;

  const player = players.find((p) => p.id === socket.id);

  console.log('Current players:', players);

  if (player) {
    // Notify the new player of their details
    socket.emit('player-info', { playerNumber: player.playerNumber, unicode: player.unicode });
  } else {
    console.error(`Player not found for socket ID: ${socket.id}`);
  }

  // Notify all players about the updated game state
  io.emit('players-online', players.length);
  io.emit('turn-update', playerTurn);

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    const playerIndex = players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== -1) {
      const disconnectedPlayer = players.splice(playerIndex, 1)[0];
      uniqueUnicodes.delete(disconnectedPlayer.unicode);

      if (playerTurn === disconnectedPlayer.playerNumber) {
        playerTurn = getNextPlayerTurn();
        io.emit('turn-update', playerTurn);
      }
    }

    io.emit('players-online', players.length);
  });

  socket.on('update-block', (data: { row: number; col: number }) => {
    const { row, col } = data;

    const currentPlayer = players.find((p) => p.id === socket.id);
    if (!currentPlayer) return;

    if (grid[row][col] === '' && currentPlayer.playerNumber === playerTurn) {
      grid[row][col] = currentPlayer.unicode;

      const currentTime = new Date().toISOString();
      history.push({
        time: currentTime,
        row,
        col,
        char: currentPlayer.unicode,
        player: playerTurn,
        gridSnapshot: JSON.parse(JSON.stringify(grid)), // Capture grid state
      });

      playerTurn = getNextPlayerTurn();
      io.emit('turn-update', playerTurn);
      io.emit('grid-update', grid);
      io.emit('history-update', history);
    }
  });

  socket.on('skip-turn', () => {
    if (players.some((p) => p.id === socket.id && p.playerNumber === playerTurn)) {
      playerTurn = getNextPlayerTurn();
      io.emit('turn-update', playerTurn);
    }
  });

  socket.emit('grid-update', grid);
  socket.emit('history-update', history);
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
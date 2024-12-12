import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Initialize a WebSocket connection to the server
const socket = io('http://localhost:4000');

const App = () => {
  // State to manage the game grid (10x10 grid initialized with empty strings)
  const [grid, setGrid] = useState(Array.from({ length: 10 }, () => Array(10).fill('')));
  // State to track the number of players currently online
  const [playersOnline, setPlayersOnline] = useState(0);
  // State to identify the player's ID assigned by the server
  const [playerId, setPlayerId] = useState<number | null>(null);
  // State to track whose turn it is
  const [playerTurn, setPlayerTurn] = useState<number | null>(null);
  // State to manage the history of moves
  const [history, setHistory] = useState([]);
  // Timer state to manage the countdown for the current turn
  const [timer, setTimer] = useState<number>(60);
  // State to display a snapshot of the grid when hovering over a history entry
  const [hoveredGrid, setHoveredGrid] = useState<string[][] | null>(null);

  useEffect(() => {
    // Listens for updates to the game grid and updates the state
    socket.on('grid-update', (updatedGrid) => setGrid(updatedGrid));
    // Updates the count of players currently online
    socket.on('players-online', (count) => setPlayersOnline(count));
    // Receives the player's assigned ID from the server
    socket.on('player-info', (data) => {
      setPlayerId(data.playerNumber);
    });
    // Updates whose turn it is and resets the timer
    socket.on('turn-update', (turn) => {
      setPlayerTurn(turn);
      setTimer(60);
    });
    // Updates the history of moves
    socket.on('history-update', (updatedHistory) => setHistory(updatedHistory));

    // Interval to handle the countdown timer
    const timerInterval = setInterval(() => {
      setTimer((prev) => {
        if (prev > 0) return prev - 1; // Decrement the timer if it's above 0
        // Skip the turn if the timer runs out and it's the player's turn
        if (prev === 0 && playerId === playerTurn) {
          socket.emit('skip-turn');
        }
        return prev;
      });
    }, 1000);

    // Cleanup function to remove socket listeners and clear the timer
    return () => {
      socket.off('grid-update');
      socket.off('players-online');
      socket.off('player-info');
      socket.off('turn-update');
      socket.off('history-update');
      clearInterval(timerInterval);
    };
  }, [playerId, playerTurn]);

  // Handles clicking on a grid cell
  const handleCellClick = (row: number, col: number) => {
    if (playerId === playerTurn && timer > 0) {
      // Emits an event to update the block on the server
      socket.emit('update-block', { row, col });
    }
  };

  return (
    <div className="p-4">
      {/* Displays the number of players online */}
      <h2 className="text-lg font-bold">Players Online: {playersOnline}</h2>
      {/* Displays the current player's turn */}
      <h3 className="text-lg">Current Turn: Player {playerTurn}</h3>
      {/* Displays the player's ID */}
      <h3 className="text-lg">
        {playerId !== null ? `You are: Player ${playerId}` : 'Connecting...'}
      </h3>
      {/* Displays the timer countdown */}
      <h3 className="text-lg">Time Remaining: {timer} seconds</h3>

      {/* Renders the game grid */}
      <div className="grid grid-cols-10 gap-1 mt-4">
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`border p-4 text-center ${
                playerTurn === playerId ? 'cursor-pointer bg-green-100' : 'bg-gray-200'
              }`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {cell}
            </div>
          ))
        )}
      </div>

      {/* Displays the history of moves */}
      <h3 className="mt-4">History</h3>
      <ul className="list-disc pl-5">
        {history.map((entry, index) => (
          <li
            key={index}
            onClick={() => setHoveredGrid(entry.gridSnapshot)} // Sets the hovered grid to show the snapshot
          >
            {entry.time}: Player {entry.player} → Row {entry.row}, Col {entry.col} → {entry.char}
          </li>
        ))}
      </ul>

      {/* Displays the grid snapshot when a history entry is hovered */}
      {hoveredGrid && (
        <div className="mt-4">
          <h4 className="text-lg">Snapshot at this time:</h4>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {hoveredGrid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="border p-4 text-center bg-gray-200"
                >
                  {cell}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
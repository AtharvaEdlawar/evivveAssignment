import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

const App = () => {
  const [grid, setGrid] = useState(Array.from({ length: 10 }, () => Array(10).fill('')));
  const [playersOnline, setPlayersOnline] = useState(0);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerTurn, setPlayerTurn] = useState<number | null>(null);
  const [history, setHistory] = useState([]);
  const [timer, setTimer] = useState<number>(60);
  const [hoveredGrid, setHoveredGrid] = useState<string[][] | null>(null);

  useEffect(() => {
    socket.on('grid-update', (updatedGrid) => setGrid(updatedGrid));
    socket.on('players-online', (count) => setPlayersOnline(count));
    socket.on('player-info', (data) => {
      setPlayerId(data.playerNumber);
    });
    socket.on('turn-update', (turn) => {
      setPlayerTurn(turn);
      setTimer(60);
    });
    socket.on('history-update', (updatedHistory) => setHistory(updatedHistory));

    const timerInterval = setInterval(() => {
      setTimer((prev) => {
        if (prev > 0) return prev - 1;
        if (prev === 0 && playerId === playerTurn) {
          socket.emit('skip-turn');
        }
        return prev;
      });
    }, 1000);

    return () => {
      socket.off('grid-update');
      socket.off('players-online');
      socket.off('player-info');
      socket.off('turn-update');
      socket.off('history-update');
      clearInterval(timerInterval);
    };
  }, [playerId, playerTurn]);

  const handleCellClick = (row: number, col: number) => {
    if (playerId === playerTurn && timer > 0) {
      socket.emit('update-block', { row, col });
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">Players Online: {playersOnline}</h2>
      <h3 className="text-lg">Current Turn: Player {playerTurn}</h3>
      <h3 className="text-lg">
        {playerId !== null ? `You are: Player ${playerId}` : 'Connecting...'}
      </h3>
      <h3 className="text-lg">Time Remaining: {timer} seconds</h3>

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

      <h3 className="mt-4">History</h3>
      <ul className="list-disc pl-5">
        {history.map((entry, index) => (
          <li
            key={index}
            onClick={() => setHoveredGrid(entry.gridSnapshot)}
          >
            {entry.time}: Player {entry.player} → Row {entry.row}, Col {entry.col} → {entry.char}
          </li>
        ))}
      </ul>

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
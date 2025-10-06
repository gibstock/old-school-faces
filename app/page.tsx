'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

const MAX_GUESSES = 7;

interface ResultsModalProps {
  gameState: GameState;
  guesses: string[][];
  handleShare: () => void;
  shareText: string;
  posters: string[];
}

const ResultsModal = ({
  gameState,
  guesses,
  handleShare,
  shareText,
  posters,
}: ResultsModalProps) => {
  const [timeTillNext, setTimeTillNext] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      const diff = tomorrow.getTime() - now.getTime();
      const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(
        2,
        '0'
      );
      const minutes = String(Math.floor((diff / 1000 / 60) % 60)).padStart(
        2,
        '0'
      );
      const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
      setTimeTillNext(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 text-center w-11/12 max-w-sm">
        {gameState.status === 'won' ? (
          <h2 className="text-3xl font-bold text-green-400">You got it! 🎉</h2>
        ) : (
          <h2 className="text-3xl font-bold text-red-400">Not Quite!</h2>
        )}
        <p className="mt-2 text-lg">
          You guessed in {guesses.length}/{MAX_GUESSES} tries.
        </p>
        <div className="poster-images mt-2 flex flex-row justify-center items-center gap-2">
          <div className="poster1 relative w-[92px] h-[120px] border-4 border-gray-600 rounded-lg overflow-hidden">
            <Image
              src={`${process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL}${posters[0]}`}
              alt="Fused actor face"
              layout="fill"
              objectFit="cover"
              priority
            />
          </div>
          <div className="poster2 relative w-[92px] h-[120px] border-4 border-gray-600 rounded-lg overflow-hidden">
            <Image
              src={`${process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL}${posters[1]}`}
              alt="Fused actor face"
              layout="fill"
              objectFit="cover"
              priority
            />
          </div>
        </div>

        <button
          onClick={handleShare}
          className="mt-6 w-full px-4 py-3 bg-blue-700 hover:bg-blue-600 rounded-lg text-lg font-bold"
        >
          {shareText}
        </button>

        <div className="mt-6 border-t border-gray-600 pt-4">
          <p className="text-gray-400">NEXT FACE IN</p>
          <p className="text-2xl font-mono">{timeTillNext}</p>
        </div>
      </div>
    </div>
  );
};

interface GameData {
  fusedImageUrl: string;
  answerOptions: string[];
  correctAnswers: string[];
  actor1hints: string[];
  actor2hints: string[];
  actor1Poster: string;
  actor2Poster: string;
}

interface GameState {
  status: 'loading' | 'playing' | 'won' | 'lost';
  guesses: string[][];
  revealedCorrect: string[];
}

export default function HomePage() {
  const [gameState, setGameState] = useState<GameState>({
    status: 'loading',
    guesses: [],
    revealedCorrect: [],
  });
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [shareText, setShareText] = useState('Copy Score');

  const correctAnswersSet = useMemo(
    () => new Set(gameData?.correctAnswers || []),
    [gameData]
  );
  const revealedCorrectSet = useMemo(
    () => new Set(gameState.revealedCorrect),
    [gameState.revealedCorrect]
  );
  const todayKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(now.getDate()).padStart(2, '0');
    return `gameState_${year}-${month}-${day}`;
  }, []);

  // Effect to load game state from localStorage or fetch new data
  useEffect(() => {
    const savedStateJSON = localStorage.getItem(todayKey);

    const fetchGameData = async () => {
      try {
        const response = await fetch('/oldschoolfaces/api/daily-game');
        if (!response.ok) throw new Error('Failed to fetch game data');
        const data: GameData = await response.json();
        setGameData(data);
        if (savedStateJSON) {
          setGameState(JSON.parse(savedStateJSON));
        } else {
          setGameState({ status: 'playing', guesses: [], revealedCorrect: [] });
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchGameData();
  }, [todayKey]);

  // Effect to save game state to localStorage whenever it changes
  useEffect(() => {
    if (gameState.status !== 'loading') {
      localStorage.setItem(todayKey, JSON.stringify(gameState));
    }
  }, [gameState, todayKey]);

  const handleAnswerClick = (name: string) => {
    if (gameState.status !== 'playing' || revealedCorrectSet.has(name)) return;
    setSelectedAnswers((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : prev.length + revealedCorrectSet.size < 2
        ? [...prev, name]
        : prev
    );
  };

  const handleSubmit = () => {
    const currentGuess = [...selectedAnswers, ...revealedCorrectSet];
    if (currentGuess.length !== 2) return;

    // Check for newly revealed correct answers from this guess
    const newlyRevealed = selectedAnswers.filter((name) =>
      correctAnswersSet.has(name)
    );
    const updatedRevealed = new Set([...revealedCorrectSet, ...newlyRevealed]);

    const isWin = updatedRevealed.size === 2;
    const newGuesses = [...gameState.guesses, selectedAnswers];

    if (isWin) {
      setGameState({
        status: 'won',
        guesses: newGuesses,
        revealedCorrect: Array.from(updatedRevealed),
      });
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameState({
        status: 'lost',
        guesses: newGuesses,
        revealedCorrect: Array.from(updatedRevealed),
      });
    } else {
      setGameState({
        status: 'playing',
        guesses: newGuesses,
        revealedCorrect: Array.from(updatedRevealed),
      });
      setSelectedAnswers([]);
    }
  };
  const handleShare = async () => {
    const guessCount = gameState.guesses.length;
    const result =
      gameState.status === 'won'
        ? `${guessCount}/${MAX_GUESSES}`
        : `X/${MAX_GUESSES}`;
    const title = `Old School Faces ${new Date().toLocaleDateString()}`;
    const text = `${title}\n${result}\n\nCan you guess today's face?`;
    const url = 'https://agws.app/oldschoolfaces';

    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(
        `${text}\n\n https://agws.app/oldschoolfaces`
      );
      setShareText('Copied!');
      setTimeout(() => setShareText('Copy Score'), 2000);
    }
  };

  const getButtonClass = (name: string) => {
    if (gameState.status === 'won' || gameState.status === 'lost') {
      if (correctAnswersSet.has(name)) return 'bg-green-600';
      return 'bg-gray-800 text-gray-500 opacity-50';
    }

    if (revealedCorrectSet.has(name)) return 'bg-green-600 cursor-not-allowed'; // Correctly revealed
    if (selectedAnswers.includes(name))
      return 'bg-purple-600 ring-2 ring-purple-300'; // Currently selected

    const pastIncorrectGuesses = gameState.guesses
      .flat()
      .filter((g) => !correctAnswersSet.has(g));
    if (pastIncorrectGuesses.includes(name))
      return 'bg-red-800 text-gray-400 cursor-not-allowed opacity-60';

    return 'bg-gray-700 hover:bg-gray-600';
  };

  if (gameState.status === 'loading' || !gameData) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-4xl font-bold">Loading Today&apos;s Face...</h1>
        <pre style={{ fontSize: '2rem', lineHeight: '1.2' }}>
          {`
  ( ͡° ͜ʖ ͡°)
`}
        </pre>
      </main>
    );
  }

  return (
    <main className="flex flex-col justify-between items-center min-h-screen p-4 sm:p-4 bg-gray-900 text-white">
      {/* RESULTS MODAL  */}
      {(gameState.status === 'won' || gameState.status === 'lost') && (
        <ResultsModal
          gameState={gameState}
          guesses={gameState.guesses}
          handleShare={handleShare}
          shareText={shareText}
          posters={[gameData.actor1Poster, gameData.actor2Poster]}
        />
      )}
      <h1 className="text-3xl font-bold text-center sm:tracking-wider">
        Old-School Faces
      </h1>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-4 items-center my-4">
        {/* ACTOR 1 HINTS */}
        <div className="p-2 text-center md:text-right">
          <h2 className="text-xl font-bold">Actor 1</h2>
          <ul className="mt-2 text-purple-300">
            {gameData.actor1hints.map(
              (hint, index) =>
                gameState.guesses.length > index && (
                  <li key={index} className="my-1">
                    {hint}
                  </li>
                )
            )}
          </ul>
        </div>

        {/* FUSED IMAGE */}
        <div className="relative w-full max-w-xs mx-auto aspect-square border-4 border-gray-600 rounded-lg overflow-hidden">
          <Image
            src={gameData.fusedImageUrl}
            alt="Fused actor face"
            layout="fill"
            objectFit="cover"
            priority
          />
        </div>

        {/* ACTOR 2 HINTS */}
        <div className="p-2 text-center md:text-left">
          <h2 className="text-xl font-bold">Actor 2</h2>
          <ul className="mt-2 text-purple-300">
            {gameData.actor2hints.map(
              (hint, index) =>
                gameState.guesses.length > index + 3 && (
                  <li key={index} className="my-1">
                    {hint}
                  </li>
                )
            )}
          </ul>
        </div>
      </div>

      {/* --- RESPONSIVE ANSWER GRID & SUBMIT BUTTON --- */}
      <div className="w-full max-w-3xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
          {gameData.answerOptions.map((name) => (
            <button
              key={name}
              disabled={
                gameState.status !== 'playing' || revealedCorrectSet.has(name)
              }
              onClick={() => handleAnswerClick(name)}
              className={`p-3 rounded-lg text-sm sm:text-base transition-all duration-200 ${getButtonClass(
                name
              )}`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="text-center mt-4">
          {gameState.status === 'playing' && (
            <button
              disabled={selectedAnswers.length + revealedCorrectSet.size < 2}
              onClick={handleSubmit}
              className="px-10 py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-lg font-bold"
            >
              Submit ({gameState.guesses.length + 1}/{MAX_GUESSES})
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

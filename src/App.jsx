import React, { useState, useEffect, useRef } from 'react';
import { Dice5, Trophy, RotateCcw, UserCircle2, Volume2, VolumeX, Play, HelpCircle, Sparkles, AlertCircle, Plus, Minus } from 'lucide-react';

const TEAM_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'];
const DEFAULT_TEAM_NAMES = ['第一组', '第二组', '第三组', '第四组', '第五组', '第六组', '第七组', '第八组'];
const MIN_TEAMS = 2;
const MAX_TEAMS = 8;

const makeDefaultTeams = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: DEFAULT_TEAM_NAMES[i],
    pos: 0,
    color: TEAM_COLORS[i],
  }));

const App = () => {
  const [setupTeams, setSetupTeams] = useState(makeDefaultTeams(4));
  const [players, setPlayers] = useState([]);

  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState('大家都在 0 号站坐稳了吗？准备出发！');
  const [winner, setWinner] = useState(null);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const [showQuestion, setShowQuestion] = useState(false);
  const [questionData, setQuestionData] = useState({ current: 0, options: [], correct: 0, originalPos: 0 });
  const [shake, setShake] = useState(false);

  const audioContext = useRef(null);
  const bgmRef = useRef(null);

  const initAudio = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  const playSound = (type) => {
    if (!audioContext.current) return;
    const ctx = audioContext.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    switch (type) {
      case 'roll':
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.05, now);
        osc.start(now); osc.stop(now + 0.08);
        break;
      case 'step':
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        osc.start(now); osc.stop(now + 0.1);
        break;
      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        osc.start(now); osc.stop(now + 0.15);
        break;
      case 'correct':
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        osc.start(now); osc.stop(now + 0.3);
        break;
      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
        break;
      case 'slide':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        osc.start(now); osc.stop(now + 0.5);
        break;
      case 'win':
        [440, 554, 659, 880].forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.setValueAtTime(f, now + i * 0.1);
          g.gain.setValueAtTime(0.1, now + i * 0.1);
          o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.5);
        });
        break;
      default: break;
    }
  };

  useEffect(() => {
    if (bgmEnabled && gameStarted) {
      if (!bgmRef.current) {
        bgmRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-funny-game-loop-508.mp3');
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.08;
      }
      bgmRef.current.play().catch(() => {});
    } else if (bgmRef.current) {
      bgmRef.current.pause();
    }
  }, [bgmEnabled, gameStarted]);

  const getRoundingValue = (num) => {
    if (num < 5) return 0;
    if (num >= 95) return 100;
    const ones = num % 10;
    if (ones === 0) return num;
    return ones < 5 ? Math.floor(num / 10) * 10 : Math.ceil(num / 10) * 10;
  };

  const updatePlayerPos = (index, pos) => {
    setPlayers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], pos };
      return next;
    });
  };

  const moveStepByStep = async (index, startPos, endPos, type = 'step') => {
    let current = startPos;
    const direction = endPos > startPos ? 1 : -1;
    while (current !== endPos) {
      current += direction;
      updatePlayerPos(index, current);
      playSound(type);
      await new Promise(r => setTimeout(r, type === 'step' ? 200 : 350));
    }
  };

  const rollDice = async () => {
    if (isRolling || isMoving || winner || showQuestion) return;
    initAudio();
    setIsRolling(true);
    setMessage('🎲 正在投掷骰子...');

    let tempValue = 1;
    const rollInterval = setInterval(() => {
      tempValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(tempValue);
      playSound('roll');
    }, 100);

    await new Promise(r => setTimeout(r, 1200));
    clearInterval(rollInterval);

    const finalRoll = Math.floor(Math.random() * 6) + 1;
    setDiceValue(finalRoll);

    await new Promise(r => setTimeout(r, 1000));
    setIsRolling(false);
    setIsMoving(true);

    const player = players[currentPlayer];
    const originalPos = player.pos;
    let targetPos = player.pos + finalRoll;
    if (targetPos > 100) targetPos = 100;

    setMessage(`${player.name} 行进中...`);
    await moveStepByStep(currentPlayer, player.pos, targetPos, 'step');

    const rounded = getRoundingValue(targetPos);
    if (rounded !== targetPos) {
      const low = Math.floor(targetPos / 10) * 10;
      const high = Math.ceil(targetPos / 10) * 10;
      setQuestionData({
        current: targetPos,
        options: [low, high],
        correct: rounded,
        originalPos,
      });
      playSound('pop');
      setShowQuestion(true);
      setMessage(`请选择：${targetPos} 应该滑向哪一站？`);
    } else {
      checkWinOrNext(targetPos);
    }
  };

  const handleChoice = async (choice) => {
    if (choice === questionData.correct) {
      playSound('correct');
      setShowQuestion(false);
      const movesBack = questionData.correct < questionData.current;
      setMessage(movesBack
        ? '回答正确！近似值有时候会往回走，这是十位近似值的规则～准备滑行...'
        : '回答正确！准备滑行...');
      await new Promise(r => setTimeout(r, 800));
      await moveStepByStep(currentPlayer, questionData.current, questionData.correct, 'slide');
      checkWinOrNext(questionData.correct);
    } else {
      playSound('wrong');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setMessage('哎呀，答错了！列车要退后了...');

      await new Promise(r => setTimeout(r, 1000));
      setShowQuestion(false);

      const penaltyPos = Math.max(0, questionData.originalPos - 1);

      setMessage(`列车正在动力回收，退回到 ${penaltyPos} 号站。`);
      await moveStepByStep(currentPlayer, questionData.current, penaltyPos, 'step');

      checkWinOrNext(penaltyPos);
    }
  };

  const checkWinOrNext = (finalPos) => {
    if (finalPos >= 100) {
      setWinner(players[currentPlayer].name);
      setIsMoving(false);
      playSound('win');
    } else {
      const nextIdx = (currentPlayer + 1) % players.length;
      setCurrentPlayer(nextIdx);
      setIsMoving(false);
      setMessage(`下一位：${players[nextIdx].name}`);
    }
  };

  const resetToSetup = () => {
    setPlayers([]);
    setCurrentPlayer(0);
    setDiceValue(0);
    setIsRolling(false);
    setIsMoving(false);
    setMessage('大家都在 0 号站坐稳了吗？准备出发！');
    setWinner(null);
    setGameStarted(false);
    setShowQuestion(false);
  };

  const addTeam = () => {
    if (setupTeams.length >= MAX_TEAMS) return;
    const i = setupTeams.length;
    setSetupTeams(prev => [...prev, { id: i + 1, name: DEFAULT_TEAM_NAMES[i], pos: 0, color: TEAM_COLORS[i] }]);
  };

  const removeTeam = () => {
    if (setupTeams.length <= MIN_TEAMS) return;
    setSetupTeams(prev => prev.slice(0, -1));
  };

  const renameTeam = (index, name) => {
    setSetupTeams(prev => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const startGame = () => {
    setPlayers(setupTeams.map(t => ({ ...t, pos: 0 })));
    setGameStarted(true);
    initAudio();
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-700 p-6">
        <div className="bg-white p-10 md:p-12 rounded-[60px] shadow-2xl text-center max-w-xl w-full border-b-[15px] border-blue-900">
          <h1 className="text-5xl md:text-6xl font-black text-blue-600 mb-2 italic tracking-tighter">近似值特快车</h1>
          <p className="text-xl md:text-2xl font-bold text-slate-400 mb-8">答对前进，答错倒退一格！</p>

          <div className="bg-slate-50 rounded-[35px] p-6 mb-8 border-4 border-dashed border-slate-200">
            <div className="flex items-center justify-between mb-5">
              <span className="text-slate-500 font-black text-lg uppercase">队伍数量</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={removeTeam}
                  disabled={setupTeams.length <= MIN_TEAMS}
                  className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-600 font-black flex items-center justify-center disabled:opacity-30 hover:bg-slate-300 transition-all"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-3xl font-black text-slate-800 w-8">{setupTeams.length}</span>
                <button
                  onClick={addTeam}
                  disabled={setupTeams.length >= MAX_TEAMS}
                  className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-600 font-black flex items-center justify-center disabled:opacity-30 hover:bg-blue-200 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {setupTeams.map((team, idx) => (
                <div key={team.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2 border border-slate-100">
                  <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                  <input
                    value={team.name}
                    onChange={(e) => renameTeam(idx, e.target.value)}
                    maxLength={12}
                    className="flex-1 min-w-0 font-black text-slate-700 text-lg outline-none bg-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={startGame}
            className="group flex items-center gap-4 mx-auto px-12 py-6 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-[35px] font-black text-2xl md:text-3xl transition-all shadow-[0_12px_0_rgb(202,138,4)] active:translate-y-2 active:shadow-none"
          >
            <Play className="fill-current w-9 h-9 md:w-10 md:h-10" /> 开启课堂比赛
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-200 p-4 font-sans select-none overflow-hidden relative">

      {isRolling && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="bg-white p-14 rounded-[70px] shadow-[0_0_80px_rgba(255,255,255,0.9)] border-[12px] border-blue-500 animate-bounce">
            <div className="text-slate-300 font-black text-3xl mb-4 uppercase text-center">正在投掷</div>
            <div className="w-64 h-64 bg-slate-50 rounded-[55px] border-[18px] border-slate-100 shadow-inner flex items-center justify-center transform rotate-12 transition-transform">
              <span className="text-[12rem] font-black text-blue-600 leading-none drop-shadow-2xl">
                {diceValue}
              </span>
            </div>
            <div className="mt-10 flex justify-center items-center gap-4">
              <Sparkles className="w-10 h-10 text-yellow-400 animate-pulse" />
              <div className="text-4xl font-black text-slate-800 italic">点数会是多少？</div>
              <Sparkles className="w-10 h-10 text-yellow-400 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-[35px] shadow-lg mb-4 border-b-4 border-slate-300">
        <div className="flex items-center gap-4 bg-slate-50 px-8 py-3 rounded-2xl border border-slate-100">
          <div className="w-10 h-10 rounded-full animate-pulse shadow-md" style={{ backgroundColor: players[currentPlayer].color }} />
          <div className="text-2xl font-black" style={{ color: players[currentPlayer].color }}>{players[currentPlayer].name}</div>
        </div>

        <div className="flex-1 text-center text-3xl font-black text-slate-700 px-10 truncate">{message}</div>

        <div className="flex gap-3">
          <button onClick={() => setBgmEnabled(!bgmEnabled)} className={`p-4 rounded-2xl transition-all shadow-sm ${bgmEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-300'}`}>
            {bgmEnabled ? <Volume2 /> : <VolumeX />}
          </button>
          <button onClick={resetToSetup} className="p-4 bg-slate-100 text-slate-300 hover:text-red-500 rounded-2xl transition-all shadow-sm">
            <RotateCcw />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 bg-white p-4 rounded-[45px] shadow-2xl border-4 border-white relative overflow-hidden flex flex-col gap-1">

          <div className="h-16 w-full bg-blue-500 rounded-2xl border-4 border-blue-400 flex items-center justify-between px-10 relative">
            <div className="text-white font-black text-2xl z-10 flex items-center gap-2">🚉 0 号始发站</div>
            <div className="absolute inset-0 flex items-center justify-center gap-5">
              {players.map((p) => p.pos === 0 && (
                <div key={p.id} className="w-10 h-10 rounded-full shadow-lg border-4 border-white flex items-center justify-center animate-bounce transition-all" style={{ backgroundColor: p.color }}>
                  <UserCircle2 className="w-6 h-6 text-white" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-10 gap-1 mt-1">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
              const isStation = num % 10 === 0;
              const isTarget = showQuestion && questionData.options.includes(num);
              return (
                <div key={num} className={`relative border-2 flex items-center justify-center text-2xl font-black rounded-xl transition-all
                  ${isStation ? 'bg-yellow-100 border-yellow-300 text-yellow-700 scale-[1.02] shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-200'}
                  ${isTarget ? 'ring-8 ring-blue-400 z-20 bg-blue-50 animate-pulse' : ''}`}>
                  {num}
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1">
                    {players.map((p) => p.pos === num && (
                      <div key={p.id} className="w-10 h-10 rounded-full shadow-lg border-4 border-white flex items-center justify-center animate-bounce" style={{ backgroundColor: p.color }}>
                        <UserCircle2 className="w-6 h-6 text-white" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-44 flex gap-5">
          <div className="w-52 bg-white rounded-[40px] shadow-xl border-b-8 border-slate-300 flex flex-col items-center justify-center">
            <div className="text-xs font-bold text-slate-300 uppercase">点数结果</div>
            <div className="text-8xl font-black text-slate-800">{diceValue || '?'}</div>
          </div>

          <button
            onClick={rollDice}
            disabled={isRolling || isMoving || !!winner || showQuestion}
            className={`flex-1 rounded-[40px] text-6xl font-black text-white shadow-[0_15px_0_rgb(30,58,138)] transform active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-8
              ${isRolling || isMoving || !!winner || showQuestion ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isRolling ? '投掷中' : (isMoving ? '前进中' : <>掷骰子 <Dice5 className="w-20 h-20" /></>)}
          </button>

          <div className="w-80 bg-white rounded-[40px] shadow-xl border-b-8 border-slate-300 p-6 flex flex-col justify-center">
            <div className="text-slate-400 font-bold text-sm mb-3 uppercase flex items-center gap-2">🏁 前两名</div>
            {players.slice().sort((a, b) => b.pos - a.pos).slice(0, 2).map((p) => (
              <div key={p.id} className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                <div className="font-black text-slate-700 text-xl truncate flex-1">{p.name}</div>
                <div className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl text-xl">{p.pos}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showQuestion && (
        <div className="fixed inset-0 bg-blue-900/70 backdrop-blur-lg flex items-center justify-center z-[600] p-6">
          <div className={`bg-white rounded-[60px] p-12 max-w-2xl w-full text-center shadow-2xl border-t-[20px] border-blue-500 transition-all ${shake ? 'animate-bounce border-red-500' : ''}`}>
            <div className="relative inline-block mb-6">
              <HelpCircle className="w-24 h-24 text-blue-600 mx-auto" />
              <AlertCircle className="absolute -top-2 -right-2 w-10 h-10 text-red-500 bg-white rounded-full animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-2">我们要滑向哪一站？</h2>
            <div className="bg-slate-50 p-8 rounded-[40px] mb-10 flex items-center justify-center gap-10 border-4 border-dashed border-slate-200">
              <div className="text-slate-400 text-3xl font-bold italic">当前停在：</div>
              <div className="text-9xl font-black text-blue-600 tracking-tighter">{questionData.current}</div>
            </div>

            <div className="grid grid-cols-2 gap-10">
              {questionData.options.map(opt => (
                <button key={opt} onClick={() => handleChoice(opt)}
                  className="group relative py-12 rounded-[55px] text-8xl font-black transition-all shadow-[0_20px_0_rgb(226,232,240)] active:translate-y-2 active:shadow-none bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white"
                >
                  {opt}
                  {opt === 0 && <div className="absolute -top-4 -left-4 bg-yellow-400 text-yellow-900 text-base px-6 py-2 rounded-full border-4 border-white font-bold">起点</div>}
                </button>
              ))}
            </div>
            <p className="mt-12 text-red-400 text-2xl font-black animate-pulse flex items-center justify-center gap-2">
              ⚠️ 答错会多退一格哦！
            </p>
          </div>
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 bg-yellow-500/95 backdrop-blur-2xl flex items-center justify-center z-[700] p-6">
          <div className="bg-white rounded-[75px] p-20 max-w-2xl w-full text-center shadow-2xl border-b-[25px] border-yellow-700">
            <Trophy className="w-64 h-64 text-yellow-500 mx-auto mb-10 animate-bounce" />
            <h2 className="text-7xl font-black text-slate-900 mb-6 italic tracking-tight">终点抵达！</h2>
            <p className="text-4xl font-bold text-blue-600 mb-16">恭喜【{winner}】成为冠军！</p>
            <button onClick={resetToSetup} className="w-full py-10 bg-green-500 text-white rounded-[50px] font-black text-5xl hover:bg-green-600 shadow-xl transition-all active:scale-95">
              再来一场
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

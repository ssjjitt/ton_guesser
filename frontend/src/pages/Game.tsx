import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { ArrowRight, RotateCcw, Check, Flag, CheckCircle2, CircleDashed, Share2, Lightbulb, Play } from 'lucide-react'
import { playTick, playWin, playLose } from '../utils/audio'

interface Question {
  id: number
  description: string
  imageUrl: string
  maskUrl: string
  trueColor: string
}

interface Round {
  id: number
  title: string
  questions: Question[]
}

function parseRGB(rgb: string) {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return [0,0,0]
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}

function calculateScore(trueRGB: number[], guessRGB: number[]) {
  const maxDiff = 255 * 3
  const diff = Math.abs(trueRGB[0] - guessRGB[0]) + 
               Math.abs(trueRGB[1] - guessRGB[1]) + 
               Math.abs(trueRGB[2] - guessRGB[2])
  
  const percentage = Math.max(0, 100 - (diff / maxDiff) * 100)
  return Math.round(percentage)
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))]
}

function VerticalSlider({ value, min, max, onChange, background, tickStep = 5, disabled = false }: { value: number, min: number, max: number, onChange: (v: number) => void, background: string, tickStep?: number, disabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTickRef = useRef<number>(value)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    const el = containerRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    updateValue(e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled) return
    if (e.buttons !== 1) return
    updateValue(e.clientY)
  }

  const updateValue = (clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let y = clientY - rect.top
    if (y < 0) y = 0
    if (y > rect.height) y = rect.height
    const percentage = 1 - (y / rect.height)
    const val = Math.round(min + percentage * (max - min))
    
    if (Math.abs(val - lastTickRef.current) >= tickStep) {
      playTick()
      lastTickRef.current = val
    }
    
    onChange(val)
  }

  return (
    <div 
      ref={containerRef}
      className={`relative flex-1 h-full touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
      style={{ background }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <div 
        className="absolute w-6 h-6 bg-white border-2 border-slate-200 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.5)] pointer-events-none left-1/2 -translate-x-1/2 transition-transform duration-75"
        style={{ top: `${(1 - (value - min) / (max - min)) * 100}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}

type Difficulty = 'easy' | 'normal' | 'hardcore'

const API_URL = import.meta.env.VITE_API_URL || '';

export function Game() {
  const { id } = useParams()
  const [round, setRound] = useState<Round | null>(null)
  
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [hue, setHue] = useState(60)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)
  
  const [hasGuessed, setHasGuessed] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [allScores, setAllScores] = useState<number[]>([])

  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [isSecondTry, setIsSecondTry] = useState(false)
  const [compareSlider, setCompareSlider] = useState(50)

  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/rounds/${id}`)
      .then(res => res.json())
      .then(data => setRound(data))

    if (!localStorage.getItem('tutorial_seen')) {
      setShowTutorial(true)
    }
  }, [id])

  const dismissTutorial = () => {
    localStorage.setItem('tutorial_seen', 'true')
    setShowTutorial(false)
  }

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showTutorial) return
      
      if (e.key === 'Enter') {
        e.preventDefault()
        if (hasGuessed) {
          if (difficulty === 'easy' && score !== null && score < 85 && !isSecondTry) {
            handleTryAgain()
          } else {
            nextQuestion()
          }
        }
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        if (!hasGuessed) handleGuess()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasGuessed, hue, saturation, lightness, showTutorial, difficulty, score, isSecondTry])

  // Save history when game finishes
  useEffect(() => {
    if (round && currentQIndex >= round.questions.length && allScores.length > 0) {
      const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      const history = JSON.parse(localStorage.getItem('color_history') || '[]')
      history.push({
        roundId: round.id,
        title: round.title,
        score: avgScore,
        date: new Date().toISOString()
      })
      localStorage.setItem('color_history', JSON.stringify(history))
    }
  }, [currentQIndex, round, allScores])

  if (!round) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 dark:border-t-blue-500"></div>
    </div>
  )

  if (round.questions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 max-w-xl mx-auto mt-10">
        <CircleDashed size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Empty Round</h2>
        <p>This round doesn't have any questions yet.</p>
        <Link to="/" className="inline-block mt-6 text-blue-600 dark:text-blue-400 font-bold hover:underline">Go back home</Link>
      </div>
    )
  }

  const isGameOver = currentQIndex >= round.questions.length
  
  if (isGameOver) {
    const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)

    const handleShare = () => {
      const diffText = difficulty === 'hardcore' ? ' (on HARDCORE mode 🔥)' : ''
      const text = `🎨 I scored ${avgScore}% accuracy guessing colors in the "${round.title}" quiz${diffText}! Can you beat my memory? Try it out!`
      navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    }

    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-200 dark:border-slate-800 text-center space-y-8 max-w-2xl mx-auto mt-12 animate-in slide-in-from-bottom-8 fade-in duration-700">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={40} className="text-blue-500 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">Round Complete!</h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">Your average accuracy across {allScores.length} photos:</p>
        </div>
        <div className={`text-8xl font-black tracking-tighter ${avgScore >= 90 ? 'text-green-500 drop-shadow-sm dark:drop-shadow-none' : avgScore >= 70 ? 'text-yellow-500 drop-shadow-sm dark:drop-shadow-none' : 'text-red-500 drop-shadow-sm dark:drop-shadow-none'}`}>
          {avgScore}%
        </div>
        <div className="pt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/" className="inline-flex justify-center items-center gap-2 bg-slate-900 dark:bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md active:scale-95">
            <RotateCcw size={20} />
            Play Another
          </Link>
          <button onClick={handleShare} className="inline-flex justify-center items-center gap-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold px-8 py-4 rounded-2xl hover:bg-blue-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95">
            <Share2 size={20} />
            Share Result
          </button>
        </div>
      </div>
    )
  }

  const q = round.questions[currentQIndex]
  const rgbColor = `rgb(${hslToRgb(hue, saturation, lightness).join(', ')})`

  const handleGuess = (forcedScore?: number) => {
    let currentScore = 0
    if (forcedScore !== undefined) {
      currentScore = forcedScore
    } else {
      const trueRGB = parseRGB(q.trueColor)
      const guessRGB = hslToRgb(hue, saturation, lightness)
      currentScore = calculateScore(trueRGB, guessRGB)
    }
    
    setScore(currentScore)
    setHasGuessed(true)

    if (currentScore > 90) {
      playWin()
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b']
      })
    } else {
      playLose()
    }
  }

  const handleGiveUp = () => {
    handleGuess(0)
  }

  const handleTryAgain = () => {
    setHasGuessed(false)
    setScore(null)
    setIsSecondTry(true)
  }

  const nextQuestion = () => {
    if (score !== null) setAllScores([...allScores, score])
    setHasGuessed(false)
    setScore(null)
    setIsSecondTry(false)
    setCompareSlider(50)
    setHue(60)
    setSaturation(100)
    setLightness(50)
    setCurrentQIndex(currentQIndex + 1)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 relative">
      
      {/* Onboarding Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 mb-4">
              <Lightbulb size={32} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">How to Play</h2>
            <div className="space-y-4 text-left text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="flex gap-3"><span className="font-black text-blue-500">1.</span> Look at the original image on the left.</p>
              <p className="flex gap-3"><span className="font-black text-blue-500">2.</span> Use the 3 sliders on the right to mix the exact color of the missing object.</p>
              <p className="flex gap-3"><span className="font-black text-blue-500">3.</span> Press <kbd className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded border dark:border-slate-600 shadow-sm text-xs font-bold font-sans">Space</kbd> to guess, and <kbd className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded border dark:border-slate-600 shadow-sm text-xs font-bold font-sans">Enter</kbd> to go to the next photo!</p>
            </div>
            <button onClick={dismissTutorial} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2">
              <Play size={18} /> Start Playing
            </button>
          </div>
        </div>
      )}

      {/* Header & Difficulty */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
          {q.description}
        </h2>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Difficulty Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            {(['easy', 'normal', 'hardcore'] as Difficulty[]).map(mode => (
              <button
                key={mode}
                onClick={() => setDifficulty(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${difficulty === mode ? (mode === 'hardcore' ? 'bg-red-500 text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm') : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 min-w-[160px]">
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {currentQIndex + 1} / {round.questions.length}
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ease-out ${difficulty === 'hardcore' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
                style={{ width: `${((currentQIndex + (hasGuessed ? 1 : 0)) / round.questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full" key={currentQIndex}>
        {/* Left Side: Image Square */}
        <div className="flex-1 aspect-square rounded-[2rem] overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-md border border-slate-200/50 dark:border-slate-700/50 relative flex justify-center items-center animate-in fade-in slide-in-from-left-4 duration-500">
          {!hasGuessed ? (
            <>
              {/* Original Image */}
              <img src={q.imageUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="Round base" />
              
              {/* Colored Mask */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-none transition-colors duration-100"
                style={{
                  backgroundColor: rgbColor,
                  maskImage: `url(${q.maskUrl})`,
                  WebkitMaskImage: `url(${q.maskUrl})`,
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                  mixBlendMode: 'color'
                }}
              />
            </>
          ) : (
            <div 
              className="absolute inset-0 w-full h-full cursor-ew-resize touch-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect()
                const val = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
                setCompareSlider(val)
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const val = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
                  setCompareSlider(val)
                }
              }}
            >
              {/* Layer 1: Original */}
              <div className="absolute inset-0 w-full h-full">
                <img src={q.imageUrl} className="w-full h-full object-contain" />
              </div>

              {/* Layer 2: Your Guess (clipped) */}
              <div 
                className="absolute inset-0 w-full h-full"
                style={{ clipPath: `inset(0% ${100 - compareSlider}% 0% 0%)` }}
              >
                <img src={q.imageUrl} className="w-full h-full object-contain" />
                <div 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    backgroundColor: rgbColor,
                    maskImage: `url(${q.maskUrl})`,
                    WebkitMaskImage: `url(${q.maskUrl})`,
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center',
                    mixBlendMode: 'color'
                  }}
                />
              </div>

              {/* Divider Line & Handle */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-30 pointer-events-none"
                style={{ left: `${compareSlider}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-200">
                  <div className="flex gap-1">
                    <div className="w-0.5 h-3 bg-slate-400 rounded-full"></div>
                    <div className="w-0.5 h-3 bg-slate-400 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div 
                className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm shadow-md transition-opacity pointer-events-none" 
                style={{ opacity: compareSlider > 20 ? 1 : 0 }}
              >
                Your Guess
              </div>
              <div 
                className="absolute top-4 right-4 bg-green-600/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm shadow-md transition-opacity pointer-events-none" 
                style={{ opacity: compareSlider < 80 ? 1 : 0 }}
              >
                Original
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Color Picker Square OR Results */}
        <div className="flex-1 aspect-square rounded-[2rem] overflow-hidden shadow-md border border-slate-200/50 dark:border-slate-700/50 relative bg-white dark:bg-slate-900 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
          {!hasGuessed ? (
            <div className="flex-1 flex relative">
              {/* The 3 Sliders */}
              <div className={`w-[30%] sm:w-[25%] h-full flex z-10 shadow-lg border-r border-black/10 transition-all ${difficulty === 'hardcore' ? 'w-16 opacity-90' : ''}`}>
                <VerticalSlider 
                  value={hue} min={0} max={360} onChange={setHue} tickStep={10}
                  background="linear-gradient(to bottom, #ff0000 0%, #ff00ff 17%, #0000ff 33%, #00ffff 50%, #00ff00 67%, #ffff00 83%, #ff0000 100%)" 
                />
                <VerticalSlider 
                  value={saturation} min={0} max={100} onChange={setSaturation} tickStep={5}
                  background={`linear-gradient(to bottom, hsl(${hue}, 100%, ${lightness}%), hsl(${hue}, 0%, ${lightness}%))`} 
                />
                <VerticalSlider 
                  value={lightness} min={0} max={100} onChange={setLightness} tickStep={5}
                  background={`linear-gradient(to bottom, #ffffff, hsl(${hue}, ${saturation}%, 50%), #000000)`} 
                />
              </div>

              {/* Chosen Color Display */}
              <div 
                className="flex-1 h-full relative transition-colors duration-75 ease-out flex justify-center items-center" 
                style={{ backgroundColor: difficulty === 'hardcore' ? '#1e293b' : rgbColor }}
              >
                {difficulty === 'hardcore' && (
                  <div className="text-slate-500 font-bold tracking-widest uppercase text-sm rotate-90 opacity-50 select-none pointer-events-none">
                    NO PREVIEW
                  </div>
                )}

                {/* Floating Buttons */}
                <div className="absolute bottom-6 right-6 flex items-center gap-4">
                  {difficulty !== 'hardcore' && (
                    <button 
                      onClick={handleGiveUp}
                      title="Give Up / Show Color"
                      className="w-12 h-12 bg-black/20 hover:bg-black/40 dark:bg-white/20 dark:hover:bg-white/40 backdrop-blur-md rounded-full flex justify-center items-center text-white transition-all active:scale-95"
                    >
                      <Flag size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleGuess()}
                    className="w-16 h-16 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 rounded-full flex justify-center items-center text-white transition-all shadow-2xl hover:scale-105 active:scale-95 border-2 border-white/10"
                  >
                    <Check size={32} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center px-6 animate-in zoom-in-95 duration-300 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">Accuracy</h3>
              <div className={`text-7xl sm:text-8xl font-black tracking-tighter drop-shadow-sm dark:drop-shadow-none ${score! >= 90 ? 'text-green-500' : score! >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                {score}%
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed max-w-sm px-4">
                {score === 0 ? 'You gave up! The correct color is shown on the right. 🏳️' :
                 score! >= 90 ? 'Incredible! You have a perfect eye for color. 🎯' : 
                 score! >= 70 ? 'Great job! You were pretty close. 👍' : 
                 'Not quite! That was a tricky one. 🤔'}
              </p>
              
              <div className="w-full max-w-xs space-y-3 mt-4">
                {difficulty === 'easy' && score !== null && score < 85 && !isSecondTry ? (
                  <button 
                    onClick={handleTryAgain}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-5 rounded-2xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2"
                  >
                    <RotateCcw size={20} />
                    Try Again
                  </button>
                ) : (
                  <button 
                    onClick={nextQuestion}
                    className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold py-5 rounded-2xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2"
                  >
                    {currentQIndex === round.questions.length - 1 ? 'See Final Score' : 'Next Question'}
                    <ArrowRight size={20} />
                  </button>
                )}
                
                <div className="text-slate-400 dark:text-slate-500 text-xs font-bold pt-2">
                  Press <kbd className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> to continue
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

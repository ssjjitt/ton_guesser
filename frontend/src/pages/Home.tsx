import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, Image as ImageIcon, Trophy } from 'lucide-react'

interface Round {
  id: number
  title: string
  questions: any[]
}

interface HistoryItem {
  roundId: number
  title: string
  score: number
  date: string
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function Home() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    fetch(`${API_URL}/api/rounds`)
      .then(res => res.json())
      .then(data => {
        setRounds(data)
        setLoading(false)
      })

    const savedHistory = JSON.parse(localStorage.getItem('color_history') || '[]')
    setHistory(savedHistory)
  }, [])

  const getBestScore = (roundId: number) => {
    const scores = history.filter(h => h.roundId === roundId).map(h => h.score)
    if (scores.length === 0) return null
    return Math.max(...scores)
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-4 py-16">
        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-bold text-sm tracking-wide mb-4">
          COLOR GUESSING GAME
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          Test Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-400 dark:to-purple-400">Color Memory</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto font-medium">
          Choose a quiz below and see how accurately you can remember the exact colors of famous characters and items!
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/80 h-56 flex flex-col gap-6 overflow-hidden relative">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-slate-800/40 to-transparent z-10" />
              <div className="relative flex justify-between items-start z-0">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
                <div className="w-16 h-7 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-3 z-0 mt-2">
                <div className="w-3/4 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"></div>
                <div className="w-5/6 h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rounds.map((round) => {
            const bestScore = getBestScore(round.id)
            return (
              <Link 
                key={round.id} 
                to={`/play/${round.id}`}
                className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/80 hover:shadow-2xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/10 hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 ease-out flex flex-col gap-6 overflow-hidden"
              >
                {/* Decorative background gradient */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                
                <div className="relative flex justify-between items-start z-10">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/40 transition-colors">
                    <PlayCircle className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" size={28} />
                  </div>
                  <div className="flex gap-2">
                    {bestScore !== null && (
                      <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                        <Trophy size={14} />
                        {bestScore}%
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                      <ImageIcon size={14} />
                      {round.questions?.length || 0}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-2">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {round.title}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">
                    Challenge yourself with {round.questions?.length || 0} colorful questions.
                  </p>
                </div>

                <div className="relative z-10 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
                    Play Now <span>→</span>
                  </div>
                </div>
              </Link>
            )
          })}

          {rounds.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mb-4">
                <ImageIcon className="text-slate-400 dark:text-slate-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">No quizzes available</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
                There are no color quizzes created yet. Head over to the admin panel to create your first round!
              </p>
              <Link to="/admin" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                Create a Round
              </Link>
            </div>
          )}
        </div>
      )}

      {/* History Section (only show if they have history) */}
      {history.length > 0 && (
        <div className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="text-yellow-500" size={28} />
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Your Recent Games</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.slice().reverse().slice(0, 8).map((h, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2">
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {new Date(h.date).toLocaleDateString()}
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {h.title}
                </div>
                <div className={`text-2xl font-black ${h.score >= 90 ? 'text-green-500' : h.score >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {h.score}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

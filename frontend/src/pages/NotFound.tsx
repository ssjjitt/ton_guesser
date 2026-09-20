import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative">
          <h1 className="text-9xl font-extrabold text-slate-200 dark:text-slate-800 drop-shadow-sm">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 px-4">
              Color Lost!
            </span>
          </div>
        </div>
        
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Oops! We couldn't find the page you're looking for. It might have been painted over or deleted.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 w-full sm:w-auto justify-center"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          
          <Link 
            to="/"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 w-full sm:w-auto justify-center"
          >
            <Home size={20} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

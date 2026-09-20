import { useState, useRef, useEffect } from 'react'
import { SamModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { Plus, List, Image as ImageIcon, Trash2, Wand2, Paintbrush, Undo2, Save, Trash, FileArchive, SkipForward } from 'lucide-react';
import JSZip from 'jszip';

env.allowLocalModels = false;

interface Round {
  id: number
  title: string
  questions: any[]
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function Admin() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard'>('dashboard')

  const [roundTitle, setRoundTitle] = useState('')
  const [createdRoundId, setCreatedRoundId] = useState<number | null>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(20)

  // Batch Queue State
  const [imageQueue, setImageQueue] = useState<{file: File, name: string}[]>([])

  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReady, setAiReady] = useState(false)
  
  const samModelRef = useRef<any>(null)
  const samProcessorRef = useRef<any>(null)
  const samImageEmbeddingsRef = useRef<any>(null)
  const rawImageRef = useRef<any>(null)

  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetchRounds()
  }, [])

  const fetchRounds = () => {
    fetch(`${API_URL}/api/rounds`)
      .then(res => res.json())
      .then(data => setRounds(data))
  }

  const handleDeleteRound = async (id: number) => {
    if (!confirm('Are you sure you want to delete this round?')) return
    await fetch(`${API_URL}/api/rounds/${id}`, { method: 'DELETE' })
    fetchRounds()
  }

  const startNewRound = async () => {
    if (!roundTitle.trim()) return alert('Title required')
    const res = await fetch(`${API_URL}/api/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: roundTitle })
    })
    const data = await res.json()
    setCreatedRoundId(data.id)
  }

  const processFiles = async (files: FileList | File[]) => {
    let newQueue: {file: File, name: string}[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = new JSZip()
        try {
          const loadedZip = await zip.loadAsync(file)
          const promises: Promise<void>[] = []
          loadedZip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && relativePath.match(/\.(jpe?g|png|webp|gif)$/i)) {
              promises.push(zipEntry.async('blob').then(blob => {
                const ext = relativePath.split('.').pop()
                const extractedFile = new File([blob], zipEntry.name, { type: `image/${ext?.toLowerCase() === 'jpg' ? 'jpeg' : ext}` })
                newQueue.push({ file: extractedFile, name: zipEntry.name })
              }))
            }
          })
          await Promise.all(promises)
        } catch (e) {
          console.error('Failed to unzip', e)
          alert('Failed to read ZIP archive')
        }
      } else if (file.type.startsWith('image/')) {
        newQueue.push({ file, name: file.name })
      }
    }

    if (newQueue.length > 0) {
      let currentSrc = imageSrc
      if (!currentSrc) {
        const next = newQueue.shift()!
        currentSrc = URL.createObjectURL(next.file)
        setImageSrc(currentSrc)
        setDescription('')
        samImageEmbeddingsRef.current = null
        rawImageRef.current = null
        setAiReady(false)
      }
      setImageQueue(prev => [...prev, ...newQueue])
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
    }
    // reset file input
    e.target.value = ''
  }

  const handleNextInQueue = () => {
    if (imageQueue.length > 0) {
      const newQueue = [...imageQueue]
      const next = newQueue.shift()!
      setImageQueue(newQueue)
      setImageSrc(URL.createObjectURL(next.file))
      setDescription('')
      samImageEmbeddingsRef.current = null
      rawImageRef.current = null
      setAiReady(false)
    } else {
      setImageSrc(null)
      setDescription('')
    }
  }

  useEffect(() => {
    if (imageSrc) {
      const img = new Image()
      img.onload = () => {
        const imageCanvas = imageCanvasRef.current
        const drawCanvas = drawCanvasRef.current
        const maskCanvas = maskCanvasRef.current
        if (imageCanvas && drawCanvas && maskCanvas) {
          const maxWidth = 800
          let width = img.width
          let height = img.height
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          [imageCanvas, drawCanvas, maskCanvas].forEach(canvas => {
            canvas.width = width
            canvas.height = height
          })

          const ctx = imageCanvas.getContext('2d')
          if (ctx) ctx.drawImage(img, 0, 0, width, height)

          const maskCtx = maskCanvas.getContext('2d')
          if (maskCtx) {
            maskCtx.fillStyle = 'rgba(0,0,0,0)'
            maskCtx.fillRect(0, 0, width, height)
          }
        }
      }
      img.src = imageSrc
    }
  }, [imageSrc])

  const loadAI = async () => {
    if (samModelRef.current) return;
    setAiLoading(true)
    try {
      const model = await SamModel.from_pretrained('Xenova/slimsam-77-uniform')
      const processor = await AutoProcessor.from_pretrained('Xenova/slimsam-77-uniform')
      samModelRef.current = model
      samProcessorRef.current = processor
    } catch (e) {
      console.error(e)
      alert('Failed to load AI model.')
    } finally {
      setAiLoading(false)
    }
  }

  const prepareImageEmbeddings = async () => {
    if (!imageSrc || !samModelRef.current || !samProcessorRef.current) return;
    setAiLoading(true)
    try {
      const rawImage = await RawImage.fromURL(imageSrc)
      rawImageRef.current = rawImage
      const inputs = await samProcessorRef.current(rawImage)
      const embeddings = await samModelRef.current.get_image_embeddings(inputs)
      samImageEmbeddingsRef.current = embeddings
      setAiReady(true)
    } catch (e) {
      console.error(e)
      alert('Failed to process image.')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (aiEnabled && !samModelRef.current) loadAI()
  }, [aiEnabled])

  useEffect(() => {
    if (aiEnabled && samModelRef.current && imageSrc && !samImageEmbeddingsRef.current) {
      prepareImageEmbeddings()
    }
  }, [aiEnabled, imageSrc, samModelRef.current])

  const handleInteraction = async (e: React.MouseEvent | React.TouchEvent) => {
    if (aiEnabled && aiReady && samModelRef.current && samProcessorRef.current && rawImageRef.current && samImageEmbeddingsRef.current) {
      const { x, y } = getCoordinates(e)
      const canvas = drawCanvasRef.current
      if (!canvas) return
      const img = rawImageRef.current
      const scaleX = img.width / canvas.width
      const scaleY = img.height / canvas.height

      try {
        const inputs = await samProcessorRef.current(rawImageRef.current, {
          input_points: [[[x * scaleX, y * scaleY]]],
          input_labels: [[[1]]]
        })
        
        Object.assign(inputs, samImageEmbeddingsRef.current)

        const outputs = await samModelRef.current(inputs)
        const masks = await samProcessorRef.current.post_process_masks(outputs.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes)

        const maskTensor = masks[0]
        const scores = outputs.iou_scores.data

        let bestIndex = 0, bestScore = -1
        for (let i = 0; i < scores.length; i++) {
          if (scores[i] > bestScore) {
            bestScore = scores[i]
            bestIndex = i
          }
        }

        const H = maskTensor.dims[2]
        const W = maskTensor.dims[3]
        const maskData = maskTensor.data.slice(bestIndex * H * W, (bestIndex + 1) * H * W)

        const drawCtx = drawCanvasRef.current?.getContext('2d')
        const maskCtx = maskCanvasRef.current?.getContext('2d')
        
        if (drawCtx && maskCtx) {
          const imgDataDraw = drawCtx.getImageData(0, 0, canvas.width, canvas.height)
          const imgDataMask = maskCtx.getImageData(0, 0, canvas.width, canvas.height)

          for (let py = 0; py < canvas.height; py++) {
            for (let px = 0; px < canvas.width; px++) {
              const idx = Math.floor(py * scaleY) * W + Math.floor(px * scaleX)
              if (maskData[idx] > 0) {
                const pixelIdx = (py * canvas.width + px) * 4
                imgDataDraw.data[pixelIdx] = 255
                imgDataDraw.data[pixelIdx + 1] = 0
                imgDataDraw.data[pixelIdx + 2] = 0
                imgDataDraw.data[pixelIdx + 3] = 128
                
                imgDataMask.data[pixelIdx] = 0
                imgDataMask.data[pixelIdx + 1] = 0
                imgDataMask.data[pixelIdx + 2] = 0
                imgDataMask.data[pixelIdx + 3] = 255
              }
            }
          }
          drawCtx.putImageData(imgDataDraw, 0, 0)
          maskCtx.putImageData(imgDataMask, 0, 0)
        }
      } catch (e) {
        console.error(e)
      }
    } else {
      setIsDrawing(true)
      draw(e)
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const drawCtx = drawCanvasRef.current?.getContext('2d')
    if (drawCtx) drawCtx.beginPath()
    const maskCtx = maskCanvasRef.current?.getContext('2d')
    if (maskCtx) maskCtx.beginPath()
  }

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    } else {
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || aiEnabled) return
    const { x, y } = getCoordinates(e)
    const drawCtx = drawCanvasRef.current?.getContext('2d')
    if (drawCtx) {
      drawCtx.lineWidth = brushSize
      drawCtx.lineCap = 'round'
      drawCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
      drawCtx.lineTo(x, y)
      drawCtx.stroke()
      drawCtx.beginPath()
      drawCtx.moveTo(x, y)
    }
    const maskCtx = maskCanvasRef.current?.getContext('2d')
    if (maskCtx) {
      maskCtx.lineWidth = brushSize
      maskCtx.lineCap = 'round'
      maskCtx.strokeStyle = 'rgba(0, 0, 0, 1)'
      maskCtx.lineTo(x, y)
      maskCtx.stroke()
      maskCtx.beginPath()
      maskCtx.moveTo(x, y)
    }
  }

  const handleSaveQuestion = async () => {
    if (!createdRoundId || !imageSrc || !description.trim()) return alert('Fill all fields')
    const imageCanvas = imageCanvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!imageCanvas || !maskCanvas) return

    try {
      const imageBlob = await new Promise<Blob>(res => imageCanvas.toBlob(b => res(b!), 'image/jpeg'))
      const maskBlob = await new Promise<Blob>(res => maskCanvas.toBlob(b => res(b!), 'image/png'))

      const formData = new FormData()
      formData.append('image', imageBlob, 'image.jpg')
      formData.append('mask', maskBlob, 'mask.png')
      formData.append('description', description)

      const response = await fetch(`${API_URL}/api/rounds/${createdRoundId}/questions`, { method: 'POST', body: formData })
      if (response.ok) {
        handleNextInQueue()
        fetchRounds()
      } else {
        alert('Failed to add question')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800/80 animate-in fade-in duration-500">
      
      {/* Nice Pill Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-10 w-max mx-auto md:mx-0">
        <button 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <List size={18} />
          Dashboard
        </button>
        <button 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'create' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('create')}
        >
          <Plus size={18} />
          Create Round
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">All Rounds</h2>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left bg-white dark:bg-slate-900">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-500 dark:text-slate-400 font-semibold text-sm tracking-wide uppercase">
                  <th className="py-4 px-6">ID</th>
                  <th className="py-4 px-6">Title</th>
                  <th className="py-4 px-6">Photos</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rounds.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-200">{r.title}</td>
                    <td className="py-4 px-6">
                      <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 py-1 px-3 rounded-full text-sm font-semibold">
                        {r.questions?.length || 0}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => handleDeleteRound(r.id)} className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rounds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                      No rounds created yet. Click "Create Round" to begin!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="space-y-10">
          {!createdRoundId ? (
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-6">Start a New Round</h2>
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-100 dark:border-slate-700">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Give your round a catchy title</label>
                <input 
                  type="text" 
                  value={roundTitle}
                  onChange={e => setRoundTitle(e.target.value)}
                  placeholder="e.g. Cartoon Characters Quiz"
                  className="w-full px-5 py-4 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl font-medium focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500 transition-all outline-none"
                />
                <button onClick={startNewRound} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-blue-950 dark:text-blue-100">Editing: {roundTitle}</h2>
                  <p className="text-sm text-blue-800/80 dark:text-blue-300 font-medium">Add photos to this round to make it a fun game.</p>
                </div>
                <button 
                  onClick={() => { setCreatedRoundId(null); setRoundTitle(''); setActiveTab('dashboard'); setImageQueue([]); setImageSrc(null) }}
                  className="bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                >
                  Finish Round
                </button>
              </div>

              {!imageSrc ? (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-16 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                  <label className="cursor-pointer flex flex-col items-center gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/40 p-4 rounded-full group-hover:scale-110 transition-transform flex gap-2 text-blue-500 dark:text-blue-400">
                      <ImageIcon size={32} />
                      <FileArchive size={32} />
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-lg block mb-1">Click to upload Images or a ZIP archive</span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">PNG, JPG, or a .zip containing multiple images</span>
                    </div>
                    <input type="file" accept="image/*,.zip" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <div className="space-y-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
                  
                  {/* Batch Upload Banner */}
                  {imageQueue.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-xs font-bold text-center py-1.5 shadow-sm z-50">
                      Batch Mode: {imageQueue.length} photos remaining in queue
                    </div>
                  )}

                  {/* AI Toggle Banner */}
                  <div className={`flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl border transition-colors ${aiEnabled ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'} ${imageQueue.length > 0 ? 'mt-4' : ''}`}>
                    <div className={`p-3 rounded-xl ${aiEnabled ? 'bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300' : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 shadow-sm'}`}>
                      <Wand2 size={24} />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className={`font-bold ${aiEnabled ? 'text-purple-900 dark:text-purple-100' : 'text-slate-700 dark:text-slate-300'}`}>AI Magic Selection</h3>
                      <p className={`text-sm font-medium ${aiEnabled ? 'text-purple-700/80 dark:text-purple-300/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        Click on objects to automatically detect their exact boundaries.
                      </p>
                    </div>
                    <button 
                      onClick={() => setAiEnabled(!aiEnabled)}
                      className={`px-6 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap ${aiEnabled ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                    >
                      {aiEnabled ? 'AI Mode: ON' : 'Turn On AI'}
                    </button>
                  </div>

                  <div className="relative border-2 border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 flex justify-center items-center">
                    {aiLoading && (
                      <div className="absolute inset-0 z-50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <div className="w-full max-w-sm px-8 py-8 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-purple-100 dark:border-purple-900/50 relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent" />
                          <Wand2 size={48} className="text-purple-500 animate-bounce drop-shadow-sm" />
                          <span className="text-purple-800 dark:text-purple-300 font-extrabold text-lg text-center">Warming up AI Model...<br/><span className="text-sm font-medium text-purple-600 dark:text-purple-400 opacity-80">This might take a moment on first load</span></span>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-gradient-to-r from-purple-400 to-purple-600 w-full animate-pulse" />
                          </div>
                        </div>
                      </div>
                    )}
                    <canvas ref={imageCanvasRef} className="absolute inset-0 m-auto z-10 w-full h-full object-contain pointer-events-none" />
                    <canvas 
                      ref={drawCanvasRef} 
                      className={`relative z-20 w-full h-full object-contain touch-none ${aiEnabled ? (aiReady ? 'cursor-crosshair' : 'cursor-wait') : 'cursor-crosshair'}`}
                      onMouseDown={handleInteraction}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={handleInteraction}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      onTouchCancel={stopDrawing}
                    />
                    <canvas ref={maskCanvasRef} className="hidden" />
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {!aiEnabled && (
                      <div className="flex items-center gap-4 flex-1 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-xl border border-slate-100 dark:border-slate-700 w-full">
                        <Paintbrush size={18} className="text-slate-400 dark:text-slate-500" />
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Brush Size</label>
                        <input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full accent-blue-600 dark:accent-blue-500" />
                      </div>
                    )}
                    
                    <div className="flex gap-3 w-full md:w-auto ml-auto">
                      {imageQueue.length > 0 && (
                        <button onClick={handleNextInQueue} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-xl font-bold transition-colors">
                          <SkipForward size={18} /> Skip Photo
                        </button>
                      )}
                      <button onClick={() => {
                        setImageQueue([])
                        setImageSrc(null)
                      }} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl font-bold transition-colors">
                        <Trash size={18} /> Cancel
                      </button>
                      <button onClick={() => {
                        const drawCtx = drawCanvasRef.current?.getContext('2d')
                        const maskCtx = maskCanvasRef.current?.getContext('2d')
                        if (drawCtx && drawCanvasRef.current) drawCtx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height)
                        if (maskCtx && maskCanvasRef.current) maskCtx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
                      }} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl font-bold transition-colors">
                        <Undo2 size={18} /> Clear Mask
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">What should players guess?</label>
                    <input 
                      type="text" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      placeholder="e.g. What color is the character's hair?" 
                      className="w-full px-5 py-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl font-medium focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:border-blue-500 transition-all outline-none" 
                    />
                  </div>

                  <button 
                    onClick={handleSaveQuestion} 
                    className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                  >
                    <Save size={20} />
                    {imageQueue.length > 0 ? `Save & Edit Next Photo (${imageQueue.length} left)` : 'Add Photo to Round'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

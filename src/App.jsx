import { useState, useEffect } from 'react'
import AdminForm from './components/AdminForm.jsx'
import TimetableDisplay from './components/TimetableDisplay.jsx'
import ClassicTimetable from './components/ClassicTimetable.jsx'
import { generateTimetableWithGemini, generateTimetableFallback } from './services/geminiApi.js'
import './App.css'

function App() {
  const [timetableData, setTimetableData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState(null)
  const [apiKeyAvailable, setApiKeyAvailable] = useState(true)
  const [viewMode, setViewMode] = useState('classic') // 'classic' or 'modern'

  useEffect(() => {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setApiKeyAvailable(false);
      setError('Gemini API key not configured. Using fallback generation method.');
    }
  }, []);

  const handleFormSubmit = async (formData) => {
    setIsLoading(true)
    setError(null)
    setFormData(formData)
    
    try {
      let generatedTimetable;
      
      if (apiKeyAvailable) {
        // Try to generate with Gemini API
        generatedTimetable = await generateTimetableWithGemini(formData)
      } else {
        // Use fallback directly if API key is not available
        generatedTimetable = generateTimetableFallback(formData)
      }
      
      setTimetableData(generatedTimetable)
    } catch (apiError) {
      console.error('API Error, using fallback:', apiError)
      
      // If API fails, use the fallback method
      try {
        const fallbackTimetable = generateTimetableFallback(formData)
        setTimetableData(fallbackTimetable)
        setError('AI generation failed. Used fallback method instead.')
      } catch (fallbackError) {
        setError('Failed to generate timetable. Please check your inputs and try again.')
        console.error('Fallback error:', fallbackError)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleTimetableUpdate = (updatedTimetable) => {
    setTimetableData(updatedTimetable)
  }

  const handleRegenerate = () => {
    if (formData) {
      handleFormSubmit(formData)
    } else {
      setTimetableData(null)
    }
  }

  const handleBackToForm = () => {
    setTimetableData(null)
    setError(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Timetable Scheduler</h1>
        <p>Generate and manage school timetables efficiently</p>
        {!apiKeyAvailable && (
          <div className="api-warning">
            Note: Gemini API key not configured. Using fallback generation method.
          </div>
        )}
      </header>
      
      <main className="app-main">
        {!timetableData ? (
          <AdminForm onSubmit={handleFormSubmit} isLoading={isLoading} />
        ) : (
          <>
            <div className="timetable-controls">
              <div className="view-toggle">
                <button 
                  className={viewMode === 'classic' ? 'active' : ''}
                  onClick={() => setViewMode('classic')}
                >
                  Classic View
                </button>
                <button 
                  className={viewMode === 'modern' ? 'active' : ''}
                  onClick={() => setViewMode('modern')}
                >
                  Modern View
                </button>
              </div>
              
              <button onClick={handleBackToForm} className="back-btn">
                ← Back to Form
              </button>
            </div>
            
            {viewMode === 'classic' ? (
              <ClassicTimetable 
                timetableData={timetableData} 
                onUpdate={handleTimetableUpdate}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <TimetableDisplay 
                timetableData={timetableData} 
                onUpdate={handleTimetableUpdate}
                onRegenerate={handleRegenerate}
              />
            )}
          </>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Generating timetable{apiKeyAvailable ? ' with AI' : ''}...</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

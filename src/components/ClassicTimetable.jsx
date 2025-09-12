import { useState, useEffect } from 'react'

const ClassicTimetable = ({ timetableData, onUpdate, onRegenerate }) => {
  const [editing, setEditing] = useState(null) // {day: day, period: periodIndex}
  const [selectedClass, setSelectedClass] = useState('')

  useEffect(() => {
    // Set the first class as default when timetable loads
    if (timetableData && Object.keys(timetableData.classes).length > 0 && !selectedClass) {
      setSelectedClass(Object.keys(timetableData.classes)[0])
    }
  }, [timetableData, selectedClass])

  if (!timetableData || !timetableData.classes || !selectedClass) {
    return <div className="no-data">No timetable data available</div>
  }

  const classData = timetableData.classes[selectedClass]
  const days = timetableData.metadata.days
  const periods = timetableData.metadata.periods

  const handleCellClick = (day, periodIndex) => {
    setEditing({ day, period: periodIndex })
  }

  const handleSubjectChange = (day, periodIndex, subjectName) => {
    const updatedTimetable = JSON.parse(JSON.stringify(timetableData)) // Deep clone
    
    // Find the subject details
    const selectedSubject = timetableData.metadata.subjects.find(s => s.name === subjectName) || 
                           { name: subjectName, teacher: '' };
    
    // Update the timetable
    updatedTimetable.classes[selectedClass].schedule[day][periodIndex].subject = subjectName;
    updatedTimetable.classes[selectedClass].schedule[day][periodIndex].teacher = selectedSubject.teacher;
    
    onUpdate(updatedTimetable);
    setEditing(null);
  }

  const getAvailableSubjects = () => {
    return classData.subjects || []
  }

  // Format time to 12-hour format with AM/PM
  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'
    const formattedHour = hour % 12 || 12
    return `${formattedHour}:${minutes}${period}`
  }

  const exportTimetable = () => {
    const csvContent = generateCSV()
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedClass}_timetable.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const generateCSV = () => {
    let csv = 'Day,' + periods.map((_, index) => `Period ${index + 1}`).join(',') + '\n'
    
    days.forEach(day => {
      const row = [day]
      periods.forEach((_, periodIndex) => {
        const periodData = classData.schedule[day][periodIndex]
        const cellContent = periodData.subject ? `${periodData.subject} (${periodData.teacher})` : 'Free'
        row.push(`"${cellContent}"`)
      })
      csv += row.join(',') + '\n'
    })
    
    return csv
  }

  return (
    <div className="classic-timetable">
      <div className="timetable-header">
        <div className="header-left">
          <h2>Timetable</h2>
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="class-selector"
          >
            {Object.keys(timetableData.classes).map(className => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </div>
        
        <div className="timetable-actions">
          <button onClick={onRegenerate} className="regenerate-btn">
            Regenerate
          </button>
          <button onClick={exportTimetable} className="export-btn">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="print-btn">
            Print
          </button>
        </div>
      </div>

      <div className="timetable-info">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Class:</span>
            <span className="info-value">{selectedClass}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Working Days:</span>
            <span className="info-value">{days.join(', ')}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Total Periods:</span>
            <span className="info-value">{periods.length} per day</span>
          </div>
          <div className="info-item">
            <span className="info-label">Period Duration:</span>
            <span className="info-value">{timetableData.metadata.periodDuration} minutes</span>
          </div>
        </div>
      </div>

      <div className="timetable-container">
        <table className="classic-timetable-table">
          <thead>
            <tr>
              <th rowSpan="2" className="day-header">Day</th>
              <th colSpan={periods.length} className="periods-header">Periods</th>
            </tr>
            <tr>
              {periods.map((period, index) => (
                <th key={index} className="period-header">
                  <div className="period-number">Period {index + 1}</div>
                  <div className="period-time">
                    {formatTime(period.start)} - {formatTime(period.end)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day} className="day-row">
                <td className="day-cell">{day}</td>
                {periods.map((period, periodIndex) => {
                  const periodData = classData.schedule[day][periodIndex]
                  const isEditing = editing && 
                    editing.day === day && 
                    editing.period === periodIndex

                  return (
                    <td 
                      key={periodIndex} 
                      className={`timetable-cell ${!periodData.subject ? 'free-period' : ''} ${isEditing ? 'editing' : ''}`}
                      onClick={() => handleCellClick(day, periodIndex)}
                    >
                      {isEditing ? (
                        <select
                          value={periodData.subject || ''}
                          onChange={(e) => handleSubjectChange(day, periodIndex, e.target.value)}
                          onBlur={() => setEditing(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditing(null)
                            if (e.key === 'Enter') e.target.blur()
                          }}
                          autoFocus
                          className="cell-select"
                        >
                          <option value="">Free Period</option>
                          {getAvailableSubjects().map(subject => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="cell-content">
                          <div className="subject-name">{periodData.subject || 'Free'}</div>
                          <div className="teacher-name">{periodData.teacher || ''}</div>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="timetable-legend">
        <div className="legend-item">
          <div className="legend-color free-period"></div>
          <span>Free Period</span>
        </div>
        <div className="legend-item">
          <div className="legend-color subject-period"></div>
          <span>Subject Period</span>
        </div>
        <p className="edit-instruction">Click on any cell to edit the subject assignment</p>
      </div>
    </div>
  )
}

export default ClassicTimetable

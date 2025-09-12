import { useState, useEffect } from 'react'

const TimetableDisplay = ({ timetableData, onUpdate, onRegenerate }) => {
  const [editing, setEditing] = useState(null) // {class: classname, day: day, period: periodIndex}
  const [teacherConflicts, setTeacherConflicts] = useState({})

  useEffect(() => {
    if (timetableData) {
      const conflicts = checkTeacherConflicts(timetableData)
      setTeacherConflicts(conflicts)
    }
  }, [timetableData])

  const handleCellClick = (classname, day, periodIndex) => {
    setEditing({ class: classname, day, period: periodIndex })
  }

  const handleSubjectChange = (classname, day, periodIndex, subjectName) => {
    const updatedTimetable = JSON.parse(JSON.stringify(timetableData)) // Deep clone
    const selectedSubject = timetableData.metadata.subjects?.find(s => s.name === subjectName) || 
                           { name: subjectName, teacher: '' };
    
    updatedTimetable.classes[classname].schedule[day][periodIndex].subject = subjectName;
    updatedTimetable.classes[classname].schedule[day][periodIndex].teacher = selectedSubject.teacher;
    
    // Check for teacher conflicts
    const conflicts = checkTeacherConflicts(updatedTimetable);
    setTeacherConflicts(conflicts);
    
    onUpdate(updatedTimetable);
    setEditing(null);
  }

  const checkTeacherConflicts = (timetable) => {
    const conflicts = {};
    const teacherSchedule = {};
    
    // Initialize teacher schedule tracker
    Object.entries(timetable.classes).forEach(([className, classData]) => {
      Object.entries(classData.schedule).forEach(([day, periods]) => {
        periods.forEach((period, periodIndex) => {
          if (period.teacher && period.subject) {
            // Use period.startTime or construct it from metadata
            const periodTime = period.startTime || timetable.metadata.periods[periodIndex]?.start || '';
            const key = `${day}-${periodTime}`;
            
            if (!teacherSchedule[key]) {
              teacherSchedule[key] = [];
            }
            teacherSchedule[key].push({
              teacher: period.teacher,
              class: className,
              subject: period.subject
            });
          }
        });
      });
    });
    
    // Find conflicts
    Object.entries(teacherSchedule).forEach(([timeslot, assignments]) => {
      const teacherCount = {};
      assignments.forEach(assignment => {
        if (!teacherCount[assignment.teacher]) {
          teacherCount[assignment.teacher] = [];
        }
        teacherCount[assignment.teacher].push(assignment);
      });
      
      Object.entries(teacherCount).forEach(([teacher, assignments]) => {
        if (assignments.length > 1) {
          if (!conflicts[timeslot]) {
            conflicts[timeslot] = {};
          }
          conflicts[timeslot][teacher] = assignments;
        }
      });
    });
    
    return conflicts;
  }

  const getAvailableSubjects = (classname) => {
    return timetableData.classes[classname].subjects || [];
  }

  const hasConflicts = Object.keys(teacherConflicts).length > 0;

  const exportAllTimetables = () => {
    const zip = new JSZip();
    
    Object.keys(timetableData.classes).forEach(className => {
      const csvContent = generateCSVForClass(className)
      zip.file(`${className}_timetable.csv`, csvContent)
    })
    
    zip.generateAsync({type:"blob"}).then(function(content) {
      const url = window.URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = 'all_timetables.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    })
  }

  const generateCSVForClass = (className) => {
    const classData = timetableData.classes[className]
    let csv = 'Day,' + timetableData.metadata.periods.map((_, index) => `Period ${index + 1}`).join(',') + '\n'
    
    timetableData.metadata.days.forEach(day => {
      const row = [day]
      timetableData.metadata.periods.forEach((_, periodIndex) => {
        const periodData = classData.schedule[day][periodIndex]
        const cellContent = periodData.subject ? `${periodData.subject} (${periodData.teacher})` : 'Free'
        row.push(`"${cellContent}"`)
      })
      csv += row.join(',') + '\n'
    })
    
    return csv
  }

  if (!timetableData || !timetableData.classes) {
    return <div className="no-data">No timetable data available</div>
  }

  return (
    <div className="timetable-display">
      <div className="timetable-header">
        <h2>Generated Timetable - Modern View</h2>
        <div className="timetable-actions">
          <button onClick={onRegenerate} className="regenerate-btn">
            Regenerate
          </button>
          <button onClick={() => window.print()} className="print-btn">
            Print All
          </button>
        </div>
      </div>

      <div className="timetable-stats">
        <div className="stat-item">
          <span className="stat-number">{Object.keys(timetableData.classes).length}</span>
          <span className="stat-label">Classes</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{timetableData.metadata.subjects.length}</span>
          <span className="stat-label">Subjects</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{timetableData.metadata.periods.length}</span>
          <span className="stat-label">Periods/Day</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{hasConflicts ? Object.keys(teacherConflicts).length : 0}</span>
          <span className="stat-label">Conflicts</span>
        </div>
      </div>

      {hasConflicts && (
        <div className="conflict-warning">
          <h3>⚠️ Teacher Conflicts Detected</h3>
          <div className="conflicts-container">
            {Object.entries(teacherConflicts).map(([timeslot, teachers]) => (
              <div key={timeslot} className="conflict-group">
                <h4>Time Slot: {timeslot}</h4>
                {Object.entries(teachers).map(([teacher, assignments]) => (
                  <div key={teacher} className="teacher-conflict">
                    <p><strong>Teacher {teacher}</strong> is assigned to:</p>
                    <ul>
                      {assignments.map((assignment, idx) => (
                        <li key={idx}>
                          {assignment.class} - {assignment.subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="classes-container">
        {Object.keys(timetableData.classes).map(classname => (
          <div key={classname} className="class-timetable">
            <div className="class-header">
              <h3>{classname} Schedule</h3>
              <div className="class-info">
                <span>Subjects: {timetableData.classes[classname].subjects?.length || 0}</span>
              </div>
            </div>
            
            <div className="table-container">
              <table className="modern-timetable-table">
                <thead>
                  <tr>
                    <th className="time-header">Time</th>
                    {timetableData.metadata.days.map(day => (
                      <th key={day} className="day-header">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableData.metadata.periods.map((period, periodIndex) => (
                    <tr key={periodIndex} className="period-row">
                      <td className="time-cell">
                        <div className="time-info">
                          <span className="period-number">P{periodIndex + 1}</span>
                          <span className="period-time">{period.start} - {period.end}</span>
                        </div>
                      </td>
                      {timetableData.metadata.days.map(day => {
                        const classSchedule = timetableData.classes[classname].schedule[day]
                        const periodData = classSchedule[periodIndex]
                        const isEditing = editing && 
                          editing.class === classname && 
                          editing.day === day && 
                          editing.period === periodIndex

                        // Check if this slot has a conflict
                        const periodTime = period.start;
                        const timeslotKey = `${day}-${periodTime}`;
                        const hasConflict = teacherConflicts[timeslotKey] && 
                                          teacherConflicts[timeslotKey][periodData.teacher];

                        return (
                          <td 
                            key={day} 
                            className={`schedule-cell ${hasConflict ? 'conflict' : ''} ${!periodData.subject ? 'free-period' : ''} ${isEditing ? 'editing' : ''}`}
                            onClick={() => handleCellClick(classname, day, periodIndex)}
                          >
                            {isEditing ? (
                              <select
                                value={periodData.subject || ''}
                                onChange={(e) => handleSubjectChange(classname, day, periodIndex, e.target.value)}
                                onBlur={() => setEditing(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditing(null)
                                  if (e.key === 'Enter') e.target.blur()
                                }}
                                autoFocus
                                className="cell-select"
                              >
                                <option value="">Free Period</option>
                                {getAvailableSubjects(classname).map(subject => (
                                  <option key={subject} value={subject}>
                                    {subject}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="cell-content">
                                <div className="subject">{periodData.subject || 'Free'}</div>
                                <div className="teacher">{periodData.teacher || ''}</div>
                                {hasConflict && <span className="conflict-indicator">⚠️</span>}
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
          </div>
        ))}
      </div>

      <div className="timetable-footer">
        <p className="edit-instruction">💡 Click on any cell to edit the subject assignment</p>
        {hasConflicts && (
          <p className="conflict-note">⚠️ Please resolve teacher conflicts before finalizing the timetable</p>
        )}
      </div>
    </div>
  )
}

export default TimetableDisplay

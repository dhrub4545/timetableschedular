import { useState, useEffect } from 'react'

const AdminForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    classes: [{ name: '', subjects: [] }],
    subjects: [{ name: '', teacher: '', classesPerWeek: 1 }],
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:00',
    endTime: '14:00',
    periodDuration: 45
  })

  const [errors, setErrors] = useState({})

  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('timetableFormData')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setFormData(parsed)
      } catch (e) {
        console.warn('Failed to load saved form data:', e)
      }
    }
  }, [])

  // Save data to localStorage whenever formData changes
  useEffect(() => {
    localStorage.setItem('timetableFormData', JSON.stringify(formData))
  }, [formData])

  const handleInputChange = (section, index, field, value) => {
    const updatedData = { ...formData }
    updatedData[section][index][field] = value
    setFormData(updatedData)
    
    // Clear error for this field
    if (errors[`${section}.${index}.${field}`]) {
      const newErrors = { ...errors }
      delete newErrors[`${section}.${index}.${field}`]
      setErrors(newErrors)
    }
  }

  const handleArrayChange = (section, value) => {
    setFormData({ ...formData, [section]: value })
  }

  const addItem = (section) => {
    if (section === 'subjects') {
      setFormData({
        ...formData,
        subjects: [...formData.subjects, { name: '', teacher: '', classesPerWeek: 1 }]
      })
    } else if (section === 'classes') {
      setFormData({
        ...formData,
        classes: [...formData.classes, { name: '', subjects: [] }]
      })
    }
  }

  const removeItem = (section, index) => {
    const updatedArray = formData[section].filter((_, i) => i !== index)
    setFormData({ ...formData, [section]: updatedArray })
  }

  const handleSubjectSelection = (classIndex, subjectIndex, isSelected) => {
    const updatedClasses = [...formData.classes]
    const subject = formData.subjects[subjectIndex]
    
    if (!subject || !subject.name) {
      console.warn('Invalid subject at index:', subjectIndex)
      return
    }
    
    const subjectName = subject.name
    
    if (isSelected) {
      if (!updatedClasses[classIndex].subjects.includes(subjectName)) {
        updatedClasses[classIndex].subjects.push(subjectName)
      }
    } else {
      updatedClasses[classIndex].subjects = updatedClasses[classIndex].subjects.filter(
        s => s !== subjectName
      )
    }
    
    setFormData({ ...formData, classes: updatedClasses })
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.workingDays.length) {
      newErrors.workingDays = 'Please select at least one working day'
    }
    
    if (!formData.subjects.length) {
      newErrors.subjects = 'Please add at least one subject'
    }
    
    if (!formData.classes.length) {
      newErrors.classes = 'Please add at least one class'
    }

    // Validate subjects
    formData.subjects.forEach((subject, index) => {
      if (!subject.name.trim()) {
        newErrors[`subjects.${index}.name`] = 'Subject name is required'
      }
      if (!subject.teacher.trim()) {
        newErrors[`subjects.${index}.teacher`] = 'Teacher name is required'
      }
      if (subject.classesPerWeek < 1 || subject.classesPerWeek > 10) {
        newErrors[`subjects.${index}.classesPerWeek`] = 'Classes per week must be between 1 and 10'
      }
    })

    // Validate classes
    formData.classes.forEach((cls, index) => {
      if (!cls.name.trim()) {
        newErrors[`classes.${index}.name`] = 'Class name is required'
      }
      if (!cls.subjects.length) {
        newErrors[`classes.${index}.subjects`] = 'Please select at least one subject for this class'
      }
    })

    // Validate time settings
    const startTime = new Date(`2023-01-01T${formData.startTime}`)
    const endTime = new Date(`2023-01-01T${formData.endTime}`)
    
    if (startTime >= endTime) {
      newErrors.timeRange = 'End time must be after start time'
    }

    const totalMinutes = (endTime - startTime) / (1000 * 60)
    const minPeriodsNeeded = Math.max(...formData.subjects.map(s => s.classesPerWeek))
    
    if (totalMinutes < minPeriodsNeeded * formData.periodDuration) {
      newErrors.timeRange = 'Not enough time available for all required classes'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    onSubmit(formData)
  }

  const clearForm = () => {
    setFormData({
      classes: [{ name: '', subjects: [] }],
      subjects: [{ name: '', teacher: '', classesPerWeek: 1 }],
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '08:00',
      endTime: '14:00',
      periodDuration: 45
    })
    setErrors({})
    localStorage.removeItem('timetableFormData')
  }

  return (
    <div className="admin-form">
      <div className="form-header">
        <h2>Administrator Configuration</h2>
        <button type="button" onClick={clearForm} className="clear-btn">
          Clear All
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>General Settings</h3>
          
          <div className="form-group">
            <label>Working Days:</label>
            <div className="checkbox-group">
              {dayOptions.map(day => (
                <label key={day} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.workingDays.includes(day)}
                    onChange={(e) => {
                      const updatedDays = e.target.checked
                        ? [...formData.workingDays, day]
                        : formData.workingDays.filter(d => d !== day)
                      handleArrayChange('workingDays', updatedDays)
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>
            {errors.workingDays && <span className="error-text">{errors.workingDays}</span>}
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Start Time:</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>End Time:</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Period Duration (minutes):</label>
              <input
                type="number"
                min="5"
                max="120"
                value={formData.periodDuration}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 45
                  setFormData({ ...formData, periodDuration: value })
                }}
                required
              />
            </div>
          </div>
          {errors.timeRange && <span className="error-text">{errors.timeRange}</span>}
        </div>
        
        <div className="form-section">
          <h3>Subjects & Teachers</h3>
          <button type="button" onClick={() => addItem('subjects')} className="add-btn">
            Add Subject
          </button>
          {errors.subjects && <span className="error-text">{errors.subjects}</span>}
          
          {formData.subjects.map((subject, index) => (
            <div key={index} className="form-row subject-row">
              <div className="form-group">
                <label>Subject Name:</label>
                <input
                  type="text"
                  value={subject.name}
                  onChange={(e) => handleInputChange('subjects', index, 'name', e.target.value)}
                  required
                />
                {errors[`subjects.${index}.name`] && 
                  <span className="error-text">{errors[`subjects.${index}.name`]}</span>}
              </div>
              
              <div className="form-group">
                <label>Teacher:</label>
                <input
                  type="text"
                  value={subject.teacher}
                  onChange={(e) => handleInputChange('subjects', index, 'teacher', e.target.value)}
                  required
                />
                {errors[`subjects.${index}.teacher`] && 
                  <span className="error-text">{errors[`subjects.${index}.teacher`]}</span>}
              </div>
              
              <div className="form-group">
                <label>Classes per Week:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={subject.classesPerWeek}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1
                    handleInputChange('subjects', index, 'classesPerWeek', value)
                  }}
                  required
                />
                {errors[`subjects.${index}.classesPerWeek`] && 
                  <span className="error-text">{errors[`subjects.${index}.classesPerWeek`]}</span>}
              </div>
              
              <button 
                type="button" 
                onClick={() => removeItem('subjects', index)}
                className="remove-btn"
                disabled={formData.subjects.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        
        <div className="form-section">
          <h3>Classes & Sections</h3>
          <button type="button" onClick={() => addItem('classes')} className="add-btn">
            Add Class
          </button>
          {errors.classes && <span className="error-text">{errors.classes}</span>}
          
          {formData.classes.map((cls, classIndex) => (
            <div key={classIndex} className="class-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Class Name:</label>
                  <input
                    type="text"
                    value={cls.name}
                    onChange={(e) => handleInputChange('classes', classIndex, 'name', e.target.value)}
                    required
                  />
                  {errors[`classes.${classIndex}.name`] && 
                    <span className="error-text">{errors[`classes.${classIndex}.name`]}</span>}
                </div>
                
                <button 
                  type="button" 
                  onClick={() => removeItem('classes', classIndex)}
                  className="remove-btn"
                  disabled={formData.classes.length === 1}
                >
                  Remove Class
                </button>
              </div>
              
              <div className="form-group">
                <label>Select Subjects for this Class:</label>
                <div className="checkbox-group">
                  {formData.subjects.map((subject, subjectIndex) => (
                    <label key={subjectIndex} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={cls.subjects.includes(subject.name)}
                        onChange={(e) => handleSubjectSelection(classIndex, subjectIndex, e.target.checked)}
                      />
                      {subject.name} ({subject.teacher})
                    </label>
                  ))}
                </div>
                {errors[`classes.${classIndex}.subjects`] && 
                  <span className="error-text">{errors[`classes.${classIndex}.subjects`]}</span>}
              </div>
            </div>
          ))}
        </div>
        
        <button type="submit" disabled={isLoading} className="submit-btn">
          {isLoading ? 'Generating Timetable...' : 'Generate Timetable'}
        </button>
      </form>
    </div>
  )
}

export default AdminForm

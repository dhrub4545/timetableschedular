import { GoogleGenerativeAI } from '@google/generative-ai';

export const generateTimetableWithGemini = async (formData) => {
  try {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!API_KEY) {
      throw new Error('API key not configured');
    }
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
    
    const prompt = createEnhancedPrompt(formData);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const parsedResponse = extractJSON(text);
      
      if (!parsedResponse.classes || !parsedResponse.metadata) {
        throw new Error('Invalid timetable structure in AI response');
      }
      
      // Validate and fix teacher conflicts
      const validatedTimetable = validateAndFixTimetableStructure(parsedResponse, formData);
      const conflictFreeTimetable = resolveTeacherConflicts(validatedTimetable, formData);
      
      return conflictFreeTimetable;
      
    } catch (parseError) {
      console.error('Parsing failed:', parseError);
      throw new Error(`Could not parse response: ${parseError.message}`);
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
};

// Enhanced prompt with strict teacher conflict rules
const createEnhancedPrompt = (formData) => {
  const totalWorkingMinutes = calculateTotalWorkingMinutes(formData);
  const periodsPerDay = Math.floor(totalWorkingMinutes / formData.periodDuration);
  
  // Create teacher list for reference
  const teacherList = [...new Set(formData.subjects.map(s => s.teacher))];
  
  return `Create a school timetable with STRICT teacher conflict prevention.

WORKING DAYS: ${formData.workingDays.join(', ')}

TIME SETTINGS:
- Start time: ${formData.startTime}
- End time: ${formData.endTime}
- Period duration: ${formData.periodDuration} minutes
- Periods per day: ${periodsPerDay}

TEACHERS: ${teacherList.join(', ')}

SUBJECTS AND TEACHERS:
${formData.subjects.map(subject => `- ${subject.name} taught by ${subject.teacher} (${subject.classesPerWeek} classes per week)`).join('\n')}

CLASSES AND THEIR SUBJECTS:
${formData.classes.map(cls => `- ${cls.name}: ${cls.subjects.join(', ')}`).join('\n')}

🚨 CRITICAL TEACHER CONFLICT RULES:
1. ONE TEACHER = ONE CLASS AT A TIME (No exceptions!)
2. If Teacher A is teaching Class 1 at 9:00 AM Monday, Teacher A CANNOT teach any other class at 9:00 AM Monday
3. Before assigning any teacher to a time slot, CHECK if they are already assigned to another class at that exact time
4. Track teacher availability: Create a teacher schedule matrix
5. Distribute subjects evenly across the week
6. Prefer morning slots for core subjects (Math, Science, English)

VALIDATION CHECKLIST (Must follow):
- ✅ No teacher appears in multiple classes at the same time
- ✅ Each subject gets exactly the required classes per week
- ✅ All time slots are filled appropriately
- ✅ Free periods are distributed evenly

Generate a conflict-free timetable in this EXACT JSON format:

{
  "classes": {
${formData.classes.map(cls => `    "${cls.name}": {
      "name": "${cls.name}",
      "subjects": ${JSON.stringify(cls.subjects)},
      "schedule": {
${formData.workingDays.map(day => `        "${day}": [
${Array.from({length: periodsPerDay}, (_, i) => `          {
            "period": ${i + 1},
            "startTime": "time",
            "endTime": "time",
            "subject": "subject_name_or_null",
            "teacher": "teacher_name_or_null"
          }`).join(',\n')}
        ]`).join(',\n')}
      }
    }`).join(',\n')}
  },
  "metadata": {
    "days": ${JSON.stringify(formData.workingDays)},
    "periods": [${Array.from({length: periodsPerDay}, (_, i) => {
      const startMinutes = i * formData.periodDuration;
      const endMinutes = (i + 1) * formData.periodDuration;
      const startHour = Math.floor(startMinutes / 60) + parseInt(formData.startTime.split(':')[0]);
      const startMin = startMinutes % 60;
      const endHour = Math.floor(endMinutes / 60) + parseInt(formData.startTime.split(':')[0]);
      const endMin = endMinutes % 60;
      return `{"start": "${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}", "end": "${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}"}`;
    }).join(', ')}],
    "startTime": "${formData.startTime}",
    "endTime": "${formData.endTime}",
    "periodDuration": ${formData.periodDuration},
    "subjects": ${JSON.stringify(formData.subjects)}
  }
}

REMEMBER: NO TEACHER CONFLICTS ALLOWED! Double-check every assignment!

Only return valid JSON, no markdown or explanations.`;
};

// Teacher conflict resolution function
const resolveTeacherConflicts = (timetableData, formData) => {
  const teacherSchedule = {}; // Track what each teacher is doing at each time slot
  const conflicts = [];
  
  // Initialize teacher schedule tracker
  formData.workingDays.forEach(day => {
    timetableData.metadata.periods.forEach((period, periodIndex) => {
      const timeSlot = `${day}-${periodIndex}`;
      teacherSchedule[timeSlot] = {};
    });
  });
  
  // First pass: identify all teacher conflicts
  Object.entries(timetableData.classes).forEach(([className, classData]) => {
    Object.entries(classData.schedule).forEach(([day, periods]) => {
      periods.forEach((period, periodIndex) => {
        if (period.teacher && period.subject) {
          const timeSlot = `${day}-${periodIndex}`;
          
          if (teacherSchedule[timeSlot][period.teacher]) {
            // Conflict detected!
            conflicts.push({
              timeSlot,
              teacher: period.teacher,
              existingAssignment: teacherSchedule[timeSlot][period.teacher],
              newAssignment: { className, subject: period.subject }
            });
          } else {
            teacherSchedule[timeSlot][period.teacher] = { className, subject: period.subject };
          }
        }
      });
    });
  });
  
  // Second pass: resolve conflicts by reassigning
  conflicts.forEach(conflict => {
    console.warn(`Resolving teacher conflict for ${conflict.teacher} at ${conflict.timeSlot}`);
    
    // Remove the conflicting assignment (keep the first one)
    const conflictingClass = conflict.newAssignment.className;
    const [day, periodIndex] = conflict.timeSlot.split('-');
    
    // Clear the conflicting slot
    timetableData.classes[conflictingClass].schedule[day][parseInt(periodIndex)] = {
      ...timetableData.classes[conflictingClass].schedule[day][parseInt(periodIndex)],
      subject: null,
      teacher: null
    };
    
    // Try to find an alternative slot for this subject
    const subject = formData.subjects.find(s => s.name === conflict.newAssignment.subject);
    if (subject) {
      assignSubjectToAvailableSlot(
        timetableData, 
        conflictingClass, 
        subject, 
        teacherSchedule, 
        formData.workingDays
      );
    }
  });
  
  return timetableData;
};

// Smart slot assignment that avoids conflicts
const assignSubjectToAvailableSlot = (timetableData, className, subject, teacherSchedule, workingDays) => {
  const classSchedule = timetableData.classes[className].schedule;
  
  // Find all available slots for this teacher
  const availableSlots = [];
  
  workingDays.forEach(day => {
    if (classSchedule[day]) {
      classSchedule[day].forEach((period, periodIndex) => {
        const timeSlot = `${day}-${periodIndex}`;
        
        // Check if slot is free for both class and teacher
        if (!period.subject && !teacherSchedule[timeSlot][subject.teacher]) {
          availableSlots.push({ day, periodIndex, timeSlot });
        }
      });
    }
  });
  
  // Assign to the first available slot
  if (availableSlots.length > 0) {
    const bestSlot = availableSlots[0];
    
    timetableData.classes[className].schedule[bestSlot.day][bestSlot.periodIndex] = {
      ...timetableData.classes[className].schedule[bestSlot.day][bestSlot.periodIndex],
      subject: subject.name,
      teacher: subject.teacher
    };
    
    // Update teacher schedule tracker
    teacherSchedule[bestSlot.timeSlot][subject.teacher] = { className, subject: subject.name };
    
    console.log(`✅ Reassigned ${subject.name} (${subject.teacher}) to ${className} at ${bestSlot.timeSlot}`);
  } else {
    console.warn(`❌ Could not find available slot for ${subject.name} (${subject.teacher}) in ${className}`);
  }
};

// Enhanced fallback algorithm with teacher conflict prevention
export const generateTimetableFallback = (formData) => {
  const days = formData.workingDays;
  const periods = generateTimePeriods(formData);
  
  const timetable = {
    classes: {},
    metadata: {
      days,
      periods,
      startTime: formData.startTime,
      endTime: formData.endTime,
      periodDuration: formData.periodDuration,
      subjects: formData.subjects
    }
  };
  
  // Initialize empty schedules
  formData.classes.forEach(cls => {
    timetable.classes[cls.name] = {
      name: cls.name,
      subjects: cls.subjects,
      schedule: {}
    };
    
    days.forEach(day => {
      timetable.classes[cls.name].schedule[day] = periods.map((period, index) => ({
        period: index + 1,
        startTime: period.start,
        endTime: period.end,
        subject: null,
        teacher: null
      }));
    });
  });
  
  // Global teacher availability tracker
  const globalTeacherSchedule = {};
  days.forEach(day => {
    periods.forEach((period, periodIndex) => {
      const timeSlot = `${day}-${periodIndex}`;
      globalTeacherSchedule[timeSlot] = new Set(); // Set of busy teachers
    });
  });
  
  // Smart assignment with conflict prevention
  formData.classes.forEach(cls => {
    const subjectRequirements = cls.subjects.map(subjectName => {
      const subject = formData.subjects.find(s => s.name === subjectName);
      return {
        name: subject.name,
        teacher: subject.teacher,
        required: subject.classesPerWeek,
        assigned: 0
      };
    });
    
    // Sort by requirements (high-demand subjects first)
    subjectRequirements.sort((a, b) => b.required - a.required);
    
    // Assign each subject requirement
    subjectRequirements.forEach(subjectReq => {
      for (let i = 0; i < subjectReq.required; i++) {
        const availableSlot = findConflictFreeSlot(
          timetable.classes[cls.name].schedule,
          globalTeacherSchedule,
          subjectReq.teacher,
          days,
          periods
        );
        
        if (availableSlot) {
          const { day, periodIndex } = availableSlot;
          
          // Assign the subject
          timetable.classes[cls.name].schedule[day][periodIndex] = {
            ...timetable.classes[cls.name].schedule[day][periodIndex],
            subject: subjectReq.name,
            teacher: subjectReq.teacher
          };
          
          // Mark teacher as busy
          const timeSlot = `${day}-${periodIndex}`;
          globalTeacherSchedule[timeSlot].add(subjectReq.teacher);
          
          subjectReq.assigned++;
        } else {
          console.warn(`⚠️ Could not assign ${subjectReq.name} to ${cls.name} - no conflict-free slots available`);
        }
      }
    });
  });
  
  return timetable;
};

// Find slot that's free for both the class and the teacher
const findConflictFreeSlot = (classSchedule, globalTeacherSchedule, teacher, days, periods) => {
  const availableSlots = [];
  
  days.forEach(day => {
    periods.forEach((period, periodIndex) => {
      const timeSlot = `${day}-${periodIndex}`;
      const daySchedule = classSchedule[day];
      
      // Check if slot is free for class AND teacher is available
      if (daySchedule[periodIndex].subject === null && 
          !globalTeacherSchedule[timeSlot].has(teacher)) {
        
        // Preference scoring
        const hourScore = periodIndex < Math.floor(periods.length / 2) ? 2 : 1; // Morning preference
        const distributionScore = getDayDistributionScore(daySchedule, teacher);
        
        availableSlots.push({
          day,
          periodIndex,
          score: hourScore + distributionScore
        });
      }
    });
  });
  
  // Return highest scoring slot
  availableSlots.sort((a, b) => b.score - a.score);
  return availableSlots[0] || null;
};

const getDayDistributionScore = (daySchedule, teacher) => {
  const teacherPeriodsInDay = daySchedule.filter(slot => slot.teacher === teacher).length;
  return teacherPeriodsInDay === 0 ? 2 : (teacherPeriodsInDay === 1 ? 1 : 0);
};

const generateTimePeriods = (formData) => {
  const periods = [];
  const startTime = new Date(`2023-01-01T${formData.startTime}`);
  const endTime = new Date(`2023-01-01T${formData.endTime}`);
  const periodDuration = formData.periodDuration * 60000;
  
  let currentTime = startTime;
  while (currentTime < endTime) {
    const periodEnd = new Date(currentTime.getTime() + periodDuration);
    if (periodEnd > endTime) break;
    
    periods.push({
      start: currentTime.toTimeString().slice(0, 5),
      end: periodEnd.toTimeString().slice(0, 5)
    });
    
    currentTime = periodEnd;
  }
  
  return periods;
};

// Helper functions remain the same...
const extractJSON = (text) => {
  const jsonBlockMatch = text.match(/``````/);
  if (jsonBlockMatch) {
    return JSON.parse(jsonBlockMatch[1]);
  }
  
  const jsonMatch = text.match(/{[\s\S]*}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return JSON.parse(text.trim());
};

const validateAndFixTimetableStructure = (timetableData, formData) => {
  Object.keys(timetableData.classes).forEach(className => {
    const classData = timetableData.classes[className];
    
    formData.workingDays.forEach(day => {
      if (!classData.schedule[day]) {
        classData.schedule[day] = [];
      }
      
      while (classData.schedule[day].length < timetableData.metadata.periods.length) {
        const periodIndex = classData.schedule[day].length;
        classData.schedule[day].push({
          period: periodIndex + 1,
          startTime: timetableData.metadata.periods[periodIndex]?.start || '',
          endTime: timetableData.metadata.periods[periodIndex]?.end || '',
          subject: null,
          teacher: null
        });
      }
    });
  });
  
  return timetableData;
};

const calculateTotalWorkingMinutes = (formData) => {
  const startTime = new Date(`2023-01-01T${formData.startTime}`);
  const endTime = new Date(`2023-01-01T${formData.endTime}`);
  return (endTime - startTime) / (1000 * 60);
};

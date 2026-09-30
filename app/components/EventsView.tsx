"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { Calendar, Plus, Trash2, Edit, Search, CheckCircle, Clock, Users, User, X, Eye } from "lucide-react";

interface AppEvent {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  assignedFacultyIds: string[];
  assignedStudents: string[];
  timeSlots?: { startTime: string; endTime: string }[];
  durationType?: 'hour' | 'hours' | 'full_day' | 'multiple_days';
  selectedPeriods?: number[];
  eventType?: 'event' | 'token';
  createdAt?: any;
}

interface EventsViewProps {
  faculties: any[];
  students: any[];
  showPopup: (type: "success" | "error" | "warning", title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function EventsView({ faculties, students, showPopup, showConfirm }: EventsViewProps) {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignedFacultyIds, setAssignedFacultyIds] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<string[]>([]);
  const [durationType, setDurationType] = useState<'hour' | 'hours' | 'full_day' | 'multiple_days'>('hour');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [eventType, setEventType] = useState<'event' | 'token'>('event');
  
  // Student Selection state
  const [studentSearch, setStudentSearch] = useState("");
  
  // Faculty Selection state
  const [facultySearch, setFacultySearch] = useState("");

  // Attendance Detail Modal state
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState<AppEvent | null>(null);
  const [attendanceData, setAttendanceData] = useState<{
    studentId: string;
    name: string;
    department: string;
    dates: { date: string; checkpoints: Record<string, string> }[];
  }[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const eventsRef = collection(db, "colleges", "events", "all_events");
      const snap = await getDocs(eventsRef);
      const fetched: AppEvent[] = [];
      snap.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as AppEvent);
      });
      // Sort by startDate descending
      fetched.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setEvents(fetched);
    } catch (err: any) {
      console.error(err);
      showPopup("error", "Error fetching events", err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setAssignedFacultyIds([]);
    setTimeSlots([]);
    setAssignedStudents([]);
    setDurationType('hour');
    setSelectedPeriods([1]);
    setEventType('event');
    setIsModalOpen(true);
  };

  const openEditModal = (evt: AppEvent) => {
    setEditingEvent(evt);
    setName(evt.name);
    setDescription(evt.description || "");
    setStartDate(evt.startDate);
    setEndDate(evt.endDate);
    setAssignedFacultyIds(evt.assignedFacultyIds || []);
    setTimeSlots(evt.timeSlots || []);
    setAssignedStudents(evt.assignedStudents || []);
    setDurationType(evt.durationType || 'hour');
    setSelectedPeriods(evt.selectedPeriods || (evt.timeSlots && evt.timeSlots.length > 0 ? [1] : []));
    setEventType(evt.eventType || 'event');
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate || assignedFacultyIds.length === 0) {
      showPopup("warning", "Missing Fields", "Please fill in all required fields.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      showPopup("warning", "Invalid Dates", "End Date cannot be before Start Date.");
      return;
    }

    try {
      const eventId = editingEvent ? editingEvent.id : `evt_${Date.now()}`;
      const docRef = doc(db, "colleges", "events", "all_events", eventId);
      
      const payload: AppEvent = {
        id: eventId,
        name,
        description,
        startDate,
        endDate,
        assignedFacultyIds,
        assignedStudents,
        timeSlots,
        durationType,
        selectedPeriods,
        eventType,
        createdAt: editingEvent ? editingEvent.createdAt : Timestamp.now()
      };

      await setDoc(docRef, payload);
      showPopup("success", "Success", `Event ${editingEvent ? "updated" : "created"} successfully!`);
      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      console.error(err);
      showPopup("error", "Error", "Failed to save event: " + err.message);
    }
  };

  const handleDeleteEvent = (id: string) => {
    showConfirm("Delete Event", "Are you sure you want to delete this event? This action cannot be undone.", async () => {
      try {
        await deleteDoc(doc(db, "colleges", "events", "all_events", id));
        showPopup("success", "Deleted", "Event deleted successfully.");
        fetchEvents();
      } catch (err: any) {
        console.error(err);
        showPopup("error", "Error", "Failed to delete event: " + err.message);
      }
    });
  };

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { startTime: "", endTime: "" }]);
  };

  const updateTimeSlot = (index: number, field: "startTime" | "endTime", value: string) => {
    const updated = [...timeSlots];
    updated[index][field] = value;
    setTimeSlots(updated);
  };

  const removeTimeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const toggleStudent = (studentId: string) => {
    if (assignedStudents.includes(studentId)) {
      setAssignedStudents(assignedStudents.filter(id => id !== studentId));
    } else {
      setAssignedStudents([...assignedStudents, studentId]);
    }
  };

  // Fetch attendance data for a specific event
  const openAttendanceModal = async (evt: AppEvent) => {
    setAttendanceEvent(evt);
    setAttendanceModalOpen(true);
    setAttendanceLoading(true);
    setAttendanceSearch("");
    try {
      // Generate all dates in the event range (dd-MM-yyyy format used by the mobile app)
      const eventDates: string[] = [];
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        eventDates.push(`${dd}-${mm}-${yyyy}`);
      }

      const studentIds = evt.assignedStudents || [];
      const periods = evt.selectedPeriods || [];

      // Fetch student names and attendance in parallel
      const results = await Promise.all(
        studentIds.map(async (sId) => {
          // Get student name
          const stuDoc = await getDoc(doc(db, "colleges", "students", "all_students", sId));
          const stuData = stuDoc.exists() ? stuDoc.data() : null;
          const name = stuData?.name || sId;
          const department = stuData?.department || "";
          const semester = stuData?.semester || "V";

          // Get attendance doc for the student's semester
          const attDoc = await getDoc(doc(db, "colleges", "students", "all_students", sId, "attendance", semester));
          const attData = attDoc.exists() ? attDoc.data() : {};

          const dates = eventDates.map(dateKey => {
            const dayData = (attData as Record<string, any>)[dateKey] || {};
            const checkpoints: Record<string, string> = {};
            for (const p of periods) {
              const cpKey = `${p}_checkpoint`;
              checkpoints[`P${p}`] = dayData[cpKey] === 'P' ? 'P' : 'A';
            }
            return { date: dateKey, checkpoints };
          });

          return { studentId: sId, name, department, dates };
        })
      );

      results.sort((a, b) => a.name.localeCompare(b.name));
      setAttendanceData(results);
    } catch (err: any) {
      console.error("Error fetching attendance:", err);
      showPopup("error", "Error", "Failed to load attendance: " + err.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const filteredEvents = events.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.toLowerCase().includes(studentSearch.toLowerCase()));
  const filteredAttendance = attendanceData.filter(s =>
    s.name.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    s.studentId.toLowerCase().includes(attendanceSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events or tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs font-normal outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Event / Token</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs font-medium bg-white border border-slate-200/80 rounded-xl">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800 mx-auto mb-2" />
          Loading scheduled events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs font-medium bg-white border border-slate-200/80 rounded-xl">
          No events found. Click "New Event / Token" above to schedule an academic session or attendance token.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEvents.map(evt => {
            const facultyNames = (evt.assignedFacultyIds || [])
              .map(id => faculties.find(f => f.id === id)?.name || id)
              .join(", ");
            return (
              <div key={evt.id} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between group cursor-pointer" onClick={() => openAttendanceModal(evt)}>
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-slate-900 leading-snug">{evt.name}</h3>
                    <div className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(evt); }} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer" title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt.id); }} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {evt.description && (
                    <p className="text-xs text-slate-500 mb-3.5 line-clamp-2 leading-relaxed">{evt.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-700">
                        {evt.startDate} 
                        {evt.startDate !== evt.endDate && (
                          <><span className="text-slate-400 mx-1">→</span>{evt.endDate}</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{evt.assignedFacultyIds?.length || 0} Faculty Assigned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{evt.assignedStudents?.length || 0} Students Eligible</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-100">
                  {evt.durationType && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded uppercase tracking-wider">
                      {evt.durationType.replace('_', ' ')}
                    </span>
                  )}
                  {evt.eventType && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded uppercase tracking-wider">
                      {evt.eventType}
                    </span>
                  )}
                  {evt.selectedPeriods && evt.selectedPeriods.length > 0 ? (
                    evt.selectedPeriods.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200/60 text-[10px] font-mono rounded">
                        <Clock className="h-2.5 w-2.5" />
                        P{p}
                      </span>
                    ))
                  ) : (
                    evt.timeSlots?.map((ts, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono rounded">
                        <Clock className="h-2.5 w-2.5" />
                        {ts.startTime} - {ts.endTime}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-10 animate-in fade-in duration-200 overflow-y-auto">
          <div className="my-auto bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-extrabold text-slate-800">{editingEvent ? "Edit Event" : "Create New Event"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-5 custom-scrollbar">
              <form id="event-form" onSubmit={handleSaveEvent} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 border-b border-slate-100 pb-1">General Info</h3>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Event Name *</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500" placeholder="e.g. Incubation Training" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Event Type *</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEventType('event')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            eventType === 'event'
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Event
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventType('token')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            eventType === 'token'
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Token
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500" placeholder="Optional description..." />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Duration Type *</label>
                        <select 
                          value={durationType} 
                          onChange={e => {
                            const newType = e.target.value as any;
                            setDurationType(newType);
                            if (newType === 'hour') setSelectedPeriods([1]);
                            if (newType === 'hours') setSelectedPeriods([1, 2]);
                            if (newType === 'full_day' || newType === 'multiple_days') setSelectedPeriods([1, 7]);
                            if (newType !== 'multiple_days') setEndDate(startDate);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="hour">Single Hour</option>
                          <option value="hours">Multiple Hours</option>
                          <option value="full_day">Full Day</option>
                          <option value="multiple_days">Multiple Days</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                          {durationType === 'multiple_days' ? 'Start Date *' : 'Date *'}
                        </label>
                        <input type="date" value={startDate} onChange={e => {
                          setStartDate(e.target.value);
                          if (durationType !== 'multiple_days') setEndDate(e.target.value);
                        }} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500" />
                      </div>
                    </div>
                    
                    {durationType === 'multiple_days' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">End Date *</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500" />
                      </div>
                    )}
                    


                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-1">
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                          {durationType === 'hour' ? 'Select Period' : durationType === 'hours' ? 'Select Continuous Periods' : 'Attendance Periods'}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map(period => {
                          const isSelected = selectedPeriods.includes(period);
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => {
                                if (durationType === 'hour') {
                                  setSelectedPeriods([period]);
                                } else {
                                  if (isSelected) {
                                    setSelectedPeriods(selectedPeriods.filter(p => p !== period).sort((a, b) => a - b));
                                  } else {
                                    setSelectedPeriods([...selectedPeriods, period].sort((a, b) => a - b));
                                  }
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-orange-600 text-white shadow-sm' 
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              P{period}
                            </button>
                          );
                        })}
                      </div>
                      {durationType === 'hours' && (
                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Select all periods that apply for this continuous event.</p>
                      )}
                      {(durationType === 'full_day' || durationType === 'multiple_days') && (
                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Select periods where attendance must be marked (e.g. P1 and P7).</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Faculty & Student Selection */}
                  <div className="flex flex-col space-y-6 border-l md:border-slate-100 md:pl-6">
                    
                    {/* Faculty Assignment */}
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Assign Faculty ({assignedFacultyIds.length})</h3>
                      </div>
                      
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search faculty..."
                          value={facultySearch}
                          onChange={e => setFacultySearch(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-medium outline-none focus:border-orange-500"
                        />
                      </div>
                      
                      <div className="h-[140px] border border-slate-200 rounded-xl overflow-y-auto bg-slate-50/50 p-2 custom-scrollbar space-y-1">
                        {faculties.filter(f => f.name.toLowerCase().includes(facultySearch.toLowerCase()) || (f.department && f.department.toLowerCase().includes(facultySearch.toLowerCase()))).map(f => {
                          const isSelected = assignedFacultyIds.includes(f.id);
                          return (
                            <div
                              key={f.id}
                              onClick={() => {
                                setAssignedFacultyIds(prev =>
                                  prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${
                                isSelected ? "bg-orange-50 border-orange-200" : "bg-white border-transparent hover:border-slate-200"
                              }`}
                            >
                              <span className={`text-xs font-bold ${isSelected ? "text-orange-700" : "text-slate-700"}`}>{f.name} <span className="font-normal text-[10px] text-slate-500">({f.department})</span></span>
                              <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "bg-orange-600 border-orange-600" : "border-slate-300"}`}>
                                {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Student Assignment */}
                    <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                      <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Assign Students ({assignedStudents.length})</h3>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAssignedStudents(students.map(s => s.id))} className="text-[10px] font-bold text-orange-600 hover:text-orange-600 cursor-pointer">Select All</button>
                        <span className="text-slate-300">|</span>
                        <button type="button" onClick={() => setAssignedStudents([])} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">Clear</button>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search students to assign..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-medium outline-none focus:border-orange-500"
                      />
                    </div>
                    
                    <div className="h-[280px] md:h-[140px] border border-slate-200 rounded-xl overflow-y-auto bg-slate-50/50 p-2 custom-scrollbar space-y-1">
                      {filteredStudents.map(student => {
                        const isSelected = assignedStudents.includes(student.id);
                        return (
                          <div
                            key={student.id}
                            onClick={() => toggleStudent(student.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${
                              isSelected ? "bg-orange-50 border-orange-200" : "bg-white border-transparent hover:border-slate-200"
                            }`}
                          >
                            <div>
                              <p className={`text-xs font-bold ${isSelected ? "text-orange-700" : "text-slate-700"}`}>{student.name}</p>
                              <p className="text-[10px] font-mono text-slate-500">{student.id} • {student.department}</p>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "bg-orange-600 border-orange-600" : "border-slate-300"}`}>
                              {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        );
                      })}
                      {filteredStudents.length === 0 && (
                        <p className="text-xs text-center text-slate-400 font-medium py-4">No students match your search.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              </form>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                Cancel
              </button>
              <button form="event-form" type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer">
                Save Event
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Attendance Detail Modal */}
      {attendanceModalOpen && attendanceEvent && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-10 animate-in fade-in duration-200 overflow-y-auto">
          <div className="my-auto bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-5xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-orange-600" />
                  {attendanceEvent.name} — Attendance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {attendanceEvent.startDate}
                  {attendanceEvent.startDate !== attendanceEvent.endDate && ` → ${attendanceEvent.endDate}`}
                  {" · "}{attendanceEvent.assignedStudents?.length || 0} students
                  {attendanceEvent.selectedPeriods && ` · Periods: ${attendanceEvent.selectedPeriods.map(p => `P${p}`).join(', ')}`}
                </p>
              </div>
              <button onClick={() => setAttendanceModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-5 pt-4 pb-2 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs font-normal outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 pt-2 custom-scrollbar">
              {attendanceLoading ? (
                <div className="text-center py-16 text-slate-400 text-xs font-medium">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800 mx-auto mb-2" />
                  Loading attendance data...
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-medium">
                  No attendance records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Summary bar */}
                  {(() => {
                    let totalChecks = 0;
                    let presentChecks = 0;
                    for (const s of attendanceData) {
                      for (const d of s.dates) {
                        for (const v of Object.values(d.checkpoints)) {
                          totalChecks++;
                          if (v === 'P') presentChecks++;
                        }
                      }
                    }
                    const pct = totalChecks > 0 ? Math.round((presentChecks / totalChecks) * 100) : 0;
                    return (
                      <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-slate-700">Present: {presentChecks}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          <span className="text-xs font-bold text-slate-700">Absent: {totalChecks - presentChecks}</span>
                        </div>
                        <div className="ml-auto text-xs font-bold text-slate-600">
                          {pct}% Overall Attendance
                        </div>
                      </div>
                    );
                  })()}

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] sticky left-0 bg-white">#</th>
                        <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] sticky left-8 bg-white min-w-[180px]">Student</th>
                        <th className="text-left py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Dept</th>
                        {attendanceData[0]?.dates.map((d, di) => (
                          <th key={di} className="text-center py-2.5 px-2 font-bold text-slate-500 uppercase tracking-wider text-[10px]" colSpan={Object.keys(d.checkpoints).length}>
                            {d.date}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100">
                        <th className="sticky left-0 bg-white"></th>
                        <th className="sticky left-8 bg-white"></th>
                        <th></th>
                        {attendanceData[0]?.dates.map((d, di) =>
                          Object.keys(d.checkpoints).map((cp, ci) => (
                            <th key={`${di}-${ci}`} className="text-center py-1.5 px-1 text-[10px] font-mono text-slate-400">
                              {cp}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((s, idx) => (
                        <tr key={s.studentId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-mono sticky left-0 bg-white">{idx + 1}</td>
                          <td className="py-2 px-3 sticky left-8 bg-white">
                            <p className="font-bold text-slate-800 text-xs">{s.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{s.studentId}</p>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-medium">{s.department}</td>
                          {s.dates.map((d, di) =>
                            Object.values(d.checkpoints).map((val, ci) => (
                              <td key={`${di}-${ci}`} className="text-center py-2 px-1">
                                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-extrabold ${
                                  val === 'P'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-400 border border-rose-100'
                                }`}>
                                  {val}
                                </span>
                              </td>
                            ))
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button onClick={() => setAttendanceModalOpen(false)} className="px-5 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

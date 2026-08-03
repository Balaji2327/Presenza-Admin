"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { Calendar, Plus, Trash2, Edit, Search, CheckCircle, Clock, Users, User, X } from "lucide-react";

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
  
  // Student Selection state
  const [studentSearch, setStudentSearch] = useState("");
  
  // Faculty Selection state
  const [facultySearch, setFacultySearch] = useState("");

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

  const filteredEvents = events.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.toLowerCase().includes(studentSearch.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </button>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-400 font-bold">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center p-12 text-slate-400 font-bold bg-white border border-slate-200 rounded-2xl">No events found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEvents.map(evt => {
            const facultyNames = (evt.assignedFacultyIds || [])
              .map(id => faculties.find(f => f.id === id)?.name || id)
              .join(", ");
            return (
              <div key={evt.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-extrabold text-lg text-slate-800 leading-tight">{evt.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(evt)} className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg cursor-pointer">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteEvent(evt.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {evt.description && (
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">{evt.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {evt.startDate} 
                      {evt.startDate !== evt.endDate && (
                        <><span className="text-slate-400 font-normal mx-0.5">to</span> {evt.endDate}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Faculty: <span className="font-bold text-slate-700">{evt.assignedFacultyIds?.length || 0} Assigned</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>Students Assigned: <span className="font-bold text-slate-700">{evt.assignedStudents.length}</span></span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-slate-100">
                  {evt.durationType && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      {evt.durationType.replace('_', ' ')}
                    </span>
                  )}
                  {evt.selectedPeriods && evt.selectedPeriods.length > 0 ? (
                    evt.selectedPeriods.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold rounded-md">
                        <Clock className="h-3 w-3" />
                        P{p}
                      </span>
                    ))
                  ) : (
                    evt.timeSlots?.map((ts, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                        <Clock className="h-3 w-3" />
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
                                  ? 'bg-orange-500 text-white shadow-sm' 
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
                              <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "bg-orange-500 border-orange-500" : "border-slate-300"}`}>
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
                        <button type="button" onClick={() => setAssignedStudents(students.map(s => s.id))} className="text-[10px] font-bold text-orange-500 hover:text-orange-600 cursor-pointer">Select All</button>
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
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "bg-orange-500 border-orange-500" : "border-slate-300"}`}>
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
              <button form="event-form" type="submit" className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer">
                Save Event
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

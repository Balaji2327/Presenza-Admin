"use client";

import React, { useState } from "react";
import { Calendar, Info } from "lucide-react";

interface CourseMapping {
  abbreviation: string;
  name: string;
  facultyId: string;
  facultyName: string;
  isElective?: boolean;
  name2?: string;
  facultyId2?: string;
  facultyName2?: string;
}

interface TimetableEditorViewProps {
  selectedClass: string;
  selectedSemester: string;
  handleClearTimetable: () => void;
  handleSaveTimetable: () => Promise<void>;
  uploadingTimetable: boolean;
  timetableGrid: Record<string, string[]>;
  handleCellChange: (day: string, idx: number, value: string) => void;
  courseMappings: CourseMapping[];
  setCourseMappings: React.Dispatch<React.SetStateAction<CourseMapping[]>>;
  faculties: any[];
}

export default function TimetableEditorView({
  selectedClass,
  selectedSemester,
  handleClearTimetable,
  handleSaveTimetable,
  uploadingTimetable,
  timetableGrid,
  handleCellChange,
  courseMappings,
  setCourseMappings,
  faculties,
}: TimetableEditorViewProps) {
  const [activeMobileDay, setActiveMobileDay] = useState<string>("Monday");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftMapping, setDraftMapping] = useState<CourseMapping | null>(null);

  const handleOpenPopup = (index?: number) => {
    if (index !== undefined) {
      setEditingIndex(index);
      setDraftMapping({ ...courseMappings[index] });
    } else {
      setEditingIndex(null);
      setDraftMapping({ abbreviation: "", name: "", facultyId: "", facultyName: "", isElective: false, name2: "", facultyId2: "", facultyName2: "" });
    }
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setDraftMapping(null);
    setEditingIndex(null);
  };

  const handleSavePopup = () => {
    if (!draftMapping) return;
    if (editingIndex !== null) {
      setCourseMappings(prev => {
        const updated = [...prev];
        updated[editingIndex] = draftMapping;
        return updated;
      });
    } else {
      setCourseMappings(prev => [...prev, draftMapping]);
    }
    handleClosePopup();
  };

  return (
    <div className="bg-white border border-slate-200/80 p-4 lg:p-6 rounded-xl shadow-2xs space-y-4 lg:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-700" />
            Timetable Grid Editor
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure periods 1 through 7 (Monday–Friday) for {selectedClass || "selected class"} (SEM {selectedSemester})
          </p>
        </div>
        {selectedClass && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearTimetable}
              disabled={uploadingTimetable}
              className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              Clear Grid
            </button>
            <button
              onClick={handleSaveTimetable}
              disabled={uploadingTimetable}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            >
              {uploadingTimetable ? "Saving..." : "Save Timetable"}
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="p-12 text-center text-slate-400 text-xs font-medium">
          <Info className="h-6 w-6 mx-auto mb-2 text-slate-350" />
          Select a department and class from the sidebar to inspect or edit the timetable.
        </div>
      ) : (
        <>
          {/* Mobile Day Selector & Period Inputs */}
          <div className="block sm:hidden space-y-4">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 items-center justify-between gap-0.5">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                const isSelected = activeMobileDay === day;
                const shortName = day.substring(0, 3);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveMobileDay(day)}
                    className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all text-center cursor-pointer ${
                      isSelected
                        ? "bg-white text-slate-900 shadow-2xs font-semibold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50/50 border border-slate-200/80 rounded-lg p-3 space-y-2">
              {Array(7).fill(0).map((_, idx) => {
                const timings = [
                  "9:00 - 9:50",
                  "9:50 - 10:40",
                  "10:55 - 11:45",
                  "11:45 - 12:35",
                  "1:25 - 2:15",
                  "2:15 - 3:05",
                  "3:20 - 4:10"
                ];
                const row = timetableGrid[activeMobileDay] || Array(7).fill("");
                return (
                  <div key={idx} className="flex items-center gap-2.5 bg-white p-2.5 border border-slate-200/80 rounded-lg shadow-2xs">
                    <div className="w-24 shrink-0">
                      <span className="block text-[11px] font-medium text-slate-900">Period {idx + 1}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">{timings[idx]}</span>
                    </div>
                    <select
                      value={row[idx] || ""}
                      onChange={(e) => handleCellChange(activeMobileDay, idx, e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-slate-800"
                    >
                      <option value="">-- Free Period --</option>
                      {courseMappings.map((map) => (
                        <option key={map.abbreviation} value={map.abbreviation}>
                          {map.abbreviation}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto border border-slate-200/80 rounded-xl bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 text-[11px] font-medium uppercase tracking-wider select-none">
                  <th className="p-3 w-28 border-r border-slate-200/80">Day</th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 1<br/><span className="text-[10px] text-slate-400 normal-case font-mono">9:00 - 9:50</span></th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 2<br/><span className="text-[10px] text-slate-400 normal-case font-mono">9:50 - 10:40</span></th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 3<br/><span className="text-[10px] text-slate-400 normal-case font-mono">10:55 - 11:45</span></th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 4<br/><span className="text-[10px] text-slate-400 normal-case font-mono">11:45 - 12:35</span></th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 5<br/><span className="text-[10px] text-slate-400 normal-case font-mono">1:25 - 2:15</span></th>
                  <th className="p-3 text-center border-r border-slate-200/80">Period 6<br/><span className="text-[10px] text-slate-400 normal-case font-mono">2:15 - 3:05</span></th>
                  <th className="p-3 text-center">Period 7<br/><span className="text-[10px] text-slate-400 normal-case font-mono">3:20 - 4:10</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                  const row = timetableGrid[day] || Array(7).fill("");
                  return (
                    <tr key={day} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800 bg-slate-50/30 border-r border-slate-200/80">
                        {day}
                      </td>
                      {Array(7).fill(0).map((_, idx) => (
                        <td key={idx} className="p-1.5 border-r border-slate-200/80">
                          <select
                            value={row[idx] || ""}
                            onChange={(e) => handleCellChange(day, idx, e.target.value)}
                            className="w-full text-center bg-white border border-slate-200/60 rounded focus:border-slate-800 outline-none text-xs font-medium text-slate-800 py-1 transition-colors"
                          >
                            <option value="">·</option>
                            {courseMappings.map((map) => (
                              <option key={map.abbreviation} value={map.abbreviation}>
                                {map.abbreviation}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Course Details & Faculty Mapping Editor */}
          <div className="border border-slate-200/80 rounded-xl bg-slate-50/30 p-4 lg:p-5 space-y-3.5 mt-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h4 className="font-semibold text-xs text-slate-900">Course & Faculty Subject Mapping</h4>
                <p className="text-[11px] text-slate-500">Map timetable subject acronyms to official curriculum course titles and faculty handlers.</p>
              </div>
              <button
                onClick={() => handleOpenPopup()}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                + Map Course
              </button>
            </div>

            {courseMappings.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No course mappings configured. Click "+ Map Course" to link abbreviations.</p>
            ) : (
              <div className="space-y-2">
                {courseMappings.map((map, index) => (
                  <div key={index} className="flex flex-row items-center justify-between bg-white p-3 border border-slate-200/80 rounded-lg shadow-2xs">
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-slate-900">
                        <span className="font-mono font-semibold text-slate-950 mr-1.5">{map.abbreviation}</span>
                        {map.name} <span className="text-slate-400 font-normal">({map.facultyName || "Unassigned"})</span>
                      </span>
                      {map.isElective && (
                        <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                          Alternative Option: {map.name2} <span className="text-slate-400">({map.facultyName2 || "Unassigned"})</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenPopup(index)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition-colors text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setCourseMappings(prev => prev.filter((_, i) => i !== index))}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded transition-colors text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Course Mapping Popup */}
      {isPopupOpen && draftMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingIndex !== null ? "Edit" : "Add"} Course Mapping</h3>
              <button onClick={handleClosePopup} className="text-slate-400 hover:text-slate-600 font-bold p-1">&times;</button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!draftMapping.isElective}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDraftMapping(prev => {
                      if (!prev) return prev;
                      const updated = { ...prev, isElective: checked };
                      if (!checked) {
                        updated.name2 = "";
                        updated.facultyId2 = "";
                        updated.facultyName2 = "";
                      }
                      return updated;
                    });
                  }}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                Mark as Elective (2 Subjects/Staff)
              </label>

              {/* Primary Subject */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {draftMapping.isElective ? "Elective Block Abbrev *" : "Abbreviation *"}
                  </label>
                  <input
                    type="text"
                    value={draftMapping.abbreviation}
                    placeholder={draftMapping.isElective ? "e.g. ELECTIVE-1" : "e.g. CNS"}
                    onChange={(e) => setDraftMapping({ ...draftMapping, abbreviation: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {draftMapping.isElective ? "Subject 1 Name *" : "Course Name *"}
                  </label>
                  <input
                    type="text"
                    value={draftMapping.name}
                    placeholder="e.g. Cryptography"
                    onChange={(e) => setDraftMapping({ ...draftMapping, name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {draftMapping.isElective ? "Subject 1 Faculty *" : "Handling Faculty Staff *"}
                  </label>
                  <select
                    value={draftMapping.facultyId}
                    onChange={(e) => {
                      const fId = e.target.value;
                      const fName = faculties.find(f => f.id === fId)?.name || "";
                      setDraftMapping({ ...draftMapping, facultyId: fId, facultyName: fName });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                  >
                    <option value="">-- Select Faculty --</option>
                    {faculties.map((fac) => (
                      <option key={fac.id} value={fac.id}>{fac.name} ({fac.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Secondary Subject */}
              {draftMapping.isElective && (
                <div className="bg-orange-50/30 p-3 rounded-lg border border-orange-100 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">Subject 2 Name *</label>
                    <input
                      type="text"
                      value={draftMapping.name2 || ""}
                      placeholder="e.g. Artificial Intelligence"
                      onChange={(e) => setDraftMapping({ ...draftMapping, name2: e.target.value })}
                      className="w-full bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">Subject 2 Faculty *</label>
                    <select
                      value={draftMapping.facultyId2 || ""}
                      onChange={(e) => {
                        const fId = e.target.value;
                        const fName = faculties.find(f => f.id === fId)?.name || "";
                        setDraftMapping({ ...draftMapping, facultyId2: fId, facultyName2: fName });
                      }}
                      className="w-full bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                    >
                      <option value="">-- Select Subject 2 Faculty --</option>
                      {faculties.map((fac) => (
                        <option key={fac.id} value={fac.id}>{fac.name} ({fac.email})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={handleClosePopup} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-all">Cancel</button>
              <button 
                onClick={handleSavePopup} 
                disabled={!draftMapping.abbreviation || !draftMapping.name || !draftMapping.facultyId || (draftMapping.isElective && (!draftMapping.name2 || !draftMapping.facultyId2))}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

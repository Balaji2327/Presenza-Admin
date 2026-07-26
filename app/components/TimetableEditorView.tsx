"use client";

import React from "react";
import { Calendar, Info } from "lucide-react";

interface CourseMapping {
  abbreviation: string;
  name: string;
  facultyId: string;
  facultyName: string;
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
  return (
    <div className="bg-white border border-slate-200 p-4 lg:p-6 rounded-2xl shadow-sm space-y-4 lg:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" /> Timetable Grid Editor
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-semibold">
            Manually create or edit the Monday to Friday (Periods 1 to 7) timetable for {selectedClass || "selected class"} (SEM {selectedSemester})
          </p>
        </div>
        {selectedClass && (
          <div className="flex gap-3">
            <button
              onClick={handleClearTimetable}
              disabled={uploadingTimetable}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-100 text-rose-600 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              Clear Grid
            </button>
            <button
              onClick={handleSaveTimetable}
              disabled={uploadingTimetable}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {uploadingTimetable ? "Saving..." : "Save Timetable"}
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="p-12 text-center text-slate-400 font-medium">
          <Info className="h-8 w-8 mx-auto mb-3 text-slate-350" />
          Please select a department and class from the sidebar first to manage the timetable.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/20 p-2 lg:p-4">
            <table className="w-full border-collapse text-left bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider select-none">
                  <th className="p-4 w-32 border-r border-slate-200">Day</th>
                  <th className="p-4 text-center border-r border-slate-200">Period 1<br/><span className="text-[10px] text-slate-400 normal-case font-normal">9:00 - 9:50</span></th>
                  <th className="p-4 text-center border-r border-slate-200">Period 2<br/><span className="text-[10px] text-slate-400 normal-case font-normal">9:50 - 10:40</span></th>
                  <th className="p-4 text-center border-r border-slate-200">Period 3<br/><span className="text-[10px] text-slate-400 normal-case font-normal">10:55 - 11:45</span></th>
                  <th className="p-4 text-center border-r border-slate-200">Period 4<br/><span className="text-[10px] text-slate-400 normal-case font-normal">11:45 - 12:35</span></th>
                  <th className="p-4 text-center border-r border-slate-200">Period 5<br/><span className="text-[10px] text-slate-400 normal-case font-normal">1:25 - 2:15</span></th>
                  <th className="p-4 text-center border-r border-slate-200">Period 6<br/><span className="text-[10px] text-slate-400 normal-case font-normal">2:15 - 3:05</span></th>
                  <th className="p-4 text-center">Period 7<br/><span className="text-[10px] text-slate-400 normal-case font-normal">3:20 - 4:10</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                  const row = timetableGrid[day] || Array(7).fill("");
                  return (
                    <tr key={day} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 uppercase text-xs">
                        {day}
                      </td>
                      {Array(7).fill(0).map((_, idx) => (
                        <td key={idx} className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            value={row[idx] || ""}
                            placeholder="e.g. CNS"
                            onChange={(e) => handleCellChange(day, idx, e.target.value)}
                            className="w-full text-center bg-transparent border-0 border-b border-transparent focus:border-orange-500 outline-none text-xs font-bold text-slate-800 p-1 placeholder:text-slate-350"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Course Details & Faculty Mapping Editor */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/20 p-4 lg:p-6 space-y-4 mt-4 lg:mt-6">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-800">Course & Faculty Mapping</h4>
                <p className="text-[11px] text-slate-400 font-semibold">Map abbreviations used in the grid above to their full names and handling faculty members.</p>
              </div>
              <button
                onClick={() => {
                  setCourseMappings(prev => [
                    ...prev,
                    { abbreviation: "", name: "", facultyId: "", facultyName: "" }
                  ]);
                }}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                + Add Course Map
              </button>
            </div>

            {courseMappings.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No course mappings configured. Click "+ Add Course Map" to map abbreviations.</p>
            ) : (
              <div className="space-y-3">
                {courseMappings.map((map, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                    <div className="w-full sm:w-1/4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Abbreviation *</label>
                      <input
                        type="text"
                        value={map.abbreviation}
                        placeholder="e.g. CNS"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCourseMappings(prev => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], abbreviation: val };
                            return updated;
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                        required
                      />
                    </div>

                    <div className="w-full sm:w-1/3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Course Name *</label>
                      <input
                        type="text"
                        value={map.name}
                        placeholder="e.g. Cryptography and Network Security"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCourseMappings(prev => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], name: val };
                            return updated;
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Handling Faculty Staff *</label>
                      <select
                        value={map.facultyId}
                        onChange={(e) => {
                          const fId = e.target.value;
                          const selectedFac = faculties.find(f => f.id === fId);
                          const fName = selectedFac ? selectedFac.name : "";
                          setCourseMappings(prev => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], facultyId: fId, facultyName: fName };
                            return updated;
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-orange-500"
                        required
                      >
                        <option value="">-- Select Faculty --</option>
                        {faculties.map((fac) => (
                          <option key={fac.id} value={fac.id}>
                            {fac.name} ({fac.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setCourseMappings(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="p-2 sm:mt-4 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-rose-500 transition-all cursor-pointer self-end sm:self-auto"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

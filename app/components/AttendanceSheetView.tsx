"use client";

import React, { useState } from "react";
import { Search, Users, CheckCircle, XCircle, Download, Info, Calendar, Layers } from "lucide-react";
import { Student, Department } from "../types";

interface AttendanceSheetViewProps {
  selectedClass: string;
  onViewFaculty: () => void;
  onViewTimetable: () => void;
  loadingStudents: boolean;
  stats: {
    totalStudents: number;
    avgPresent: number;
    attendanceWarningCount: number;
  };
  loadingAttendance: boolean;
  handleDownloadExcel: () => Promise<void>;
  filteredStudents: Student[];
  students: Student[];
  studentAttendance: Record<string, any>;
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeTab: "overview" | "daily";
  setActiveTab: (tab: "overview" | "daily") => void;
  selectedDate: string;
  handleSort: (field: "name" | "id" | "present" | "absent" | "od") => void;
  renderSortIndicator: (field: "name" | "id" | "present" | "absent" | "od") => React.ReactNode;
  getAttendanceSummaryForDate: (studentId: string, date: string) => any[] | null;
  selectedSemester: string;
  setSelectedSemester: (sem: string) => void;
  setEditingStudent: (student: Student | null) => void;
  setOriginalStudentId: (id: string) => void;
  setSelectedDate: (date: string) => void;
  onEditClass: () => void;
}

export default function AttendanceSheetView({
  selectedClass,
  loadingStudents,
  stats,
  loadingAttendance,
  handleDownloadExcel,
  filteredStudents,
  students,
  studentAttendance,
  selectedStudent,
  setSelectedStudent,
  searchTerm,
  setSearchTerm,
  activeTab,
  setActiveTab,
  selectedDate,
  handleSort,
  renderSortIndicator,
  getAttendanceSummaryForDate,
  selectedSemester,
  setSelectedSemester,
  setEditingStudent,
  setOriginalStudentId,
  setSelectedDate,
  onViewFaculty,
  onViewTimetable,
  onEditClass,
}: AttendanceSheetViewProps) {
  const [filterType] = useState<"single" | "range">("range");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const getDatesInRange = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    let start = new Date(startStr);
    const end = new Date(endStr);
    while (start <= end) {
      const dd = String(start.getDate()).padStart(2, "0");
      const mm = String(start.getMonth() + 1).padStart(2, "0");
      const yyyy = start.getFullYear();
      dates.push(`${dd}-${mm}-${yyyy}`);
      start.setDate(start.getDate() + 1);
    }
    return dates;
  };

  const activeDates = getDatesInRange(fromDate, toDate);

  const getDaySummary = (studentId: string, dateStr: string) => {
    const record = studentAttendance[studentId];
    const dailyAttendance = record?.[dateStr];
    if (!dailyAttendance || typeof dailyAttendance !== "object") return null;

    let pCount = 0;
    let aCount = 0;
    let odCount = 0;
    let totalCount = 0;
    
    Object.values(dailyAttendance).forEach((hourEntry: any) => {
      if (hourEntry && typeof hourEntry === "object") {
        Object.values(hourEntry).forEach((status: any) => {
          totalCount++;
          if (status === "P") pCount++;
          else if (status === "A") aCount++;
          else if (status === "OD") odCount++;
        });
      }
    });

    if (totalCount === 0) return null;
    return { pCount, aCount, odCount, totalCount };
  };
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info cards */}
      {selectedClass && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-3 lg:gap-4">
          {/* Card 1: Total Students */}
          <div className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Total Students
              </p>
              <h3 className="text-xs sm:text-lg lg:text-xl font-black text-slate-800 mt-0.5">
                {loadingStudents ? "..." : stats.totalStudents}
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-blue-50 text-blue-500 rounded-lg border border-blue-100 shrink-0">
              <Users className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Avg. Attendance */}
          <div className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Avg. Attendance
              </p>
              <h3 className="text-xs sm:text-lg lg:text-xl font-black mt-0.5 bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {loadingAttendance ? "..." : `${stats.avgPresent}%`}
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shrink-0">
              <CheckCircle className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Low Attendance Alert */}
          <div className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Low Attendance
              </p>
              <h3 className="text-xs sm:text-lg lg:text-xl font-black text-rose-500 mt-0.5">
                {loadingAttendance ? "..." : stats.attendanceWarningCount}
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-rose-50 text-rose-500 rounded-lg border border-rose-100 shrink-0">
              <XCircle className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>

          {/* Card 4: View Faculty */}
          <div 
            onClick={onViewFaculty}
            className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group"
          >
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">
                Dept Faculty
              </p>
              <h3 className="text-[9px] sm:text-xs font-bold text-slate-600 mt-0.5 group-hover:text-indigo-600 transition-colors">
                View All
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-indigo-50 text-indigo-500 rounded-lg border border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
              <Users className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>

          {/* Card 5: Manage Timetable */}
          <div 
            onClick={onViewTimetable}
            className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all group"
          >
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-amber-500 transition-colors">
                Class Timetable
              </p>
              <h3 className="text-[9px] sm:text-xs font-bold text-slate-600 mt-0.5 group-hover:text-amber-600 transition-colors">
                Manage
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-amber-50 text-amber-500 rounded-lg border border-amber-100 group-hover:bg-amber-500 group-hover:text-white transition-all shrink-0">
              <Calendar className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>

          {/* Card 6: Class Settings */}
          <div 
            onClick={onEditClass}
            className="bg-white border border-slate-200/85 p-2 sm:p-3.5 lg:p-4 rounded-xl flex items-center justify-between shadow-xs cursor-pointer hover:border-orange-400 hover:shadow-sm transition-all group"
          >
            <div>
              <p className="text-[8px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider group-hover:text-orange-500 transition-colors">
                Class Settings
              </p>
              <h3 className="text-[9px] sm:text-xs font-bold text-slate-600 mt-0.5 group-hover:text-orange-600 transition-colors">
                Class Editor
              </h3>
            </div>
            <div className="p-1 sm:p-2.5 bg-orange-50 text-orange-500 rounded-lg border border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0">
              <Layers className="h-3.5 w-3.5 sm:h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Student Attendance List */}
      {selectedClass ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 lg:p-6 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:gap-4 items-stretch lg:items-center justify-between bg-slate-50/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-56 lg:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 items-center">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === "overview"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semester Stats
                </button>
                <div className={`flex items-center rounded-lg transition-all ${
                    activeTab === "daily"
                      ? "bg-white text-orange-600 shadow-sm pl-4 pr-2 py-1.5"
                      : "text-slate-500 hover:text-slate-800 px-4 py-1.5"
                  }`}>
                  <button
                    onClick={() => setActiveTab("daily")}
                    className="text-xs font-bold outline-none cursor-pointer"
                  >
                    Daily Grid
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Semester</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                >
                  {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-lg transition-all border border-emerald-500 hover:border-emerald-600 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </button>
              <div className="text-xs text-slate-400 font-bold">
                Showing {filteredStudents.length} of {students.length} students
              </div>
            </div>
          </div>

          {/* Secondary filter bar for Daily Grid Date Range */}
          {activeTab === "daily" && (
            <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 border-b border-slate-100 p-4 text-xs font-semibold select-none">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">From</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none cursor-pointer focus:border-slate-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">To</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-bold outline-none cursor-pointer focus:border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {loadingStudents ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
              Loading student records...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No students found.
            </div>
          ) : (
            <div className="overflow-x-auto sm:block">
              {activeTab === "overview" ? (
                <>
                  {/* Mobile Overview View */}
                  <div className="block sm:hidden divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const p = Math.round(studentAttendance[student.id]?.P ?? 0);
                      const a = Math.round(studentAttendance[student.id]?.A ?? 0);
                      const od = Math.round(studentAttendance[student.id]?.OD ?? 0);
                      return (
                        <div key={student.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{student.name}</h4>
                              <span className="font-mono text-[10px] font-bold text-slate-400">{student.id}</span>
                            </div>
                            <button onClick={() => {
                              setEditingStudent(student);
                              setOriginalStudentId(student.id);
                            }} className="px-3 py-1 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-650 hover:border-orange-400 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer">
                              Edit
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                            <div>
                              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Present</span>
                              <span className="text-xs font-black text-emerald-600">{p}%</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">OD</span>
                              <span className="text-xs font-black text-blue-600">{od}%</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Absent</span>
                              <span className="text-xs font-black text-rose-500">{a}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <table className="hidden sm:table w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50/50 select-none">
                        <th onClick={() => handleSort("id")} className="p-4 pl-6 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">ID {renderSortIndicator("id")}</span>
                        </th>
                        <th onClick={() => handleSort("name")} className="p-4 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">Name {renderSortIndicator("name")}</span>
                        </th>
                        <th onClick={() => handleSort("present")} className="p-4 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">Present % {renderSortIndicator("present")}</span>
                        </th>
                        <th onClick={() => handleSort("od")} className="p-4 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">OD % {renderSortIndicator("od")}</span>
                        </th>
                        <th onClick={() => handleSort("absent")} className="p-4 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">Absent % {renderSortIndicator("absent")}</span>
                        </th>
                        <th className="p-4 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student) => {
                        const p = Math.round(studentAttendance[student.id]?.P ?? 0);
                        const a = Math.round(studentAttendance[student.id]?.A ?? 0);
                        const od = Math.round(studentAttendance[student.id]?.OD ?? 0);
                        return (
                          <tr key={student.id} className={`group hover:bg-slate-50/40 transition-colors ${selectedStudent?.id === student.id ? "bg-orange-50/20" : ""}`}>
                            <td className="p-4 pl-6 font-mono text-xs font-semibold text-slate-500">{student.id}</td>
                            <td className="p-4 font-bold text-slate-800 group-hover:text-orange-600 transition-colors">{student.name}</td>
                            <td className="p-4 text-center font-bold text-emerald-600">{p}%</td>
                            <td className="p-4 text-center font-bold text-blue-600">{od}%</td>
                            <td className="p-4 text-center font-bold text-rose-600">{a}%</td>
                            <td className="p-4 pr-6 text-right">
                              <button onClick={() => {
                                setEditingStudent(student);
                                setOriginalStudentId(student.id);
                              }} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-600 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400 cursor-pointer">
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  {/* Mobile Daily Cards View */}
                  <div className="block sm:hidden divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      if (filterType === "single") {
                        const dailyLogs = getAttendanceSummaryForDate(student.id, selectedDate) || [];
                        const hourlyStatus = Array(7).fill(null);
                        dailyLogs.forEach((item) => {
                          if (item.hour >= 1 && item.hour <= 7) {
                            hourlyStatus[item.hour - 1] = item;
                          }
                        });
                        return (
                          <div key={student.id} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{student.name}</h4>
                                <span className="font-mono text-[10px] font-bold text-slate-400">{student.id}</span>
                              </div>
                              <button onClick={() => setSelectedStudent(student)} className="px-3 py-1 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-655 hover:border-orange-400 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer">
                                Logs
                              </button>
                            </div>
                            {/* 7 Periods mini indicators */}
                            <div className="grid grid-cols-7 gap-1 text-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 select-none">
                              {hourlyStatus.map((item, idx) => {
                                const isP = item?.status === "P";
                                const isOD = item?.status === "OD";
                                return (
                                  <div key={idx} className="flex flex-col items-center">
                                    <span className="text-[7.5px] font-black text-slate-405 mb-0.5 leading-none">H{idx + 1}</span>
                                    {item ? (
                                      <span className={`inline-block w-5 h-5 flex items-center justify-center rounded-md text-[9px] font-black leading-none ${
                                        isP ? "bg-emerald-100 text-emerald-700" :
                                        isOD ? "bg-blue-100 text-blue-700" :
                                        "bg-rose-100 text-rose-700"
                                      }`}>
                                        {item.status}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 font-bold">-</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        // Date range mobile summary
                        return (
                          <div key={student.id} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{student.name}</h4>
                                <span className="font-mono text-[10px] font-bold text-slate-400">{student.id}</span>
                              </div>
                              <button onClick={() => setSelectedStudent(student)} className="px-3 py-1 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-655 hover:border-orange-400 text-xs font-bold rounded-lg border border-slate-200/80 transition-all cursor-pointer">
                                Logs
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {activeDates.map(dateStr => {
                                const summary = getDaySummary(student.id, dateStr);
                                if (!summary) return null;
                                const isFullP = summary.aCount === 0 && summary.odCount === 0;
                                const isFullA = summary.aCount === summary.totalCount;
                                const isOD = summary.odCount > 0 && summary.aCount === 0;
                                return (
                                  <div key={dateStr} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold">
                                    <span className="text-slate-400">{dateStr.substring(0, 5)}:</span>
                                    {isFullP ? <span className="text-emerald-600 font-black">P</span> :
                                     isFullA ? <span className="text-rose-600 font-black">A</span> :
                                     isOD ? <span className="text-blue-600 font-black">OD</span> :
                                     <span className="text-amber-600 font-black">{summary.pCount}/{summary.totalCount}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>

                  {/* Desktop Daily Table View */}
                  <table className="hidden sm:table w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50/50 select-none">
                        <th onClick={() => handleSort("name")} className="p-4 pl-6 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">Name {renderSortIndicator("name")}</span>
                        </th>
                        {filterType === "single" ? (
                          <>
                            <th className="p-4 text-center">1st Hour</th>
                            <th className="p-4 text-center">2nd Hour</th>
                            <th className="p-4 text-center">3rd Hour</th>
                            <th className="p-4 text-center">4th Hour</th>
                            <th className="p-4 text-center">5th Hour</th>
                            <th className="p-4 text-center">6th Hour</th>
                            <th className="p-4 text-center">7th Hour</th>
                          </>
                        ) : (
                          activeDates.map(dateStr => (
                            <th key={dateStr} className="p-4 text-center font-mono text-[10px] tracking-wider min-w-[70px]">
                              {dateStr.substring(0, 5)}
                            </th>
                          ))
                        )}
                        <th className="p-4 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student) => {
                        if (filterType === "single") {
                          const dailyLogs = getAttendanceSummaryForDate(student.id, selectedDate) || [];
                          const hourlyStatus = Array(7).fill(null);
                          dailyLogs.forEach((item) => {
                            if (item.hour >= 1 && item.hour <= 7) {
                              hourlyStatus[item.hour - 1] = item;
                            }
                          });
                          return (
                            <tr key={student.id} className={`group hover:bg-slate-50/40 transition-colors ${selectedStudent?.id === student.id ? "bg-orange-50/20" : ""}`}>
                              <td className="p-4 pl-6 font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                                <div>
                                  <div className="truncate max-w-[200px]">{student.name}</div>
                                  <div className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5">{student.id}</div>
                                </div>
                              </td>
                              {hourlyStatus.map((item, idx) => {
                                const isP = item?.status === "P";
                                const isOD = item?.status === "OD";
                                return (
                                  <td key={idx} className="p-4 text-center">
                                    {item ? (
                                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                                        isP ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                        isOD ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                        "bg-rose-50 text-rose-600 border border-rose-100"
                                      }`}>
                                        {item.status}
                                      </span>
                                    ) : "-"}
                                  </td>
                                );
                              })}
                              <td className="p-4 pr-6 text-right">
                                <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-650 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400 cursor-pointer">
                                  Logs
                                </button>
                              </td>
                            </tr>
                          );
                        } else {
                          // Date range grid row
                          return (
                            <tr key={student.id} className={`group hover:bg-slate-50/40 transition-colors ${selectedStudent?.id === student.id ? "bg-orange-50/20" : ""}`}>
                              <td className="p-4 pl-6 font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                                <div>
                                  <div className="truncate max-w-[200px]">{student.name}</div>
                                  <div className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5">{student.id}</div>
                                </div>
                              </td>
                              {activeDates.map(dateStr => {
                                const summary = getDaySummary(student.id, dateStr);
                                if (!summary) return <td key={dateStr} className="p-4 text-center text-slate-350">-</td>;
                                
                                const isFullP = summary.aCount === 0 && summary.odCount === 0;
                                const isFullA = summary.aCount === summary.totalCount;
                                const isOD = summary.odCount > 0 && summary.aCount === 0;
                                
                                return (
                                  <td key={dateStr} className="p-4 text-center">
                                    {isFullP ? (
                                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold" title="Present for all classes">
                                        P
                                      </span>
                                    ) : isFullA ? (
                                      <span className="inline-block px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold" title="Absent for all classes">
                                        A
                                      </span>
                                    ) : isOD ? (
                                      <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold" title="On Duty">
                                        OD
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-xs font-bold" title={`${summary.pCount} of ${summary.totalCount} classes present`}>
                                        {summary.pCount}/{summary.totalCount}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-4 pr-6 text-right">
                                <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-650 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400 cursor-pointer">
                                  Logs
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 border-dashed p-12 lg:p-24 rounded-2xl text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <div className="bg-slate-50 p-5 rounded-full mb-4 border border-slate-100">
            <Info className="h-10 w-10 text-slate-400" />
          </div>
          <h5 className="font-bold text-base text-slate-500">View Class Attendance</h5>
          <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
            Select a department and class from the top dropdowns to view student attendance records.
          </p>
        </div>
      )}
    </div>
  );
}

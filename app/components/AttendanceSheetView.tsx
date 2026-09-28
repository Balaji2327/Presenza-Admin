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
  handleDownloadExcel: (options?: { isRange?: boolean; fromDate?: string; toDate?: string }) => Promise<void>;
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
  const [showRange, setShowRange] = useState(false);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [appliedDates, setAppliedDates] = useState<{from: string, to: string} | null>(null);
  const filterType = (showRange && appliedDates !== null) ? "range" : "single";

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

  const activeDates = appliedDates ? getDatesInRange(appliedDates.from, appliedDates.to) : [];

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Students */}
          <div className="bg-white border border-slate-200/80 p-3 sm:p-4 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Enrolled
              </span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {loadingStudents ? "..." : stats.totalStudents}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Students registered</span>
            </div>
          </div>

          {/* Card 2: Avg. Attendance */}
          <div className="bg-white border border-slate-200/80 p-3 sm:p-4 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Average Present
              </span>
              <CheckCircle className="h-4 w-4 text-slate-900" />
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {loadingAttendance ? "..." : `${stats.avgPresent}%`}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Semester average</span>
            </div>
          </div>

          {/* Card 3: Low Attendance Alert */}
          <div className="bg-white border border-slate-200/80 p-3 sm:p-4 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Defaulters (&lt;75%)
              </span>
              <XCircle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-rose-700 tabular-nums">
                {loadingAttendance ? "..." : stats.attendanceWarningCount}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Action required</span>
            </div>
          </div>

          {/* Card 4: Manage Timetable */}
          <button 
            onClick={onViewTimetable}
            className="text-left bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40 p-3 sm:p-4 rounded-xl shadow-2xs transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Class Schedule
              </span>
              <Calendar className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-2">
              <span className="text-sm font-semibold text-slate-900 block">
                Timetable Grid
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Open class schedule</span>
            </div>
          </button>

          {/* Card 5: Class Settings */}
          <button 
            onClick={onEditClass}
            className="text-left bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40 p-3 sm:p-4 rounded-xl shadow-2xs transition-colors cursor-pointer group col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Settings
              </span>
              <Layers className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-2">
              <span className="text-sm font-semibold text-slate-900 block">
                Class Editor
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Rename or remove class</span>
            </div>
          </button>
        </div>
      )}

      {/* Main Grid: Student Attendance List */}
      {selectedClass ? (
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden flex flex-col shadow-2xs">
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:gap-4 items-stretch lg:items-center justify-between bg-slate-50/30">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 w-full lg:w-auto flex-wrap">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 items-center">
                <button
                  onClick={() => {
                    setActiveTab("overview");
                    setShowRange(false);
                    setFromDate("");
                    setToDate("");
                    setAppliedDates(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semester Overview
                </button>
                <button
                  onClick={() => {
                    setActiveTab("daily");
                    setShowRange(false);
                    setFromDate("");
                    setToDate("");
                    setAppliedDates(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    activeTab === "daily"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Daily Grid
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button
                  onClick={() => {
                    const nextShowRange = !showRange;
                    setShowRange(nextShowRange);
                    if (nextShowRange) {
                      setActiveTab("daily");
                    } else {
                      setFromDate("");
                      setToDate("");
                      setAppliedDates(null);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    showRange 
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Date Range
                </button>
              </div>

              {showRange ? (
                <div className="flex items-center gap-1 animate-in slide-in-from-left-2">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 font-bold outline-none cursor-pointer focus:border-slate-300 w-[110px]"
                  />
                  <span className="text-[11px] font-medium text-slate-500 uppercase">To</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none cursor-pointer focus:border-slate-800 w-[120px]"
                  />
                  <button
                    onClick={() => setAppliedDates({ from: fromDate, to: toDate })}
                    disabled={!fromDate || !toDate}
                    className="ml-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              ) : activeTab === "daily" ? (
                <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2">
                  <span className="text-xs font-medium text-slate-500">Date:</span>
                  <input
                    type="date"
                    value={selectedDate && selectedDate.includes("-") ? `${selectedDate.split("-")[2]}-${selectedDate.split("-")[1]}-${selectedDate.split("-")[0]}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setSelectedDate("");
                        return;
                      }
                      const [yyyy, mm, dd] = val.split("-");
                      setSelectedDate(`${dd}-${mm}-${yyyy}`);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none cursor-pointer focus:border-slate-800 w-[125px]"
                  />
                </div>
              ) : null}

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Semester:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-slate-800 cursor-pointer"
                >
                  {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={() => handleDownloadExcel({ 
                  isRange: activeTab === "daily" && showRange && appliedDates !== null, 
                  fromDate: appliedDates?.from, 
                  toDate: appliedDates?.to 
                })}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-white" />
                <span>Export Report</span>
              </button>
              <div className="text-xs text-slate-400 font-medium">
                {filteredStudents.length} of {students.length} students
              </div>
            </div>
          </div>

          {loadingStudents ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-800 mx-auto mb-2" />
              Loading student roster...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium">
              No students found for this class.
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
                              <h4 className="font-semibold text-slate-900 text-xs">{student.name}</h4>
                              <span className="font-mono text-[10px] text-slate-500">{student.id}</span>
                            </div>
                            <button onClick={() => {
                              setEditingStudent(student);
                              setOriginalStudentId(student.id);
                            }} className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition-colors cursor-pointer shadow-2xs">
                              Edit
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">Present</span>
                              <span className="text-xs font-semibold text-slate-900 tabular-nums">{p}%</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">OD</span>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">{od}%</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">Absent</span>
                              <span className="text-xs font-semibold text-rose-700 tabular-nums">{a}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <table className="hidden sm:table w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-medium uppercase tracking-wider bg-slate-50/40 select-none">
                        <th onClick={() => handleSort("id")} className="px-5 py-3 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">ID {renderSortIndicator("id")}</span>
                        </th>
                        <th onClick={() => handleSort("name")} className="px-5 py-3 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">Student Name {renderSortIndicator("name")}</span>
                        </th>
                        <th onClick={() => handleSort("present")} className="px-5 py-3 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">Present % {renderSortIndicator("present")}</span>
                        </th>
                        <th onClick={() => handleSort("od")} className="px-5 py-3 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">OD % {renderSortIndicator("od")}</span>
                        </th>
                        <th onClick={() => handleSort("absent")} className="px-5 py-3 text-center cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center justify-center w-full">Absent % {renderSortIndicator("absent")}</span>
                        </th>
                        <th className="px-5 py-3 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStudents.map((student) => {
                        const p = Math.round(studentAttendance[student.id]?.P ?? 0);
                        const a = Math.round(studentAttendance[student.id]?.A ?? 0);
                        const od = Math.round(studentAttendance[student.id]?.OD ?? 0);
                        return (
                          <tr key={student.id} className={`group hover:bg-slate-50/60 transition-colors ${selectedStudent?.id === student.id ? "bg-slate-50" : ""}`}>
                            <td className="px-5 py-3 font-mono font-medium text-slate-600">{student.id}</td>
                            <td className="px-5 py-3 font-medium text-slate-900">{student.name}</td>
                            <td className="px-5 py-3 text-center font-bold text-slate-900 tabular-nums">{p}%</td>
                            <td className="px-5 py-3 text-center font-medium text-slate-700 tabular-nums">{od}%</td>
                            <td className="px-5 py-3 text-center font-medium text-rose-700 tabular-nums">{a}%</td>
                            <td className="px-5 py-3 pr-6 text-right">
                              <button onClick={() => {
                                setEditingStudent(student);
                                setOriginalStudentId(student.id);
                              }} className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium rounded-md transition-colors border border-slate-200 cursor-pointer shadow-2xs">
                                Edit Profile
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
                                    <span className="text-[7.5px] font-black text-slate-400 mb-0.5 leading-none">H{idx + 1}</span>
                                    {item ? (
                                      <span className={`inline-block w-5 h-5 flex items-center justify-center rounded-md text-[9px] font-bold leading-none ${
                                        isP ? "bg-slate-100 text-slate-800" :
                                        isOD ? "bg-orange-50 text-orange-700 border border-orange-200/60" :
                                        "bg-rose-50 text-rose-700 border border-rose-200/60"
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
                                <h4 className="font-bold text-slate-900 text-sm">{student.name}</h4>
                                <span className="font-mono text-[10px] font-bold text-slate-400">{student.id}</span>
                              </div>
                              <button onClick={() => setSelectedStudent(student)} className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer">
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
                                    {isFullP ? <span className="text-slate-800 font-bold">P</span> :
                                     isFullA ? <span className="text-rose-600 font-bold">A</span> :
                                     isOD ? <span className="text-orange-600 font-bold">OD</span> :
                                     <span className="text-slate-900 font-bold">{summary.pCount}/{summary.totalCount}</span>}
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
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-medium uppercase tracking-wider bg-slate-50/40 select-none">
                        <th onClick={() => handleSort("name")} className="px-5 py-3 cursor-pointer hover:text-slate-700 transition-colors">
                          <span className="inline-flex items-center">Student Name {renderSortIndicator("name")}</span>
                        </th>
                        {filterType === "single" ? (
                          <>
                            <th className="px-3 py-3 text-center">Period 1</th>
                            <th className="px-3 py-3 text-center">Period 2</th>
                            <th className="px-3 py-3 text-center">Period 3</th>
                            <th className="px-3 py-3 text-center">Period 4</th>
                            <th className="px-3 py-3 text-center">Period 5</th>
                            <th className="px-3 py-3 text-center">Period 6</th>
                            <th className="px-3 py-3 text-center">Period 7</th>
                          </>
                        ) : (
                          activeDates.map(dateStr => (
                            <th key={dateStr} className="px-3 py-3 text-center font-mono text-[10px] tracking-wider min-w-[70px]">
                              {dateStr.substring(0, 5)}
                            </th>
                          ))
                        )}
                        <th className="px-5 py-3 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
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
                            <tr key={student.id} className={`group hover:bg-slate-50/60 transition-colors ${selectedStudent?.id === student.id ? "bg-slate-50" : ""}`}>
                              <td className="px-5 py-3 text-slate-900 font-medium">
                                <div>
                                  <div className="truncate max-w-[200px]">{student.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{student.id}</div>
                                </div>
                              </td>
                              {hourlyStatus.map((item, idx) => {
                                const isP = item?.status === "P";
                                const isOD = item?.status === "OD";
                                return (
                                  <td key={idx} className="px-3 py-3 text-center">
                                    {item ? (
                                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                        isP ? "bg-slate-100 text-slate-800" :
                                        isOD ? "bg-orange-50 text-orange-700 border border-orange-200/60" :
                                        "bg-rose-50 text-rose-700 border border-rose-200/60"
                                      }`}>
                                        {item.status}
                                      </span>
                                    ) : <span className="text-slate-300">·</span>}
                                  </td>
                                );
                              })}
                              <td className="px-5 py-3 pr-6 text-right">
                                <button onClick={() => setSelectedStudent(student)} className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors border border-slate-200 cursor-pointer shadow-2xs">
                                  View Log
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
                                      <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded text-xs font-semibold" title="Present for all classes">
                                        P
                                      </span>
                                    ) : isFullA ? (
                                      <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/60 rounded text-xs font-semibold" title="Absent for all classes">
                                        A
                                      </span>
                                    ) : isOD ? (
                                      <span className="inline-block px-2.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200/60 rounded text-xs font-semibold" title="On Duty">
                                        OD
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded text-xs font-semibold" title={`${summary.pCount} of ${summary.totalCount} classes present`}>
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

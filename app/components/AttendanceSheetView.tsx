"use client";

import React from "react";
import { Search, Users, CheckCircle, XCircle, Download, Info } from "lucide-react";
import { Student, Department } from "../types";

interface AttendanceSheetViewProps {
  selectedClass: string;
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
}: AttendanceSheetViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info cards */}
      {selectedClass && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Students
              </p>
              <h3 className="text-3xl font-black text-slate-800 mt-2">
                {loadingStudents ? "..." : stats.totalStudents}
              </h3>
            </div>
            <div className="p-4 bg-blue-50 text-blue-500 rounded-xl border border-blue-100">
              <Users className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Avg. Attendance Rate
              </p>
              <h3 className="text-3xl font-black mt-2 bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {loadingAttendance ? "..." : `${stats.avgPresent}%`}
              </h3>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Low Attendance Alert
              </p>
              <h3 className="text-3xl font-black text-rose-500 mt-2">
                {loadingAttendance ? "..." : stats.attendanceWarningCount}
              </h3>
            </div>
            <div className="p-4 bg-rose-50 text-rose-500 rounded-xl border border-rose-100">
              <XCircle className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Student Attendance List */}
      {selectedClass ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
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
                <button
                  onClick={() => setActiveTab("daily")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === "daily"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Daily Grid ({selectedDate})
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4 w-full lg:w-auto shrink-0">
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
            <div className="overflow-x-auto">
              {activeTab === "overview" ? (
                <table className="w-full border-collapse text-left">
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
                            <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-600 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400 cursor-pointer">
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50/50 select-none">
                      <th onClick={() => handleSort("name")} className="p-4 pl-6 cursor-pointer hover:text-slate-700 transition-colors">
                        <span className="inline-flex items-center">Name {renderSortIndicator("name")}</span>
                      </th>
                      <th className="p-4 text-center">1st Hour</th>
                      <th className="p-4 text-center">2nd Hour</th>
                      <th className="p-4 text-center">3rd Hour</th>
                      <th className="p-4 text-center">4th Hour</th>
                      <th className="p-4 text-center">5th Hour</th>
                      <th className="p-4 text-center">6th Hour</th>
                      <th className="p-4 text-center">7th Hour</th>
                      <th className="p-4 pr-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
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
                            <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-600 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400 cursor-pointer">
                              Logs
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 border-dashed p-24 rounded-2xl text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
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

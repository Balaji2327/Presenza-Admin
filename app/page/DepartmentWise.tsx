"use client";

import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  query,
  where,
} from "firebase/firestore";
import { Users, CheckCircle, XCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  class: string;
  department: string;
  semester?: string;
}

interface DepartmentWiseProps {
  departmentId: string;
  departmentName: string;
  onBack: () => void;
  onViewFaculty: () => void;
  onViewTimetable: () => void;
}

export default function DepartmentWise({
  departmentId,
  departmentName,
  onBack,
  onViewFaculty,
  onViewTimetable,
}: DepartmentWiseProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [presentStudents, setPresentStudents] = useState<Student[]>([]);
  const [absentStudents, setAbsentStudents] = useState<Student[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"present" | "absent" | "total" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  useEffect(() => {
    async function fetchDepartmentAttendance() {
      try {
        setLoading(true);
        // 1. Fetch all students in the department
        const studentsQuery = query(
          collection(db, "colleges", "students", "all_students"),
          where("department", "==", departmentId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Student[];
        setStudents(studentsList);

        // Convert yyyy-MM-dd date input format to dd-MM-yyyy database key format
        const [year, month, day] = selectedDate.split("-");
        const dateStr = `${day}-${month}-${year}`;

        const tempPresent: Student[] = [];
        const tempAbsent: Student[] = [];

        // 2. Fetch attendance for each student in parallel
        await Promise.all(
          studentsList.map(async (student) => {
            const attColRef = collection(
              db,
              "colleges",
              "students",
              "all_students",
              student.id,
              "attendance"
            );
            const attColSnap = await getDocs(attColRef);

            let foundLog = false;
            let hasAbsent = false;
            let hasPresent = false;

            for (const docSnap of attColSnap.docs) {
              if (docSnap.exists()) {
                const attData = docSnap.data();
                const dailyAttendance = attData[dateStr];
                
                if (dailyAttendance && typeof dailyAttendance === "object") {
                  foundLog = true;
                  Object.values(dailyAttendance).forEach((hourEntry: any) => {
                    if (hourEntry && typeof hourEntry === "object") {
                      Object.values(hourEntry).forEach((status: any) => {
                        if (status === "A") {
                          hasAbsent = true;
                        } else if (status === "P" || status === "OD") {
                          hasPresent = true;
                        }
                      });
                    }
                  });
                }
              }
            }

            if (foundLog) {
              if (hasAbsent) {
                tempAbsent.push(student);
              } else if (hasPresent) {
                tempPresent.push(student);
              }
            }
          })
        );

        setPresentStudents(tempPresent);
        setAbsentStudents(tempAbsent);
      } catch (err) {
        console.error("Error loading department attendance:", err);
      } finally {
        setLoading(false);
      }
    }

    if (departmentId) {
      fetchDepartmentAttendance();
    }
  }, [departmentId, selectedDate]);

  const activeCategoryList =
    selectedCategory === "present"
      ? presentStudents
      : selectedCategory === "absent"
      ? absentStudents
      : selectedCategory === "total"
      ? students
      : [];

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {departmentName} Overview
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Real-time daily attendance metrics and departmental operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-slate-800 transition-colors cursor-pointer shadow-2xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-slate-200/80 rounded-xl">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-slate-200 border-t-slate-800" />
          <p className="text-slate-500 text-xs font-medium">Aggregating departmental attendance records...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Total Students Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "total" ? null : "total")}
              className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
                selectedCategory === "total"
                  ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/50"
                  : "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Enrolled</span>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{students.length}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Students in department</span>
              </div>
            </button>

            {/* Present Today Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "present" ? null : "present")}
              className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
                selectedCategory === "present"
                  ? "border-orange-600 ring-1 ring-orange-600 bg-orange-50/20"
                  : "border-slate-200/80 hover:border-orange-300 hover:bg-orange-50/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Present Today</span>
                <CheckCircle className="h-4 w-4 text-orange-600" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{presentStudents.length}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {students.length > 0 ? `${Math.round((presentStudents.length / students.length) * 100)}% attendance rate` : "No data"}
                </span>
              </div>
            </button>

            {/* Absent Today Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "absent" ? null : "absent")}
              className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
                selectedCategory === "absent"
                  ? "border-rose-600 ring-1 ring-rose-600 bg-rose-50/20"
                  : "border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Absent Today</span>
                <XCircle className="h-4 w-4 text-rose-600" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-semibold tracking-tight text-rose-700 tabular-nums">{absentStudents.length}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Flagged absences</span>
              </div>
            </button>

            {/* View Faculty Card */}
            <button 
              onClick={onViewFaculty}
              className="text-left bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40 p-4 rounded-xl shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Department Faculty</span>
                <Users className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <div className="mt-2.5">
                <span className="text-sm font-semibold text-slate-900 group-hover:text-slate-800 transition-colors block">
                  View Faculty List
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Manage assignments & roles</span>
              </div>
            </button>

            {/* Time Table Card */}
            <button 
              onClick={onViewTimetable}
              className="text-left bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40 p-4 rounded-xl shadow-2xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Schedule Engine</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400 group-hover:text-slate-700 transition-colors"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                  <path d="m9 16 2 2 4-4" />
                </svg>
              </div>
              <div className="mt-2.5">
                <span className="text-sm font-semibold text-slate-900 group-hover:text-slate-800 transition-colors block">
                  Class Timetable
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Edit or AI-generate grids</span>
              </div>
            </button>
          </div>

          {/* Drilldown List */}
          {selectedCategory && (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-800" />
                  <h3 className="text-xs font-semibold text-slate-900 capitalize">
                    {selectedCategory} Students ({activeCategoryList.length})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Dismiss view
                </button>
              </div>

              <div className="overflow-x-auto">
                {activeCategoryList.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium">
                    No students recorded under this category for the selected date.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Student ID</th>
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Name</th>
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Class</th>
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeCategoryList.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono font-medium text-slate-700">{student.id}</td>
                          <td className="px-5 py-3 font-medium text-slate-900">{student.name}</td>
                          <td className="px-5 py-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px]">{student.class}</span>
                          </td>
                          <td className="px-5 py-3 text-slate-500">{student.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

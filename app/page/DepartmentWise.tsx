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
    <div className="space-y-6 animate-fade-in w-full -mt-4 lg:-mt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-extrabold text-slate-800">
              {departmentName} — Attendance Overview
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Department-wise Stats
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          <p className="text-slate-500 text-sm font-semibold">Calculating attendance data...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            {/* Total Students Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "total" ? null : "total")}
              className={`text-left bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between transition-all cursor-pointer ${
                selectedCategory === "total"
                  ? "border-blue-500 ring-2 ring-blue-500/10 shadow-blue-500/5 bg-blue-50/20"
                  : "border-slate-200 hover:border-blue-200 hover:shadow-md"
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Students</span>
                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{students.length}</h3>
              </div>
              <div className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
                <Users className="h-6 w-6" />
              </div>
            </button>

            {/* Present Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "present" ? null : "present")}
              className={`text-left bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between transition-all cursor-pointer ${
                selectedCategory === "present"
                  ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-emerald-500/5 bg-emerald-50/20"
                  : "border-slate-200 hover:border-emerald-200 hover:shadow-md"
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Present Today</span>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{presentStudents.length}</h3>
              </div>
              <div className="h-12 w-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle className="h-6 w-6" />
              </div>
            </button>

            {/* Absent Card */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === "absent" ? null : "absent")}
              className={`text-left bg-white border rounded-2xl p-5 shadow-sm flex items-center justify-between transition-all cursor-pointer ${
                selectedCategory === "absent"
                  ? "border-rose-500 ring-2 ring-rose-500/10 shadow-rose-500/5 bg-rose-50/20"
                  : "border-slate-200 hover:border-rose-200 hover:shadow-md"
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-extrabold">Absent Today</span>
                <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{absentStudents.length}</h3>
              </div>
              <div className="h-12 w-12 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
                <XCircle className="h-6 w-6" />
              </div>
            </button>

            {/* View Faculty Card */}
            <div 
              onClick={onViewFaculty}
              className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">
                  Dept Faculty
                </span>
                <h3 className="text-xl font-bold text-slate-600 mt-1 group-hover:text-indigo-600 transition-colors">
                  View All
                </h3>
              </div>
              <div className="h-12 w-12 bg-indigo-50 text-indigo-500 rounded-xl border border-indigo-100 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                <Users className="h-6 w-6" />
              </div>
            </div>

            {/* Time Table Card (SchedulAI Engine) */}
            <div 
              onClick={onViewTimetable}
              className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-orange-400 hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="z-10">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors">
                  Time Table
                </span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1 group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                  Generate
                </h3>
              </div>
              <div className="h-12 w-12 bg-orange-50 text-orange-500 rounded-xl border border-orange-100 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0 z-10">
                <Users className="hidden" /> {/* placeholder to maintain alignment */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                  <path d="m9 16 2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Drilldown List */}
          {selectedCategory && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-slide-up">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 capitalize">
                  {selectedCategory} Students List ({activeCategoryList.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                {activeCategoryList.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm font-semibold">
                    No students in this category.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Student ID</th>
                        <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Name</th>
                        <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Class</th>
                        <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCategoryList.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 text-xs font-bold text-slate-700">{student.id}</td>
                          <td className="px-6 py-3.5 text-xs font-bold text-slate-800">{student.name}</td>
                          <td className="px-6 py-3.5 text-xs font-bold text-slate-600">{student.class}</td>
                          <td className="px-6 py-3.5 text-xs text-slate-500 font-medium">{student.email}</td>
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

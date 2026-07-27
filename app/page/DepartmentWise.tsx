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
}

export default function DepartmentWise({
  departmentId,
  departmentName,
  onBack,
}: DepartmentWiseProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [presentStudents, setPresentStudents] = useState<Student[]>([]);
  const [absentStudents, setAbsentStudents] = useState<Student[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"present" | "absent" | null>(null);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {/* Total Students Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Students</span>
                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{students.length}</h3>
              </div>
              <div className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                <Users className="h-6 w-6" />
              </div>
            </div>

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
              <div className="h-12 w-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
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
              <div className="h-12 w-12 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                <XCircle className="h-6 w-6" />
              </div>
            </button>
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

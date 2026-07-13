"use client";

import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  DocumentData,
  onSnapshot,
} from "firebase/firestore";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  GraduationCap,
  Layers,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Sparkles,
  Info
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  classes?: string[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  class: string;
  department: string;
  mentor_id?: string;
}

interface AttendanceRecord {
  P?: number;
  A?: number;
  OD?: number;
  [dateKey: string]: any; // maps dd-MM-yyyy to daily record
}

export default function AdminDashboard() {
  // Navigation states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord>>({});

  // Filters & Controls
  const [selectedSemester, setSelectedSemester] = useState<string>("I");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  });

  // Loading and Error states
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdblockWarning, setShowAdblockWarning] = useState(false);

  // Semesters list
  const semesters = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

  // Fetch Departments on Mount
  useEffect(() => {
    let active = true;
    // Show a warning if it takes more than 5 seconds to load
    const timer = setTimeout(() => {
      if (active) {
        setShowAdblockWarning(true);
      }
    }, 5000);

    async function fetchDepartments() {
      try {
        setLoadingDepts(true);
        setError(null);

        const colRef = collection(db, "colleges", "departments", "all_departments");
        const snapshot = await getDocs(colRef);
        if (!active) return;

        const deptsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "Unnamed Department",
            classes: data.classes || [],
          } as Department;
        });
        setDepartments(deptsData);
        if (deptsData.length > 0) {
          setSelectedDept(deptsData[0]);
          if (deptsData[0].classes && deptsData[0].classes.length > 0) {
            setSelectedClass(deptsData[0].classes[0]);
          }
        }
        setShowAdblockWarning(false);
        clearTimeout(timer);
      } catch (err: any) {
        console.error("Error fetching departments:", err);
        setError(err.message || String(err));
      } finally {
        if (active) {
          setLoadingDepts(false);
        }
      }
    }
    fetchDepartments();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Fetch Students and their attendance when selectedClass or selectedSemester changes
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setStudentAttendance({});
      return;
    }

    let unsubscribes: (() => void)[] = [];

    async function fetchClassData() {
      try {
        setLoadingStudents(true);
        setLoadingAttendance(true);

        // Fetch students in class
        const studentsRef = collection(db, "colleges", "students", "all_students");
        const q = query(studentsRef, where("class", "==", selectedClass));
        const snapshot = await getDocs(q);

        const studentsList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "Unknown",
            email: data.email || "",
            class: data.class || "",
            department: data.department || "",
            mentor_id: data.mentor_id || "",
          } as Student;
        });

        // Sort students alphabetically
        studentsList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(studentsList);

        // Setup real-time listeners for each student's attendance document for the current semester
        setStudentAttendance({});
        
        unsubscribes = studentsList.map((student) => {
          const semDocRef = doc(
            db,
            "colleges",
            "students",
            "all_students",
            student.id,
            "attendance",
            selectedSemester
          );
          
          return onSnapshot(semDocRef, (docSnap) => {
            setStudentAttendance((prev) => {
              const updated = { ...prev };
              if (docSnap.exists()) {
                updated[student.id] = docSnap.data() as AttendanceRecord;
              } else {
                updated[student.id] = { P: 0, A: 0, OD: 0 };
              }
              return updated;
            });
          }, (err) => {
            console.error(`Error listening to attendance for ${student.id}:`, err);
          });
        });

      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoadingStudents(false);
        setLoadingAttendance(false);
      }
    }

    fetchClassData();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [selectedClass, selectedSemester]);

  // Filter students based on search term
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm) ||
      student.id.toLowerCase().includes(searchTerm)
  );

  // Calculate high-level statistics for the class
  const calculateStats = () => {
    if (students.length === 0) return { avgPresent: 0, totalStudents: 0, attendanceWarningCount: 0 };
    let totalPresentPctSum = 0;
    let warningCount = 0;
    students.forEach((s) => {
      const att = studentAttendance[s.id];
      const p = att?.P ?? 0;
      totalPresentPctSum += p;
      if (p < 75) warningCount++;
    });
    return {
      avgPresent: Math.round(totalPresentPctSum / students.length),
      totalStudents: students.length,
      attendanceWarningCount: warningCount,
    };
  };

  const stats = calculateStats();

  // Helper to get attendance summary for a specific date
  const getAttendanceSummaryForDate = (studentId: string, dateStr: string) => {
    const record = studentAttendance[studentId];
    if (!record) return null;
    const dailyData = record[dateStr];
    if (!dailyData || typeof dailyData !== "object") return null;

    const summaryList: { hour: number; subject: string; status: string }[] = [];
    Object.keys(dailyData).forEach((hourIdx) => {
      const hourEntry = dailyData[hourIdx];
      if (typeof hourEntry === "object" && hourEntry !== null) {
        Object.keys(hourEntry).forEach((subject) => {
          summaryList.push({
            hour: parseInt(hourIdx) + 1,
            subject,
            status: hourEntry[subject],
          });
        });
      }
    });

    // Sort by hour
    summaryList.sort((a, b) => a.hour - b.hour);
    return summaryList;
  };

  // Helper to extract clean attendance logs for a selected student
  const getDetailedStudentLogs = (studentId: string) => {
    const record = studentAttendance[studentId];
    if (!record) return [];

    const logs: { date: string; hour: string; subject: string; status: string }[] = [];
    Object.keys(record).forEach((key) => {
      // Skip percentage metrics
      if (key === "P" || key === "A" || key === "OD") return;

      const dailyData = record[key];
      if (typeof dailyData === "object" && dailyData !== null) {
        Object.keys(dailyData).forEach((hourIdx) => {
          const hourEntry = dailyData[hourIdx];
          if (typeof hourEntry === "object" && hourEntry !== null) {
            Object.keys(hourEntry).forEach((subject) => {
              logs.push({
                date: key,
                hour: (parseInt(hourIdx) + 1).toString(),
                subject,
                status: hourEntry[subject],
              });
            });
          }
        });
      }
    });

    // Sort logs by date (newest first) and then hour
    return logs.sort((a, b) => {
      const [d1, m1, y1] = a.date.split("-").map(Number);
      const [d2, m2, y2] = b.date.split("-").map(Number);
      const dateA = new Date(y1, m1 - 1, d1);
      const dateB = new Date(y2, m2 - 1, d2);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return parseInt(b.hour) - parseInt(a.hour);
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* SIDEBAR: Departments & Classes */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="bg-orange-500 p-2 rounded-xl text-white shadow-md shadow-orange-500/10">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
              PRESENZA
            </h1>
            <p className="text-xs text-slate-400 font-bold">ADMIN PORTAL</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 mb-3">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                DEPARTMENTS
              </span>
              <Layers className="h-3.5 w-3.5 text-slate-400" />
            </div>

            {error ? (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl font-medium">
                Error: {error}
              </div>
            ) : loadingDepts ? (
              <div className="space-y-2 p-2">
                {showAdblockWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-100 text-amber-700 text-xs rounded-xl font-medium mb-2 leading-relaxed">
                    ⚠️ Connection is hanging. If you use uBlock, AdBlock, or Brave, please disable it for localhost:3000 to allow Firebase connections.
                  </div>
                )}
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {departments.map((dept) => {
                  const isSelected = selectedDept?.id === dept.id;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => {
                        setSelectedDept(dept);
                        if (dept.classes && dept.classes.length > 0) {
                          setSelectedClass(dept.classes[0]);
                        } else {
                          setSelectedClass("");
                        }
                        setSelectedStudent(null);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left border ${
                        isSelected
                          ? "bg-gradient-to-r from-orange-50 to-orange-100/30 border-orange-200 text-orange-600 shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-sm truncate">{dept.name}</div>
                        <div className="text-xs opacity-75 font-semibold mt-0.5">{dept.id}</div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isSelected ? "rotate-90 text-orange-500" : "opacity-40"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Classes Section */}
          {selectedDept && (
            <div>
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  CLASSES ({selectedDept.classes?.length || 0})
                </span>
                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedDept.classes && selectedDept.classes.length > 0 ? (
                  selectedDept.classes.map((cls) => {
                    const isSelected = selectedClass === cls;
                    return (
                      <button
                        key={cls}
                        onClick={() => {
                          setSelectedClass(cls);
                          setSelectedStudent(null);
                        }}
                        className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                          isSelected
                            ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/10 font-bold"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-sm">{cls}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                    No classes available.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2 bg-white border border-slate-200/60 rounded-xl shadow-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500 font-semibold">Database Synced</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-extrabold text-slate-800">
              {selectedClass ? `${selectedDept?.name} — ${selectedClass}` : "Select Department & Class"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Date Selector */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-1 px-2.5 gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={(() => {
                  const parts = selectedDate.split("-");
                  if (parts.length === 3) {
                    return `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }
                  return "";
                })()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const parts = val.split("-");
                    if (parts.length === 3) {
                      setSelectedDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none cursor-pointer focus:ring-0"
              />
            </div>

            {/* Semester Filter */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-1">
              <span className="text-xs font-bold px-3 text-slate-450">SEM</span>
              <div className="flex gap-0.5">
                {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                  <button
                    key={sem}
                    onClick={() => {
                      setSelectedSemester(sem);
                      setSelectedStudent(null);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedSemester === sem
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
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
                <div className="p-4 bg-blue-550/10 text-blue-500 rounded-xl border border-blue-100 bg-blue-50">
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

          {/* Main Grid: Student List & Detailed View */}
          {selectedClass ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              {/* Students List Card */}
              <div className="xl:col-span-2 bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="text-xs text-slate-400 font-bold">
                    Showing {filteredStudents.length} of {students.length} students
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
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50/50">
                          <th className="p-4 pl-6">ID</th>
                          <th className="p-4">Name</th>
                          <th className="p-4">Attendance ({selectedDate})</th>
                          <th className="p-4 pr-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((student) => {
                          return (
                            <tr
                              key={student.id}
                              className={`group hover:bg-slate-50/40 transition-colors ${
                                selectedStudent?.id === student.id ? "bg-orange-50/20" : ""
                              }`}
                            >
                              <td className="p-4 pl-6 font-mono text-xs font-semibold text-slate-500">
                                {student.id}
                              </td>
                              <td className="p-4 font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                                {student.name}
                              </td>
                              <td className="p-4 text-center">
                                {(() => {
                                  const dailyLogs = getAttendanceSummaryForDate(student.id, selectedDate);
                                  return dailyLogs && dailyLogs.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 items-center justify-center">
                                      {dailyLogs.map((item, idx) => {
                                        const isP = item.status === "P";
                                        const isOD = item.status === "OD";
                                        return (
                                          <span
                                            key={idx}
                                            title={`Hour ${item.hour}: ${item.subject} (${item.status})`}
                                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-black cursor-help ${
                                              isP
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                                                : isOD
                                                ? "bg-blue-50 text-blue-700 border border-blue-250"
                                                : "bg-rose-50 text-rose-700 border border-rose-250"
                                            }`}
                                          >
                                            {item.status}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-semibold italic">No data</span>
                                  );
                                })()}
                              </td>
                              <td className="p-4 pr-6 text-right">
                                <button
                                  onClick={() => setSelectedStudent(student)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-650 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detailed View Panel */}
              <div className="xl:col-span-1">
                {selectedStudent ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            STUDENT PROFILE
                          </span>
                          <h4 className="text-lg font-bold text-slate-800 mt-1">
                            {selectedStudent.name}
                          </h4>
                          <p className="text-xs text-slate-455 font-mono mt-0.5 font-semibold">
                            ID: {selectedStudent.id}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedStudent(null)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Micro stats */}
                      <div className="grid grid-cols-3 gap-2 mt-6">
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                          <span className="text-xs text-slate-400 font-bold block">PRES</span>
                          <span className="text-sm font-bold text-emerald-600">
                            {Math.round(studentAttendance[selectedStudent.id]?.P ?? 0)}%
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                          <span className="text-xs text-slate-400 font-bold block">ABS</span>
                          <span className="text-sm font-bold text-rose-600">
                            {Math.round(studentAttendance[selectedStudent.id]?.A ?? 0)}%
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                          <span className="text-xs text-slate-400 font-bold block">O-D</span>
                          <span className="text-sm font-bold text-blue-600">
                            {Math.round(studentAttendance[selectedStudent.id]?.OD ?? 0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline List */}
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          ATTENDANCE LOG (SEM {selectedSemester})
                        </span>
                      </div>

                      <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                        {getDetailedStudentLogs(selectedStudent.id).length === 0 ? (
                          <div className="text-center py-12 text-xs text-slate-450 font-medium">
                            No attendance logs stored for this semester.
                          </div>
                        ) : (
                          getDetailedStudentLogs(selectedStudent.id).map((log, index) => {
                            const isPresent = log.status === "P";
                            const isOD = log.status === "OD";

                            return (
                              <div
                                key={index}
                                className="bg-slate-55 border border-slate-100/60 p-3.5 rounded-xl flex items-center justify-between shadow-sm bg-slate-50"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">
                                    {log.subject}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-semibold">
                                    <Calendar className="h-3 w-3 text-slate-400" />
                                    <span>{log.date}</span>
                                    <span>•</span>
                                    <span>Hour {log.hour}</span>
                                  </div>
                                </div>
                                <div>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                                      isPresent
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                        : isOD
                                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                                        : "bg-rose-50 text-rose-600 border border-rose-100"
                                    }`}
                                  >
                                    {log.status === "P" ? "Present" : log.status === "OD" ? "On-Duty" : "Absent"}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 border-dashed p-12 rounded-2xl text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="bg-slate-50 p-4 rounded-full mb-4 border border-slate-100">
                      <Sparkles className="h-8 w-8 text-orange-400" />
                    </div>
                    <h5 className="font-bold text-sm text-slate-500">No Student Selected</h5>
                    <p className="text-xs text-slate-400 max-w-[200px] mt-2 leading-relaxed">
                      Click the &quot;History&quot; button next to any student to load their full attendance log.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 border-dashed p-24 rounded-2xl text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
              <div className="bg-slate-50 p-5 rounded-full mb-4 border border-slate-100">
                <Info className="h-10 w-10 text-slate-450" />
              </div>
              <h5 className="font-bold text-base text-slate-500">Welcome to Admin Portal</h5>
              <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
                Select a department and class from the left sidebar to view active student enrollments and records.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

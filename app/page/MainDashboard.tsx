"use client";

import { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  DocumentData,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  Info,
  Download,
  X
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
  const [currentView, setCurrentView] = useState<"students" | "faculty">("students");
  const [studentSubView, setStudentSubView] = useState<"list" | "attendance" | "timetable">("list");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Auth states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // All Students list (loaded globally for list view)
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState<boolean>(false);

  // Faculty states
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState<boolean>(false);
  const [facultyId, setFacultyId] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [facultyPassword, setFacultyPassword] = useState("");
  const [facultyClassesInput, setFacultyClassesInput] = useState(""); // Comma separated list of classes
  const [editingFacultyDeptId, setEditingFacultyDeptId] = useState("");
  const [addingFaculty, setAddingFaculty] = useState(false);

  // Editing state variables
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);

  // Timetable states
  const [timetableGrid, setTimetableGrid] = useState<Record<string, string[]>>({
    Monday: Array(7).fill(""),
    Tuesday: Array(7).fill(""),
    Wednesday: Array(7).fill(""),
    Thursday: Array(7).fill(""),
    Friday: Array(7).fill("")
  });
  const [courseMappings, setCourseMappings] = useState<Array<{ abbreviation: string; name: string; facultyId: string; facultyName: string }>>([]);
  const [uploadingTimetable, setUploadingTimetable] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceRecord>>({});

  // Filters & Controls
  const [selectedSemester, setSelectedSemester] = useState<string>("I");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "daily">("overview");
  const [sortField, setSortField] = useState<"name" | "id" | "present" | "absent" | "od">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "id" | "present" | "absent" | "od") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortIndicator = (field: "name" | "id" | "present" | "absent" | "od") => {
    if (sortField !== field) {
      return <span className="ml-1 text-slate-350 group-hover:text-slate-500 text-[10px] transition-colors">⇅</span>;
    }
    return sortOrder === "asc" ? (
      <span className="ml-1 text-orange-500 text-[10px]">▲</span>
    ) : (
      <span className="ml-1 text-orange-500 text-[10px]">▼</span>
    );
  };
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
          // Auto-expand all departments so classes are visible immediately
          setExpandedDepts(new Set(deptsData.map(d => d.id)));
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

  // Fetch all students globally
  const fetchAllStudents = async () => {
    try {
      setLoadingAllStudents(true);
      const studentsRef = collection(db, "colleges", "students", "all_students");
      const snapshot = await getDocs(studentsRef);
      const list = snapshot.docs.map((docSnap) => {
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
      list.sort((a, b) => a.name.localeCompare(b.name));
      setAllStudents(list);
    } catch (err) {
      console.error("Error fetching all students:", err);
    } finally {
      setLoadingAllStudents(false);
    }
  };

  // Fetch all faculties globally
  const fetchFaculties = async () => {
    try {
      setLoadingFaculties(true);
      const facRef = collection(db, "colleges", "faculties", "all_faculties");
      const snapshot = await getDocs(facRef);
      const facList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setFaculties(facList);
    } catch (err) {
      console.error("Error fetching faculties:", err);
    } finally {
      setLoadingFaculties(false);
    }
  };

  // Fetch data on login status
  useEffect(() => {
    const logged = localStorage.getItem("adminLoggedIn");
    if (logged === "true") {
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchAllStudents();
      fetchFaculties();
    }
  }, [isLoggedIn]);

  // Student Edit Handler
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const studentDocRef = doc(db, "colleges", "students", "all_students", editingStudent.id);
      await updateDoc(studentDocRef, {
        name: editingStudent.name,
        email: editingStudent.email,
        class: editingStudent.class,
        department: editingStudent.department,
        mentor_id: editingStudent.mentor_id || "",
      });
      alert("Student updated successfully!");
      setEditingStudent(null);
      fetchAllStudents();
    } catch (err: any) {
      console.error("Error updating student:", err);
      alert("Failed to update student: " + err.message);
    }
  };

  // Faculty Edit Handler
  const handleUpdateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    try {
      const facDocRef = doc(db, "colleges", "faculties", "all_faculties", editingFaculty.id);
      await updateDoc(facDocRef, {
        name: editingFaculty.name,
        email: editingFaculty.email,
        department: editingFaculty.department,
        classes: editingFaculty.classes,
        password: editingFaculty.password || "faculty123",
      });
      alert("Faculty updated successfully!");
      setEditingFaculty(null);
      fetchFaculties();
    } catch (err: any) {
      console.error("Error updating faculty:", err);
      alert("Failed to update faculty: " + err.message);
    }
  };

  // Fetch timetable URL for selected class & semester
  const fetchTimetable = async () => {
    const emptyGrid: Record<string, string[]> = {
      Monday: Array(7).fill(""),
      Tuesday: Array(7).fill(""),
      Wednesday: Array(7).fill(""),
      Thursday: Array(7).fill(""),
      Friday: Array(7).fill("")
    };
    if (!selectedDept || !selectedClass || !selectedSemester) {
      setTimetableGrid(emptyGrid);
      setCourseMappings([]);
      return;
    }
    try {
      const classDocRef = doc(
        db,
        "colleges",
        "departments",
        "all_departments",
        selectedDept.id,
        "clasees",
        selectedClass
      );
      const docSnap = await getDoc(classDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const timetables = data.timetables || {};
        const savedGrid = timetables[selectedSemester];
        if (savedGrid && typeof savedGrid === "object") {
          const merged: Record<string, string[]> = { ...emptyGrid };
          Object.keys(savedGrid).forEach(day => {
            if (Array.isArray((savedGrid as any)[day])) {
              const periods = [...(savedGrid as any)[day]];
              while (periods.length < 7) periods.push("");
              merged[day] = periods.slice(0, 7);
            }
          });
          setTimetableGrid(merged);
        } else {
          setTimetableGrid(emptyGrid);
        }
        
        const mappings = data.courseMapping || {};
        setCourseMappings(mappings[selectedSemester] || []);
      } else {
        setTimetableGrid(emptyGrid);
        setCourseMappings([]);
      }
    } catch (err) {
      console.error("Error fetching timetable:", err);
      setTimetableGrid(emptyGrid);
      setCourseMappings([]);
    }
  };

  useEffect(() => {
    if (currentView === "timetable" || currentView === "attendance") {
      fetchTimetable();
    }
  }, [selectedDept, selectedClass, selectedSemester, currentView]);

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDeptId = editingFacultyDeptId || (selectedDept?.id || "");
    if (!facultyId || !facultyName || !facultyEmail || !targetDeptId) {
      alert("Please fill in all required fields (ID, Name, Email, Department).");
      return;
    }
    try {
      setAddingFaculty(true);
      const docRef = doc(db, "colleges", "faculties", "all_faculties", facultyId);
      
      const classesArr = facultyClassesInput
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const facultyData = {
        id: facultyId,
        name: facultyName,
        email: facultyEmail,
        department: targetDeptId,
        password: facultyPassword || "faculty123",
        classes: classesArr,
        mentees: []
      };

      await setDoc(docRef, facultyData);
      alert("Faculty member added successfully!");
      
      setFacultyId("");
      setFacultyName("");
      setFacultyEmail("");
      setFacultyPassword("");
      setFacultyClassesInput("");
      setEditingFacultyDeptId("");
      
      fetchFaculties();
    } catch (err: any) {
      console.error("Error adding faculty:", err);
      alert("Error adding faculty: " + err.message);
    } finally {
      setAddingFaculty(false);
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    if (!confirm("Are you sure you want to delete this faculty member?")) return;
    try {
      const docRef = doc(db, "colleges", "faculties", "all_faculties", id);
      await deleteDoc(docRef);
      alert("Faculty member deleted.");
      fetchFaculties();
    } catch (err: any) {
      console.error("Error deleting faculty:", err);
      alert("Error deleting faculty: " + err.message);
    }
  };

  const handleSaveTimetable = async () => {
    if (!selectedDept || !selectedClass || !selectedSemester) {
      alert("Please select Department, Class, and Semester first.");
      return;
    }
    try {
      setUploadingTimetable(true);
      const classDocRef = doc(
        db,
        "colleges",
        "departments",
        "all_departments",
        selectedDept.id,
        "clasees",
        selectedClass
      );
      
      const docSnap = await getDoc(classDocRef);
      let existingTimetables: Record<string, any> = {};
      let existingMappings: Record<string, any> = {};
      if (docSnap.exists()) {
        const classData = docSnap.data();
        existingTimetables = classData.timetables || {};
        existingMappings = classData.courseMapping || {};
      }
      
      const updatedTimetables = {
        ...existingTimetables,
        [selectedSemester]: timetableGrid
      };
      const updatedMappings = {
        ...existingMappings,
        [selectedSemester]: courseMappings
      };
      
      await setDoc(classDocRef, {
        timetables: updatedTimetables,
        courseMapping: updatedMappings
      }, { merge: true });
      
      alert("Timetable and course mappings saved successfully!");
    } catch (err: any) {
      console.error("Error saving timetable:", err);
      alert("Error saving timetable: " + err.message);
    } finally {
      setUploadingTimetable(false);
    }
  };

  const handleClearTimetable = async () => {
    if (!selectedDept || !selectedClass || !selectedSemester) {
      alert("Please select Department, Class, and Semester first.");
      return;
    }
    if (!confirm("Are you sure you want to clear the timetable and course mappings for this class and semester?")) return;
    const emptyGrid = {
      Monday: Array(7).fill(""),
      Tuesday: Array(7).fill(""),
      Wednesday: Array(7).fill(""),
      Thursday: Array(7).fill(""),
      Friday: Array(7).fill("")
    };
    try {
      setUploadingTimetable(true);
      const classDocRef = doc(
        db,
        "colleges",
        "departments",
        "all_departments",
        selectedDept.id,
        "clasees",
        selectedClass
      );
      
      const docSnap = await getDoc(classDocRef);
      let existingTimetables: Record<string, any> = {};
      let existingMappings: Record<string, any> = {};
      if (docSnap.exists()) {
        const classData = docSnap.data();
        existingTimetables = classData.timetables || {};
        existingMappings = classData.courseMapping || {};
      }
      
      const updatedTimetables = { ...existingTimetables };
      delete updatedTimetables[selectedSemester];
      const updatedMappings = { ...existingMappings };
      delete updatedMappings[selectedSemester];
      
      await setDoc(classDocRef, {
        timetables: updatedTimetables,
        courseMapping: updatedMappings
      }, { merge: true });
      
      setTimetableGrid(emptyGrid);
      setCourseMappings([]);
      alert("Timetable and mappings cleared successfully!");
    } catch (err: any) {
      console.error("Error clearing timetable:", err);
      alert("Error clearing timetable: " + err.message);
    } finally {
      setUploadingTimetable(false);
    }
  };

  const handleCellChange = (day: string, idx: number, value: string) => {
    setTimetableGrid(prev => {
      const updated = { ...prev };
      const updatedRow = [...(updated[day] || Array(7).fill(""))];
      updatedRow[idx] = value;
      updated[day] = updatedRow;
      return updated;
    });
  };

  // Filter students based on search term
  // Filter and sort students based on search term and sort selection
  const filteredStudents = students
    .filter(
      (student) =>
        student.name.toLowerCase().includes(searchTerm) ||
        student.id.toLowerCase().includes(searchTerm)
    )
    .sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === "id") {
        valA = a.id.toLowerCase();
        valB = b.id.toLowerCase();
      } else if (sortField === "present") {
        valA = studentAttendance[a.id]?.P ?? 0;
        valB = studentAttendance[b.id]?.P ?? 0;
      } else if (sortField === "absent") {
        valA = studentAttendance[a.id]?.A ?? 0;
        valB = studentAttendance[b.id]?.A ?? 0;
      } else if (sortField === "od") {
        valA = studentAttendance[a.id]?.OD ?? 0;
        valB = studentAttendance[b.id]?.OD ?? 0;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });

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

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    if (activeTab === "overview") {
      // Columns: ID, Name, Present %, OD %, Absent %
      worksheet.columns = [
        { header: "ID", key: "id", width: 18 },
        { header: "Name", key: "name", width: 35 },
        { header: "Present %", key: "present", width: 15 },
        { header: "OD %", key: "od", width: 15 },
        { header: "Absent %", key: "absent", width: 15 },
      ];

      // Format headers
      worksheet.getRow(1).font = { name: "Calibri", family: 4, size: 11, bold: true };
      worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" }, // #f1f5f9
      };

      filteredStudents.forEach((student) => {
        const p = Math.round(studentAttendance[student.id]?.P ?? 0);
        const a = Math.round(studentAttendance[student.id]?.A ?? 0);
        const od = Math.round(studentAttendance[student.id]?.OD ?? 0);

        const row = worksheet.addRow({
          id: student.id,
          name: student.name,
          present: `${p}%`,
          od: `${od}%`,
          absent: `${a}%`,
        });

        row.getCell("id").numFmt = "@"; // format as text
        row.getCell("id").alignment = { horizontal: "left" };
        row.getCell("name").alignment = { horizontal: "left" };
        row.getCell("present").alignment = { horizontal: "center" };
        row.getCell("od").alignment = { horizontal: "center" };
        row.getCell("absent").alignment = { horizontal: "center" };
      });

      const fileName = `Attendance_Overview_${selectedClass}_SEM_${selectedSemester}.xlsx`;
      await downloadWorkbook(workbook, fileName);
    } else {
      // Columns: ID, Name, 1st Hour to 7th Hour
      worksheet.columns = [
        { header: "ID", key: "id", width: 18 },
        { header: "Name", key: "name", width: 35 },
        { header: "1st Hour", key: "h1", width: 12 },
        { header: "2nd Hour", key: "h2", width: 12 },
        { header: "3rd Hour", key: "h3", width: 12 },
        { header: "4th Hour", key: "h4", width: 12 },
        { header: "5th Hour", key: "h5", width: 12 },
        { header: "6th Hour", key: "h6", width: 12 },
        { header: "7th Hour", key: "h7", width: 12 },
      ];

      // Format headers
      worksheet.getRow(1).font = { name: "Calibri", family: 4, size: 11, bold: true };
      worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" }, // #f1f5f9
      };

      filteredStudents.forEach((student) => {
        const dailyLogs = getAttendanceSummaryForDate(student.id, selectedDate) || [];
        
        // Map 1st to 7th hour
        const hourlyStatus = Array(7).fill("-");
        dailyLogs.forEach((item) => {
          if (item.hour >= 1 && item.hour <= 7) {
            hourlyStatus[item.hour - 1] = item.status;
          }
        });

        const row = worksheet.addRow({
          id: student.id,
          name: student.name,
          h1: hourlyStatus[0],
          h2: hourlyStatus[1],
          h3: hourlyStatus[2],
          h4: hourlyStatus[3],
          h5: hourlyStatus[4],
          h6: hourlyStatus[5],
          h7: hourlyStatus[6],
        });

        row.getCell("id").numFmt = "@"; // format as text
        row.getCell("id").alignment = { horizontal: "left" };
        row.getCell("name").alignment = { horizontal: "left" };

        const hourKeys = ["h1", "h2", "h3", "h4", "h5", "h6", "h7"];
        hourKeys.forEach((key) => {
          const cell = row.getCell(key);
          cell.alignment = { horizontal: "center" };
          const val = cell.value;
          if (val === "P") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFD1FAE5" }, // soft green
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF065F46" }, bold: true };
          } else if (val === "A") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEE2E2" }, // soft red
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF991B1B" }, bold: true };
          } else if (val === "OD") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFDBEAFE" }, // soft blue
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF1E40AF" }, bold: true };
          }
        });
      });

      const fileName = `Attendance_Daily_${selectedClass}_${selectedDate}.xlsx`;
      await downloadWorkbook(workbook, fileName);
    }
  };

  const downloadWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === "admin" && loginPassword === "admin123") {
      setIsLoggedIn(true);
      localStorage.setItem("adminLoggedIn", "true");
    } else {
      alert("Invalid credentials. Try admin / admin123.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("adminLoggedIn");
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-orange-500 p-3 rounded-2xl text-white shadow-lg shadow-orange-500/20">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="font-extrabold text-2xl tracking-tight text-slate-800">
              PRESENZA ADMIN
            </h1>
            <p className="text-sm text-slate-400 font-semibold">Sign in to manage students &amp; faculty</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Username</label>
              <input
                type="text"
                placeholder="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-500/10 cursor-pointer text-center"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredAllStudents = allStudents.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.id.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.class.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      (s.mentor_id || "").toLowerCase().includes(term)
    );
  });

  const filteredAllFaculty = faculties.filter((f) => {
    const term = searchTerm.toLowerCase();
    return (
      (f.id || "").toLowerCase().includes(term) ||
      (f.name || "").toLowerCase().includes(term) ||
      (f.email || "").toLowerCase().includes(term) ||
      (f.department || "").toLowerCase().includes(term) ||
      (f.classes || []).some((c: string) => c.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* SIDEBAR: Navigation Menu */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shadow-sm h-screen sticky top-0">
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

        {/* Dept + Class Tree */}
        <div className="flex-1 overflow-y-auto">
          {/* Section Label */}
          <div className="px-4 pt-4 pb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Departments</span>
          </div>

          {loadingDepts ? (
            <div className="px-4 py-3 flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-400" />
              Loading...
            </div>
          ) : departments.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic">No departments found.</div>
          ) : (
            <div className="px-2 pb-2 space-y-0.5">
              {departments.map((dept) => {
                const isOpen = expandedDepts.has(dept.id);
                const isActiveDept = selectedDept?.id === dept.id;
                return (
                  <div key={dept.id}>
                    {/* Dept row */}
                    <button
                      onClick={() => {
                        setExpandedDepts(prev => {
                          const next = new Set(prev);
                          if (next.has(dept.id)) next.delete(dept.id);
                          else next.add(dept.id);
                          return next;
                        });
                        setSelectedDept(dept);
                        if (dept.classes && dept.classes.length > 0) {
                          setSelectedClass(dept.classes[0]);
                        } else {
                          setSelectedClass("");
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActiveDept
                          ? "bg-orange-50 text-orange-600 border border-orange-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{dept.name}</span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-90 text-orange-500" : "text-slate-400"
                        }`}
                      />
                    </button>

                    {/* Class list (collapsible) */}
                    {isOpen && (
                      <div className="ml-3 mt-0.5 mb-1 border-l-2 border-slate-100 pl-2 space-y-0.5">
                        {dept.classes && dept.classes.length > 0 ? (
                          dept.classes.map((cls) => {
                            const isActiveClass = selectedClass === cls && isActiveDept;
                            return (
                              <button
                                key={cls}
                                onClick={() => {
                                  setSelectedDept(dept);
                                  setSelectedClass(cls);
                                  setSelectedStudent(null);
                                  setCurrentView("students");
                                  setStudentSubView("attendance");
                                }}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                  isActiveClass
                                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                                    : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                  isActiveClass ? "bg-white" : "bg-slate-300"
                                }`} />
                                {cls}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-1.5 text-[11px] text-slate-400 italic">No classes</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-slate-100" />

          {/* Section Label */}
          <div className="px-4 pb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Manage</span>
          </div>

          {/* Students & Faculty nav */}
          <div className="px-2 pb-2 space-y-0.5">
            <button
              onClick={() => {
                setCurrentView("students");
                setStudentSubView("list");
                setSearchTerm("");
                setEditingStudent(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                currentView === "students"
                  ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/10"
                  : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Students</span>
            </button>

            <button
              onClick={() => {
                setCurrentView("faculty");
                setSearchTerm("");
                setEditingFaculty(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                currentView === "faculty"
                  ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/10"
                  : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Faculty</span>
            </button>
          </div>
        </div>

        {/* Sticky Logout Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl text-rose-600 text-sm font-bold transition-all cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-extrabold text-slate-800">
              {currentView === "students" && (
                studentSubView === "list" ? "Student Profiles & Editor" :
                studentSubView === "attendance" ? `Attendance Viewer — ${selectedClass || ""}` :
                `Timetable Grid Editor — ${selectedClass || ""}`
              )}
              {currentView === "faculty" && "Faculty Management"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Class/Dept filters inline for Attendance and Timetable sub-views */}
            {currentView === "students" && studentSubView !== "list" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDept?.id || ""}
                  onChange={(e) => {
                    const dept = departments.find(d => d.id === e.target.value);
                    if (dept) {
                      setSelectedDept(dept);
                      if (dept.classes && dept.classes.length > 0) {
                        setSelectedClass(dept.classes[0]);
                      } else {
                        setSelectedClass("");
                      }
                      setSelectedStudent(null);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                {selectedDept && (
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setSelectedStudent(null);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    {selectedDept.classes?.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {currentView === "students" && studentSubView === "attendance" && (
              /* Date Selector */
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
            )}

            {currentView === "students" && studentSubView !== "list" && (
              /* Semester Filter */
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
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Sub-view navigation for students */}
          {currentView === "students" && (
            <div className="flex border-b border-slate-200 gap-4 mb-4 select-none">
              <button
                onClick={() => {
                  setStudentSubView("list");
                  setSearchTerm("");
                }}
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                  studentSubView === "list"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-550 hover:text-slate-850"
                }`}
              >
                Student Profiles & Editor
              </button>
              <button
                onClick={() => {
                  setStudentSubView("attendance");
                  setSearchTerm("");
                }}
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                  studentSubView === "attendance"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-550 hover:text-slate-850"
                }`}
              >
                Class Attendance Sheet
              </button>
              <button
                onClick={() => {
                  setStudentSubView("timetable");
                  setSearchTerm("");
                }}
                className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                  studentSubView === "timetable"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-550 hover:text-slate-855"
                }`}
              >
                Class Timetable Editor
              </button>
            </div>
          )}

          {/* Students -> Sub-view list */}
          {currentView === "students" && studentSubView === "list" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-205 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">
                  Total Records: {filteredAllStudents.length}
                </div>
              </div>

              {/* Students Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                        <th className="p-4 pl-6">Student ID</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Class</th>
                        <th className="p-4">Mentor ID</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-600">
                      {loadingAllStudents ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 font-bold">Loading student profiles...</td>
                        </tr>
                      ) : filteredAllStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 font-bold">No students found.</td>
                        </tr>
                      ) : (
                        filteredAllStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 pl-6 font-mono text-xs text-slate-800">{student.id}</td>
                            <td className="p-4 text-slate-800 font-bold">{student.name}</td>
                            <td className="p-4 text-slate-500 font-medium">{student.email}</td>
                            <td className="p-4">{student.department}</td>
                            <td className="p-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-650 rounded-lg text-xs font-bold">{student.class}</span></td>
                            <td className="p-4 font-mono text-xs">{student.mentor_id || "-"}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => setEditingStudent(student)}
                                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Students -> Sub-view attendance */}
          {currentView === "students" && studentSubView === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
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
                                    <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-600 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400">
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
                                    <button onClick={() => setSelectedStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-600 hover:shadow-sm text-xs font-bold rounded-lg transition-all border border-slate-200/80 hover:border-orange-400">
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
          )}

          {currentView === "timetable" && (
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
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
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/20 p-4">
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
                <div className="border border-slate-200 rounded-xl bg-slate-50/20 p-6 space-y-4 mt-6">
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
                        <div key={index} className="flex gap-4 items-center bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                          <div className="w-1/4">
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

                          <div className="w-1/3">
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
                            className="p-2 mt-4 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-rose-500 transition-all cursor-pointer"
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
          )}
        </div>
      </main>

      {/* Overlay Student Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  STUDENT PROFILE
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  {selectedStudent.name}
                </h4>
                <p className="text-xs text-slate-450 font-mono mt-0.5 font-semibold">
                  ID: {selectedStudent.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Metrics */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-100 p-4 rounded-xl text-center shadow-xs">
                  <span className="text-xs text-slate-400 font-bold block mb-1">PRESENT</span>
                  <span className="text-lg font-black text-emerald-600">
                    {Math.round(studentAttendance[selectedStudent.id]?.P ?? 0)}%
                  </span>
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-xl text-center shadow-xs">
                  <span className="text-xs text-slate-400 font-bold block mb-1">ABSENT</span>
                  <span className="text-lg font-black text-rose-600">
                    {Math.round(studentAttendance[selectedStudent.id]?.A ?? 0)}%
                  </span>
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-xl text-center shadow-xs">
                  <span className="text-xs text-slate-400 font-bold block mb-1">ON-DUTY</span>
                  <span className="text-lg font-black text-blue-600">
                    {Math.round(studentAttendance[selectedStudent.id]?.OD ?? 0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  ATTENDANCE LOG (SEM {selectedSemester})
                </span>
              </div>

              <div className="space-y-3">
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
                        className="bg-slate-50 border border-slate-100/60 p-3.5 rounded-xl flex items-center justify-between shadow-xs bg-slate-50"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {log.subject}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-455 mt-1 font-semibold">
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
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Login from "./Login";
import News from "./News";
import DepartmentWise from "./DepartmentWise";
import Sidebar from "../components/Sidebar";
import AttendanceSheetView from "../components/AttendanceSheetView";
import TimetableEditorView from "../components/TimetableEditorView";
import EventsView from "../components/EventsView";
import TimetableGeneratorView from "../components/TimetableGeneratorView";
import ExcelJS from "exceljs";
import { db, storage, auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
  addDoc,
  writeBatch,
  deleteField,
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
  X,
  Filter,
  LogOut,
  AlertTriangle,
  Newspaper,
  Trash2,
  Menu,
  PanelLeftClose,
  Edit
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
  semester?: string;
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
  const [currentView, setCurrentView] = useState<"students" | "faculty" | "news" | "department-wise" | "events" | "timetable">("students");
  const [studentSubView, setStudentSubView] = useState<"list" | "attendance" | "timetable">("list");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [fromDeptFaculty, setFromDeptFaculty] = useState<boolean>(false);



  // Auth states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

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
  const [facultyRole, setFacultyRole] = useState<"faculty" | "hod">("faculty");
  const [addingFaculty, setAddingFaculty] = useState(false);

  // Editing state variables
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [originalStudentId, setOriginalStudentId] = useState<string>("");
  const [savingStudent, setSavingStudent] = useState<boolean>(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [popupConfig, setPopupConfig] = useState<{ type: "success" | "error" | "warning"; title: string; message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showPopup = (type: "success" | "error" | "warning", title: string, message: string) => {
    setPopupConfig({ type, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
  };

  // Adding student states
  const [isAddingStudent, setIsAddingStudent] = useState<boolean>(false);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    id: "",
    name: "",
    email: "",
    class: "",
    department: "",
    mentor_id: "",
    semester: "I"
  });
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const [tempDept, setTempDept] = useState<Department | null>(null);
  const [tempClass, setTempClass] = useState<string>("");
  const [filterDept, setFilterDept] = useState<Department | null>(null);
  const [filterClass, setFilterClass] = useState<string>("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Add Dept & Class state variables
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptId, setNewDeptId] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [savingDept, setSavingDept] = useState(false);
  const [isDeptEditorOpen, setIsDeptEditorOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState("");
  const [newDeptNameInput, setNewDeptNameInput] = useState("");

  const [isAddingClass, setIsAddingClass] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [isClassEditorOpen, setIsClassEditorOpen] = useState(false);
  const [newClassNameInput, setNewClassNameInput] = useState("");

  // Timetable states
  const [timetableGrid, setTimetableGrid] = useState<Record<string, string[]>>({
    Monday: Array(7).fill(""),
    Tuesday: Array(7).fill(""),
    Wednesday: Array(7).fill(""),
    Thursday: Array(7).fill(""),
    Friday: Array(7).fill("")
  });
  const [courseMappings, setCourseMappings] = useState<Array<{ abbreviation: string; name: string; facultyId: string; facultyName: string; isElective?: boolean; name2?: string; facultyId2?: string; facultyName2?: string }>>([]);
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
      <span className="ml-1 text-orange-600 text-[10px]">▲</span>
    ) : (
      <span className="ml-1 text-orange-600 text-[10px]">▼</span>
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

  // Fetch Departments once authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      setLoadingDepts(false);
      return;
    }

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
  }, [isLoggedIn]);



  const [classCurrentSemester, setClassCurrentSemester] = useState<string>("I");
  const [newClassSemesterInput, setNewClassSemesterInput] = useState<string>("I");
  const [classSemesterDates, setClassSemesterDates] = useState<Record<string, { startDate?: string; endDate?: string }>>({});
  const [classSemesterStartDateInput, setClassSemesterStartDateInput] = useState<string>("");
  const [classSemesterEndDateInput, setClassSemesterEndDateInput] = useState<string>("");
  const [isEndingSemester, setIsEndingSemester] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedClass || !selectedDept) return;
    const deptId = selectedDept.id;

    async function fetchClassMetadata() {
      try {
        const classDocRef = doc(
          db,
          "colleges",
          "departments",
          "all_departments",
          deptId,
          "classes",
          selectedClass
        );
        const docSnap = await getDoc(classDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentSem = data.currentSemester || "I";
          const semDates = data.semesterDates || {};
          setClassCurrentSemester(currentSem);
          setSelectedSemester(currentSem);
          setClassSemesterDates(semDates);
          if (semDates[currentSem]) {
            setClassSemesterStartDateInput(semDates[currentSem].startDate || "");
            setClassSemesterEndDateInput(semDates[currentSem].endDate || "");
          } else {
            setClassSemesterStartDateInput(data.semesterStartDate || "");
            setClassSemesterEndDateInput(data.semesterEndDate || "");
          }
        } else {
          setClassCurrentSemester("I");
          setSelectedSemester("I");
          setClassSemesterDates({});
          setClassSemesterStartDateInput("");
          setClassSemesterEndDateInput("");
        }
      } catch (err) {
        console.error("Error fetching class metadata:", err);
      }
    }

    fetchClassMetadata();
  }, [selectedClass, selectedDept?.id]);

  // Fetch Class Timetable & Course Mappings from Firestore when class or semester changes
  const fetchCurrentClassTimetable = async () => {
    if (!selectedClass || !selectedDept) {
      setTimetableGrid({
        Monday: Array(7).fill(""),
        Tuesday: Array(7).fill(""),
        Wednesday: Array(7).fill(""),
        Thursday: Array(7).fill(""),
        Friday: Array(7).fill("")
      });
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
        "classes",
        selectedClass
      );
      const docSnap = await getDoc(classDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const targetSem = selectedSemester || data.currentSemester || "I";
        const savedTimetable = data.timetables?.[targetSem] || {
          Monday: Array(7).fill(""),
          Tuesday: Array(7).fill(""),
          Wednesday: Array(7).fill(""),
          Thursday: Array(7).fill(""),
          Friday: Array(7).fill("")
        };
        const savedMappings = data.courseMapping?.[targetSem] || [];
        setTimetableGrid(savedTimetable);
        setCourseMappings(savedMappings);
      } else {
        setTimetableGrid({
          Monday: Array(7).fill(""),
          Tuesday: Array(7).fill(""),
          Wednesday: Array(7).fill(""),
          Thursday: Array(7).fill(""),
          Friday: Array(7).fill("")
        });
        setCourseMappings([]);
      }
    } catch (err) {
      console.error("Error loading class timetable:", err);
    }
  };

  useEffect(() => {
    fetchCurrentClassTimetable();
  }, [selectedClass, selectedDept?.id, selectedSemester]);

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
            semester: data.semester || "I",
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
            student.semester || selectedSemester
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

  const handleSemesterChange = async (newSemester: string) => {
    if (!selectedClass) {
      setSelectedSemester(newSemester);
      return;
    }
    try {
      setLoadingStudents(true);
      const studentsRef = collection(db, "colleges", "students", "all_students");
      const q = query(studentsRef, where("class", "==", selectedClass));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { semester: newSemester });
        });
        await batch.commit();
      }

      // Update the global state after Firestore updates are committed
      setSelectedSemester(newSemester);
      
      // Re-fetch all students to sync global state
      await fetchAllStudents();

      showPopup("success", "Semester Updated", `All students in class ${selectedClass} set to Semester ${newSemester}`);
    } catch (err: any) {
      console.error("Error setting semester for class students:", err);
      showPopup("error", "Error", "Failed to update students' semester: " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

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
          semester: data.semester || "I",
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

  // Create Department Handler
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptId || !newDeptName) return;
    setSavingDept(true);
    try {
      const deptIdClean = newDeptId.trim().toUpperCase();
      const deptDocRef = doc(db, "colleges", "departments", "all_departments", deptIdClean);
      await setDoc(deptDocRef, {
        name: newDeptName.trim(),
        classes: []
      });
      
      const newD: Department = { id: deptIdClean, name: newDeptName.trim(), classes: [] };
      setDepartments(prev => [...prev, newD]);
      
      setIsAddingDept(false);
      setNewDeptId("");
      setNewDeptName("");
      showPopup("success", "Success", "Department created successfully!");
    } catch (err: any) {
      console.error(err);
      showPopup("error", "Error", "Error creating department: " + err.message);
    } finally {
      setSavingDept(false);
    }
  };

  // Create Class Handler
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId || !newClassName) return;
    setSavingClass(true);
    try {
      const dept = departments.find(d => d.id === targetDeptId);
      if (!dept) throw new Error("Department not found");

      const classNameClean = newClassName.trim();
      const updatedClasses = [...(dept.classes || [])];
      if (updatedClasses.includes(classNameClean)) {
        showPopup("warning", "Warning", "Class already exists in this department!");
        setSavingClass(false);
        return;
      }
      updatedClasses.push(classNameClean);

      // 1. Update the classes array in the department document
      const deptDocRef = doc(db, "colleges", "departments", "all_departments", targetDeptId);
      await updateDoc(deptDocRef, {
        classes: updatedClasses
      });

      // 2. Create the class document in the 'classes' subcollection
      const classDocRef = doc(
        db,
        "colleges",
        "departments",
        "all_departments",
        targetDeptId,
        "classes",
        classNameClean
      );
      await setDoc(classDocRef, {
        timetables: {}
      });

      setDepartments(prev => prev.map(d => {
        if (d.id === targetDeptId) {
          return { ...d, classes: updatedClasses };
        }
        return d;
      }));

      setIsAddingClass(false);
      setNewClassName("");
      setTargetDeptId("");
      showPopup("success", "Success", "Class created successfully!");
    } catch (err: any) {
      console.error(err);
      showPopup("error", "Error", "Error creating class: " + err.message);
    } finally {
      setSavingClass(false);
    }
  };

  const handleDeleteDept = async (deptId: string) => {
    showConfirm(
      "Delete Department",
      "Are you sure you want to delete this department? All its classes will also be deleted.",
      async () => {
        try {
          setIsDeptEditorOpen(false);
          const deptDocRef = doc(db, "colleges", "departments", "all_departments", deptId);
          await deleteDoc(deptDocRef);
          
          setDepartments(prev => prev.filter(d => d.id !== deptId));
          if (selectedDept?.id === deptId) {
            setSelectedDept(null);
            setSelectedClass("");
          }
          showPopup("success", "Success", "Department deleted successfully!");
        } catch (err: any) {
          console.error("Error deleting department:", err);
          showPopup("error", "Error", "Failed to delete department: " + err.message);
        }
      }
    );
  };

  const handleRenameDept = async (deptId: string, newDeptName: string) => {
    if (!newDeptName.trim()) {
      showPopup("warning", "Warning", "Department name cannot be empty.");
      return;
    }
    
    try {
      setSavingDept(true);
      const deptDocRef = doc(db, "colleges", "departments", "all_departments", deptId);
      await updateDoc(deptDocRef, { name: newDeptName.trim() });
      
      setDepartments(prev => prev.map(d => {
        if (d.id === deptId) {
          return { ...d, name: newDeptName.trim() };
        }
        return d;
      }));

      if (selectedDept?.id === deptId) {
        setSelectedDept(prev => prev ? { ...prev, name: newDeptName.trim() } : null);
      }

      showPopup("success", "Success", "Department renamed successfully!");
      setIsDeptEditorOpen(false);
    } catch (err: any) {
      console.error("Error renaming department:", err);
      showPopup("error", "Error", "Failed to rename department: " + err.message);
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteClass = async (deptId: string, className: string) => {
    showConfirm(
      "Delete Class",
      "Are you sure you want to delete this class?",
      async () => {
        try {
          setIsClassEditorOpen(false);
          // 1. Remove from department's classes array
          const dept = departments.find(d => d.id === deptId);
          if (dept) {
            const updatedClasses = (dept.classes || []).filter(c => c !== className);
            const deptDocRef = doc(db, "colleges", "departments", "all_departments", deptId);
            await updateDoc(deptDocRef, { classes: updatedClasses });
            
            setDepartments(prev => prev.map(d => {
              if (d.id === deptId) {
                return { ...d, classes: updatedClasses };
              }
              return d;
            }));
          }

          // 2. Delete class document
          const classDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "classes", className);
          await deleteDoc(classDocRef);
          
          if (selectedClass === className && selectedDept?.id === deptId) {
            setSelectedClass("");
          }
          showPopup("success", "Success", "Class deleted successfully!");
        } catch (err: any) {
          console.error("Error deleting class:", err);
          showPopup("error", "Error", "Failed to delete class: " + err.message);
        }
      }
    );
  };

  const handleSaveClassSettings = async (
    deptId: string,
    oldClassName: string,
    newClassName: string,
    newSemester: string,
    startDate?: string,
    endDate?: string
  ) => {
    if (!newClassName.trim()) {
      showPopup("warning", "Warning", "Class name cannot be empty.");
      return;
    }

    try {
      setSavingClass(true);
      const isNameChanged = oldClassName !== newClassName;
      const isSemesterChanged = classCurrentSemester !== newSemester;
      const existingSemDates = classSemesterDates[newSemester] || {};
      const isDatesChanged =
        (startDate !== undefined && startDate !== (existingSemDates.startDate || "")) ||
        (endDate !== undefined && endDate !== (existingSemDates.endDate || ""));

      if (!isNameChanged && !isSemesterChanged && !isDatesChanged) {
        setIsClassEditorOpen(false);
        return;
      }

      // Check if new name already exists
      const dept = departments.find(d => d.id === deptId);
      if (isNameChanged && dept && (dept.classes || []).includes(newClassName)) {
        showPopup("warning", "Warning", `A class named ${newClassName} already exists in this department.`);
        setSavingClass(false);
        return;
      }

      // 1. Update the classes array in the department document (if name changed)
      if (isNameChanged && dept) {
        const updatedClasses = (dept.classes || []).map(c => c === oldClassName ? newClassName : c);
        const deptDocRef = doc(db, "colleges", "departments", "all_departments", deptId);
        await updateDoc(deptDocRef, { classes: updatedClasses });
        
        setDepartments(prev => prev.map(d => {
          if (d.id === deptId) {
            return { ...d, classes: updatedClasses };
          }
          return d;
        }));
      }

      // 2. Update/Create the class document in 'classes' subcollection
      const oldClassDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "classes", oldClassName);
      const newClassDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "classes", newClassName);
      
      const oldClassSnap = await getDoc(oldClassDocRef);
      const classData = oldClassSnap.exists() ? oldClassSnap.data() : {};
      
      const updatedSemesterDates = {
        ...(classData.semesterDates || {}),
        [newSemester]: {
          startDate: startDate || "",
          endDate: endDate || ""
        }
      };

      const updatedClassData = {
        ...classData,
        currentSemester: newSemester,
        semesterStartDate: startDate || "",
        semesterEndDate: endDate || "",
        semesterDates: updatedSemesterDates
      };

      if (isNameChanged) {
        await setDoc(newClassDocRef, updatedClassData);
        await deleteDoc(oldClassDocRef);
      } else {
        await setDoc(oldClassDocRef, updatedClassData);
      }

      // 3. Update all students in this class
      const studentsRef = collection(db, "colleges", "students", "all_students");
      const studentsQuery = query(studentsRef, where("class", "==", oldClassName));
      const studentsSnap = await getDocs(studentsQuery);
      
      if (!studentsSnap.empty) {
        const batch = writeBatch(db);
        studentsSnap.docs.forEach((docSnap) => {
          const updateFields: any = {};
          if (isNameChanged) updateFields.class = newClassName;
          if (isSemesterChanged) updateFields.semester = newSemester;
          batch.update(docSnap.ref, updateFields);
        });
        await batch.commit();
      }

      // 4. Update all faculties assigned to this class (if name changed)
      if (isNameChanged) {
        const facultiesRef = collection(db, "colleges", "faculties", "all_faculties");
        const facultiesSnap = await getDocs(facultiesRef);
        const facultyBatch = writeBatch(db);
        let facultyNeedsCommit = false;

        facultiesSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const assignedClasses = data.classes || [];
          if (assignedClasses.includes(oldClassName)) {
            const updatedClasses = assignedClasses.map((c: string) => c === oldClassName ? newClassName : c);
            facultyBatch.update(docSnap.ref, { classes: updatedClasses });
            facultyNeedsCommit = true;
          }
        });

        if (facultyNeedsCommit) {
          await facultyBatch.commit();
        }
      }

      // 5. Update local states
      setClassCurrentSemester(newSemester);
      setSelectedSemester(newSemester);
      setClassSemesterDates(updatedSemesterDates);
      
      if (isNameChanged && selectedClass === oldClassName && selectedDept?.id === deptId) {
        setSelectedClass(newClassName);
      }
      
      await fetchAllStudents();
      await fetchFaculties();
      setIsClassEditorOpen(false);

      showPopup("success", "Success", "Class settings and semester dates updated successfully!");
    } catch (err: any) {
      console.error("Error updating class settings:", err);
      showPopup("error", "Error", "Failed to update class settings: " + err.message);
    } finally {
      setSavingClass(false);
    }
  };

  // Listen to Firebase Auth state and verify admin role
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Force-refresh the token to get the latest custom claims
          const tokenResult = await user.getIdTokenResult(true);
          const isAdminClaim = tokenResult.claims.admin === true || tokenResult.claims.role === "admin";
          const isAdminEmail = user.email?.toLowerCase() === "admin@presenza.app";

          if (isAdminClaim || isAdminEmail) {
            setIsLoggedIn(true);
            setAuthError(null);
          } else {
            // Authenticated but NOT an admin — deny access
            await signOut(auth);
            setIsLoggedIn(false);
            setAuthError("Access denied. This account does not have admin privileges.");
          }
        } catch (err) {
          console.error("Error verifying admin claims:", err);
          await signOut(auth);
          setIsLoggedIn(false);
          setAuthError("Authentication verification failed. Please try again.");
        }
      } else {
        setIsLoggedIn(false);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
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
      setSavingStudent(true);
      const isIdChanged = editingStudent.id !== originalStudentId;

      if (isIdChanged) {
        // Check if student with new ID already exists
        const newStudentDocRef = doc(db, "colleges", "students", "all_students", editingStudent.id);
        const newStudentSnap = await getDoc(newStudentDocRef);
        if (newStudentSnap.exists()) {
          alert(`A student with ID ${editingStudent.id} already exists!`);
          setSavingStudent(false);
          return;
        }

        // Create new student document
        await setDoc(newStudentDocRef, {
          name: editingStudent.name,
          email: editingStudent.email,
          class: editingStudent.class,
          department: editingStudent.department,
          mentor_id: editingStudent.mentor_id || "",
          semester: editingStudent.semester || "I",
        });

        // Copy attendance subcollection
        const oldAttendanceRef = collection(db, "colleges", "students", "all_students", originalStudentId, "attendance");
        const attendanceSnap = await getDocs(oldAttendanceRef);
        for (const docSnap of attendanceSnap.docs) {
          const newAttDocRef = doc(db, "colleges", "students", "all_students", editingStudent.id, "attendance", docSnap.id);
          await setDoc(newAttDocRef, docSnap.data());
          // delete old attendance doc
          await deleteDoc(docSnap.ref);
        }

        // Delete old student document
        const oldStudentDocRef = doc(db, "colleges", "students", "all_students", originalStudentId);
        await deleteDoc(oldStudentDocRef);
      } else {
        // Just update existing document fields
        const studentDocRef = doc(db, "colleges", "students", "all_students", editingStudent.id);
        await updateDoc(studentDocRef, {
          name: editingStudent.name,
          email: editingStudent.email,
          class: editingStudent.class,
          department: editingStudent.department,
          mentor_id: editingStudent.mentor_id || "",
          semester: editingStudent.semester || "I",
        });
      }

      showPopup("success", "Success", "Student profile updated successfully!");
      setEditingStudent(null);
      fetchAllStudents();
    } catch (err: any) {
      console.error("Error updating student:", err);
      showPopup("error", "Error", "Failed to update student: " + err.message);
    } finally {
      setSavingStudent(false);
    }
  };

  const handleResetDeviceFaceId = async () => {
    if (!editingStudent) return;
    if (!window.confirm("Are you sure you want to reset device ID and face embeddings for this student?")) return;
    try {
      setSavingStudent(true);
      const studentDocRef = doc(db, "colleges", "students", "all_students", editingStudent.id);
      await updateDoc(studentDocRef, {
        deviceId: deleteField(),
        faceEmbeddings: deleteField(),
      });
      showPopup("success", "Success", "Device ID and Face Embeddings reset successfully!");
      setEditingStudent(null);
      fetchAllStudents();
    } catch (err: any) {
      console.error("Error resetting device/face ID:", err);
      showPopup("error", "Error", "Failed to reset: " + err.message);
    } finally {
      setSavingStudent(false);
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidDocId = (id: string) => /^[a-zA-Z0-9_-]{2,50}$/.test(id);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (newStudent.id || "").trim();
    const cleanName = (newStudent.name || "").trim();
    const cleanEmail = (newStudent.email || "").trim();
    const cleanDept = (newStudent.department || "").trim();
    const cleanClass = (newStudent.class || "").trim();

    if (!cleanId || !cleanName || !cleanEmail || !cleanDept || !cleanClass) {
      showPopup("warning", "Warning", "Please fill in all required fields.");
      return;
    }

    if (!isValidDocId(cleanId)) {
      showPopup("warning", "Warning", "Student ID must only contain letters, numbers, hyphens, or underscores (2-50 characters).");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      showPopup("warning", "Warning", "Please enter a valid email address.");
      return;
    }

    try {
      setSavingStudent(true);
      const studentDocRef = doc(db, "colleges", "students", "all_students", cleanId);
      const studentSnap = await getDoc(studentDocRef);
      if (studentSnap.exists()) {
        showPopup("warning", "Warning", `A student with ID ${cleanId} already exists!`);
        setSavingStudent(false);
        return;
      }

      await setDoc(studentDocRef, {
        name: cleanName,
        email: cleanEmail,
        class: cleanClass,
        department: cleanDept,
        mentor_id: (newStudent.mentor_id || "").trim(),
        semester: newStudent.semester || selectedSemester || "I",
      });

      showPopup("success", "Success", "Student added successfully!");
      setIsAddingStudent(false);
      setNewStudent({
        id: "",
        name: "",
        email: "",
        class: "",
        department: "",
        mentor_id: "",
        semester: "I"
      });
      fetchAllStudents();
    } catch (err: any) {
      console.error("Error creating student:", err);
      showPopup("error", "Error", "Failed to add student: " + err.message);
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    showConfirm(
      "Delete Student",
      "Are you sure you want to delete this student profile?",
      async () => {
        try {
          const studentDocRef = doc(db, "colleges", "students", "all_students", id);
          await deleteDoc(studentDocRef);

          const attendanceRef = collection(db, "colleges", "students", "all_students", id, "attendance");
          const attendanceSnap = await getDocs(attendanceRef);
          for (const docSnap of attendanceSnap.docs) {
            await deleteDoc(docSnap.ref);
          }

          showPopup("success", "Success", "Student profile deleted successfully.");
          fetchAllStudents();
        } catch (err: any) {
          console.error("Error deleting student:", err);
          showPopup("error", "Error", "Failed to delete student: " + err.message);
        }
      }
    );
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
        role: editingFaculty.role || "faculty",
      });
      showPopup("success", "Success", "Faculty updated successfully!");
      setEditingFaculty(null);
      fetchFaculties();
    } catch (err: any) {
      console.error("Error updating faculty:", err);
      showPopup("error", "Error", "Failed to update faculty: " + err.message);
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
        "classes",
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
    if (currentView === "students" && (studentSubView === "timetable" || studentSubView === "attendance")) {
      fetchTimetable();
    }
  }, [selectedDept, selectedClass, selectedSemester, currentView, studentSubView]);

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFacultyId = facultyId.trim();
    const cleanFacultyName = facultyName.trim();
    const cleanFacultyEmail = facultyEmail.trim();
    const targetDeptId = (editingFacultyDeptId || (selectedDept?.id || "")).trim();

    if (!cleanFacultyId || !cleanFacultyName || !cleanFacultyEmail || !targetDeptId) {
      showPopup("warning", "Warning", "Please fill in all required fields (ID, Name, Email, Department).");
      return;
    }

    if (!isValidDocId(cleanFacultyId)) {
      showPopup("warning", "Warning", "Faculty ID must only contain letters, numbers, hyphens, or underscores (2-50 characters).");
      return;
    }

    if (!isValidEmail(cleanFacultyEmail)) {
      showPopup("warning", "Warning", "Please enter a valid email address.");
      return;
    }

    try {
      setAddingFaculty(true);
      const docRef = doc(db, "colleges", "faculties", "all_faculties", cleanFacultyId);
      
      const classesArr = facultyClassesInput
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const facultyData = {
        id: cleanFacultyId,
        name: cleanFacultyName,
        email: cleanFacultyEmail,
        department: targetDeptId,
        classes: classesArr,
        role: facultyRole,
        mentees: []
      };

      await setDoc(docRef, facultyData);
      showPopup("success", "Success", "Faculty member added successfully!");
      
      setFacultyId("");
      setFacultyName("");
      setFacultyEmail("");
      setFacultyPassword("");
      setFacultyClassesInput("");
      setFacultyRole("faculty");
      setEditingFacultyDeptId("");
      
      fetchFaculties();
    } catch (err: any) {
      console.error("Error adding faculty:", err);
      showPopup("error", "Error", "Error adding faculty: " + err.message);
    } finally {
      setAddingFaculty(false);
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    showConfirm(
      "Delete Faculty",
      "Are you sure you want to delete this faculty member?",
      async () => {
        try {
          const docRef = doc(db, "colleges", "faculties", "all_faculties", id);
          await deleteDoc(docRef);
          showPopup("success", "Success", "Faculty member deleted.");
          fetchFaculties();
        } catch (err: any) {
          console.error("Error deleting faculty:", err);
          showPopup("error", "Error", "Error deleting faculty: " + err.message);
        }
      }
    );
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
        "classes",
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
        "classes",
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

  const handleDownloadExcel = async (options?: { isRange?: boolean; fromDate?: string; toDate?: string }) => {
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

      worksheet.spliceRows(1, 0, 
        ["Department", selectedDept?.name || "-"],
        ["Class", selectedClass || "-"],
        ["Semester", selectedSemester || "-"],
        ["Date", options?.isRange ? `${options.fromDate} to ${options.toDate}` : selectedDate],
        []
      );

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

      worksheet.spliceRows(1, 0, 
        ["Department", selectedDept?.name || "-"],
        ["Class", selectedClass || "-"],
        ["Semester", selectedSemester || "-"],
        ["Date", options?.isRange ? `${options.fromDate} to ${options.toDate}` : selectedDate],
        []
      );

      const fileName = `Attendance_Daily_${selectedClass}_${options?.isRange ? 'Range' : selectedDate}.xlsx`;
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

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Signout error:", err);
    }
    setIsLoggedIn(false);
    localStorage.removeItem("adminLoggedIn");
  };



  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div>
        <Login onLoginSuccess={handleLoginSuccess} />
        {authError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 border border-rose-100 mb-4">
                <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-slate-800">Access Denied</h3>
              <p className="text-xs text-slate-500 font-semibold mt-2">{authError}</p>
              <button
                onClick={() => setAuthError(null)}
                className="mt-5 w-full py-2 bg-orange-600 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredAllStudents = allStudents.filter((s) => {
    const term = searchTerm.toLowerCase();
    if (filterDept && s.department !== filterDept.id) {
      return false;
    }
    if (filterClass && s.class !== filterClass) {
      return false;
    }
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
    if (filterDept && f.department !== filterDept.id) {
      return false;
    }
    if (filterClass && !((f.classes || []) as string[]).includes(filterClass)) {
      return false;
    }
    return (
      (f.id || "").toLowerCase().includes(term) ||
      (f.name || "").toLowerCase().includes(term) ||
      (f.email || "").toLowerCase().includes(term) ||
      (f.department || "").toLowerCase().includes(term) ||
      (f.classes || []).some((c: string) => c.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR: Navigation Menu */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        departments={departments}
        loadingDepts={loadingDepts}
        expandedDepts={expandedDepts}
        setExpandedDepts={setExpandedDepts}
        selectedDept={selectedDept}
        setSelectedDept={setSelectedDept}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        currentView={currentView}
        setCurrentView={setCurrentView}
        studentSubView={studentSubView}
        setStudentSubView={setStudentSubView}
        setFromDeptFaculty={setFromDeptFaculty}
        setIsDeptEditorOpen={setIsDeptEditorOpen}
        setEditingDeptId={setEditingDeptId}
        setNewDeptNameInput={setNewDeptNameInput}
        setIsAddingDept={setIsAddingDept}
        setTargetDeptId={setTargetDeptId}
        setIsAddingClass={setIsAddingClass}
        setEditingStudent={setEditingStudent}
        setSearchTerm={setSearchTerm}
        setEditingFaculty={setEditingFaculty}
        setFilterDept={setFilterDept}
        setFilterClass={setFilterClass}
        setShowLogoutConfirm={setShowLogoutConfirm}
        fromDeptFaculty={fromDeptFaculty}
      />

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header - Hidden in Timetable view since TimetableGeneratorView has its own dedicated navigation header */}
        {currentView !== "timetable" && (
          <header className="h-16 border-b border-slate-200/80 flex items-center justify-between px-4 lg:px-8 bg-white z-10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger Menu for Mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-base font-semibold text-slate-900 truncate tracking-tight">
                  {currentView === "students" && (
                    studentSubView === "list" ? "Student Directory" :
                    studentSubView === "attendance" ? `Class Attendance · ${selectedClass || ""}` :
                    `Class Timetable · ${selectedClass || ""}`
                  )}
                  {currentView === "faculty" && "Faculty Management Directory"}
                  {currentView === "news" && "Campus Bulletins & Announcements"}
                  {currentView === "department-wise" && "Department Overview & Attendance"}
                </h1>
                <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                  Academic Operations Management Portal
                </p>
              </div>
            </div>

            {/* <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
                Live Data Synchronized
              </span>
            </div> */}
          </header>
        )}

        {/* Dashboard Content */}
        <div className={`flex-1 overflow-y-auto ${currentView === "timetable" ? "p-2 sm:p-4 pt-2 sm:pt-3" : "p-4 lg:p-8 space-y-5"}`}>
          {/* Students -> Sub-view list */}
          {currentView === "students" && studentSubView === "list" && (
            <div className="space-y-4 animate-fade-in">
              {/* Search & Filter Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 items-stretch sm:items-center justify-between bg-white border border-slate-200/80 p-4 sm:p-5 rounded-xl shadow-2xs">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search students by name, ID, class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-xs font-normal outline-none focus:border-slate-800 transition-colors placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (!showFilterPopover) {
                          setTempDept(filterDept);
                          setTempClass(filterClass);
                        }
                        setShowFilterPopover(!showFilterPopover);
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        filterDept || filterClass
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                      title="Filter by Department & Class"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>{filterDept || filterClass ? "Filters Active" : "Filter"}</span>
                    </button>

                    {showFilterPopover && (
                      <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-20 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-semibold text-slate-900">Filter Records</span>
                          {(filterDept || filterClass || tempDept || tempClass) && (
                            <button
                              onClick={() => {
                                setTempDept(null);
                                setTempClass("");
                                setFilterDept(null);
                                setFilterClass("");
                                setShowFilterPopover(false);
                              }}
                              className="text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-500 uppercase">Department</label>
                          <select
                            value={tempDept?.id || ""}
                            onChange={(e) => {
                              const deptId = e.target.value;
                              const dept = departments.find(d => d.id === deptId);
                              setTempDept(dept || null);
                              setTempClass("");
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none focus:border-slate-800 cursor-pointer"
                          >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-slate-500 uppercase">Class</label>
                          <select
                            value={tempClass}
                            onChange={(e) => setTempClass(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none focus:border-slate-800 cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                            disabled={!tempDept}
                          >
                            <option value="">All Classes</option>
                            {tempDept?.classes?.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterDept(tempDept);
                              setFilterClass(tempClass);
                              setShowFilterPopover(false);
                            }}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer text-center"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsAddingStudent(true);
                      const defaultDept = departments.length > 0 ? departments[0] : null;
                      const defaultClass = defaultDept?.classes && defaultDept.classes.length > 0 ? defaultDept.classes[0] : "";
                      setNewStudent({
                        id: "",
                        name: "",
                        email: "",
                        class: defaultClass,
                        department: defaultDept?.id || "",
                        mentor_id: "",
                        semester: classCurrentSemester || "I"
                      });
                    }}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + Add Student
                  </button>
                  <div className="text-xs font-medium text-slate-400 shrink-0 hidden sm:block">
                    Total: {filteredAllStudents.length}
                  </div>
                </div>
              </div>

              {/* Students - Mobile Card View */}
              <div className="md:hidden space-y-2.5">
                {loadingAllStudents ? (
                  <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-slate-400 text-xs font-medium">Loading student directory...</div>
                ) : filteredAllStudents.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-slate-400 text-xs font-medium">No students match current search or filters.</div>
                ) : (
                  filteredAllStudents.map((student) => (
                    <div key={student.id} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 truncate">{student.name}</h4>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{student.id}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium shrink-0">{student.class}</span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 w-12 shrink-0 text-[11px]">Email</span>
                          <span className="truncate">{student.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 w-12 shrink-0 text-[11px]">Dept</span>
                          <span>{student.department}</span>
                        </div>
                        {student.mentor_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 w-12 shrink-0 text-[11px]">Mentor</span>
                            <span className="font-mono text-xs">{student.mentor_id}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setOriginalStudentId(student.id);
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer text-center"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex-1 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-md text-xs font-medium transition-colors cursor-pointer text-center"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Students - Desktop Table View */}
              <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-wider bg-slate-50/40">
                        <th className="px-5 py-3 pl-6">Student ID</th>
                        <th className="px-5 py-3">Student Name</th>
                        <th className="px-5 py-3">Email Address</th>
                        <th className="px-5 py-3">Department</th>
                        <th className="px-5 py-3">Class</th>
                        <th className="px-5 py-3">Mentor ID</th>
                        <th className="px-5 py-3 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {loadingAllStudents ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">Loading student directory...</td>
                        </tr>
                      ) : filteredAllStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">No students found.</td>
                        </tr>
                      ) : (
                        filteredAllStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3 pl-6 font-mono font-medium text-slate-600">{student.id}</td>
                            <td className="px-5 py-3 text-slate-900 font-medium">{student.name}</td>
                            <td className="px-5 py-3 text-slate-500">{student.email}</td>
                            <td className="px-5 py-3 text-slate-600">{student.department}</td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">{student.class}</span>
                            </td>
                            <td className="px-5 py-3 font-mono text-slate-500">{student.mentor_id || "—"}</td>
                            <td className="px-5 py-3 pr-6 text-right flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingStudent(student);
                                  setOriginalStudentId(student.id);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                              >
                                Delete
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
            <AttendanceSheetView
              selectedClass={selectedClass}
              loadingStudents={loadingStudents}
              stats={stats}
              loadingAttendance={loadingAttendance}
              handleDownloadExcel={handleDownloadExcel}
              filteredStudents={filteredStudents}
              students={students}
              studentAttendance={studentAttendance}
              selectedStudent={selectedStudent}
              setSelectedStudent={setSelectedStudent}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedDate={selectedDate}
              handleSort={handleSort}
              renderSortIndicator={renderSortIndicator}
              getAttendanceSummaryForDate={getAttendanceSummaryForDate}
              selectedSemester={selectedSemester}
              setSelectedSemester={setSelectedSemester}
              setEditingStudent={setEditingStudent}
              setOriginalStudentId={setOriginalStudentId}
              setSelectedDate={setSelectedDate}
              onViewFaculty={() => {
                setCurrentView("faculty");
                setFilterDept(selectedDept);
                setSearchTerm("");
                setFromDeptFaculty(true);
              }}
              onViewTimetable={() => setStudentSubView("timetable")}
              onEditClass={() => {
                setNewClassNameInput(selectedClass);
                setNewClassSemesterInput(classCurrentSemester);
                const currentDates = classSemesterDates[classCurrentSemester] || {};
                setClassSemesterStartDateInput(currentDates.startDate || "");
                setClassSemesterEndDateInput(currentDates.endDate || "");
                setIsEndingSemester(false);
                setIsClassEditorOpen(true);
              }}
            />
          )}

          {currentView === "students" && studentSubView === "timetable" && (
            <TimetableEditorView
              selectedClass={selectedClass}
              selectedSemester={selectedSemester}
              handleClearTimetable={handleClearTimetable}
              handleSaveTimetable={handleSaveTimetable}
              uploadingTimetable={uploadingTimetable}
              timetableGrid={timetableGrid}
              handleCellChange={handleCellChange}
              courseMappings={courseMappings}
              setCourseMappings={setCourseMappings}
              faculties={faculties}
            />
          )}

          {currentView === "faculty" && (
            <div className="space-y-4 lg:space-y-5 animate-fade-in">
              {/* Search & Add Faculty Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 items-stretch sm:items-center justify-between bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by faculty name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (!showFilterPopover) {
                          setTempDept(filterDept);
                          setTempClass(filterClass);
                        }
                        setShowFilterPopover(!showFilterPopover);
                      }}
                      className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        filterDept || filterClass
                          ? "bg-orange-50 border-orange-200 text-orange-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      title="Filter by Department & Class"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filter</span>
                      {(filterDept || filterClass) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                      )}
                    </button>

                    {showFilterPopover && (
                      <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-20 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <span className="text-xs font-bold text-slate-900">Filter Records</span>
                          {(filterDept || filterClass || tempDept || tempClass) && (
                            <button
                              onClick={() => {
                                setTempDept(null);
                                setTempClass("");
                                setFilterDept(null);
                                setFilterClass("");
                                setFromDeptFaculty(false);
                                setShowFilterPopover(false);
                              }}
                              className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                          <select
                            value={tempDept?.id || ""}
                            onChange={(e) => {
                              const deptId = e.target.value;
                              const dept = departments.find(d => d.id === deptId);
                              setTempDept(dept || null);
                              setTempClass("");
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium outline-none cursor-pointer focus:border-slate-900"
                          >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class</label>
                          <select
                            value={tempClass}
                            onChange={(e) => setTempClass(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium outline-none cursor-pointer focus:border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!tempDept}
                          >
                            <option value="">All Classes</option>
                            {tempDept?.classes?.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterDept(tempDept);
                              setFilterClass(tempClass);
                              setFromDeptFaculty(false);
                              setShowFilterPopover(false);
                            }}
                            className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setFacultyId("");
                      setFacultyName("");
                      setFacultyEmail("");
                      setFacultyPassword("");
                      setFacultyClassesInput("");
                      setEditingFacultyDeptId("");
                      setAddingFaculty(true);
                    }}
                    className="h-9 px-3.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <span>+ Add Faculty</span>
                  </button>
                  <div className="text-xs font-bold text-slate-400 tabular-nums uppercase shrink-0 hidden sm:block">
                    Total: {filteredAllFaculty.length}
                  </div>
                </div>
              </div>

              {/* Faculty - Mobile Card View */}
              <div className="md:hidden space-y-3">
                {loadingFaculties ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium text-xs">Loading faculty profiles...</div>
                ) : filteredAllFaculty.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium text-xs">No faculty members found.</div>
                ) : (
                  filteredAllFaculty.map((fac) => (
                    <div key={fac.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{fac.name}</h4>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">{fac.id}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">{fac.department}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${fac.role === "hod" ? "bg-slate-900 text-white" : "bg-orange-50 text-orange-700 border border-orange-200/60"}`}>
                            {fac.role || "faculty"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium w-14 shrink-0">Email</span>
                          <span className="font-medium truncate text-slate-800">{fac.email}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 font-medium w-14 shrink-0">Classes</span>
                          <div className="flex flex-wrap gap-1">
                            {(fac.classes || []).map((cls: string) => (
                              <span key={cls} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">{cls}</span>
                            ))}
                            {(fac.classes || []).length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setEditingFaculty(fac)}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFaculty(fac.id)}
                          className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Faculty - Desktop Table View */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4 pl-6">Faculty ID</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Assigned Classes</th>
                        <th className="py-3 px-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {loadingFaculties ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">Loading faculty profiles...</td>
                        </tr>
                      ) : filteredAllFaculty.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">No faculty members found.</td>
                        </tr>
                      ) : (
                        filteredAllFaculty.map((fac) => (
                          <tr key={fac.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 pl-6 font-mono text-slate-900 font-semibold">{fac.id}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{fac.name}</td>
                            <td className="py-3 px-4 text-slate-600 font-medium">{fac.email}</td>
                            <td className="py-3 px-4 font-semibold text-slate-700">{fac.department}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${fac.role === "hod" ? "bg-slate-900 text-white" : "bg-orange-50 text-orange-700 border border-orange-200/60"}`}>
                                {fac.role || "faculty"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {(fac.classes || []).map((cls: string) => (
                                  <span key={cls} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                                    {cls}
                                  </span>
                                ))}
                                {(fac.classes || []).length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                              </div>
                            </td>
                            <td className="py-3 px-4 pr-6 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingFaculty(fac)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteFaculty(fac.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 rounded-md text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
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

          {/* News View */}
          {currentView === "news" && (
            <News showPopup={showPopup} showConfirm={showConfirm} />
          )}

          {/* Events View */}
          {currentView === "events" && (
            <EventsView
              faculties={faculties}
              students={allStudents}
              showPopup={showPopup}
              showConfirm={showConfirm}
            />
          )}

          {/* Department Wise View */}
          {currentView === "department-wise" && (
            <DepartmentWise
              departmentId={selectedDept?.id || ""}
              departmentName={selectedDept?.name || ""}
              onBack={() => {
                setCurrentView("students");
                setStudentSubView("list");
                setSelectedDept(null);
              }}
              onViewFaculty={() => {
                setCurrentView("faculty");
                setFilterDept(selectedDept);
                setSearchTerm("");
                setFromDeptFaculty(true);
              }}
              onViewTimetable={() => {
                setCurrentView("timetable");
              }}
            />
          )}

          {/* Timetable Generator View (SchedulAI Engine) */}
          {currentView === "timetable" && (
            <TimetableGeneratorView
              selectedDept={selectedDept}
              departments={departments}
              faculties={faculties}
              onTimetablesUpdated={fetchCurrentClassTimetable}
              onBack={() => {
                if (selectedDept) {
                  setCurrentView("department-wise");
                } else {
                  setCurrentView("students");
                  setStudentSubView("list");
                }
              }}
            />
          )}
        </div>
      </main>

      {/* Overlay Student Profile Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Student Profile
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  {selectedStudent.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium">
                  ID: {selectedStudent.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Metrics */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 p-3.5 rounded-lg text-center shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Present</span>
                  <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {Math.round(studentAttendance[selectedStudent.id]?.P ?? 0)}%
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-lg text-center shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Absent</span>
                  <span className="text-lg sm:text-xl font-bold text-rose-600 tabular-nums">
                    {Math.round(studentAttendance[selectedStudent.id]?.A ?? 0)}%
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-lg text-center shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">On-Duty</span>
                  <span className="text-lg sm:text-xl font-bold text-orange-600 tabular-nums">
                    {Math.round(studentAttendance[selectedStudent.id]?.OD ?? 0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline List */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Attendance History (Semester {selectedSemester})
                </span>
              </div>

              <div className="space-y-2.5">
                {getDetailedStudentLogs(selectedStudent.id).length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-medium">
                    No attendance records logged for this semester.
                  </div>
                ) : (
                  getDetailedStudentLogs(selectedStudent.id).map((log, index) => {
                    const isPresent = log.status === "P";
                    const isOD = log.status === "OD";

                    return (
                      <div
                        key={index}
                        className="bg-white border border-slate-200 p-3.5 rounded-lg flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-slate-900">
                            {log.subject}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 font-medium">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{log.date}</span>
                            <span>•</span>
                            <span>Hour {log.hour}</span>
                          </div>
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              isPresent
                                ? "bg-slate-100 text-slate-800"
                                : isOD
                                ? "bg-orange-50 text-orange-700 border border-orange-200/60"
                                : "bg-rose-50 text-rose-700 border border-rose-200/60"
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

      {/* Department Editor Modal */}
      {isDeptEditorOpen && editingDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Department Settings
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  Department Editor
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Department ID: <span className="font-mono text-slate-700">{editingDeptId}</span>
                </p>
              </div>
              <button
                onClick={() => setIsDeptEditorOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Rename Section */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rename Department</label>
                <input
                  type="text"
                  value={newDeptNameInput}
                  onChange={(e) => setNewDeptNameInput(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleRenameDept(editingDeptId, newDeptNameInput)}
                  disabled={savingDept}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center disabled:opacity-50"
                >
                  {savingDept ? "Saving..." : "Save Department Name"}
                </button>
              </div>

              {/* Danger Zone Divider */}
              <div className="border-t border-slate-150 pt-4 mt-2">
                <h5 className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Danger Zone</h5>
                <p className="text-[11px] text-slate-500 mb-3 font-normal leading-relaxed">
                  Permanently delete this department. All classes and student timetables associated with it will also be deleted.
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteDept(editingDeptId)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center"
                >
                  Delete Department
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Editor Modal */}
      {isClassEditorOpen && selectedClass && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Class Settings
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  Class Editor
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Department: <span className="font-semibold text-slate-700">{selectedDept.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsClassEditorOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Rename Section */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rename Class</label>
                <input
                  type="text"
                  value={newClassNameInput}
                  onChange={(e) => setNewClassNameInput(e.target.value)}
                  placeholder="e.g. SEC25CJ013"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              {/* Semester Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Semester</label>
                <select
                  value={newClassSemesterInput}
                  onChange={(e) => {
                    const sem = e.target.value;
                    setNewClassSemesterInput(sem);
                    const dates = classSemesterDates[sem] || {};
                    setClassSemesterStartDateInput(dates.startDate || "");
                    setClassSemesterEndDateInput(dates.endDate || "");
                    setIsEndingSemester(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 cursor-pointer"
                >
                  {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              {/* Semester Lifecycle: Start Date & End Semester Flow */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Semester {newClassSemesterInput} Timeline
                  </span>
                  {classSemesterEndDateInput ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      Semester Ended
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                      Active Semester
                    </span>
                  )}
                </div>

                {/* 1. Start Date Input */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Semester Start Date <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={classSemesterStartDateInput}
                    onChange={(e) => setClassSemesterStartDateInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Starting date for Semester {newClassSemesterInput} attendance
                  </span>
                </div>

                {/* 2. End Date Section or "End the semester" button */}
                {classSemesterEndDateInput || isEndingSemester ? (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10.5px] font-bold text-rose-600 uppercase tracking-wider">
                        Semester End Date
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setClassSemesterEndDateInput("");
                          setIsEndingSemester(false);
                        }}
                        className="text-[10.5px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                      >
                        Clear / Keep Active
                      </button>
                    </div>
                    <input
                      type="date"
                      value={classSemesterEndDateInput}
                      onChange={(e) => setClassSemesterEndDateInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Attendance records will be finalized up to this date.
                    </span>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEndingSemester(true);
                        const todayStr = new Date().toISOString().split("T")[0];
                        setClassSemesterEndDateInput(todayStr);
                      }}
                      className="w-full py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200/80 hover:border-rose-300 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>End the semester</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleSaveClassSettings(
                      selectedDept.id,
                      selectedClass,
                      newClassNameInput,
                      newClassSemesterInput,
                      classSemesterStartDateInput,
                      classSemesterEndDateInput
                    )
                  }
                  disabled={savingClass}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center disabled:opacity-50 shadow-xs"
                >
                  {savingClass ? "Saving..." : "Save Class Settings"}
                </button>
              </div>

              {/* Danger Zone Divider */}
              <div className="border-t border-slate-150 pt-4 mt-2">
                <h5 className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Danger Zone</h5>
                <p className="text-[11px] text-slate-500 mb-3 font-normal leading-relaxed">
                  Permanently delete this class, its timetable settings, and all associated configurations. This action is irreversible.
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteClass(selectedDept.id, selectedClass)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center"
                >
                  Delete Class
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Edit Student Profile
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  {editingStudent.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium">
                  ID: {editingStudent.id}
                </p>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateStudent} className="p-5 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student ID / Roll No.</label>
                <input
                  type="text"
                  value={editingStudent.id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                  <select
                    value={editingStudent.department}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const deptObj = departments.find((d) => d.id === deptId);
                      const defaultClass = deptObj?.classes && deptObj.classes.length > 0 ? deptObj.classes[0] : "";
                      setEditingStudent({
                        ...editingStudent,
                        department: deptId,
                        class: defaultClass,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class</label>
                  <select
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                    required
                  >
                    {departments
                      .find((d) => d.id === editingStudent.department)
                      ?.classes?.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mentor ID</label>
                  <input
                    type="text"
                    value={editingStudent.mentor_id || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mentor_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    placeholder="e.g. FAC123"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Semester</label>
                  <select
                    value={editingStudent.semester || classCurrentSemester || "I"}
                    onChange={(e) => setEditingStudent({ ...editingStudent, semester: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-900 cursor-not-allowed opacity-75"
                    disabled
                  >
                    {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDeviceFaceId}
                  disabled={savingStudent}
                  className="px-3 py-2 border border-rose-200/80 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  Reset Face & Device ID
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    disabled={savingStudent}
                    className="flex-1 sm:flex-none px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStudent}
                    className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingStudent ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {isAddingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Add New Department
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  New Department Details
                </h4>
              </div>
              <button
                onClick={() => setIsAddingDept(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateDept} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Department Code/ID (e.g. CSE, ECE)
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    placeholder="e.g. CSE"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingDept(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingDept ? "Adding..." : "Add Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      {isAddingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Add New Class
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  New Class Details
                </h4>
              </div>
              <button
                onClick={() => setIsAddingClass(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateClass} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select Department
                  </label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Class Name/ID
                  </label>
                  <input
                    type="text"
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. CSE-A, CSE-B"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingClass(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClass}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingClass ? "Adding..." : "Add Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isAddingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Add New Student
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  New Student Profile
                </h4>
              </div>
              <button
                onClick={() => setIsAddingStudent(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateStudent} className="p-5 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student ID / Roll No. *</label>
                <input
                  type="text"
                  placeholder="e.g. 21CS001"
                  value={newStudent.id || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newStudent.name || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. john.doe@college.edu"
                  value={newStudent.email || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department *</label>
                  <select
                    value={newStudent.department || ""}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const deptObj = departments.find((d) => d.id === deptId);
                      const defaultClass = deptObj?.classes && deptObj.classes.length > 0 ? deptObj.classes[0] : "";
                      setNewStudent({
                        ...newStudent,
                        department: deptId,
                        class: defaultClass,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 cursor-pointer"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class *</label>
                  <select
                    value={newStudent.class || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 cursor-pointer"
                    required
                  >
                    {departments
                      .find((d) => d.id === newStudent.department)
                      ?.classes?.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mentor ID</label>
                  <input
                    type="text"
                    placeholder="e.g. FAC123"
                    value={newStudent.mentor_id || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, mentor_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Semester *</label>
                  <select
                    value={newStudent.semester || classCurrentSemester || "I"}
                    onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-900 cursor-not-allowed opacity-75"
                    disabled
                  >
                    {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  disabled={savingStudent}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingStudent ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {addingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Add New Faculty
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  New Faculty Profile
                </h4>
              </div>
              <button
                onClick={() => setAddingFaculty(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={async (e) => {
              await handleAddFaculty(e);
              setAddingFaculty(false);
            }} className="p-5 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Faculty ID *</label>
                <input
                  type="text"
                  placeholder="e.g. FAC001"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Smith"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. jane.smith@college.edu"
                  value={facultyEmail}
                  onChange={(e) => setFacultyEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role *</label>
                <select
                  value={facultyRole}
                  onChange={(e) => setFacultyRole(e.target.value as "faculty" | "hod")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                  required
                >
                  <option value="faculty">Faculty</option>
                  <option value="hod">Head of Department (HOD)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department *</label>
                  <select
                    value={editingFacultyDeptId}
                    onChange={(e) => setEditingFacultyDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                    required
                  >
                    <option value="">-- Select Dept --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Classes</label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-A, CSE-B"
                    value={facultyClassesInput}
                    onChange={(e) => setFacultyClassesInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Comma-separated list</p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddingFaculty(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Add Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Edit Faculty Profile
                </span>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  {editingFaculty.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium">
                  ID: {editingFaculty.id}
                </p>
              </div>
              <button
                onClick={() => setEditingFaculty(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateFaculty} className="p-5 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={editingFaculty.name}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={editingFaculty.email}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role *</label>
                <select
                  value={editingFaculty.role || "faculty"}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                  required
                >
                  <option value="faculty">Faculty</option>
                  <option value="hod">Head of Department (HOD)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Department *</label>
                  <select
                    value={editingFaculty.department}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Classes</label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-A, CSE-B"
                    value={Array.isArray(editingFaculty.classes) ? editingFaculty.classes.join(", ") : ""}
                    onChange={(e) => {
                      const arr = e.target.value.split(",").map(c => c.trim()).filter(c => c.length > 0);
                      setEditingFaculty({ ...editingFaculty, classes: arr });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Comma-separated list</p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Popup Modal */}
      {popupConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            {popupConfig.type === "success" && (
              <div className="mx-auto flex items-center justify-center h-11 w-11 rounded-full bg-slate-100 border border-slate-200 mb-3.5">
                <CheckCircle className="h-5 w-5 text-slate-900" />
              </div>
            )}
            {popupConfig.type === "error" && (
              <div className="mx-auto flex items-center justify-center h-11 w-11 rounded-full bg-rose-50 border border-rose-100 mb-3.5">
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
            )}
            {popupConfig.type === "warning" && (
              <div className="mx-auto flex items-center justify-center h-11 w-11 rounded-full bg-orange-50 border border-orange-200 mb-3.5">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            )}
            <h3 className="text-sm font-bold text-slate-900">{popupConfig.title}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">{popupConfig.message}</p>
            <button
              onClick={() => setPopupConfig(null)}
              className="mt-5 w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-11 w-11 rounded-full bg-rose-50 border border-rose-100 mb-3.5">
              <LogOut className="h-5 w-5 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Confirm Sign Out</h3>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">Are you sure you want to end your current session?</p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-1/2 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Confirm Dialog Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-11 w-11 rounded-full bg-orange-50 border border-orange-200 mb-3.5">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{confirmConfig.title}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">{confirmConfig.message}</p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setConfirmConfig(null)}
                className="w-1/2 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmConfig(null);
                  confirmConfig.onConfirm();
                }}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

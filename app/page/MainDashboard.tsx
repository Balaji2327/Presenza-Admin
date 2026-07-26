"use client";

import { useEffect, useState } from "react";
import Login from "./Login";
import AttendanceSheetView from "../components/AttendanceSheetView";
import TimetableEditorView from "../components/TimetableEditorView";
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
  addDoc,
  writeBatch,
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

interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  type?: "pinned" | "regular";
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
  const [currentView, setCurrentView] = useState<"students" | "faculty" | "news">("students");
  const [studentSubView, setStudentSubView] = useState<"list" | "attendance" | "timetable">("list");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [fromDeptFaculty, setFromDeptFaculty] = useState<boolean>(false);

  // News states
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState<boolean>(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsType, setNewsType] = useState<"pinned" | "regular">("regular");
  const [addingNews, setAddingNews] = useState(false);

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

  // Fetch News
  useEffect(() => {
    async function fetchNews() {
      try {
        setLoadingNews(true);
        const colRef = collection(db, "news");
        const snapshot = await getDocs(colRef);
        const newsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as NewsItem[];
        // Sort by date descending
        newsData.sort((a, b) => b.createdAt - a.createdAt);
        setNewsList(newsData);
      } catch (err: any) {
        console.error("Error fetching news:", err);
      } finally {
        setLoadingNews(false);
      }
    }
    fetchNews();
  }, []);

  const [classCurrentSemester, setClassCurrentSemester] = useState<string>("I");
  const [newClassSemesterInput, setNewClassSemesterInput] = useState<string>("I");

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
          "clasees",
          selectedClass
        );
        const docSnap = await getDoc(classDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentSem = data.currentSemester || "I";
          setClassCurrentSemester(currentSem);
          setSelectedSemester(currentSem);
        } else {
          setClassCurrentSemester("I");
          setSelectedSemester("I");
        }
      } catch (err) {
        console.error("Error fetching class metadata:", err);
      }
    }

    fetchClassMetadata();
  }, [selectedClass, selectedDept?.id]);

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

      // 2. Create the class document in the 'clasees' subcollection
      const classDocRef = doc(
        db,
        "colleges",
        "departments",
        "all_departments",
        targetDeptId,
        "clasees",
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
          const classDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "clasees", className);
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
    newSemester: string
  ) => {
    if (!newClassName.trim()) {
      showPopup("warning", "Warning", "Class name cannot be empty.");
      return;
    }

    try {
      setSavingClass(true);
      const isNameChanged = oldClassName !== newClassName;
      const isSemesterChanged = classCurrentSemester !== newSemester;

      if (!isNameChanged && !isSemesterChanged) {
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

      // 2. Update/Create the class document in 'clasees' subcollection
      const oldClassDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "clasees", oldClassName);
      const newClassDocRef = doc(db, "colleges", "departments", "all_departments", deptId, "clasees", newClassName);
      
      const oldClassSnap = await getDoc(oldClassDocRef);
      const classData = oldClassSnap.exists() ? oldClassSnap.data() : {};
      const updatedClassData = {
        ...classData,
        currentSemester: newSemester
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
      
      if (isNameChanged && selectedClass === oldClassName && selectedDept?.id === deptId) {
        setSelectedClass(newClassName);
      }
      
      await fetchAllStudents();
      await fetchFaculties();
      setIsClassEditorOpen(false);

      showPopup("success", "Success", "Class settings updated successfully!");
    } catch (err: any) {
      console.error("Error updating class settings:", err);
      showPopup("error", "Error", "Failed to update class settings: " + err.message);
    } finally {
      setSavingClass(false);
    }
  };

  // Fetch data on login status
  useEffect(() => {
    const logged = localStorage.getItem("adminLoggedIn");
    if (logged === "true") {
      setIsLoggedIn(true);
    }
    setCheckingAuth(false);
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

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.id || !newStudent.name || !newStudent.email || !newStudent.department || !newStudent.class) {
      showPopup("warning", "Warning", "Please fill in all required fields.");
      return;
    }
    try {
      setSavingStudent(true);
      const studentDocRef = doc(db, "colleges", "students", "all_students", newStudent.id);
      const studentSnap = await getDoc(studentDocRef);
      if (studentSnap.exists()) {
        showPopup("warning", "Warning", `A student with ID ${newStudent.id} already exists!`);
        setSavingStudent(false);
        return;
      }

      await setDoc(studentDocRef, {
        name: newStudent.name,
        email: newStudent.email,
        class: newStudent.class,
        department: newStudent.department,
        mentor_id: newStudent.mentor_id || "",
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
        password: editingFaculty.password || "faculty123",
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
    if (currentView === "students" && (studentSubView === "timetable" || studentSubView === "attendance")) {
      fetchTimetable();
    }
  }, [selectedDept, selectedClass, selectedSemester, currentView, studentSubView]);

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDeptId = editingFacultyDeptId || (selectedDept?.id || "");
    if (!facultyId || !facultyName || !facultyEmail || !targetDeptId) {
      showPopup("warning", "Warning", "Please fill in all required fields (ID, Name, Email, Department).");
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
      showPopup("success", "Success", "Faculty member added successfully!");
      
      setFacultyId("");
      setFacultyName("");
      setFacultyEmail("");
      setFacultyPassword("");
      setFacultyClassesInput("");
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

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    localStorage.setItem("adminLoggedIn", "true");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("adminLoggedIn");
  };

  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) {
      showPopup("warning", "Missing Fields", "Please enter both title and content for the news.");
      return;
    }
    try {
      setAddingNews(true);
      const docRef = await addDoc(collection(db, "news"), {
        title: newsTitle.trim(),
        content: newsContent.trim(),
        type: newsType,
        createdAt: Date.now()
      });
      const newNewsItem: NewsItem = {
        id: docRef.id,
        title: newsTitle.trim(),
        content: newsContent.trim(),
        type: newsType,
        createdAt: Date.now()
      };
      setNewsList([newNewsItem, ...newsList]);
      setNewsTitle("");
      setNewsContent("");
      setNewsType("regular");
      showPopup("success", "News Added", "News item successfully added.");
    } catch (err: any) {
      console.error("Error adding news:", err);
      showPopup("error", "Failed to Add News", err.message);
    } finally {
      setAddingNews(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    showConfirm("Delete News", "Are you sure you want to delete this news item?", async () => {
      try {
        await deleteDoc(doc(db, "news", id));
        setNewsList(newsList.filter(item => item.id !== id));
        showPopup("success", "News Deleted", "News item successfully deleted.");
      } catch (err: any) {
        console.error("Error deleting news:", err);
        showPopup("error", "Failed to Delete News", err.message);
      }
    });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
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
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR: Navigation Menu */}
      <aside className={`w-64 border-r border-slate-200 bg-white flex flex-col shadow-sm h-screen shrink-0 z-50 transition-transform duration-200 ease-out fixed top-0 left-0 lg:sticky lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 sidebar-slide-in' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className="p-4 lg:p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="bg-orange-100 p-0 rounded-xl h-11 w-11 shrink-0 shadow-md shadow-orange-500/10 flex items-center justify-center overflow-hidden">
            <img 
              src="/splash_logo_dark.png" 
              alt="Presenza Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
              PRESENZA
            </h1>
            <p className="text-xs text-slate-400 font-bold">ADMIN PORTAL</p>
          </div>
          {/* Close sidebar button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        {/* Dept + Class Tree */}
        <div className="flex-1 overflow-y-auto">
          {/* Section Label */}
          <div className="px-4 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Departments</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAddingDept(true)}
                className="text-[10px] font-bold text-orange-500 hover:text-orange-600 transition cursor-pointer"
                title="Add Department"
              >
                + Dept
              </button>
              <span className="text-slate-300 text-[10px]">|</span>
              <button
                onClick={() => {
                  if (departments.length === 0) {
                    alert("Please add a department first!");
                    return;
                  }
                  setTargetDeptId(departments[0].id);
                  setIsAddingClass(true);
                }}
                className="text-[10px] font-bold text-orange-500 hover:text-orange-600 transition cursor-pointer"
                title="Add Class"
              >
                + Class
              </button>
            </div>
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
                    <div className={`flex items-center gap-1 pr-2 rounded-xl transition-all ${isActiveDept ? "bg-orange-50 border border-orange-100" : "hover:bg-slate-50 border border-transparent"}`}>
                      <button
                        onClick={() => {
                          setExpandedDepts(prev => {
                            const next = new Set(prev);
                            if (next.has(dept.id)) next.delete(dept.id);
                            else next.add(dept.id);
                            return next;
                          });
                          setSelectedDept(dept);
                          setSelectedClass("");
                          setCurrentView("students");
                          setStudentSubView("attendance");
                          setFromDeptFaculty(false);
                          // Don't close sidebar on dept click (user might want to expand and select class)
                        }}
                        className={`flex-1 flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold cursor-pointer outline-none ${isActiveDept ? "text-orange-600" : "text-slate-600"}`}
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
                      <button
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setNewDeptNameInput(dept.name);
                          setIsDeptEditorOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Class list (collapsible) */}
                    {isOpen && (
                      <div className="ml-3 mt-0.5 mb-1 border-l-2 border-slate-100 pl-2 space-y-0.5">
                        {dept.classes && dept.classes.length > 0 ? (
                          dept.classes.map((cls) => {
                            const isActiveClass = selectedClass === cls && isActiveDept;
                            return (
                              <div key={cls} className={`flex items-center gap-1 pr-1 rounded-lg transition-all ${isActiveClass ? "bg-orange-500 shadow-sm shadow-orange-500/20" : "hover:bg-orange-50"}`}>
                                <button
                                  onClick={() => {
                                    setSelectedDept(dept);
                                    setSelectedClass(cls);
                                    setSelectedStudent(null);
                                    setCurrentView("students");
                                    setStudentSubView("attendance");
                                    setFromDeptFaculty(false);
                                    setSidebarOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold cursor-pointer outline-none ${isActiveClass ? "text-white" : "text-slate-500"}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    isActiveClass ? "bg-white" : "bg-slate-300"
                                  }`} />
                                  {cls}
                                </button>
                              </div>
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

        </div>

        {/* Sticky Manage & Logout Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
          {/* Section Label */}
          <div className="px-2 pb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Manage</span>
          </div>

          {/* Students & Faculty nav */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setCurrentView("students");
                setStudentSubView("list");
                setSearchTerm("");
                setEditingStudent(null);
                setSelectedDept(null);
                setFromDeptFaculty(false);
                setFilterDept(null);
                setFilterClass("");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 border ${
                currentView === "students" && studentSubView === "list"
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
                setSelectedDept(null);
                setFromDeptFaculty(false);
                setFilterDept(null);
                setFilterClass("");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 border ${
                currentView === "faculty" && !fromDeptFaculty
                  ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/10"
                  : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Faculty</span>
            </button>

            <button
              onClick={() => {
                setCurrentView("news");
                setSelectedDept(null);
                setFromDeptFaculty(false);
                setFilterDept(null);
                setFilterClass("");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 border ${
                currentView === "news"
                  ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/10"
                  : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Newspaper className="h-4 w-4" />
              <span>News</span>
            </button>
          </div>

          <div className="my-1 border-t border-slate-200/60" />

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl text-rose-600 text-sm font-bold transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 lg:h-20 border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 bg-white shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Menu for Mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm lg:text-lg font-extrabold text-slate-800 truncate">
              {currentView === "students" && (
                studentSubView === "list" ? "Student Profiles" :
                studentSubView === "attendance" ? `Attendance — ${selectedClass || ""}` :
                `Timetable — ${selectedClass || ""}`
              )}
              {currentView === "faculty" && "Faculty Management"}
              {currentView === "news" && "News Management"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6 select-none">
          {/* Students -> Sub-view list */}
          {currentView === "students" && studentSubView === "list" && (
            <div className="space-y-4 lg:space-y-6 animate-fade-in">
              {/* Search & Filter Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 items-stretch sm:items-center justify-between bg-white border border-slate-200 p-4 lg:p-6 rounded-2xl shadow-sm">
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
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (!showFilterPopover) {
                          setTempDept(filterDept);
                          setTempClass(filterClass);
                        }
                        setShowFilterPopover(!showFilterPopover);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        filterDept || filterClass
                          ? "bg-orange-50 border-orange-200 text-orange-600 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                      title="Filter by Department & Class"
                    >
                      <Filter className="h-4 w-4" />
                    </button>

                    {showFilterPopover && (
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-20 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-800">Filter Records</span>
                          {(filterDept || filterClass || tempDept || tempClass) && (
                            <button
                              onClick={() => {
                                setTempDept(null);
                                setTempClass("");
                                setFilterDept(null);
                                setFilterClass("");
                                setShowFilterPopover(false);
                              }}
                              className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                          <select
                            value={tempDept?.id || ""}
                            onChange={(e) => {
                              const deptId = e.target.value;
                              const dept = departments.find(d => d.id === deptId);
                              setTempDept(dept || null);
                              setTempClass("");
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer"
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
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class</label>
                          <select
                            value={tempClass}
                            onChange={(e) => setTempClass(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer disabled:cursor-not-allowed"
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
                              setShowFilterPopover(false);
                            }}
                            className="w-full py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer text-center"
                          >
                            Apply Filter
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
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer whitespace-nowrap"
                  >
                    + Add Student
                  </button>
                  <div className="text-xs font-bold text-slate-400 uppercase shrink-0 hidden sm:block">
                    Total: {filteredAllStudents.length}
                  </div>
                </div>
              </div>

              {/* Students - Mobile Card View */}
              <div className="md:hidden space-y-3">
                {loadingAllStudents ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold shadow-sm">Loading student profiles...</div>
                ) : filteredAllStudents.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold shadow-sm">No students found.</div>
                ) : (
                  filteredAllStudents.map((student) => (
                    <div key={student.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{student.name}</h4>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{student.id}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{student.class}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold w-12 shrink-0">Email</span>
                          <span className="font-medium truncate">{student.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold w-12 shrink-0">Dept</span>
                          <span className="font-semibold">{student.department}</span>
                        </div>
                        {student.mentor_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold w-12 shrink-0">Mentor</span>
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
                          className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Students - Desktop Table View */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hidden md:block">
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
                            <td className="p-4 pr-6 text-right flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingStudent(student);
                                  setOriginalStudentId(student.id);
                                }}
                                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
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
            <div className="space-y-4 lg:space-y-6 animate-fade-in">
              {/* Search & Add Faculty Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 items-stretch sm:items-center justify-between bg-white border border-slate-200 p-4 lg:p-6 rounded-2xl shadow-sm">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all faculty..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-205 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (!showFilterPopover) {
                          setTempDept(filterDept);
                          setTempClass(filterClass);
                        }
                        setShowFilterPopover(!showFilterPopover);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        filterDept || filterClass
                          ? "bg-orange-50 border-orange-200 text-orange-600 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                      title="Filter by Department & Class"
                    >
                      <Filter className="h-4 w-4" />
                    </button>

                    {showFilterPopover && (
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-20 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-800">Filter Records</span>
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
                              className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                          <select
                            value={tempDept?.id || ""}
                            onChange={(e) => {
                              const deptId = e.target.value;
                              const dept = departments.find(d => d.id === deptId);
                              setTempDept(dept || null);
                              setTempClass("");
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer"
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
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class</label>
                          <select
                            value={tempClass}
                            onChange={(e) => setTempClass(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none cursor-pointer disabled:cursor-not-allowed"
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
                            className="w-full py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer text-center"
                          >
                            Apply Filter
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
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer whitespace-nowrap"
                  >
                    + Add Faculty
                  </button>
                  <div className="text-xs font-bold text-slate-400 uppercase shrink-0 hidden sm:block">
                    Total: {filteredAllFaculty.length}
                  </div>
                </div>
              </div>

              {/* Faculty - Mobile Card View */}
              <div className="md:hidden space-y-3">
                {loadingFaculties ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold shadow-sm">Loading faculty profiles...</div>
                ) : filteredAllFaculty.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold shadow-sm">No faculty members found.</div>
                ) : (
                  filteredAllFaculty.map((fac) => (
                    <div key={fac.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{fac.name}</h4>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{fac.id}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold shrink-0">{fac.department}</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold w-14 shrink-0">Email</span>
                          <span className="font-medium truncate">{fac.email}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 font-bold w-14 shrink-0">Classes</span>
                          <div className="flex flex-wrap gap-1">
                            {(fac.classes || []).map((cls: string) => (
                              <span key={cls} className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded text-[10px] font-bold">{cls}</span>
                            ))}
                            {(fac.classes || []).length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setEditingFaculty(fac)}
                          className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFaculty(fac.id)}
                          className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Faculty - Desktop Table View */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                        <th className="p-4 pl-6">Faculty ID</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Assigned Classes</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-600">
                      {loadingFaculties ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">Loading faculty profiles...</td>
                        </tr>
                      ) : filteredAllFaculty.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">No faculty members found.</td>
                        </tr>
                      ) : (
                        filteredAllFaculty.map((fac) => (
                          <tr key={fac.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 pl-6 font-mono text-xs text-slate-800">{fac.id}</td>
                            <td className="p-4 text-slate-800 font-bold">{fac.name}</td>
                            <td className="p-4 text-slate-500 font-medium">{fac.email}</td>
                            <td className="p-4">{fac.department}</td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {(fac.classes || []).map((cls: string) => (
                                  <span key={cls} className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded text-[10px] font-bold">
                                    {cls}
                                  </span>
                                ))}
                                {(fac.classes || []).length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                              </div>
                            </td>
                            <td className="p-4 pr-6 text-right flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingFaculty(fac);
                                }}
                                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFaculty(fac.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
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

          {/* News View */}
          {currentView === "news" && (
            <div className="max-w-4xl mx-auto space-y-4 lg:space-y-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Newspaper className="h-4 w-4 text-orange-500" />
                    Post New News
                  </h3>
                </div>
                <form onSubmit={handleAddNews} className="p-4 lg:p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. End Semester Exams Schedule"
                        value={newsTitle}
                        onChange={(e) => setNewsTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                        required
                      />
                    </div>
                    <div className="w-1/3">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type *</label>
                      <select
                        value={newsType}
                        onChange={(e) => setNewsType(e.target.value as "pinned" | "regular")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500"
                      >
                        <option value="regular">Regular News</option>
                        <option value="pinned">Pinned News</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Content *</label>
                    <textarea
                      placeholder="Write the news content here..."
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-medium min-h-[120px] resize-y"
                      required
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={addingNews}
                      className={`px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer ${addingNews ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                      {addingNews ? "Posting..." : "Post News"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-400" />
                    Published News
                  </h3>
                </div>
                <div className="p-6">
                  {loadingNews ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                    </div>
                  ) : newsList.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm font-semibold">
                      No news published yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {newsList.map(news => (
                        <div key={news.id} className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-800">{news.title}</h4>
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                news.type === "pinned" 
                                  ? "bg-rose-100 text-rose-700" 
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {news.type === "pinned" ? "Pinned" : "Regular"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 whitespace-pre-wrap">{news.content}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                              {new Date(news.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteNews(news.id)}
                            className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Delete News"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
            <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-slate-100 bg-slate-50/30">
              <div className="grid grid-cols-3 gap-2 lg:gap-4">
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

      {/* Department Editor Modal */}
      {isDeptEditorOpen && editingDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Department Settings
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  Department Editor
                </h4>
                <p className="text-xs text-slate-450 mt-0.5 font-semibold">
                  Department ID: {editingDeptId}
                </p>
              </div>
              <button
                onClick={() => setIsDeptEditorOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Rename Section */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rename Department</label>
                <input
                  type="text"
                  value={newDeptNameInput}
                  onChange={(e) => setNewDeptNameInput(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleRenameDept(editingDeptId, newDeptNameInput)}
                  disabled={savingDept}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer text-center disabled:opacity-50"
                >
                  {savingDept ? "Saving..." : "Save Department Name"}
                </button>
              </div>

              {/* Danger Zone Divider */}
              <div className="border-t border-slate-150 pt-4 mt-2">
                <h5 className="text-xs font-extrabold text-rose-500 uppercase tracking-wider mb-1.5">Danger Zone</h5>
                <p className="text-[10px] text-slate-450 mb-3 font-semibold leading-relaxed">
                  Permanently delete this department. All classes and student timetables associated with it will also be deleted.
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteDept(editingDeptId)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-100 hover:border-rose-500 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Class Settings
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  Class Editor
                </h4>
                <p className="text-xs text-slate-450 mt-0.5 font-semibold">
                  Department: {selectedDept.name}
                </p>
              </div>
              <button
                onClick={() => setIsClassEditorOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Rename Section */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rename Class</label>
                <input
                  type="text"
                  value={newClassNameInput}
                  onChange={(e) => setNewClassNameInput(e.target.value)}
                  placeholder="e.g. SEC25CJ013"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                />
              </div>

              {/* Semester Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Current Semester</label>
                <select
                  value={newClassSemesterInput}
                  onChange={(e) => setNewClassSemesterInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
                >
                  {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveClassSettings(selectedDept.id, selectedClass, newClassNameInput, newClassSemesterInput)}
                  disabled={savingClass}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer text-center disabled:opacity-50"
                >
                  {savingClass ? "Saving..." : "Save Class Settings"}
                </button>
              </div>

              {/* Danger Zone Divider */}
              <div className="border-t border-slate-150 pt-4 mt-2">
                <h5 className="text-xs font-extrabold text-rose-500 uppercase tracking-wider mb-1.5">Danger Zone</h5>
                <p className="text-[10px] text-slate-450 mb-3 font-semibold leading-relaxed">
                  Permanently delete this class, its timetable settings, and all associated configurations. This action is irreversible.
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteClass(selectedDept.id, selectedClass)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-100 hover:border-rose-500 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Edit Student Profile
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  {editingStudent.name}
                </h4>
                <p className="text-xs text-slate-450 font-mono mt-0.5 font-semibold">
                  ID: {editingStudent.id}
                </p>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Student ID / Roll No.</label>
                <input
                  type="text"
                  value={editingStudent.id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Department</label>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
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
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Class</label>
                  <select
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mentor ID</label>
                  <input
                    type="text"
                    value={editingStudent.mentor_id || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mentor_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-mono"
                    placeholder="e.g. FAC123"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Semester</label>
                  <select
                    value={editingStudent.semester || classCurrentSemester || "I"}
                    onChange={(e) => setEditingStudent({ ...editingStudent, semester: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-not-allowed opacity-75"
                    disabled
                  >
                    {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  disabled={savingStudent}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingStudent ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {isAddingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Add New Department
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  New Department Details
                </h4>
              </div>
              <button
                onClick={() => setIsAddingDept(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateDept} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Department Code/ID (e.g. CSE, ECE)
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    placeholder="e.g. CSE"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500 font-bold"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingDept(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Add New Class
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  New Class Details
                </h4>
              </div>
              <button
                onClick={() => setIsAddingClass(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateClass} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Select Department
                  </label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500 font-bold cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Class Name/ID
                  </label>
                  <input
                    type="text"
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. CSE-A, CSE-B"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500 font-bold"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddingClass(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClass}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Add New Student
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  New Student Profile
                </h4>
              </div>
              <button
                onClick={() => setIsAddingStudent(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Student ID / Roll No. *</label>
                <input
                  type="text"
                  placeholder="e.g. 21CS001"
                  value={newStudent.id || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newStudent.name || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. john.doe@college.edu"
                  value={newStudent.email || ""}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Department *</label>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
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
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Class *</label>
                  <select
                    value={newStudent.class || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mentor ID</label>
                  <input
                    type="text"
                    placeholder="e.g. FAC123"
                    value={newStudent.mentor_id || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, mentor_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Semester *</label>
                  <select
                    value={newStudent.semester || classCurrentSemester || "I"}
                    onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 cursor-not-allowed opacity-75"
                    disabled
                  >
                    {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  disabled={savingStudent}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Add New Faculty
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  New Faculty Profile
                </h4>
              </div>
              <button
                onClick={() => setAddingFaculty(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={async (e) => {
              await handleAddFaculty(e);
              setAddingFaculty(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Faculty ID *</label>
                <input
                  type="text"
                  placeholder="e.g. FAC001"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Smith"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. jane.smith@college.edu"
                  value={facultyEmail}
                  onChange={(e) => setFacultyEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Leave empty for default 'faculty123'"
                  value={facultyPassword}
                  onChange={(e) => setFacultyPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Department *</label>
                  <select
                    value={editingFacultyDeptId}
                    onChange={(e) => setEditingFacultyDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
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
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assigned Classes</label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-A, CSE-B"
                    value={facultyClassesInput}
                    onChange={(e) => setFacultyClassesInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Comma-separated list</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddingFaculty(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/20 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Edit Faculty Profile
                </span>
                <h4 className="text-lg font-bold text-slate-800 mt-1">
                  {editingFaculty.name}
                </h4>
                <p className="text-xs text-slate-450 font-mono mt-0.5 font-semibold">
                  ID: {editingFaculty.id}
                </p>
              </div>
              <button
                onClick={() => setEditingFaculty(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-250 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateFaculty} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editingFaculty.name}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address *</label>
                <input
                  type="email"
                  value={editingFaculty.email}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Enter new password or leave blank"
                  value={editingFaculty.password || ""}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Department *</label>
                  <select
                    value={editingFaculty.department}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-500"
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
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assigned Classes</label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-A, CSE-B"
                    value={Array.isArray(editingFaculty.classes) ? editingFaculty.classes.join(", ") : ""}
                    onChange={(e) => {
                      const arr = e.target.value.split(",").map(c => c.trim()).filter(c => c.length > 0);
                      setEditingFaculty({ ...editingFaculty, classes: arr });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Comma-separated list</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            {popupConfig.type === "success" && (
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            )}
            {popupConfig.type === "error" && (
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 border border-rose-100 mb-4">
                <XCircle className="h-6 w-6 text-rose-600" />
              </div>
            )}
            {popupConfig.type === "warning" && (
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-50 border border-amber-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            )}
            <h3 className="text-base font-extrabold text-slate-800">{popupConfig.title}</h3>
            <p className="text-xs text-slate-500 font-semibold mt-2">{popupConfig.message}</p>
            <button
              onClick={() => setPopupConfig(null)}
              className="mt-5 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 border border-rose-100 mb-4">
              <LogOut className="h-6 w-6 text-rose-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">Confirm Logout</h3>
            <p className="text-xs text-slate-500 font-semibold mt-2">Are you sure you want to log out of the admin panel?</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-1/2 py-2 border border-slate-200 text-slate-550 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="w-1/2 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Confirm Dialog Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-50 border border-amber-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">{confirmConfig.title}</h3>
            <p className="text-xs text-slate-500 font-semibold mt-2">{confirmConfig.message}</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmConfig(null)}
                className="w-1/2 py-2 border border-slate-200 text-slate-550 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmConfig(null);
                  confirmConfig.onConfirm();
                }}
                className="w-1/2 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer"
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

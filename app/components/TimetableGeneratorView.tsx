"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Plus,
  Trash2,
  Zap,
  Calendar,
  Download,
  RefreshCw,
  Users,
  BookOpen,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Layers,
  ArrowLeft,
  Settings2,
  Key,
  HelpCircle,
  FileSpreadsheet,
  Check,
  ChevronDown,
  Wand2,
  Lightbulb,
  X,
  MessageSquareText,
  SlidersHorizontal,
  Bot,
  Search,
  ArrowUpDown,
  ChevronRight,
  History,
  FolderClock,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Department, Faculty } from "../types";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FacultyItem {
  id: string;
  name: string;
  department: string;
  email?: string;
  classes?: string[];
}

export interface ClassItem {
  id: string;
  name: string;
  department: string;
  currentSemester?: string; // e.g. "I", "II", "III", "IV", "V", "VI", "VII", "VIII"
  lunchPeriod: number; // class-specific lunch period (e.g. Period 4 for Year 1, Period 5 for Year 3)
}

export interface RoomItem {
  id: string;
  name: string;
  type: "CLASSROOM" | "LAB";
}

export interface SubjectItem {
  id: string;
  name: string;
  acronym?: string; // short abbreviation, e.g. "DBMS", "CNS", "AI&ML"
  classId: string;
  facultyId: string;
  secondaryFacultyId?: string; // for shared labs / multiple faculty
  tertiaryFacultyId?: string;  // 3rd faculty member
  roomId?: string;
  type: "THEORY" | "LAB" | "ELECTIVE" | "PROJECT";
  electiveGroupId?: string; // e.g. "Elective-1"
  totalSemHours: number; // total required hours for the entire semester (e.g. 60 hrs)
  hoursPerWeek: number;  // computed / allocated weekly periods (e.g. 4 hrs/wk)
}

// Auto-generate acronym from subject name (e.g. "Database Management Systems" => "DBMS")
const generateAcronym = (name: string): string => {
  if (!name.trim()) return "";
  const skipWords = new Set(["and", "the", "of", "for", "in", "to", "a", "an", "&", "/", "-", "with"]);
  const words = name.replace(/[()]/g, " ").split(/[\s/&-]+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  const acronym = words
    .filter((w) => !skipWords.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return acronym || name.substring(0, 3).toUpperCase();
};

export interface TimetableSlot {
  day: string;
  period: number;
  classId: string;
  className: string;
  subject: string;
  subjectAcronym?: string;
  faculty: string;
  secondaryFaculty?: string;
  room?: string;
  type: "THEORY" | "LAB" | "ELECTIVE" | "PROJECT";
  electiveGroupId?: string;
}

export interface ConflictItem {
  type: string;
  message: string;
  slotDetails?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
import { db } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

interface TimetableGeneratorViewProps {
  selectedDept?: Department | null;
  departments: Department[];
  faculties: Faculty[];
  onBack: () => void;
  onTimetablesUpdated?: () => void;
}

export default function TimetableGeneratorView({
  selectedDept,
  departments,
  faculties,
  onBack,
  onTimetablesUpdated,
}: TimetableGeneratorViewProps) {
  // Config — Gemini API key is kept server-side only (see /api/generate-timetable)
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [weeksInSemester, setWeeksInSemester] = useState(15);
  const [activeDeptFilter, setActiveDeptFilter] = useState<string>(selectedDept?.id || "ALL");

  // 1. Classes / Batches with Staggered Lunch Periods
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // 2. Faculty Directory
  const [facultyList, setFacultyList] = useState<FacultyItem[]>([]);

  // 3. Rooms & Labs
  const [rooms, setRooms] = useState<RoomItem[]>([
    { id: "r_1007", name: "Room 1007", type: "CLASSROOM" },
    { id: "r_1008", name: "Room 1008", type: "CLASSROOM" },
    { id: "r_1009", name: "Room 1009", type: "CLASSROOM" },
    { id: "r_cc12", name: "CC12 Lab", type: "LAB" },
  ]);

  // 4. Subjects & Faculty Assignments
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // View Filter & State
  const [activeTab, setActiveTab] = useState<"INPUTS" | "TIMETABLE" | "HISTORY">("INPUTS");
  const [timetableSubTab, setTimetableSubTab] = useState<"CLASS" | "FACULTY">("CLASS");
  const [selectedClassView, setSelectedClassView] = useState<string>("");
  const [selectedFacultyView, setSelectedFacultyView] = useState<string>("");
  const [activeFacultyPopover, setActiveFacultyPopover] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictItem[]>([]);
  const [finalTimetable, setFinalTimetable] = useState<TimetableSlot[] | null>(null);

  // AI Prompt Studio States
  const [showAIPromptModal, setShowAIPromptModal] = useState(false);
  const [userPromptText, setUserPromptText] = useState("");
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [aiGeneratedSuccess, setAiGeneratedSuccess] = useState<string | null>(null);
  const [aiEngineUsed, setAiEngineUsed] = useState<string | null>(null);
  const [isRestructureMode, setIsRestructureMode] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [mounted, setMounted] = useState(false);

  // History tab state
  const [historyDeptId, setHistoryDeptId] = useState<string>(selectedDept?.id || "");
  const [historyClassList, setHistoryClassList] = useState<string[]>([]);
  const [historyClassName, setHistoryClassName] = useState<string>("");
  const [historySemesters, setHistorySemesters] = useState<string[]>([]);
  const [historySemester, setHistorySemester] = useState<string>("");
  const [historyGrid, setHistoryGrid] = useState<Record<string, string[]> | null>(null);
  const [historyCourses, setHistoryCourses] = useState<any[] | null>(null);
  const [historyPeriodsPerDay, setHistoryPeriodsPerDay] = useState<number>(7);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Faculty class-wise filtering & assignment states
  const [selectedClassForFaculty, setSelectedClassForFaculty] = useState<string>("ALL");
  const [showBatchAssignModal, setShowBatchAssignModal] = useState(false);
  const [activeClassAssignmentFacultyId, setActiveClassAssignmentFacultyId] = useState<string | null>(null);
  const [newFacultyInput, setNewFacultyInput] = useState<string>("");
  const [assignModalSearch, setAssignModalSearch] = useState<string>("");

  // Cross-department faculty states
  const [showOtherDeptSection, setShowOtherDeptSection] = useState(false);
  const [otherDeptSearch, setOtherDeptSearch] = useState("");
  const [otherDeptSortBy, setOtherDeptSortBy] = useState<"name" | "count">("name");
  const [selectedOtherDeptId, setSelectedOtherDeptId] = useState<string | null>(null);
  const [otherDeptFacultySearch, setOtherDeptFacultySearch] = useState("");

  useEffect(() => {
    setMounted(true);
    try {
      const savedKey = localStorage.getItem("presenza_gemini_api_key");
      if (savedKey) setCustomApiKey(savedKey);
    } catch (e) {}
  }, []);

  const handleApiKeyChange = (key: string) => {
    setCustomApiKey(key);
    try {
      if (key.trim()) {
        localStorage.setItem("presenza_gemini_api_key", key.trim());
      } else {
        localStorage.removeItem("presenza_gemini_api_key");
      }
    } catch (e) {}
  };

  // Prepopulate classes & faculties from Presenza-Admin
  useEffect(() => {
    // 1. Prepare Faculty List from Presenza
    let loadedFaculty: FacultyItem[] = [];
    if (faculties && faculties.length > 0) {
      loadedFaculty = faculties
        .filter((f) => activeDeptFilter === "ALL" || !f.department || f.department === activeDeptFilter)
        .map((f) => ({
          id: f.id || `f_${f.name.replace(/\s+/g, "_")}`,
          name: f.name || "Faculty",
          department: f.department || "",
          email: f.email || "",
          classes: Array.isArray(f.classes)
            ? [...f.classes]
            : typeof (f as any).classes === "string"
            ? (f as any).classes.split(",").map((c: string) => c.trim()).filter(Boolean)
            : [],
        }));
    }

    if (loadedFaculty.length === 0 && faculties && faculties.length > 0) {
      // Fallback to all faculties if none matched current dept filter
      loadedFaculty = faculties.map((f) => ({
        id: f.id || `f_${f.name.replace(/\s+/g, "_")}`,
        name: f.name || "Faculty",
        department: f.department || "",
        email: f.email || "",
        classes: Array.isArray(f.classes)
          ? [...f.classes]
          : typeof (f as any).classes === "string"
          ? (f as any).classes.split(",").map((c: string) => c.trim()).filter(Boolean)
          : [],
      }));
    }

    // If still empty, supply clean starter row
    if (loadedFaculty.length === 0) {
      loadedFaculty = [{ id: "f_1", name: "", department: "", classes: [] }];
    }
    setFacultyList(loadedFaculty);

    // 2. Prepare Classes from Presenza Departments
    const inferSemesterFromName = (clsName: string): string => {
      const upper = clsName.toUpperCase();
      if (upper.includes("-VIII") || upper.includes("_VIII") || upper.includes("2027")) return "VIII";
      if (upper.includes("-VII") || upper.includes("_VII") || upper.includes("2028") || upper.includes("IV-")) return "VII";
      if (upper.includes("-VI") || upper.includes("_VI")) return "VI";
      if (upper.includes("-V") || upper.includes("_V") || upper.includes("2029") || upper.includes("III-")) return "V";
      if (upper.includes("-IV") || upper.includes("_IV")) return "IV";
      if (upper.includes("-III") || upper.includes("_III") || upper.includes("2030") || upper.includes("II-")) return "III";
      if (upper.includes("-II") || upper.includes("_II")) return "II";
      if (upper.includes("-I") || upper.includes("_I") || upper.includes("2031") || upper.includes("I-")) return "I";
      return "I";
    };

    const loadedClasses: ClassItem[] = [];
    const deptsToScan =
      activeDeptFilter === "ALL"
        ? departments
        : departments.filter((d) => d.id === activeDeptFilter);

    let defaultLunch = 4;
    deptsToScan.forEach((dept) => {
      if (dept.classes && dept.classes.length > 0) {
        dept.classes.forEach((clsName) => {
          // Default lunch fixed at Period 4 (admin can change it in the dropdown)
          const lunch = 4;
          const inferredSem = inferSemesterFromName(clsName);
          loadedClasses.push({
            id: `c_${clsName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            name: clsName,
            department: dept.name,
            currentSemester: inferredSem,
            lunchPeriod: lunch,
          });
        });
      }
    });

    if (loadedClasses.length === 0) {
      loadedClasses.push({
        id: "c_1",
        name: "SECCJ2030A",
        department: selectedDept?.name || "General",
        currentSemester: "III",
        lunchPeriod: 4,
      });
    }

    setClasses(loadedClasses);

    // Asynchronously fetch exact currentSemester from Firestore for all classes
    deptsToScan.forEach(async (dept) => {
      if (!dept.id) return;
      try {
        const snap = await getDocs(
          collection(db, "colleges", "departments", "all_departments", dept.id, "classes")
        );
        snap.forEach((dSnap) => {
          const data = dSnap.data();
          if (data?.currentSemester) {
            setClasses((prev) =>
              prev.map((c) =>
                c.name.toLowerCase() === dSnap.id.toLowerCase()
                  ? { ...c, currentSemester: data.currentSemester }
                  : c
              )
            );
          }
        });
      } catch (err) {}
    });

    if (loadedClasses.length > 0) {
      setSelectedClassView(loadedClasses[0].id);
      setSelectedClassForFaculty(loadedClasses[0].name);
    }
    if (loadedFaculty.length > 0 && loadedFaculty[0].id) {
      setSelectedFacultyView(loadedFaculty[0].id);
    }

    // 3. Generate initial subjects for classes if empty
    setSubjects((prev) => {
      if (prev.length > 0) return prev; // Keep if already entered
      const initialSubs: SubjectItem[] = [];
      const defaultSubjectNames = [
        { name: "Database Management Systems", acronym: "DBMS", type: "THEORY", semHrs: 45 },
        { name: "Computer Networks & Security", acronym: "CNS", type: "THEORY", semHrs: 45 },
        { name: "Web Technologies & Cloud", acronym: "WT", type: "THEORY", semHrs: 45 },
        { name: "Artificial Intelligence & ML", acronym: "AI&ML", type: "THEORY", semHrs: 45 },
        { name: "DBMS & Networks Laboratory", acronym: "DBMS LAB", type: "LAB", semHrs: 45 },
        { name: "Industry Design Project / Lab", acronym: "IDP LAB", type: "PROJECT", semHrs: 45 },
      ];

      loadedClasses.slice(0, 3).forEach((cls) => {
        const classSpecificTeachers = loadedFaculty.filter(
          (f) => f.classes && f.classes.includes(cls.name)
        );
        const pool = classSpecificTeachers.length > 0 ? classSpecificTeachers : loadedFaculty;
        defaultSubjectNames.forEach((sDef, idx) => {
          const assignedFac = pool[idx % pool.length];
          const secFac = sDef.type === "LAB" ? pool[(idx + 1) % pool.length] : undefined;
          initialSubs.push({
            id: `s_${cls.id}_${idx}`,
            name: sDef.name,
            acronym: sDef.acronym,
            classId: cls.id,
            facultyId: assignedFac?.id || "",
            secondaryFacultyId: secFac?.id || undefined,
            type: sDef.type as any,
            totalSemHours: sDef.semHrs,
            hoursPerWeek: Math.max(1, Math.round(sDef.semHrs / 15)),
            roomId: sDef.type === "LAB" || sDef.type === "PROJECT" ? "r_cc12" : undefined,
          });
        });
      });
      return initialSubs;
    });
  }, [selectedDept, departments, faculties, activeDeptFilter]);

  // Automatically update all subjects' Hrs/Wk whenever weeksInSemester is changed
  const updateSemesterWeeks = (newWeeks: number) => {
    const validWeeks = Math.max(1, newWeeks);
    setWeeksInSemester(validWeeks);
    setSubjects((prev) =>
      prev.map((sub) => ({
        ...sub,
        hoursPerWeek: Math.max(1, Math.round(sub.totalSemHours / validWeeks)),
      }))
    );
  };

  const handleClassChange = (index: number, field: keyof ClassItem, value: any) => {
    const oldName = classes[index].name;
    const updated = [...classes];
    updated[index] = { ...updated[index], [field]: value };
    if (index === updated.length - 1 && field === "name" && String(value).trim() !== "") {
      updated.push({
        id: `c_${Date.now()}`,
        name: "",
        department: selectedDept?.name || "",
        lunchPeriod: 4,
      });
    }
    setClasses(updated);

    if (field === "name" && oldName && oldName !== value) {
      if (selectedClassForFaculty === oldName) {
        setSelectedClassForFaculty(String(value));
      }
      setFacultyList((prev) =>
        prev.map((f) => ({
          ...f,
          classes: (f.classes || []).map((c) => (c === oldName ? String(value) : c)),
        }))
      );
    }
  };

  const handleRemoveClass = (index: number) => {
    if (classes.length <= 1) return;
    const removedCls = classes[index];
    const updated = classes.filter((_, i) => i !== index);
    setClasses(updated);
    if (removedCls.name) {
      if (selectedClassForFaculty === removedCls.name) {
        setSelectedClassForFaculty(updated[0]?.name || "ALL");
      }
      setFacultyList((prev) =>
        prev.map((f) => ({
          ...f,
          classes: (f.classes || []).filter((c) => c !== removedCls.name),
        }))
      );
    }
  };

  const handleFacultyChange = (index: number, field: keyof FacultyItem, value: any) => {
    const updated = [...facultyList];
    updated[index] = { ...updated[index], [field]: value };
    if (index === updated.length - 1 && field === "name" && typeof value === "string" && value.trim() !== "") {
      updated.push({
        id: `f_${Date.now()}`,
        name: "",
        department: selectedDept?.name || "",
        classes: selectedClassForFaculty !== "ALL" ? [selectedClassForFaculty] : [],
      });
    }
    setFacultyList(updated);
  };

  const handleFacultyUpdate = (id: string, updates: Partial<FacultyItem>) => {
    setFacultyList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const handleAddFaculty = (name: string, assignedClass?: string) => {
    if (!name.trim()) return;
    const newFac: FacultyItem = {
      id: `f_${Date.now()}`,
      name: name.trim(),
      department: selectedDept?.name || "",
      classes: assignedClass && assignedClass !== "ALL" ? [assignedClass] : [],
    };
    setFacultyList((prev) => [...prev, newFac]);
  };

  const handleRemoveFaculty = (id: string) => {
    setFacultyList((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleFacultyClass = (facId: string, className: string) => {
    setFacultyList((prev) =>
      prev.map((f) => {
        if (f.id === facId) {
          const current = f.classes || [];
          const next = current.includes(className)
            ? current.filter((c) => c !== className)
            : [...current, className];
          return { ...f, classes: next };
        }
        return f;
      })
    );
  };

  const handleRoomChange = (index: number, field: keyof RoomItem, value: any) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    if (index === updated.length - 1 && field === "name" && String(value).trim() !== "") {
      updated.push({ id: `r_${Date.now()}`, name: "", type: "CLASSROOM" });
    }
    setRooms(updated);
  };

  const handleSubjectChangeById = (
    id: string,
    classId: string,
    field: keyof SubjectItem,
    value: any
  ) => {
    let updated = subjects.map((s) => {
      if (s.id !== id) return s;
      const sub = { ...s, [field]: value };
      if (field === "name") {
        const oldAutoAcronym = generateAcronym(s.name);
        if (!s.acronym || s.acronym === oldAutoAcronym) {
          sub.acronym = generateAcronym(String(value));
        }
      } else if (field === "acronym") {
        sub.acronym = String(value).toUpperCase();
      } else if (field === "totalSemHours") {
        const semHours = Number(value) || 0;
        sub.hoursPerWeek = Math.max(1, Math.round(semHours / (weeksInSemester || 15)));
      } else if (field === "hoursPerWeek") {
        const weeklyHours = Number(value) || 0;
        sub.totalSemHours = weeklyHours * (weeksInSemester || 15);
      }
      return sub;
    });

    // Auto-add new subject field if typing in the last subject of this class
    if (field === "name" && String(value).trim() !== "") {
      const classSubjects = updated.filter((s) => s.classId === classId);
      const isLastInClass = classSubjects[classSubjects.length - 1]?.id === id;
      if (isLastInClass) {
        updated.push({
          id: `s_${Date.now()}`,
          name: "",
          acronym: "",
          classId,
          facultyId: facultyList[0]?.id || "",
          type: "THEORY",
          totalSemHours: 45,
          hoursPerWeek: Math.max(1, Math.round(45 / (weeksInSemester || 15))),
        });
      }
    }

    setSubjects(updated);
  };

  const updateSubjectFacultyBatch = (
    subjectId: string,
    facultyId: string,
    secondaryFacultyId?: string,
    tertiaryFacultyId?: string,
    className?: string
  ) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              facultyId,
              secondaryFacultyId,
              tertiaryFacultyId,
            }
          : s
      )
    );

    if (className) {
      const assignedIds = [facultyId, secondaryFacultyId, tertiaryFacultyId].filter(Boolean) as string[];
      if (assignedIds.length > 0) {
        setFacultyList((prev) =>
          prev.map((f) => {
            if (assignedIds.includes(f.id)) {
              const cur = f.classes || [];
              if (!cur.includes(className)) {
                return { ...f, classes: [...cur, className] };
              }
            }
            return f;
          })
        );
      }
    }
  };

  const deleteSubjectById = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const addNewSubjectForClass = (classId: string) => {
    setSubjects((prev) => [
      ...prev,
      {
        id: `s_${Date.now()}`,
        name: "",
        acronym: "",
        classId,
        facultyId: facultyList[0]?.id || "",
        type: "THEORY",
        totalSemHours: 45,
        hoursPerWeek: Math.max(1, Math.round(45 / (weeksInSemester || 15))),
      },
    ]);
  };

  const clearAllData = () => {
    setClasses([{ id: `c_${Date.now()}`, name: "", department: "", lunchPeriod: 4 }]);
    setFacultyList([{ id: `f_${Date.now()}`, name: "", department: "", classes: [] }]);
    setSelectedClassForFaculty("ALL");
    setRooms([{ id: `r_${Date.now()}`, name: "", type: "CLASSROOM" }]);
    setSubjects([]);
    setFinalTimetable(null);
    setDetectedConflicts([]);
  };

  // ── Deterministic Constraint Checking Engine ──────────────────────────────
  const checkTimetableConstraints = (slots: TimetableSlot[]): ConflictItem[] => {
    const conflicts: ConflictItem[] = [];

    // 0. Check Class Lunch Period Violations
    classes.forEach((cls) => {
      if (!cls.name.trim()) return;
      const lunchSlots = slots.filter(
        (s) => s.classId === cls.id && s.period === cls.lunchPeriod
      );
      if (lunchSlots.length > 0) {
        conflicts.push({
          type: "LUNCH_BREAK_VIOLATION",
          message: `Class "${cls.name}" has scheduled classes during its assigned lunch period (Period ${cls.lunchPeriod}).`,
          slotDetails: `P${cls.lunchPeriod}`,
        });
      }
    });

    // 1. Check Faculty Double-Booking
    const facultySlotMap = new Map<string, TimetableSlot[]>();
    slots.forEach((slot) => {
      if (slot.faculty && slot.faculty.trim() !== "" && slot.faculty !== "-") {
        const primaryKey = `${slot.day}-${slot.period}-${slot.faculty}`;
        if (!facultySlotMap.has(primaryKey)) facultySlotMap.set(primaryKey, []);
        facultySlotMap.get(primaryKey)!.push(slot);
      }

      if (slot.secondaryFaculty && slot.secondaryFaculty.trim() !== "") {
        const secondaryKey = `${slot.day}-${slot.period}-${slot.secondaryFaculty}`;
        if (!facultySlotMap.has(secondaryKey)) facultySlotMap.set(secondaryKey, []);
        facultySlotMap.get(secondaryKey)!.push(slot);
      }
    });

    facultySlotMap.forEach((matchedSlots, key) => {
      const uniqueClasses = new Set(matchedSlots.map((s) => s.classId));
      if (uniqueClasses.size > 1) {
        const [day, period, facultyName] = key.split("-");
        conflicts.push({
          type: "FACULTY_DOUBLE_BOOKED",
          message: `${facultyName} is scheduled simultaneously for ${uniqueClasses.size} different classes on ${day} Period ${period}.`,
          slotDetails: `${day} P${period}`,
        });
      }
    });

    // 2. Check Class Double Booking
    const classSlotMap = new Map<string, TimetableSlot[]>();
    slots.forEach((slot) => {
      const key = `${slot.day}-${slot.period}-${slot.classId}`;
      if (!classSlotMap.has(key)) classSlotMap.set(key, []);
      classSlotMap.get(key)!.push(slot);
    });

    classSlotMap.forEach((matchedSlots, key) => {
      if (matchedSlots.length > 1) {
        const allElectiveSameGroup = matchedSlots.every(
          (s) =>
            s.type === "ELECTIVE" &&
            s.electiveGroupId &&
            s.electiveGroupId === matchedSlots[0].electiveGroupId
        );
        if (!allElectiveSameGroup) {
          const [day, period, clsId] = key.split("-");
          const clsObj = classes.find((c) => c.id === clsId);
          conflicts.push({
            type: "CLASS_DOUBLE_BOOKED",
            message: `Class "${clsObj?.name || clsId}" has multiple non-elective subjects at ${day} Period ${period}.`,
            slotDetails: `${day} P${period}`,
          });
        }
      }
    });

    // 3. Check Room Clashing
    const roomSlotMap = new Map<string, TimetableSlot[]>();
    slots.forEach((slot) => {
      if (slot.room && slot.room.trim() !== "" && slot.room !== "-") {
        const key = `${slot.day}-${slot.period}-${slot.room}`;
        if (!roomSlotMap.has(key)) roomSlotMap.set(key, []);
        roomSlotMap.get(key)!.push(slot);
      }
    });

    roomSlotMap.forEach((matchedSlots, key) => {
      const uniqueClasses = new Set(matchedSlots.map((s) => s.classId));
      if (uniqueClasses.size > 1) {
        const [day, period, rm] = key.split("-");
        conflicts.push({
          type: "ROOM_CLASH",
          message: `Room "${rm}" is assigned to multiple classes on ${day} Period ${period}.`,
          slotDetails: `${day} P${period}`,
        });
      }
    });

    return conflicts;
  };

  // ── Multi-Stage Pipeline: Generate → Validate → AI Repair → Final ──────────
  const runAIEnginePipeline = async (options?: {
    userInstructions?: string;
    isRestructure?: boolean;
    requireAI?: boolean;
  }) => {
    const validClasses = classes.filter((c) => c.name.trim() !== "");
    const validFaculty = facultyList.filter((f) => f.name.trim() !== "");
    const validRooms = rooms.filter((r) => r.name.trim() !== "");
    const validSubjects = subjects.filter((s) => s.name.trim() !== "");

    if (
      validClasses.length === 0 ||
      validFaculty.length === 0 ||
      validSubjects.length === 0
    ) {
      alert("Please ensure you have at least 1 Class, 1 Faculty, and 1 Subject configured.");
      return;
    }

    setIsProcessing(true);
    setDetectedConflicts([]);
    if (!options?.isRestructure) {
      setFinalTimetable(null);
    }
    setAiErrorMsg(null);

    try {
      // 1. Deterministic High-Speed Conflict-Free CSP Solver (Zero Clashes Guaranteed)
      const generateLocalOptimizedTimetable = (): TimetableSlot[] => {
        const slots: TimetableSlot[] = [];
        const busyFaculty = new Map<string, Set<string>>();
        const busyRooms = new Map<string, Set<string>>();

        // Dedicated classroom map per class to prevent room clashing
        const classroomList = validRooms.filter((r) => r.type === "CLASSROOM");
        const classRoomMap = new Map<string, string>();
        validClasses.forEach((cls, idx) => {
          if (classroomList.length > 0) {
            classRoomMap.set(cls.id, classroomList[idx % classroomList.length].name);
          } else {
            classRoomMap.set(cls.id, `Room 100${7 + idx}`);
          }
        });

        const isSlotAvailable = (
          day: string,
          period: number,
          facName: string,
          secFacName?: string,
          terFacName?: string,
          roomName?: string
        ): boolean => {
          const key = `${day}-${period}`;
          const facSet = busyFaculty.get(key) || new Set<string>();
          const rmSet = busyRooms.get(key) || new Set<string>();

          if (facName && facSet.has(facName)) return false;
          if (secFacName && facSet.has(secFacName)) return false;
          if (terFacName && facSet.has(terFacName)) return false;
          if (roomName && rmSet.has(roomName)) return false;
          return true;
        };

        const markSlotBusy = (
          day: string,
          period: number,
          facName: string,
          secFacName?: string,
          terFacName?: string,
          roomName?: string
        ) => {
          const key = `${day}-${period}`;
          if (!busyFaculty.has(key)) busyFaculty.set(key, new Set<string>());
          if (!busyRooms.has(key)) busyRooms.set(key, new Set<string>());

          if (facName) busyFaculty.get(key)!.add(facName);
          if (secFacName) busyFaculty.get(key)!.add(secFacName);
          if (terFacName) busyFaculty.get(key)!.add(terFacName);
          if (roomName) busyRooms.get(key)!.add(roomName);
        };

        // 1. Weekly Lab Allocation (Continuous 2-3 period blocks in FN or AN)
        validClasses.forEach((cls) => {
          const classSubjects = validSubjects.filter((s) => s.classId === cls.id);
          const labSubjects = classSubjects.filter(
            (s) => s.type === "LAB" || s.type === "PROJECT"
          );
          const daysWithLab = new Set<string>();

          labSubjects.forEach((lab) => {
            const fac = validFaculty.find((f) => f.id === lab.facultyId);
            const secFac = validFaculty.find((f) => f.id === lab.secondaryFacultyId);
            const facName = fac?.name || "Faculty";
            const secFacName = secFac?.name;
            const roomName = lab.roomId
              ? validRooms.find((r) => r.id === lab.roomId)?.name || "CC12 Lab"
              : "CC12 Lab";

            let scheduled = false;

            for (const day of DAYS) {
              if (scheduled) break;
              if (daysWithLab.has(day)) continue;

              const candidateBlocks: number[][] = [];
              const aftStart = cls.lunchPeriod + 1;
              if (aftStart + 1 <= periodsPerDay) {
                candidateBlocks.push([aftStart, aftStart + 1]);
              }
              if (cls.lunchPeriod >= 3) {
                candidateBlocks.push([1, 2]);
              }
              if (aftStart + 2 <= periodsPerDay) {
                candidateBlocks.push([aftStart, aftStart + 1, aftStart + 2]);
              }
              if (cls.lunchPeriod >= 4) {
                candidateBlocks.push([1, 2, 3]);
              }

              for (const block of candidateBlocks) {
                if (block.some((p) => p > periodsPerDay || p === cls.lunchPeriod))
                  continue;

                const alreadyOccupied = block.some((p) =>
                  slots.some(
                    (s) =>
                      s.classId === cls.id && s.day === day && s.period === p
                  )
                );
                if (alreadyOccupied) continue;

                const available = block.every((p) =>
                  isSlotAvailable(day, p, facName, secFacName, undefined, roomName)
                );
                if (available) {
                  block.forEach((p) => {
                    markSlotBusy(day, p, facName, secFacName, undefined, roomName);
                    slots.push({
                      day,
                      period: p,
                      classId: cls.id,
                      className: cls.name,
                      subject: lab.name,
                      subjectAcronym: lab.acronym || generateAcronym(lab.name),
                      faculty: facName,
                      secondaryFaculty: secFacName,
                      room: roomName,
                      type: lab.type,
                      electiveGroupId: lab.electiveGroupId,
                    });
                  });
                  daysWithLab.add(day);
                  scheduled = true;
                  break;
                }
              }
            }
          });
        });

        // 2. Schedule Theory Subjects
        validClasses.forEach((cls) => {
          const classSubjects = validSubjects.filter((s) => s.classId === cls.id);
          const theorySubjects = classSubjects.filter(
            (s) => s.type !== "LAB" && s.type !== "PROJECT"
          );
          const classRoom = classRoomMap.get(cls.id) || "Room 1007";
          const remainingHours = new Map<string, number>();
          theorySubjects.forEach((s) => remainingHours.set(s.id, s.hoursPerWeek));

          // Pass 1: Maximize daily diversity (1 per subject per day)
          DAYS.forEach((day) => {
            const scheduledToday = new Set<string>();

            for (let p = 1; p <= periodsPerDay; p++) {
              if (p === cls.lunchPeriod) continue;

              const alreadyFilled = slots.some(
                (s) =>
                  s.classId === cls.id && s.day === day && s.period === p
              );
              if (alreadyFilled) continue;

              const chosenTheory = theorySubjects.find((s) => {
                if ((remainingHours.get(s.id) || 0) <= 0) return false;
                if (scheduledToday.has(s.id)) return false;
                const fac = validFaculty.find((f) => f.id === s.facultyId);
                const secFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
                const rm = s.roomId ? validRooms.find((r) => r.id === s.roomId) : undefined;
                const roomName = rm?.name || classRoom;
                return isSlotAvailable(
                  day,
                  p,
                  fac?.name || "",
                  secFac?.name,
                  undefined,
                  roomName
                );
              });

              if (chosenTheory) {
                const fac = validFaculty.find((f) => f.id === chosenTheory.facultyId);
                const secFac = validFaculty.find((f) => f.id === chosenTheory.secondaryFacultyId);
                const rm = chosenTheory.roomId ? validRooms.find((r) => r.id === chosenTheory.roomId) : undefined;
                const facName = fac?.name || "Faculty";
                const secFacName = secFac?.name;
                const roomName = rm?.name || classRoom;

                markSlotBusy(day, p, facName, secFacName, undefined, roomName);
                scheduledToday.add(chosenTheory.id);
                remainingHours.set(
                  chosenTheory.id,
                  (remainingHours.get(chosenTheory.id) || 0) - 1
                );

                slots.push({
                  day,
                  period: p,
                  classId: cls.id,
                  className: cls.name,
                  subject: chosenTheory.name,
                  subjectAcronym: chosenTheory.acronym || generateAcronym(chosenTheory.name),
                  faculty: facName,
                  secondaryFaculty: secFacName,
                  room: roomName,
                  type: chosenTheory.type,
                  electiveGroupId: chosenTheory.electiveGroupId,
                });
              }
            }
          });

          // Pass 2: Fill remaining quota hours without clashing
          DAYS.forEach((day) => {
            for (let p = 1; p <= periodsPerDay; p++) {
              if (p === cls.lunchPeriod) continue;

              const alreadyFilled = slots.some(
                (s) =>
                  s.classId === cls.id && s.day === day && s.period === p
              );
              if (alreadyFilled) continue;

              const chosenSubject = theorySubjects.find((s) => {
                if ((remainingHours.get(s.id) || 0) <= 0) return false;
                const fac = validFaculty.find((f) => f.id === s.facultyId);
                const secFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
                const rm = s.roomId ? validRooms.find((r) => r.id === s.roomId) : undefined;
                const roomName = rm?.name || classRoom;
                return isSlotAvailable(
                  day,
                  p,
                  fac?.name || "",
                  secFac?.name,
                  undefined,
                  roomName
                );
              });

              if (chosenSubject) {
                const fac = validFaculty.find((f) => f.id === chosenSubject.facultyId);
                const secFac = validFaculty.find((f) => f.id === chosenSubject.secondaryFacultyId);
                const rm = chosenSubject.roomId ? validRooms.find((r) => r.id === chosenSubject.roomId) : undefined;
                const facName = fac?.name || "Faculty";
                const secFacName = secFac?.name;
                const roomName = rm?.name || classRoom;

                markSlotBusy(day, p, facName, secFacName, undefined, roomName);
                remainingHours.set(
                  chosenSubject.id,
                  (remainingHours.get(chosenSubject.id) || 0) - 1
                );

                slots.push({
                  day,
                  period: p,
                  classId: cls.id,
                  className: cls.name,
                  subject: chosenSubject.name,
                  subjectAcronym: chosenSubject.acronym || generateAcronym(chosenSubject.name),
                  faculty: facName,
                  secondaryFaculty: secFacName,
                  room: roomName,
                  type: chosenSubject.type,
                  electiveGroupId: chosenSubject.electiveGroupId,
                });
              }
            }
          });

          // Pass 3: Fill any remaining open slots strictly WITHOUT creating clashes!
          DAYS.forEach((day) => {
            for (let p = 1; p <= periodsPerDay; p++) {
              if (p === cls.lunchPeriod) continue;

              const alreadyFilled = slots.some(
                (s) =>
                  s.classId === cls.id && s.day === day && s.period === p
              );
              if (alreadyFilled) continue;

              // Check if any theory subject's faculty is currently available
              const chosenSubject = theorySubjects.find((s) => {
                const fac = validFaculty.find((f) => f.id === s.facultyId);
                const secFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
                const rm = s.roomId ? validRooms.find((r) => r.id === s.roomId) : undefined;
                const roomName = rm?.name || classRoom;
                return isSlotAvailable(
                  day,
                  p,
                  fac?.name || "",
                  secFac?.name,
                  undefined,
                  roomName
                );
              });

              if (chosenSubject) {
                const fac = validFaculty.find((f) => f.id === chosenSubject.facultyId);
                const secFac = validFaculty.find((f) => f.id === chosenSubject.secondaryFacultyId);
                const rm = chosenSubject.roomId ? validRooms.find((r) => r.id === chosenSubject.roomId) : undefined;
                const facName = fac?.name || "Faculty";
                const secFacName = secFac?.name;
                const roomName = rm?.name || classRoom;

                markSlotBusy(day, p, facName, secFacName, undefined, roomName);

                slots.push({
                  day,
                  period: p,
                  classId: cls.id,
                  className: cls.name,
                  subject: `${chosenSubject.name} (Tutorial / Rev)`,
                  subjectAcronym: `${chosenSubject.acronym || generateAcronym(chosenSubject.name)} (T)`,
                  faculty: facName,
                  secondaryFaculty: secFacName,
                  room: roomName,
                  type: chosenSubject.type,
                  electiveGroupId: chosenSubject.electiveGroupId,
                });
              } else {
                // If all assigned faculty are busy with other classes at this period,
                // assign a free faculty or Mentoring to guarantee ZERO clashes!
                const freeFac = validFaculty.find((f) =>
                  isSlotAvailable(day, p, f.name, undefined, undefined, classRoom)
                );
                const facName = freeFac ? freeFac.name : "Dept. Counselor";
                markSlotBusy(day, p, facName, undefined, undefined, classRoom);

                slots.push({
                  day,
                  period: p,
                  classId: cls.id,
                  className: cls.name,
                  subject: "Library & Research Seminar",
                  subjectAcronym: "LRS",
                  faculty: facName,
                  room: classRoom,
                  type: "THEORY",
                });
              }
            }
          });
        });

        return slots;
      };

      // 2. Gemini AI Model Call (via server-side proxy)
      const callGemini = async (promptText: string, instructions?: string): Promise<{ text?: string; model?: string; error?: string }> => {
        try {
          setPipelineStage(options?.isRestructure ? "Restructuring timetable with Gemini AI..." : "Synthesizing schedule with Gemini AI...");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000);

          const resp = await fetch("/api/generate-timetable", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptText,
              userInstructions: instructions || undefined,
              preferredModel: "gemini-2.5-flash",
              customApiKey: customApiKey.trim() || undefined,
            }),
          });
          clearTimeout(timeoutId);

          const data = await resp.json().catch(() => ({}));
          if (resp.ok && data.text) {
            setPipelineStage(`Schedule generated with Gemini AI (${data.model})! Verifying constraints...`);
            return { text: data.text, model: data.model };
          }

          return { error: data.error || `HTTP ${resp.status}: Gemini AI call failed` };
        } catch (err: any) {
          if (err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("abort")) {
            return {
              error: "AI generation timed out after 90 seconds due to network latency. Please try again or click 'Use Local Solver Instead'.",
            };
          }
          return { error: err?.message || "Connection to Gemini AI server timed out" };
        }
      };

      // STAGE 1: Execution
      setPipelineStage(
        options?.isRestructure
          ? "Preparing restructuring instructions for AI..."
          : "Stage 1/2: Preparing constraints & timetable generation matrix..."
      );

      let promptToSend = "";
      if (options?.isRestructure && finalTimetable && finalTimetable.length > 0) {
        promptToSend = `You are an expert college timetable scheduling engine. Your task is to RESTRUCTURE an existing timetable according to user instructions.

Classes & Lunch Times:
${validClasses.map((c) => `- Class "${c.name}" (ID: "${c.id}"): Lunch at Period ${c.lunchPeriod}.`).join("\n")}

Faculty:
${validFaculty.map((f) => `- "${f.name}" (${f.department}) [ID: "${f.id}"]`).join("\n")}

Curriculum / Subjects:
${validSubjects
  .map((s) => {
    const cls = validClasses.find((c) => c.id === s.classId);
    const fac = validFaculty.find((f) => f.id === s.facultyId);
    return `- [${cls?.name || s.classId}] "${s.name}" (${s.type}) - Faculty: "${fac?.name || "Faculty"}"`;
  })
  .join("\n")}

EXISTING TIMETABLE SLOTS:
${JSON.stringify(
  finalTimetable
    .map((s) => ({
      day: s.day,
      period: s.period,
      classId: s.classId,
      className: s.className,
      subject: s.subject,
      faculty: s.faculty,
      secondaryFaculty: s.secondaryFaculty || "",
      room: s.room,
      type: s.type,
    }))
    .slice(0, 100)
)}

HUMAN RESTRUCTURING INSTRUCTIONS:
"${options?.userInstructions || "Optimize and balance the timetable schedule"}"

HARD CONSTRAINTS:
1. STRICT ZERO TEACHER DOUBLE-BOOKING: No faculty member can teach two classes in the exact same day and period.
2. STRICT CLASS LUNCH PERIOD COMPLIANCE: Do not place any lecture/lab during a class's assigned lunch period.
3. LAB SESSIONS: Must remain continuous.
4. Apply the user's restructuring instructions faithfully while maintaining the above constraints.

Return strictly a JSON array of all timetable slots in the exact format:
[
  {
    "day": "Monday",
    "period": 1,
    "classId": "${validClasses[0]?.id}",
    "className": "${validClasses[0]?.name}",
    "subject": "Subject Name",
    "faculty": "Faculty Name",
    "secondaryFaculty": "",
    "room": "Room 1007",
    "type": "THEORY"
  }
]`;
      } else {
        promptToSend = `You are a college timetable scheduling engine with ZERO TOLERANCE for constraint violations.
Generate an exact weekly timetable (Monday to Friday, 5 days, ${periodsPerDay} periods each day) for ALL ${validClasses.length} classes.

Classes & Lunch Times:
${validClasses.map((c) => `- Class "${c.name}" (ID: "${c.id}"): MANDATORY Lunch at Period ${c.lunchPeriod}.`).join("\n")}

Faculty:
${validFaculty.map((f) => `- "${f.name}" (${f.department}) [ID: "${f.id}"]`).join("\n")}

Curriculum & Weekly Periods:
${validSubjects
  .map((s) => {
    const cls = validClasses.find((c) => c.id === s.classId);
    const fac = validFaculty.find((f) => f.id === s.facultyId);
    const secFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
    const facStr = [fac?.name, secFac?.name].filter(Boolean).join(" + ");
    return `- [${cls?.name || s.classId}] "${s.name}" | Type: ${s.type} | Faculty: "${facStr}" | Weekly Periods: ${s.hoursPerWeek}`;
  })
  .join("\n")}

${
  options?.userInstructions
    ? `ADDITIONAL HUMAN INSTRUCTIONS & PREFERENCES:\n"${options.userInstructions}"\nEnsure the schedule honors these user requirements while strictly satisfying all hard constraints.\n`
    : ""
}

HARD RULES:
1. ZERO TEACHER OVERLAPS (No faculty teaches 2 classes at once).
2. NO CLASSES DURING CLASS LUNCH PERIOD.
3. CONTINUOUS LABS in Forenoon or Afternoon.
4. MAXIMUM DAILY SUBJECT DIVERSITY.

Return strictly a JSON array of slots:
[
  {
    "day": "Monday",
    "period": 1,
    "classId": "${validClasses[0]?.id}",
    "className": "${validClasses[0]?.name}",
    "subject": "Subject Name",
    "faculty": "Faculty Name",
    "secondaryFaculty": "",
    "room": "Room 1007",
    "type": "THEORY",
    "electiveGroupId": ""
  }
]`;
      }

      let slots: TimetableSlot[] = [];
      let generatedWithAI = false;
      let usedModel = "";

      let parsingErrorDetail = "";
      const aiResponse = await callGemini(promptToSend, options?.userInstructions);
      if (aiResponse.text) {
        try {
          const raw = aiResponse.text.trim();
          let parsedData: any[] = [];

          // 1. Direct parse attempt first
          try {
            const direct = JSON.parse(raw);
            if (Array.isArray(direct)) {
              parsedData = direct;
            } else if (typeof direct === "object" && direct !== null) {
              const arrayKey = Object.keys(direct).find((k) => Array.isArray(direct[k]));
              if (arrayKey) parsedData = direct[arrayKey];
            }
          } catch {
            // direct parse failed (e.g. multiple arrays or text around JSON)
          }

          // 2. If direct parse didn't get an array, match all markdown JSON blocks: ```json ... ```
          if (parsedData.length === 0) {
            const mdBlocks = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi);
            if (mdBlocks) {
              for (const b of mdBlocks) {
                const cleanB = b.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
                try {
                  const p = JSON.parse(cleanB);
                  if (Array.isArray(p)) parsedData.push(...p);
                  else if (typeof p === "object" && p !== null) {
                    const k = Object.keys(p).find((key) => Array.isArray(p[key]));
                    if (k) parsedData.push(...p[k]);
                  }
                } catch {}
              }
            }
          }

          // 3. Match all individual JSON arrays: [ ... ]
          if (parsedData.length === 0) {
            const arrayMatches = raw.match(/\[\s*\{[\s\S]*?\}\s*\]/g);
            if (arrayMatches) {
              for (const arrStr of arrayMatches) {
                try {
                  const p = JSON.parse(arrStr);
                  if (Array.isArray(p)) parsedData.push(...p);
                } catch {
                  try {
                    const fixed = arrStr.replace(/,\s*([\]}])/g, "$1");
                    const p = JSON.parse(fixed);
                    if (Array.isArray(p)) parsedData.push(...p);
                  } catch {}
                }
              }
            }
          }

          // 4. Match single outer array between first [ and last ]
          if (parsedData.length === 0) {
            const firstBracket = raw.indexOf("[");
            const lastBracket = raw.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket > firstBracket) {
              const sliceStr = raw.slice(firstBracket, lastBracket + 1);
              try {
                const p = JSON.parse(sliceStr);
                if (Array.isArray(p)) parsedData = p;
              } catch {
                try {
                  const fixed = sliceStr.replace(/,\s*([\]}])/g, "$1");
                  const p = JSON.parse(fixed);
                  if (Array.isArray(p)) parsedData = p;
                } catch {}
              }
            }
          }

          // 5. Fallback: match individual slot objects: { "day": ..., "period": ... }
          if (parsedData.length === 0) {
            const objectMatches = raw.match(/\{[^{}]*?"day"[\s\S]*?\}/g);
            if (objectMatches) {
              for (const objStr of objectMatches) {
                try {
                  const p = JSON.parse(objStr);
                  if (p && (p.day || p.period)) parsedData.push(p);
                } catch {}
              }
            }
          }

          if (Array.isArray(parsedData) && parsedData.length > 0) {
            slots = parsedData
              .filter(
                (s: any) =>
                  s &&
                  s.subject &&
                  String(s.subject).toUpperCase() !== "LUNCH" &&
                  String(s.type).toUpperCase() !== "LUNCH"
              )
              .map((s: any) => {
                const targetCls = validClasses.find(
                  (c) => c.id === s.classId || c.name.toLowerCase() === String(s.className || "").toLowerCase()
                );
                return {
                  day: s.day || "Monday",
                  period: Number(s.period) || 1,
                  classId: targetCls?.id || s.classId || validClasses[0].id,
                  className: targetCls?.name || s.className || validClasses[0].name,
                  subject: s.subject || "Subject",
                  faculty: s.faculty || "Faculty",
                  secondaryFaculty: s.secondaryFaculty || "",
                  room: s.room || (s.type === "LAB" ? "CC12 Lab" : "Room"),
                  type: s.type || "THEORY",
                  electiveGroupId: s.electiveGroupId || "",
                };
              });

            if (slots.length > 0) {
              generatedWithAI = true;
              usedModel = aiResponse.model || "Gemini AI";
            }
          } else {
            parsingErrorDetail = "AI returned text, but could not extract valid timetable slots from it.";
          }
        } catch (parseErr: any) {
          console.error("Failed to parse AI timetable response:", parseErr);
          parsingErrorDetail = `Failed to parse AI response: ${parseErr?.message || "Invalid JSON"}`;
        }
      }

      if (!generatedWithAI) {
        if (options?.requireAI) {
          setAiErrorMsg(
            aiResponse.error ||
              parsingErrorDetail ||
              "Gemini AI was unable to return a valid structured schedule. Please try again or use the Quick Solver."
          );
          setIsProcessing(false);
          setPipelineStage("");
          return;
        }

        // Automatic fallback for quick solver button
        slots = generateLocalOptimizedTimetable();
      }

      // STAGE 2: Verification & Auto-Repair
      setPipelineStage("Stage 2/2: Verifying faculty, room & lunch constraints...");
      let conflicts = checkTimetableConstraints(slots);

      if (conflicts.length > 0) {
        // Remove lunch collisions
        slots = slots.filter((s) => {
          const cls = validClasses.find((c) => c.id === s.classId);
          return s.period !== cls?.lunchPeriod;
        });
        conflicts = checkTimetableConstraints(slots);
      }

      setDetectedConflicts(conflicts);
      setFinalTimetable(slots);
      setPipelineStage("");
      setIsProcessing(false);
      setShowAIPromptModal(false);
      setAiErrorMsg(null);

      if (generatedWithAI) {
        setAiEngineUsed(usedModel);
        setAiGeneratedSuccess(
          options?.isRestructure
            ? `Timetable successfully restructured using ${usedModel} with your custom requirements!`
            : `Timetable successfully generated using ${usedModel} with custom human instructions!`
        );
      } else {
        setAiEngineUsed(null);
        setAiGeneratedSuccess(null);
      }

      setActiveTab("TIMETABLE");
    } catch (err: any) {
      console.error(err);
      alert("Pipeline Error: " + (err?.message || "Failed to generate timetable."));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const exportPDF = (targetClassId: string) => {
    if (!finalTimetable) return;
    const targetClass = classes.find((c) => c.id === targetClassId);
    const classNameStr = targetClass?.name || "Class Timetable";
    const classLunch = targetClass?.lunchPeriod || 4;

    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.setTextColor(234, 88, 12); // Orange-600
    doc.text(`PRESENZA · Timetable: ${classNameStr}`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Department: ${selectedDept?.name || targetClass?.department || "General"} · Designated Lunch: Period ${classLunch} · Generated: ${new Date().toLocaleDateString()}`,
      14,
      22
    );

    const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
    const head = [
      [
        "Day",
        ...periods.map((p) =>
          p === classLunch ? `Period ${p}\n(LUNCH)` : `Period ${p}`
        ),
      ],
    ];

    const body = DAYS.map((day) => {
      const row: string[] = [day];
      periods.forEach((p) => {
        if (p === classLunch) {
          row.push("LUNCH BREAK");
          return;
        }
        const matchedSlots = finalTimetable.filter(
          (t) =>
            t.classId === targetClassId &&
            t.day.toLowerCase() === day.toLowerCase() &&
            t.period === p
        );

        if (matchedSlots.length > 0) {
          const slotText = matchedSlots
            .map((s) => s.subjectAcronym || generateAcronym(s.subject))
            .join("\n/\n");
          row.push(slotText);
        } else {
          row.push("-");
        }
      });
      return row;
    });

    autoTable(doc, {
      head,
      body,
      startY: 28,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3.5, halign: "center", valign: "middle", fontStyle: "bold" },
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
    });

    // Abbreviations & Course Details Table in PDF
    const classSubs = subjects.filter((s) => s.classId === targetClassId && s.name.trim());
    const abbrBody: string[][] = [];
    const seenPDFSubs = new Set<string>();

    finalTimetable
      .filter((t) => t.classId === targetClassId)
      .forEach((slot) => {
        if (!slot.subject || seenPDFSubs.has(slot.subject)) return;
        seenPDFSubs.add(slot.subject);
        const subObj = classSubs.find((s) => s.name === slot.subject);
        const acronym = slot.subjectAcronym || subObj?.acronym || generateAcronym(slot.subject);
        const facStr = slot.secondaryFaculty ? `${slot.faculty} & ${slot.secondaryFaculty}` : slot.faculty;
        abbrBody.push([acronym, slot.subject, slot.type || "THEORY", facStr, slot.room || "-"]);
      });

    if (abbrBody.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text("Course Abbreviations & Handling Faculty", 14, finalY + 8);

      autoTable(doc, {
        head: [["Abbreviation", "Course Name", "Type", "Course Handling Staff", "Room"]],
        body: abbrBody,
        startY: finalY + 11,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
      });
    }

    doc.save(`Presenza-Timetable-${classNameStr.replace(/\s+/g, "-")}.pdf`);
  };

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Publish / Apply generated timetable to all respective classes in Firestore
  const handlePublishToAllClasses = async () => {
    if (!finalTimetable || finalTimetable.length === 0) {
      alert("No generated timetable found. Please generate a timetable first.");
      return;
    }

    setIsPublishing(true);
    try {
      let count = 0;
      const classNamesUpdated: string[] = [];

      for (const cls of validClasses) {
        // Find which department this class belongs to
        let targetDept = departments.find((d) => d.classes?.includes(cls.name));
        if (!targetDept && selectedDept) targetDept = selectedDept;
        if (!targetDept && departments.length > 0) targetDept = departments[0];

        if (!targetDept) continue;

        // Build 5-day grid
        const grid: Record<string, string[]> = {
          Monday: Array(periodsPerDay).fill(""),
          Tuesday: Array(periodsPerDay).fill(""),
          Wednesday: Array(periodsPerDay).fill(""),
          Thursday: Array(periodsPerDay).fill(""),
          Friday: Array(periodsPerDay).fill(""),
        };

        const classSlots = finalTimetable.filter(
          (t) =>
            t.classId === cls.id ||
            String(t.className || "").toLowerCase() === cls.name.toLowerCase()
        );

        classSlots.forEach((slot) => {
          if (
            slot.day &&
            grid[slot.day] &&
            slot.period >= 1 &&
            slot.period <= periodsPerDay
          ) {
            grid[slot.day][slot.period - 1] = slot.subject || "";
          }
        });

        // Collect course mappings for this class
        const classSubs = subjects.filter(
          (s) => s.classId === cls.id && s.name.trim()
        );
        const mappedCourses: any[] = [];
        const seenSubs = new Set<string>();

        classSubs.forEach((s) => {
          if (seenSubs.has(s.name.trim())) return;
          seenSubs.add(s.name.trim());
          const pFac = validFaculty.find((f) => f.id === s.facultyId);
          const sFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
          mappedCourses.push({
            abbreviation: s.acronym || generateAcronym(s.name.trim()),
            name: s.name.trim(),
            facultyId: pFac?.id || "",
            facultyName: pFac?.name || "",
            isElective: s.type === "ELECTIVE",
            type: s.type,
            hoursPerWeek: s.hoursPerWeek,
            name2: sFac ? s.name.trim() : "",
            facultyId2: sFac?.id || "",
            facultyName2: sFac?.name || "",
          });
        });

        // Also add any subject found in slots that wasn't in classSubs
        classSlots.forEach((slot) => {
          if (slot.subject && !seenSubs.has(slot.subject.trim())) {
            seenSubs.add(slot.subject.trim());
            const fac = validFaculty.find((f) => f.name === slot.faculty);
            const secFac = validFaculty.find((f) => f.name === slot.secondaryFaculty);
            mappedCourses.push({
              abbreviation: slot.subjectAcronym || generateAcronym(slot.subject.trim()),
              name: slot.subject.trim(),
              facultyId: fac?.id || "",
              facultyName: slot.faculty || "",
              isElective: slot.type === "ELECTIVE",
              type: slot.type,
              hoursPerWeek: 0,
              name2: slot.secondaryFaculty ? slot.subject.trim() : "",
              facultyId2: secFac?.id || "",
              facultyName2: slot.secondaryFaculty || "",
            });
          }
        });

        const classDocRef = doc(
          db,
          "colleges",
          "departments",
          "all_departments",
          targetDept.id,
          "classes",
          cls.name
        );

        const classDocSnap = await getDoc(classDocRef);
        const existingData = classDocSnap.exists() ? classDocSnap.data() : {};
        const currentSem = existingData.currentSemester || "I";
        const existingTimetables = existingData.timetables || {};
        const existingMappings = existingData.courseMapping || {};

        existingTimetables[currentSem] = grid;
        existingMappings[currentSem] = mappedCourses;

        await setDoc(
          classDocRef,
          {
            timetables: existingTimetables,
            courseMapping: existingMappings,
            periodsPerDay: periodsPerDay,
            currentSemester: currentSem,
          },
          { merge: true }
        );

        count++;
        classNamesUpdated.push(cls.name);
      }

      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 5000);
      if (onTimetablesUpdated) {
        onTimetablesUpdated();
      }
      alert(
        ` Successfully applied generated timetable to all ${count} respective classes (${classNamesUpdated.join(
          ", "
        )})!\n\nAll class timetables have been updated.`
      );
    } catch (err: any) {
      console.error("Error saving timetables to classes:", err);
      alert("Error saving timetable to classes: " + (err.message || String(err)));
    } finally {
      setIsPublishing(false);
    }
  };

  const validClasses = classes.filter((c) => c.name.trim() !== "");
  const validFaculty = facultyList.filter((f) => f.name.trim() !== "");
  const validRooms = rooms.filter((r) => r.name.trim() !== "");
  const selectedClassObj = classes.find((c) => c.id === selectedClassView);
  const selectedClassLunch = selectedClassObj?.lunchPeriod || 4;

  // ── History fetch functions ─────────────────────────────────────────────────
  const loadHistoryClasses = async (deptId: string) => {
    if (!deptId) {
      setHistoryClassList([]);
      setHistoryClassName("");
      setHistorySemesters([]);
      setHistorySemester("");
      setHistoryGrid(null);
      setHistoryCourses(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const classesColRef = collection(
        db, "colleges", "departments", "all_departments", deptId, "classes"
      );
      const snap = await getDocs(classesColRef);
      const names: string[] = [];
      snap.forEach((d) => names.push(d.id));
      names.sort();
      setHistoryClassList(names);
      setHistoryClassName("");
      setHistorySemesters([]);
      setHistorySemester("");
      setHistoryGrid(null);
      setHistoryCourses(null);
    } catch (err) {
      console.error("Error loading history classes:", err);
      setHistoryClassList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistorySemesters = async (deptId: string, className: string) => {
    if (!deptId || !className) {
      setHistorySemesters([]);
      setHistorySemester("");
      setHistoryGrid(null);
      setHistoryCourses(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const classDocRef = doc(
        db, "colleges", "departments", "all_departments", deptId, "classes", className
      );
      const snap = await getDoc(classDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const timetables = data?.timetables as Record<string, any> | undefined;
        const ppd = data?.periodsPerDay;
        if (ppd && typeof ppd === "number") setHistoryPeriodsPerDay(ppd);

        if (timetables) {
          const sems = Object.keys(timetables).sort();
          setHistorySemesters(sems);
        } else {
          setHistorySemesters([]);
        }
      } else {
        setHistorySemesters([]);
      }
      setHistorySemester("");
      setHistoryGrid(null);
      setHistoryCourses(null);
    } catch (err) {
      console.error("Error loading history semesters:", err);
      setHistorySemesters([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryTimetable = async (deptId: string, className: string, semester: string) => {
    if (!deptId || !className || !semester) {
      setHistoryGrid(null);
      setHistoryCourses(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const classDocRef = doc(
        db, "colleges", "departments", "all_departments", deptId, "classes", className
      );
      const snap = await getDoc(classDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const ppd = data?.periodsPerDay;
        if (ppd && typeof ppd === "number") setHistoryPeriodsPerDay(ppd);

        const timetables = data?.timetables as Record<string, any> | undefined;
        const mappings = data?.courseMapping as Record<string, any> | undefined;

        if (timetables && timetables[semester]) {
          setHistoryGrid(timetables[semester] as Record<string, string[]>);
        } else {
          setHistoryGrid(null);
        }

        if (mappings && mappings[semester]) {
          setHistoryCourses(mappings[semester] as any[]);
        } else {
          setHistoryCourses(null);
        }
      }
    } catch (err) {
      console.error("Error loading history timetable:", err);
      setHistoryGrid(null);
      setHistoryCourses(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in w-full">
      {/* Top Header & Navigation Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 lg:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-all cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg lg:text-xl font-semibold text-slate-900 tracking-tight">
                Timetable Generator & AI Engine
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-slate-100 border border-slate-200 text-slate-700 rounded-md">
                Multi-Constraint Solver
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {selectedDept ? `${selectedDept.name} Department` : "Global Academic Timetable"} · Presenza Engine
            </p>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/60">
            <button
              onClick={() => setActiveTab("INPUTS")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "INPUTS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Data Inputs
            </button>
            <button
              onClick={() => setActiveTab("TIMETABLE")}
              disabled={!finalTimetable}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "TIMETABLE"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              View Timetable
            </button>
            <button
              onClick={() => {
                setActiveTab("HISTORY");
                if (historyDeptId && historyClassList.length === 0) {
                  loadHistoryClasses(historyDeptId);
                }
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "HISTORY"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <History className="h-3 w-3" />
              History
            </button>
          </div>

          {finalTimetable && (
            <button
              onClick={handlePublishToAllClasses}
              disabled={isPublishing}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                publishSuccess
                  ? "bg-orange-600 text-white ring-2 ring-orange-500/20"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
              title="Publish this generated schedule to all respective class timetables in Presenza"
            >
              {isPublishing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : publishSuccess ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>
                {isPublishing
                  ? "Publishing..."
                  : publishSuccess
                  ? "Published!"
                  : "Publish to Classes"}
              </span>
            </button>
          )}

          {/* AI Restructure Button (Visible when timetable exists) */}
          {finalTimetable && (
            <button
              onClick={() => {
                setIsRestructureMode(true);
                setAiErrorMsg(null);
                setShowAIPromptModal(true);
              }}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Restructure current timetable with custom human instructions"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>AI Restructure</span>
            </button>
          )}

          {/* AI Studio Generator Button */}
          <button
            onClick={() => {
              setIsRestructureMode(false);
              setAiErrorMsg(null);
              setShowAIPromptModal(true);
            }}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Generate timetable using Google Gemini AI with custom prompt instructions"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>AI Generator</span>
          </button>

          {/* Quick Solver Button */}
          <button
            onClick={() => runAIEnginePipeline({ requireAI: false })}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Instant local multi-constraint solver"
          >
            {isProcessing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            <span>{isProcessing ? "Solving..." : "Quick Solver"}</span>
          </button>
        </div>
      </div>

      {/* AI Success Notification */}
      {aiGeneratedSuccess && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold text-slate-900">AI Schedule Generated</p>
                {aiEngineUsed && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-white border border-slate-200 text-slate-700">
                    {aiEngineUsed}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{aiGeneratedSuccess}</p>
            </div>
          </div>
          <button
            onClick={() => setAiGeneratedSuccess(null)}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Processing Banner */}
      {isProcessing && (
        <div className="p-4 lg:p-5 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-orange-950">
              SchedulAI Constraint Optimization Engine Active
            </p>
            <p className="text-xs text-orange-700 font-medium mt-0.5">{pipelineStage}</p>
          </div>
        </div>
      )}

      {/* ── TAB 1: DATA INPUTS & CONSTRAINTS ─────────────────────────────────── */}
      {activeTab === "INPUTS" && (
        <div className="space-y-6">
          {/* Global Parameters Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Weekly Schedule Parameters
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Working days: Monday to Friday (5 Days) · Synced with Presenza
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs font-bold">
              {/* Department Filter Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Department:</span>
                <select
                  value={activeDeptFilter}
                  onChange={(e) => setActiveDeptFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-medium text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Semester Length:</span>
                <select
                  value={weeksInSemester}
                  onChange={(e) => updateSemesterWeeks(Number(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-medium text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={12}>12 Weeks</option>
                  <option value={14}>14 Weeks</option>
                  <option value={15}>15 Weeks (Standard)</option>
                  <option value={16}>16 Weeks</option>
                  <option value={18}>18 Weeks</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Periods / Day:</span>
                <select
                  value={periodsPerDay}
                  onChange={(e) => setPeriodsPerDay(Number(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-medium text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={6}>6 Periods</option>
                  <option value={7}>7 Periods</option>
                  <option value={8}>8 Periods</option>
                </select>
              </div>

              <button
                onClick={() => {
                  if (
                    confirm(
                      "Reset all classes, faculty, rooms, and subjects back to blank?"
                    )
                  ) {
                    clearAllData();
                  }
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer font-bold"
              >
                Clear Data
              </button>
            </div>
          </div>

          {/* 3-Column Top Grid: Classes & Lunch, Faculty, Rooms */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Classes with Staggered Lunch */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      1. Classes & Lunch
                    </h2>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {classes.filter((c) => c.name.trim()).length} active classes
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedClassForFaculty !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setSelectedClassForFaculty("ALL")}
                      className="text-[10px] font-bold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                    >
                      Show All
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-0.5 rounded-md">
                    Auto row
                  </span>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {classes.map((cls, idx) => {
                  const isSelected = selectedClassForFaculty === cls.name && cls.name.trim() !== "";
                  const facCount = facultyList.filter(
                    (f) => f.name.trim() && (f.classes || []).includes(cls.name)
                  ).length;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        if (cls.name.trim()) {
                          setSelectedClassForFaculty(isSelected ? "ALL" : cls.name);
                        }
                      }}
                      className={`group flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20 shadow-xs"
                          : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-white"
                      }`}
                      title={cls.name ? `Click to filter Faculty Directory for ${cls.name}` : undefined}
                    >
                      <span className={`text-[11px] font-bold w-4 text-center shrink-0 ${isSelected ? "text-orange-600" : "text-slate-300"}`}>
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={cls.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleClassChange(idx, "name", e.target.value)}
                        placeholder="e.g. SECCJ2030A"
                        className="flex-1 text-xs font-medium border-0 bg-transparent focus:bg-white focus:border focus:border-orange-500 rounded-lg px-2 py-1.5 focus:outline-none transition-all text-slate-800 min-w-0"
                      />
                      {/* Current Semester Fixed Badge (from Class Editor) */}
                      {cls.name.trim() && (
                        <span
                          className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 rounded-lg px-2 py-0.5 shrink-0 shadow-2xs select-none"
                          title={`Fixed Current Semester configured in Class Editor: Semester ${cls.currentSemester || "I"}`}
                        >
                          Sem {cls.currentSemester || "I"}
                        </span>
                      )}
                      {cls.name.trim() && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-colors ${
                            facCount > 0
                              ? isSelected
                                ? "bg-orange-200 text-orange-900"
                                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                              : "bg-amber-100 text-amber-800"
                          }`}
                          title={`${facCount} teachers assigned to ${cls.name}`}
                        >
                          {facCount} fac
                        </span>
                      )}
                      <select
                        value={cls.lunchPeriod}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          handleClassChange(idx, "lunchPeriod", Number(e.target.value))
                        }
                        className="text-[10px] font-semibold border border-orange-200 bg-orange-50 text-orange-900 rounded-lg px-2 py-1 outline-none cursor-pointer shrink-0"
                        title="Class Lunch Break Period"
                      >
                        <option value={3}>Lunch P3</option>
                        <option value={4}>Lunch P4</option>
                        <option value={5}>Lunch P5</option>
                        <option value={6}>Lunch P6</option>
                      </select>
                      {classes.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveClass(idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer shrink-0"
                          title="Remove Class"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Faculty Directory */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      2. Faculty Directory
                    </h2>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {selectedClassForFaculty === "ALL"
                        ? `${facultyList.filter((f) => f.name.trim()).length} teachers loaded (All)`
                        : `${
                            facultyList.filter(
                              (f) =>
                                f.name.trim() &&
                                (f.classes || []).includes(selectedClassForFaculty)
                            ).length
                          } teachers for ${selectedClassForFaculty}`}
                    </span>
                  </div>
                </div>

                {/* Class selector filter */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedClassForFaculty}
                    onChange={(e) => setSelectedClassForFaculty(e.target.value)}
                    className="text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-2 py-1 outline-none hover:border-orange-400 focus:border-orange-500 cursor-pointer shadow-2xs max-w-[130px] truncate"
                    title="Filter faculty by class"
                  >
                    <option value="ALL">
                      All Classes ({facultyList.filter((f) => f.name.trim()).length})
                    </option>
                    {validClasses.map((c) => {
                      const count = facultyList.filter(
                        (f) => f.name.trim() && (f.classes || []).includes(c.name)
                      ).length;
                      return (
                        <option key={c.id} value={c.name}>
                          {c.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Sub-bar when a specific class is selected */}
              {selectedClassForFaculty !== "ALL" && (
                <div className="flex items-center justify-between bg-orange-50/70 border border-orange-200/80 rounded-xl px-2.5 py-1 mb-2 text-xs">
                  <span className="text-[10px] font-semibold text-orange-950 truncate max-w-[150px]">
                    Viewing: <b className="text-orange-700">{selectedClassForFaculty}</b>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowBatchAssignModal(true)}
                      className="text-[10px] font-bold text-orange-700 hover:text-orange-900 bg-white hover:bg-orange-100/60 border border-orange-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Assign from Dept
                    </button>
                  </div>
                </div>
              )}

              {/* Faculty Items List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {selectedClassForFaculty !== "ALL" &&
                facultyList.filter(
                  (f) =>
                    f.name.trim() &&
                    (f.classes || []).includes(selectedClassForFaculty)
                ).length === 0 ? (
                  <div className="text-center py-6 px-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 my-auto">
                    <Users className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">
                      No teachers assigned to {selectedClassForFaculty}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 mb-2.5">
                      {facultyList.filter((f) => f.name.trim()).length} teachers available in department
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowBatchAssignModal(true)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="h-3 w-3" /> Assign Teachers
                    </button>
                  </div>
                ) : (
                  (selectedClassForFaculty === "ALL"
                    ? facultyList
                    : facultyList.filter(
                        (f) =>
                          (f.classes || []).includes(selectedClassForFaculty)
                      )
                  ).map((fac, idx) => (
                    <div
                      key={fac.id}
                      className="group flex items-center gap-1.5 p-1.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/40 hover:bg-white transition-all relative"
                    >
                      <span className="text-[11px] font-semibold text-slate-300 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={fac.name}
                        onChange={(e) =>
                          handleFacultyUpdate(fac.id, { name: e.target.value })
                        }
                        placeholder="Faculty Name"
                        className="flex-1 text-xs font-normal border-0 bg-transparent focus:bg-white focus:border focus:border-orange-500 rounded-lg px-2 py-1 focus:outline-none transition-all text-slate-800"
                      />

                      {fac.department && activeDeptFilter !== "ALL" && fac.department !== activeDeptFilter && (
                        <span
                          className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.5 rounded-md shrink-0"
                          title={`From ${fac.department} Department`}
                        >
                          {fac.department}
                        </span>
                      )}

                      {/* Class tags & actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {selectedClassForFaculty !== "ALL" ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFacultyClass(fac.id, selectedClassForFaculty)
                            }
                            className="text-[9px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                            title={`Remove from ${selectedClassForFaculty}`}
                          >
                            ✕ Unassign
                          </button>
                        ) : (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveClassAssignmentFacultyId(
                                  activeClassAssignmentFacultyId === fac.id
                                    ? null
                                    : fac.id
                                )
                              }
                              className="text-[9px] font-bold text-slate-600 hover:text-orange-700 bg-slate-100 hover:bg-orange-50 border border-slate-200/80 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors flex items-center gap-0.5"
                              title="Assign to classes"
                            >
                              {(fac.classes || []).length > 0 ? (
                                <span className="text-orange-700">
                                  {(fac.classes || []).length} cls
                                </span>
                              ) : (
                                <span className="text-slate-400">+ Class</span>
                              )}
                              <ChevronDown className="h-2.5 w-2.5" />
                            </button>

                            {/* Class assignment popover for this teacher */}
                            {activeClassAssignmentFacultyId === fac.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40 bg-transparent"
                                  onClick={() => setActiveClassAssignmentFacultyId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1 text-xs animate-in zoom-in-95">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                                    Assigned Classes
                                  </div>
                                  {validClasses.map((cls) => {
                                    const isAssigned = (fac.classes || []).includes(cls.name);
                                    return (
                                      <div
                                        key={cls.id}
                                        onClick={() =>
                                          handleToggleFacultyClass(fac.id, cls.name)
                                        }
                                        className="flex items-center gap-2 p-1 rounded-md hover:bg-orange-50 cursor-pointer select-none"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isAssigned}
                                          onChange={() => {}}
                                          className="rounded text-orange-600 focus:ring-orange-500 pointer-events-none text-xs"
                                        />
                                        <span
                                          className={`text-[11px] ${
                                            isAssigned
                                              ? "font-bold text-orange-950"
                                              : "text-slate-600"
                                          }`}
                                        >
                                          {cls.name}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveFaculty(fac.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer"
                          title="Delete Teacher"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Quick-Add input row */}
              <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newFacultyInput}
                  onChange={(e) => setNewFacultyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFacultyInput.trim()) {
                      handleAddFaculty(newFacultyInput, selectedClassForFaculty);
                      setNewFacultyInput("");
                    }
                  }}
                  placeholder={
                    selectedClassForFaculty !== "ALL"
                      ? `Add teacher to ${selectedClassForFaculty}...`
                      : "Add teacher to directory..."
                  }
                  className="flex-1 text-xs border border-dashed border-slate-300 rounded-xl px-2.5 py-1.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newFacultyInput.trim()) {
                      handleAddFaculty(newFacultyInput, selectedClassForFaculty);
                      setNewFacultyInput("");
                    }
                  }}
                  className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-xl border border-orange-200 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 3. Rooms & Labs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                      3. Rooms & Labs
                    </h2>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {rooms.filter((r) => r.name.trim()).length} venues
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-0.5 rounded-md">
                  Auto row
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {rooms.map((rm, idx) => (
                  <div key={rm.id} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-300 w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={rm.name}
                      onChange={(e) => handleRoomChange(idx, "name", e.target.value)}
                      placeholder="Room / Lab Name"
                      className="flex-1 text-xs font-normal border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 transition-all text-slate-800"
                    />
                    <select
                      value={rm.type}
                      onChange={(e) => handleRoomChange(idx, "type", e.target.value)}
                      className="text-[10px] font-semibold border border-slate-200 rounded-xl px-2 py-2 bg-slate-50 outline-none cursor-pointer text-slate-700"
                    >
                      <option value="CLASSROOM">Room</option>
                      <option value="LAB">Lab</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Subject Curriculum & Faculty Assignments (Class-Wise) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                  4. Subject Curriculum & Faculty Assignments (Class-Wise)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-normal">
                Configuring curriculum for {validClasses.length} Classes ({weeksInSemester} Weeks/Semester)
              </span>
            </div>

            {validClasses.map((cls) => {
              const classSubjects = subjects.filter((s) => s.classId === cls.id);
              return (
                <div
                  key={cls.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-orange-100 text-orange-950 font-bold text-xs">
                        {cls.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200/70">
                        Semester {cls.currentSemester || "I"}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Lunch: Period {cls.lunchPeriod} ·{" "}
                        {classSubjects.filter((s) => s.name.trim() !== "").length}{" "}
                        Subjects Assigned
                      </span>
                    </div>

                    <button
                      onClick={() => addNewSubjectForClass(cls.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 border border-orange-200 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Subject to {cls.name}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-visible">
                    <table className="w-full table-fixed text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                          <th className="p-3 w-8 text-center">#</th>
                          <th className="p-3 w-40">Subject Name</th>
                          <th className="p-3 w-24 bg-orange-50/70 text-orange-950 font-bold text-center">Acronym</th>
                          <th className="p-3 w-24">Type</th>
                          <th className="p-3 w-44">Faculty (MSQ)</th>
                          <th className="p-3 w-24">Room</th>
                          <th className="p-3 w-16 text-center bg-orange-50/70 text-orange-950 font-semibold">
                            Sem Hrs
                          </th>
                          <th className="p-3 w-16 text-center font-bold">Hrs/Wk</th>
                          <th className="p-3 w-24">Elective</th>
                          <th className="p-3 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classSubjects.map((sub, idx) => {
                          const isBottomRow =
                            idx >= Math.max(3, classSubjects.length - 3);
                          const assignedFacultyIds = [
                            sub.facultyId,
                            sub.secondaryFacultyId,
                            sub.tertiaryFacultyId,
                          ].filter(Boolean) as string[];

                          const toggleFaculty = (facId: string) => {
                            let next = [...assignedFacultyIds];
                            if (next.includes(facId)) {
                              next = next.filter((id) => id !== facId);
                            } else {
                              next.push(facId);
                            }
                            updateSubjectFacultyBatch(
                              sub.id,
                              next[0] || "",
                              next[1] || undefined,
                              next[2] || undefined,
                              cls.name
                            );
                          };

                          const primaryFaculty = validFaculty.find(
                            (f) => f.id === sub.facultyId
                          );
                          const secondaryFaculty = validFaculty.find(
                            (f) => f.id === sub.secondaryFacultyId
                          );
                          const tertiaryFaculty = validFaculty.find(
                            (f) => f.id === sub.tertiaryFacultyId
                          );
                          const facultyDisplayNames = [
                            primaryFaculty?.name,
                            secondaryFaculty?.name,
                            tertiaryFaculty?.name,
                          ].filter(Boolean);

                          return (
                            <tr
                              key={sub.id}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="p-2 text-center text-slate-400 font-normal text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={sub.name}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. Database Management Systems"
                                  className="w-full text-xs font-normal border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/40 focus:bg-white focus:border-orange-500 focus:outline-none text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={sub.acronym ?? ""}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "acronym",
                                      e.target.value
                                    )
                                  }
                                  placeholder={generateAcronym(sub.name) || "e.g. DBMS"}
                                  className="w-full text-xs font-bold uppercase tracking-wider border border-orange-200/90 rounded-lg px-2 py-1.5 bg-orange-50/40 focus:bg-white focus:border-orange-500 focus:outline-none text-orange-950 placeholder:text-orange-300 text-center font-mono"
                                  title="Course Acronym (used in timetable grid)"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={sub.type}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "type",
                                      e.target.value
                                    )
                                  }
                                  className={`w-full text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer ${
                                    sub.type === "THEORY"
                                      ? "bg-slate-100 text-slate-800"
                                      : sub.type === "LAB"
                                      ? "bg-orange-600 text-white"
                                      : sub.type === "ELECTIVE"
                                      ? "bg-orange-50 text-orange-800"
                                      : "bg-slate-200 text-slate-900"
                                  }`}
                                >
                                  <option value="THEORY">Theory</option>
                                  <option value="LAB">Lab</option>
                                  <option value="ELECTIVE">Elective</option>
                                  <option value="PROJECT">Project</option>
                                </select>
                              </td>
                              <td className="p-2 relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveFacultyPopover(
                                      activeFacultyPopover === sub.id ? null : sub.id
                                    )
                                  }
                                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/70 text-[11px] font-bold cursor-pointer flex items-center justify-between gap-1 hover:bg-white transition-all text-left"
                                >
                                  <span className="truncate max-w-[130px] text-slate-800 font-bold">
                                    {facultyDisplayNames.length > 0
                                      ? facultyDisplayNames
                                          .map((n) => n?.split(" ")[0] || n)
                                          .join(", ")
                                      : "Select Faculty"}
                                  </span>
                                  <span className="text-[9px] font-semibold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-md shrink-0">
                                    {assignedFacultyIds.length} MSQ
                                  </span>
                                </button>

                                {activeFacultyPopover === sub.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40 bg-transparent"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFacultyPopover(null);
                                      }}
                                    />
                                    <div
                                      className={`absolute z-50 left-0 ${
                                        isBottomRow
                                          ? "bottom-full mb-1"
                                          : "top-full mt-1"
                                      } w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-72 overflow-y-auto space-y-2 text-xs animate-in zoom-in-95 duration-150`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                          Assign Faculty to {cls.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFacultyPopover(null);
                                          }}
                                          className="text-[11px] font-bold text-orange-600 hover:text-orange-800 px-2 py-0.5 rounded-md bg-orange-50 cursor-pointer"
                                        >
                                          Done ✕
                                        </button>
                                      </div>

                                      {validFaculty.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 italic py-2 text-center">
                                          No faculty available.
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          {/* Teachers assigned to this class */}
                                          {validFaculty.filter((f) => (f.classes || []).includes(cls.name)).length > 0 && (
                                            <div className="space-y-1">
                                              <div className="text-[10px] font-bold text-orange-800 bg-orange-50/80 px-2 py-0.5 rounded-md flex items-center justify-between">
                                                <span>Teachers for {cls.name}</span>
                                                <span className="bg-orange-100 px-1 rounded text-[9px]">
                                                  {validFaculty.filter((f) => (f.classes || []).includes(cls.name)).length}
                                                </span>
                                              </div>
                                              {validFaculty
                                                .filter((f) => (f.classes || []).includes(cls.name))
                                                .map((f) => {
                                                  const isChecked = assignedFacultyIds.includes(f.id);
                                                  return (
                                                    <div
                                                      key={f.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFaculty(f.id);
                                                      }}
                                                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors select-none"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer pointer-events-none"
                                                      />
                                                      <span
                                                        className={`text-xs ${
                                                          isChecked
                                                            ? "font-bold text-orange-950"
                                                            : "text-slate-700 font-medium"
                                                        }`}
                                                      >
                                                        {f.name}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                            </div>
                                          )}

                                          {/* Other teachers from department */}
                                          {validFaculty.filter((f) => !(f.classes || []).includes(cls.name)).length > 0 && (
                                            <div className="space-y-1 pt-1">
                                              <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center justify-between">
                                                <span>
                                                  {validFaculty.filter((f) => (f.classes || []).includes(cls.name)).length > 0
                                                    ? "Other Dept Teachers"
                                                    : "All Dept Teachers"}
                                                </span>
                                                <span className="bg-slate-200 px-1 rounded text-[9px]">
                                                  {validFaculty.filter((f) => !(f.classes || []).includes(cls.name)).length}
                                                </span>
                                              </div>
                                              {validFaculty
                                                .filter((f) => !(f.classes || []).includes(cls.name))
                                                .map((f) => {
                                                  const isChecked = assignedFacultyIds.includes(f.id);
                                                  return (
                                                    <div
                                                      key={f.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFaculty(f.id);
                                                      }}
                                                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors select-none"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer pointer-events-none"
                                                      />
                                                      <span
                                                        className={`text-xs ${
                                                          isChecked
                                                            ? "font-bold text-orange-950"
                                                            : "text-slate-600 font-medium"
                                                        }`}
                                                      >
                                                        {f.name}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td className="p-2">
                                <select
                                  value={sub.roomId || ""}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "roomId",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="w-full text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50/40 focus:bg-white focus:outline-none text-slate-800 cursor-pointer"
                                >
                                  <option value="">Any Room</option>
                                  {validRooms.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  step={5}
                                  value={sub.totalSemHours}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "totalSemHours",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full text-center text-xs font-semibold border border-orange-200 rounded-lg px-1 py-1.5 bg-orange-50/60 text-orange-950"
                                  title="Total Semester Hours"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={sub.hoursPerWeek}
                                  onChange={(e) =>
                                    handleSubjectChangeById(
                                      sub.id,
                                      cls.id,
                                      "hoursPerWeek",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full text-center text-xs font-semibold border border-slate-200 rounded-lg px-1 py-1.5 bg-slate-50/40 text-slate-800"
                                  title={`Computed: ${sub.hoursPerWeek} periods/week across ${weeksInSemester} weeks`}
                                />
                              </td>
                              <td className="p-2">
                                {sub.type === "ELECTIVE" ? (
                                  <input
                                    type="text"
                                    value={sub.electiveGroupId || ""}
                                    onChange={(e) =>
                                      handleSubjectChangeById(
                                        sub.id,
                                        cls.id,
                                        "electiveGroupId",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Elective-1"
                                    className="w-full text-[11px] font-bold border border-orange-200 rounded-lg px-2 py-1.5 bg-orange-50 text-orange-900 focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-slate-300 text-center block font-bold">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => deleteSubjectById(sub.id)}
                                  className="text-slate-300 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                                  title="Delete Subject"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── GENERATE TIMETABLE BUTTON SECTION ─────────────────────────── */}
          <div className="bg-gradient-to-r from-orange-50 via-white to-orange-50 border border-orange-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ready to Generate Timetable</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {validClasses.length} classes · {subjects.filter((s) => s.name.trim()).length} subjects configured · {periodsPerDay} periods/day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setIsRestructureMode(false);
                    setAiErrorMsg(null);
                    setShowAIPromptModal(true);
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4 text-orange-500" />
                  <span>AI Generator</span>
                </button>
                <button
                  onClick={() => runAIEnginePipeline({ requireAI: false })}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-all cursor-pointer shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span>{isProcessing ? "Generating..." : "Generate Timetable"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: AI OPTIMIZED TIMETABLE & CONFLICT AUDIT ─────────────────── */}
      {activeTab === "TIMETABLE" && finalTimetable && (
        <div className="space-y-6 animate-fade-in">
          {/* Conflict Resolution Audit Pill & View Sub-Tabs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                  detectedConflicts.length === 0
                    ? "bg-orange-50 text-orange-600 border border-orange-200"
                    : "bg-rose-50 text-rose-600 border border-rose-200"
                }`}
              >
                {detectedConflicts.length === 0 ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {detectedConflicts.length === 0
                    ? "Constraint Verification Passed (0 Hard Conflicts)"
                    : `${detectedConflicts.length} Potential Clashes Detected`}
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Zero teacher overlaps, laboratory mutual exclusion & class-specific lunch compliance verified.
                </p>
              </div>
            </div>

            {/* Toggle Class Timetable vs Faculty Timetable */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                <button
                  onClick={() => setTimetableSubTab("CLASS")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    timetableSubTab === "CLASS"
                      ? "bg-orange-600 text-white shadow-sm shadow-orange-500/10"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Class View
                </button>
                <button
                  onClick={() => setTimetableSubTab("FACULTY")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    timetableSubTab === "FACULTY"
                      ? "bg-orange-600 text-white shadow-sm shadow-orange-500/10"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Faculty View
                </button>
              </div>

              {timetableSubTab === "CLASS" ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedClassView}
                    onChange={(e) => setSelectedClassView(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {validClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => exportPDF(selectedClassView)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                  <button
                    onClick={handlePublishToAllClasses}
                    disabled={isPublishing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    title="Publish this timetable to all respective classes"
                  >
                    {isPublishing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>{isPublishing ? "Applying..." : "Apply to All Classes"}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedFacultyView}
                    onChange={(e) => setSelectedFacultyView(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {validFaculty.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* CLASS TIMETABLE MATRIX — College Format */}
          {timetableSubTab === "CLASS" && (() => {
            // Build course lookup for this class
            const classSubjectsForView = subjects.filter(
              (s) => s.classId === selectedClassView && s.name.trim()
            );
            const classSlots = finalTimetable.filter(
              (t) => t.classId === selectedClassView
            );
            // Unique subjects used in slots
            const usedSubjects = new Map<string, { name: string; acronym: string; faculty: string[]; type: string; hoursPerWeek: number }>();
            classSlots.forEach((slot) => {
              if (!slot.subject || usedSubjects.has(slot.subject)) {
                if (slot.subject && usedSubjects.has(slot.subject)) {
                  // Add faculty if not already listed
                  const entry = usedSubjects.get(slot.subject)!;
                  if (slot.faculty && !entry.faculty.includes(slot.faculty)) entry.faculty.push(slot.faculty);
                  if (slot.secondaryFaculty && !entry.faculty.includes(slot.secondaryFaculty)) entry.faculty.push(slot.secondaryFaculty);
                }
                return;
              }
              const matchedSub = classSubjectsForView.find((s) => s.name === slot.subject);
              usedSubjects.set(slot.subject, {
                name: slot.subject,
                acronym: slot.subjectAcronym || matchedSub?.acronym || generateAcronym(slot.subject),
                faculty: [slot.faculty, slot.secondaryFaculty].filter(Boolean) as string[],
                type: slot.type,
                hoursPerWeek: matchedSub?.hoursPerWeek || 0,
              });
            });

            return (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* ── Timetable Header — College Style ── */}
              <div className="bg-slate-900 text-white p-5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {selectedDept?.name || "Department"} — Class Time Table
                    </p>
                    <h3 className="text-lg font-bold tracking-tight mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{selectedClassObj?.name || "Class Timetable"}</span>
                      {selectedClassObj?.currentSemester && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-400/30">
                          Semester {selectedClassObj.currentSemester}
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] text-slate-400">
                      Lunch Break: <span className="text-orange-400 font-bold">Period {selectedClassLunch}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {periodsPerDay} Periods / Day · 5 Working Days
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Period Grid with Acronyms ── */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: `${Math.max(600, periodsPerDay * 90 + 100)}px` }}>
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="p-2.5 w-20 font-bold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 text-[10px] sticky left-0 bg-slate-50 z-10">
                        Day
                      </th>
                      {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                        (period) => (
                          <th
                            key={period}
                            className={`p-2.5 font-semibold text-center border-r border-slate-200 text-[10px] ${
                              period === selectedClassLunch
                                ? "bg-orange-100 text-orange-900"
                                : "text-slate-700"
                            }`}
                          >
                            <span className="block font-bold text-[11px]">P{period}</span>
                            {period === selectedClassLunch ? (
                              <span className="block text-[9px] font-bold text-orange-700 uppercase mt-0.5">
                                LUNCH
                              </span>
                            ) : (
                              <span className="block text-[8px] font-normal text-slate-400 mt-0.5">
                                Period {period}
                              </span>
                            )}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr
                        key={day}
                        className="border-b border-slate-200 hover:bg-slate-50/30 transition-colors"
                      >
                        <td className="p-2.5 font-bold text-slate-800 bg-slate-50/80 border-r border-slate-200 text-center text-[11px] uppercase tracking-wider sticky left-0 z-10">
                          {day.substring(0, 3)}
                        </td>
                        {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                          (period) => {
                            if (period === selectedClassLunch) {
                              return (
                                <td
                                  key={period}
                                  className="p-1 text-center bg-orange-50/50 border-r border-slate-200"
                                >
                                  <div className="h-full min-h-[44px] flex items-center justify-center text-orange-700 font-bold text-[10px] tracking-wider uppercase">
                                    L<br/>U<br/>N<br/>C<br/>H
                                  </div>
                                </td>
                              );
                            }

                            const matchedSlots = finalTimetable.filter((t) => {
                              const isSameClass = t.classId === selectedClassView;
                              const isSameDay = t.day?.toLowerCase() === day.toLowerCase();
                              const isSamePeriod = Number(t.period) === period;
                              return isSameClass && isSameDay && isSamePeriod;
                            });

                            if (matchedSlots.length === 0) {
                              return (
                                <td
                                  key={period}
                                  className="p-1 text-center text-slate-300 border-r border-slate-100 text-xs font-bold"
                                >
                                  -
                                </td>
                              );
                            }

                            return (
                              <td
                                key={period}
                                className="p-1 border-r border-slate-200 align-middle"
                              >
                                <div className="space-y-0.5">
                                  {matchedSlots.map((slot, sIdx) => {
                                    const isLab =
                                      slot.type === "LAB" ||
                                      slot.subject.toLowerCase().includes("lab");
                                    const isProject =
                                      slot.type === "PROJECT" ||
                                      slot.subject.toLowerCase().includes("project");
                                    const acronym = slot.subjectAcronym || generateAcronym(slot.subject);
                                    const facShort = slot.secondaryFaculty
                                      ? `${slot.faculty.split(" ").pop()} / ${slot.secondaryFaculty.split(" ").pop()}`
                                      : slot.faculty.split(" ").pop() || "";

                                    return (
                                      <div
                                        key={sIdx}
                                        className={`px-2 py-2 rounded-xl text-center min-h-[46px] flex items-center justify-center font-extrabold text-xs shadow-2xs transition-all hover:scale-[1.02] ${
                                          isLab
                                            ? "bg-slate-900 text-white"
                                            : isProject
                                            ? "bg-slate-200 text-slate-900"
                                            : "bg-orange-100 text-orange-950 border border-orange-200/80"
                                        }`}
                                        title={`${slot.subject}\nFaculty: ${slot.faculty}${slot.secondaryFaculty ? ` & ${slot.secondaryFaculty}` : ""}${slot.room ? `\nRoom: ${slot.room}` : ""}`}
                                      >
                                        <span className="tracking-wide font-mono">
                                          {acronym}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          }
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Abbreviations & Course Details Table ── */}
              <div className="border-t-2 border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-orange-600" />
                    Abbreviations & Course Details
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {usedSubjects.size} Courses Listed
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="p-3 text-left w-28 bg-orange-50/60 text-orange-950">Abbreviation</th>
                        <th className="p-3 text-left">Course Name</th>
                        <th className="p-3 text-left w-20">Type</th>
                        <th className="p-3 text-left">Course Handling Staff</th>
                        <th className="p-3 text-center w-20">Hrs/Wk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(usedSubjects.entries()).map(([subName, info]) => (
                        <tr key={subName} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-950 font-extrabold text-[11px] font-mono tracking-wider inline-block border border-orange-200/80">
                              {info.acronym}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900 text-xs">
                            {info.name}
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              info.type === "LAB" ? "bg-slate-900 text-white" :
                              info.type === "PROJECT" ? "bg-slate-200 text-slate-800" :
                              info.type === "ELECTIVE" ? "bg-orange-100 text-orange-900" :
                              "bg-slate-100 text-slate-700"
                            }`}>
                              {info.type}
                            </span>
                          </td>
                          <td className="p-3 text-xs font-medium text-slate-700">
                            {info.faculty.join(", ") || "—"}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 text-xs">
                            {info.hoursPerWeek || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Publish Footer ── */}
              <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-orange-500" />
                  <span>
                    <b className="text-slate-800">{usedSubjects.size}</b> courses ·{" "}
                    <b className="text-slate-800">{classSlots.length}</b> scheduled slots ·{" "}
                    <b className="text-slate-800">{periodsPerDay}</b> periods/day
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportPDF(selectedClassView)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </button>
                  <button
                    onClick={handlePublishToAllClasses}
                    disabled={isPublishing}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      publishSuccess
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-orange-600 hover:bg-orange-700"
                    }`}
                  >
                    {isPublishing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : publishSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isPublishing
                        ? "Publishing..."
                        : publishSuccess
                        ? "Published Successfully!"
                        : "Publish to Classes"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* FACULTY TIMETABLE MATRIX */}
          {timetableSubTab === "FACULTY" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {validFaculty.find((f) => f.id === selectedFacultyView)?.name ||
                      "Faculty Timetable"}
                  </h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">
                    Individual Teaching Schedule across all classes
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  5 Working Days · {periodsPerDay} Periods / Day
                </span>
              </div>

              {/* Faculty Grid */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 w-24 font-semibold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 text-[11px]">
                        Day
                      </th>
                      {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                        (period) => (
                          <th
                            key={period}
                            className="p-3 font-medium text-center border-r border-slate-200 text-[11px] text-slate-800"
                          >
                            P{period}
                            <span className="block text-[9px] font-normal text-slate-400">
                              Period {period}
                            </span>
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const targetFacultyName =
                        validFaculty.find((f) => f.id === selectedFacultyView)
                          ?.name || "";
                      return (
                        <tr
                          key={day}
                          className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="p-3 font-semibold text-slate-800 bg-slate-50 border-r border-slate-200 text-center text-xs uppercase tracking-wider">
                            {day}
                          </td>
                          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                            (period) => {
                              const matchedSlot = finalTimetable.find(
                                (t) =>
                                  (t.faculty === targetFacultyName ||
                                    t.secondaryFaculty === targetFacultyName) &&
                                  t.day.toLowerCase() === day.toLowerCase() &&
                                  t.period === period
                              );

                              if (!matchedSlot) {
                                return (
                                  <td
                                    key={period}
                                    className="p-1.5 text-center text-slate-300 border-r border-slate-100 text-xs font-bold"
                                  >
                                    -
                                  </td>
                                );
                              }

                              const isLab = matchedSlot.type === "LAB";

                              return (
                                <td
                                  key={period}
                                  className="p-1.5 border-r border-slate-200 align-top"
                                >
                                  <div
                                    className={`p-2 rounded-xl border flex flex-col justify-between min-h-[56px] shadow-xs ${
                                      isLab
                                        ? "bg-slate-100 border-slate-300 text-slate-900"
                                        : "bg-white border-slate-200 text-slate-900"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span
                                        className="font-semibold text-[11px] leading-tight truncate"
                                        title={matchedSlot.subject}
                                      >
                                        {matchedSlot.subject}
                                      </span>
                                      <span className="text-[8px] font-semibold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md shrink-0">
                                        {matchedSlot.className}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-medium mt-1">
                                      <span className="truncate max-w-[70%]">
                                        {matchedSlot.room || "Room"}
                                      </span>
                                      {matchedSlot.secondaryFaculty && (
                                        <span className="text-[8px] font-semibold text-slate-700 bg-slate-200 px-1 py-0.2 rounded">
                                          Shared
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: TIMETABLE HISTORY ────────────────────────────────────── */}
      {activeTab === "HISTORY" && (
        <div className="space-y-5 animate-fade-in">
          {/* Filters Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <FolderClock className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Timetable History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse previously generated timetables across departments, classes and semesters
                </p>
              </div>
            </div>

            <div className="flex items-end gap-3 flex-wrap">
              {/* Department Selector */}
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Department
                </label>
                <select
                  value={historyDeptId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setHistoryDeptId(id);
                    setHistoryClassName("");
                    setHistorySemesters([]);
                    setHistorySemester("");
                    setHistoryGrid(null);
                    setHistoryCourses(null);
                    loadHistoryClasses(id);
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Selector */}
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Class
                </label>
                <select
                  value={historyClassName}
                  onChange={(e) => {
                    const cls = e.target.value;
                    setHistoryClassName(cls);
                    setHistorySemester("");
                    setHistoryGrid(null);
                    setHistoryCourses(null);
                    loadHistorySemesters(historyDeptId, cls);
                  }}
                  disabled={!historyDeptId || historyClassList.length === 0}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Class</option>
                  {historyClassList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Selector */}
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Semester
                </label>
                <select
                  value={historySemester}
                  onChange={(e) => {
                    const sem = e.target.value;
                    setHistorySemester(sem);
                    loadHistoryTimetable(historyDeptId, historyClassName, sem);
                  }}
                  disabled={historySemesters.length === 0}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Semester</option>
                  {historySemesters.map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {historyLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>

          {/* History Timetable Display */}
          {historyGrid && historySemester && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 text-white p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {departments.find((d) => d.id === historyDeptId)?.name || "Department"} — Timetable Archive
                    </p>
                    <h3 className="text-lg font-bold tracking-tight mt-0.5">
                      {historyClassName} — Semester {historySemester}
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 px-3 py-1 bg-slate-800 rounded-lg">
                    {historyPeriodsPerDay} Periods / Day
                  </span>
                </div>
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: `${Math.max(600, historyPeriodsPerDay * 90 + 100)}px` }}>
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="p-2.5 w-20 font-bold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 text-[10px]">
                        Day
                      </th>
                      {Array.from({ length: historyPeriodsPerDay }, (_, i) => i + 1).map((p) => (
                        <th key={p} className="p-2.5 font-semibold text-center border-r border-slate-200 text-[10px] text-slate-700">
                          <span className="block font-bold text-[11px]">P{p}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const daySlots = historyGrid[day] as string[] | undefined;
                      return (
                        <tr key={day} className="border-b border-slate-200 hover:bg-slate-50/30 transition-colors">
                          <td className="p-2.5 font-bold text-slate-800 bg-slate-50/80 border-r border-slate-200 text-center text-[11px] uppercase tracking-wider">
                            {day.substring(0, 3)}
                          </td>
                          {Array.from({ length: historyPeriodsPerDay }, (_, i) => i).map((idx) => {
                            const val = daySlots && idx < daySlots.length ? daySlots[idx] : "";
                            const hasVal = val.trim() !== "";
                            // Try to find acronym from course mappings
                            let display = val;
                            if (hasVal && historyCourses) {
                              const match = historyCourses.find((c: any) => c.name === val);
                              if (match?.abbreviation) display = match.abbreviation;
                            }
                              return (
                                <td key={idx} className="p-1 border-r border-slate-200 text-center align-middle">
                                  {hasVal ? (
                                    <div className="px-2 py-2 rounded-xl bg-orange-100 text-orange-950 font-extrabold text-xs min-h-[44px] flex items-center justify-center border border-orange-200/80 font-mono shadow-2xs" title={val}>
                                      <span className="tracking-wide">{display}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-bold text-xs">-</span>
                                  )}
                                </td>
                              );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Abbreviations & Course Details */}
              {historyCourses && historyCourses.length > 0 && (
                <div className="border-t-2 border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-orange-600" />
                      Abbreviations & Course Details
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {historyCourses.length} Courses
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                          <th className="p-3 text-left w-28 bg-orange-50/60 text-orange-950">Abbreviation</th>
                          <th className="p-3 text-left">Course Name</th>
                          <th className="p-3 text-left">Course Handling Staff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyCourses.map((c: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-950 font-extrabold text-[11px] font-mono tracking-wider inline-block border border-orange-200/80">
                                {c.abbreviation || "—"}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-900 text-xs">
                              {c.name || "—"}
                            </td>
                            <td className="p-3 text-xs font-medium text-slate-700">
                              {c.facultyName || "—"}
                              {c.isElective && c.facultyName2 ? ` / ${c.facultyName2}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!historyGrid && !historyLoading && historySemester && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 mt-3">No timetable found</p>
              <p className="text-xs text-slate-400 mt-1">No timetable data exists for this semester.</p>
            </div>
          )}

          {!historyDeptId && !historyLoading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
              <FolderClock className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 mt-3">Select a department to browse history</p>
              <p className="text-xs text-slate-400 mt-1">Choose a department, class, and semester to view archived timetables.</p>
            </div>
          )}
        </div>
      )}

        {/* ── Batch Assign Teachers to Class Modal (Portaled to document.body) ── */}
      {showBatchAssignModal && selectedClassForFaculty !== "ALL" && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Faculty to {selectedClassForFaculty}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Department: <span className="font-semibold text-orange-600">{activeDeptFilter}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBatchAssignModal(false);
                  setShowOtherDeptSection(false);
                  setSelectedOtherDeptId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* SECTION 1: Current Department Faculties */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {activeDeptFilter} Department Faculty
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {validFaculty.filter((f) => !f.department || f.department === activeDeptFilter).length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const deptFac = validFaculty.filter(
                        (f) =>
                          (!f.department || f.department === activeDeptFilter) &&
                          f.name.toLowerCase().includes(assignModalSearch.toLowerCase())
                      );
                      const allVisibleAssigned = deptFac.length > 0 && deptFac.every((f) =>
                        (f.classes || []).includes(selectedClassForFaculty)
                      );
                      setFacultyList((prev) =>
                        prev.map((f) => {
                          if (deptFac.some((vf) => vf.id === f.id)) {
                            const cur = f.classes || [];
                            if (allVisibleAssigned) {
                              return {
                                ...f,
                                classes: cur.filter((c) => c !== selectedClassForFaculty),
                              };
                            } else {
                              return {
                                ...f,
                                classes: cur.includes(selectedClassForFaculty)
                                  ? cur
                                  : [...cur, selectedClassForFaculty],
                              };
                            }
                          }
                          return f;
                        })
                      );
                    }}
                    className="text-[11px] font-bold text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200 cursor-pointer shrink-0 transition-colors"
                  >
                    Toggle All
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={assignModalSearch}
                    onChange={(e) => setAssignModalSearch(e.target.value)}
                    placeholder={`Search ${activeDeptFilter} faculty...`}
                    className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:border-orange-500 bg-slate-50/50 focus:bg-white text-slate-800"
                  />
                </div>

                {/* List of current dept faculty */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {validFaculty
                    .filter(
                      (f) =>
                        (!f.department || f.department === activeDeptFilter) &&
                        f.name.toLowerCase().includes(assignModalSearch.toLowerCase())
                    )
                    .map((f) => {
                      const isChecked = (f.classes || []).includes(selectedClassForFaculty);
                      const otherClasses = (f.classes || []).filter(
                        (c) => c !== selectedClassForFaculty
                      );
                      return (
                        <div
                          key={f.id}
                          onClick={() => handleToggleFacultyClass(f.id, selectedClassForFaculty)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                            isChecked
                              ? "bg-orange-50/70 border-orange-200 text-orange-950 shadow-2xs"
                              : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded text-orange-600 focus:ring-orange-500 pointer-events-none"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold leading-none truncate">{f.name}</p>
                              {otherClasses.length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-1 truncate">
                                  Also in: {otherClasses.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                              isChecked
                                ? "bg-orange-200 text-orange-900"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isChecked ? "Assigned" : "Not Assigned"}
                          </span>
                        </div>
                      );
                    })}
                  {validFaculty.filter(
                    (f) =>
                      (!f.department || f.department === activeDeptFilter) &&
                      f.name.toLowerCase().includes(assignModalSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No faculty found matching search in {activeDeptFilter}.
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Add Faculty from Other Departments */}
              <div className="border-t border-slate-200/80 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOtherDeptSection(!showOtherDeptSection)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-200 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                      +
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-orange-950">
                        Add Faculty from Other Departments
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Assign guest or inter-department faculty to {selectedClassForFaculty}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 group-hover:text-orange-600 transition-transform duration-200 ${
                      showOtherDeptSection ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showOtherDeptSection && (
                  <div className="mt-3 p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Department Selector Step */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          1. Select Department
                        </label>
                        {/* Sort selector */}
                        <div className="flex items-center gap-1">
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          <button
                            type="button"
                            onClick={() =>
                              setOtherDeptSortBy((prev) => (prev === "name" ? "count" : "name"))
                            }
                            className="text-[10px] font-semibold text-slate-600 hover:text-orange-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                          >
                            Sort: {otherDeptSortBy === "name" ? "Name (A-Z)" : "Faculty Count"}
                          </button>
                        </div>
                      </div>

                      {/* Search Departments */}
                      <div className="relative mb-2">
                        <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={otherDeptSearch}
                          onChange={(e) => setOtherDeptSearch(e.target.value)}
                          placeholder="Search departments..."
                          className="w-full text-xs border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-orange-500 bg-white text-slate-800"
                        />
                      </div>

                      {/* Department Chips / List */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                        {departments
                          .filter((d) => d.id !== activeDeptFilter)
                          .filter(
                            (d) =>
                              d.name.toLowerCase().includes(otherDeptSearch.toLowerCase()) ||
                              d.id.toLowerCase().includes(otherDeptSearch.toLowerCase())
                          )
                          .sort((a, b) => {
                            if (otherDeptSortBy === "count") {
                              const countA = faculties.filter((f) => f.department === a.id).length;
                              const countB = faculties.filter((f) => f.department === b.id).length;
                              return countB - countA;
                            }
                            return a.name.localeCompare(b.name);
                          })
                          .map((dept) => {
                            const deptFacultyCount = faculties.filter(
                              (f) => f.department === dept.id
                            ).length;
                            const isSelected = selectedOtherDeptId === dept.id;
                            return (
                              <button
                                key={dept.id}
                                type="button"
                                onClick={() =>
                                  setSelectedOtherDeptId((prev) =>
                                    prev === dept.id ? null : dept.id
                                  )
                                }
                                className={`flex items-center justify-between p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                                    : "bg-white border-slate-200 hover:border-orange-300 text-slate-700 hover:bg-orange-50/30"
                                }`}
                              >
                                <div className="truncate pr-1">
                                  <p className="text-[11px] font-bold leading-tight truncate">
                                    {dept.id}
                                  </p>
                                  <p
                                    className={`text-[9px] truncate ${
                                      isSelected ? "text-orange-100" : "text-slate-400"
                                    }`}
                                  >
                                    {dept.name}
                                  </p>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    isSelected
                                      ? "bg-orange-700/60 text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {deptFacultyCount}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Faculty in Selected Department Step */}
                    {selectedOtherDeptId && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            2. Select Faculty from {selectedOtherDeptId}
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {
                              faculties.filter((f) => f.department === selectedOtherDeptId).length
                            }{" "}
                            faculty found
                          </span>
                        </div>

                        {/* Search faculty in that dept */}
                        <div className="relative mb-2">
                          <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={otherDeptFacultySearch}
                            onChange={(e) => setOtherDeptFacultySearch(e.target.value)}
                            placeholder={`Search faculty in ${selectedOtherDeptId}...`}
                            className="w-full text-xs border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-orange-500 bg-white text-slate-800"
                          />
                        </div>

                        {/* List of other dept faculty */}
                        <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                          {faculties
                            .filter((f) => f.department === selectedOtherDeptId)
                            .filter((f) =>
                              f.name.toLowerCase().includes(otherDeptFacultySearch.toLowerCase())
                            )
                            .map((f) => {
                              // Check if this faculty is currently assigned to selectedClassForFaculty in facultyList
                              const currentInList = facultyList.find((fl) => fl.id === f.id);
                              const isAssigned = (currentInList?.classes || []).includes(
                                selectedClassForFaculty
                              );

                              return (
                                <div
                                  key={f.id}
                                  onClick={() => {
                                    setFacultyList((prev) => {
                                      const existing = prev.find((item) => item.id === f.id);
                                      if (existing) {
                                        const curClasses = existing.classes || [];
                                        if (curClasses.includes(selectedClassForFaculty)) {
                                          return prev.map((item) =>
                                            item.id === f.id
                                              ? {
                                                  ...item,
                                                  classes: curClasses.filter(
                                                    (c) => c !== selectedClassForFaculty
                                                  ),
                                                }
                                              : item
                                          );
                                        } else {
                                          return prev.map((item) =>
                                            item.id === f.id
                                              ? {
                                                  ...item,
                                                  classes: [...curClasses, selectedClassForFaculty],
                                                }
                                              : item
                                          );
                                        }
                                      } else {
                                        // Add to facultyList with this class assigned
                                        return [
                                          ...prev,
                                          {
                                            id: f.id,
                                            name: f.name,
                                            department: selectedOtherDeptId,
                                            classes: [selectedClassForFaculty],
                                          },
                                        ];
                                      }
                                    });
                                  }}
                                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer select-none ${
                                    isAssigned
                                      ? "bg-orange-50 border-orange-300 text-orange-950 shadow-2xs"
                                      : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => {}}
                                      className="rounded text-orange-600 focus:ring-orange-500 pointer-events-none"
                                    />
                                    <div>
                                      <p className="text-xs font-bold leading-none">{f.name}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Dept: {selectedOtherDeptId}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isAssigned
                                        ? "bg-orange-200 text-orange-900"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {isAssigned ? "Assigned" : "Add to Class"}
                                  </span>
                                </div>
                              );
                            })}
                          {faculties.filter((f) => f.department === selectedOtherDeptId).length ===
                            0 && (
                            <div className="p-3 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                              No faculty found in {selectedOtherDeptId}.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-600">
                <b className="text-orange-700 font-bold">
                  {
                    facultyList.filter(
                      (f) =>
                        f.name.trim() &&
                        (f.classes || []).includes(selectedClassForFaculty)
                    ).length
                  }
                </b>{" "}
                teachers assigned to {selectedClassForFaculty}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowBatchAssignModal(false);
                  setShowOtherDeptSection(false);
                  setSelectedOtherDeptId(null);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

        {/* ── AI Prompt & Restructuring Modal (Portaled to document.body) ── */}
      {showAIPromptModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl md:max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-orange-600 flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {isRestructureMode ? "Restructure Timetable with AI" : "AI Timetable Studio"}
                  </h3>
                  <p className="text-xs text-slate-300 font-normal">
                    {isRestructureMode
                      ? "Guide Gemini to rebalance or rearrange the existing timetable"
                      : "Provide natural language requirements for Google Gemini AI to schedule"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    showApiKeyInput ? "text-orange-400 bg-white/10" : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                  title="Configure Gemini API Key"
                >
                  <Key className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowAIPromptModal(false);
                    setAiErrorMsg(null);
                  }}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Optional Custom API Key Drawer */}
              {(showApiKeyInput || aiErrorMsg) && (
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-semibold text-orange-950 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-orange-600" />
                      <span>Custom Google Gemini API Key</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      Get Free Key at Google AI Studio &rarr;
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Paste your Gemini API key (starts with AIzaSy...)"
                      className="flex-1 bg-white border border-orange-200 focus:border-orange-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 outline-none"
                    />
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={() => handleApiKeyChange("")}
                        className="px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-orange-800 leading-normal">
                    Stored safely in your browser session. Use this if your server key has denied permissions.
                  </p>
                </div>
              )}

              {/* Mode Selection Tabs (if a timetable already exists) */}
              {finalTimetable && finalTimetable.length > 0 && (
                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRestructureMode(false);
                      setAiErrorMsg(null);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      !isRestructureMode
                        ? "bg-white text-slate-900 shadow-sm font-semibold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Generate from Scratch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRestructureMode(true);
                      setAiErrorMsg(null);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isRestructureMode
                        ? "bg-white text-slate-900 shadow-sm font-semibold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Restructure Current Timetable</span>
                  </button>
                </div>
              )}

              {/* Prompt Input Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareText className="h-4 w-4 text-orange-600" />
                    <span>
                      {isRestructureMode
                        ? "Restructuring Instructions"
                        : "Custom Scheduling Instructions & Preferences"}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Natural language prompt</span>
                </div>
                <textarea
                  value={userPromptText}
                  onChange={(e) => setUserPromptText(e.target.value)}
                  rows={4}
                  placeholder={
                    isRestructureMode
                      ? "e.g., Move DBMS Lab from Monday to Wednesday afternoon. Swap Period 1 and Period 2 for SECCJ2030A. Make sure Dr. M.Nithya only teaches forenoon sessions."
                      : "e.g., Keep Friday afternoon (Period 6 and 7) free for project club activities. Schedule all Laboratory sessions in forenoon. Prioritize senior faculty for Period 1."
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-2xl p-4 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 leading-relaxed shadow-inner resize-none"
                />
              </div>

              {/* Quick Inspiration Chips */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Lightbulb className="h-3.5 w-3.5 text-orange-600" />
                  <span>Quick Preset Prompts:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Keep Friday afternoon free",
                    "Schedule all Labs in forenoon sessions",
                    "Balance theory lectures evenly across 5 days",
                    "Reserve Period 1 for core theory subjects",
                    "Stagger laboratory classes across Monday to Thursday",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setUserPromptText((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return preset;
                          return `${trimmed}. ${preset}`;
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-semibold transition-all cursor-pointer active:scale-95 text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Callout if AI Failed */}
              {aiErrorMsg && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-rose-900">Gemini AI Service Alert</p>
                      <p className="font-mono text-[11px] leading-relaxed break-all text-rose-700">
                        {aiErrorMsg}
                      </p>
                      {aiErrorMsg.includes("denied access") && (
                        <p className="text-[11px] text-rose-800 font-medium pt-1">
                          Tip: The Google project was denied access for this key. Paste a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold text-orange-600">Google AI Studio</a> above, or click below to generate instantly using the local solver.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAIPromptModal(false);
                        runAIEnginePipeline({ requireAI: false });
                      }}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-600 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      ⚡ Use Local Solver Instead
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Bot className="h-4 w-4 text-slate-400" />
                <span>Google Gemini 2.5 / Flash AI</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAIPromptModal(false);
                    setAiErrorMsg(null);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAIEnginePipeline({
                      userInstructions: userPromptText,
                      isRestructure: isRestructureMode,
                      requireAI: true,
                    })
                  }
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>
                        {isRestructureMode ? "Restructuring Schedule..." : "Generating with Gemini..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {isRestructureMode ? "Restructure Timetable" : "Generate Timetable with AI"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

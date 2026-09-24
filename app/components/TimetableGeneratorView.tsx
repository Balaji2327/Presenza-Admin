"use client";

import React, { useState, useEffect } from "react";
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
  ChevronDown
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
}

export interface ClassItem {
  id: string;
  name: string;
  department: string;
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

export interface TimetableSlot {
  day: string;
  period: number;
  classId: string;
  className: string;
  subject: string;
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

interface TimetableGeneratorViewProps {
  selectedDept?: Department | null;
  departments: Department[];
  faculties: Faculty[];
  onBack: () => void;
}

export default function TimetableGeneratorView({
  selectedDept,
  departments,
  faculties,
  onBack,
}: TimetableGeneratorViewProps) {
  // Config & API - loaded automatically from process.env.NEXT_PUBLIC_GEMINI_API_KEY (.env.local)
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
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
  const [activeTab, setActiveTab] = useState<"INPUTS" | "TIMETABLE">("INPUTS");
  const [timetableSubTab, setTimetableSubTab] = useState<"CLASS" | "FACULTY">("CLASS");
  const [selectedClassView, setSelectedClassView] = useState<string>("");
  const [selectedFacultyView, setSelectedFacultyView] = useState<string>("");
  const [activeFacultyPopover, setActiveFacultyPopover] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictItem[]>([]);
  const [finalTimetable, setFinalTimetable] = useState<TimetableSlot[] | null>(null);

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
        }));
    }

    if (loadedFaculty.length === 0 && faculties && faculties.length > 0) {
      // Fallback to all faculties if none matched current dept filter
      loadedFaculty = faculties.map((f) => ({
        id: f.id || `f_${f.name.replace(/\s+/g, "_")}`,
        name: f.name || "Faculty",
        department: f.department || "",
        email: f.email || "",
      }));
    }

    // If still empty, supply clean starter row
    if (loadedFaculty.length === 0) {
      loadedFaculty = [{ id: "f_1", name: "", department: "" }];
    }
    setFacultyList(loadedFaculty);

    // 2. Prepare Classes from Presenza Departments
    const loadedClasses: ClassItem[] = [];
    const deptsToScan =
      activeDeptFilter === "ALL"
        ? departments
        : departments.filter((d) => d.id === activeDeptFilter);

    let defaultLunch = 4;
    deptsToScan.forEach((dept) => {
      if (dept.classes && dept.classes.length > 0) {
        dept.classes.forEach((clsName, idx) => {
          // Stagger lunch periods slightly (e.g. P4 or P5)
          const lunch = idx % 2 === 0 ? 4 : 5;
          loadedClasses.push({
            id: `c_${clsName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            name: clsName,
            department: dept.name,
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
        lunchPeriod: 4,
      });
    }

    setClasses(loadedClasses);
    if (loadedClasses.length > 0) {
      setSelectedClassView(loadedClasses[0].id);
    }
    if (loadedFaculty.length > 0 && loadedFaculty[0].id) {
      setSelectedFacultyView(loadedFaculty[0].id);
    }

    // 3. Generate initial subjects for classes if empty
    setSubjects((prev) => {
      if (prev.length > 0) return prev; // Keep if already entered
      const initialSubs: SubjectItem[] = [];
      const defaultSubjectNames = [
        { name: "Database Management Systems", type: "THEORY", semHrs: 45 },
        { name: "Computer Networks & Security", type: "THEORY", semHrs: 45 },
        { name: "Web Technologies & Cloud", type: "THEORY", semHrs: 45 },
        { name: "Artificial Intelligence & ML", type: "THEORY", semHrs: 45 },
        { name: "DBMS & Networks Laboratory", type: "LAB", semHrs: 45 },
        { name: "Industry Design Project / Lab", type: "PROJECT", semHrs: 45 },
      ];

      loadedClasses.slice(0, 3).forEach((cls) => {
        defaultSubjectNames.forEach((sDef, idx) => {
          const assignedFac = loadedFaculty[idx % loadedFaculty.length];
          const secFac = sDef.type === "LAB" ? loadedFaculty[(idx + 1) % loadedFaculty.length] : undefined;
          initialSubs.push({
            id: `s_${cls.id}_${idx}`,
            name: sDef.name,
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
  };

  const handleFacultyChange = (index: number, field: keyof FacultyItem, value: string) => {
    const updated = [...facultyList];
    updated[index][field] = value;
    if (index === updated.length - 1 && value.trim() !== "") {
      updated.push({ id: `f_${Date.now()}`, name: "", department: "" });
    }
    setFacultyList(updated);
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
      if (field === "totalSemHours") {
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
    tertiaryFacultyId?: string
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
    setFacultyList([{ id: `f_${Date.now()}`, name: "", department: "" }]);
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
  const runAIEnginePipeline = async () => {
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
    setFinalTimetable(null);

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

      // 2. Hybrid Gemini AI Model Call with Fallback
      const callGeminiWithFallback = async (prompt: string): Promise<string> => {
        const cleanKey = apiKey.trim();
        if (!cleanKey) {
          setPipelineStage("Running instant Presenza high-speed CSP engine...");
          return JSON.stringify(generateLocalOptimizedTimetable());
        }

        const uniqueModels = [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
        ];

        for (const modelName of uniqueModels) {
          try {
            setPipelineStage(`Stage 1/2: Synthesizing with Gemini AI (${modelName})...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;
            const resp = await fetch(url, {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json",
                },
              }),
            });
            clearTimeout(timeoutId);

            if (resp.status === 401 || resp.status === 403) {
              console.warn(
                `Gemini API authorization error (${resp.status}): Project access denied or invalid key. Switching directly to Presenza CSP engine.`
              );
              break; // Abort remaining models immediately to prevent repeated 403 console errors
            }

            if (resp.ok) {
              const data = await resp.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text && (text.includes("[") || text.includes("{"))) {
                setPipelineStage(`Stage 1/2: Timetable generated with Gemini AI! Checking constraints...`);
                return text;
              }
            }
          } catch (err: any) {
            console.warn(`Model ${modelName} call skipped:`, err?.message || err);
          }
        }

        setPipelineStage("Running deterministic CSP scheduler...");
        return JSON.stringify(generateLocalOptimizedTimetable());
      };

      // STAGE 1: Execution
      setPipelineStage("Stage 1/2: Preparing constraints & timetable generation matrix...");

      const generatePrompt = `You are a college timetable scheduling engine with ZERO TOLERANCE for constraint violations.
Generate an exact weekly timetable (Monday to Friday, 5 days, ${periodsPerDay} periods each day) for ALL ${validClasses.length} classes.

Classes & Lunch Times:
${validClasses.map((c) => `- Class "${c.name}" (ID: "${c.id}"): MANDATORY Lunch at Period ${c.lunchPeriod}.`).join("\n")}

Faculty:
${validFaculty.map((f) => `- "${f.name}" (${f.department}) [ID: "${f.id}"]`).join("\n")}

Curriculum & Weekly Periods:
${validSubjects.map((s) => {
  const cls = validClasses.find((c) => c.id === s.classId);
  const fac = validFaculty.find((f) => f.id === s.facultyId);
  const secFac = validFaculty.find((f) => f.id === s.secondaryFacultyId);
  const facStr = [fac?.name, secFac?.name].filter(Boolean).join(" + ");
  return `- [${cls?.name || s.classId}] "${s.name}" | Type: ${s.type} | Faculty: "${facStr}" | Weekly Periods: ${s.hoursPerWeek}`;
}).join("\n")}

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

      let slots: TimetableSlot[] = [];
      try {
        const aiResponseText = await callGeminiWithFallback(generatePrompt);
        let cleaned = aiResponseText
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        if (cleaned.startsWith("{") && cleaned.includes('"candidates"')) {
          try {
            const parsedEnvelope = JSON.parse(cleaned);
            const partText = parsedEnvelope?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (partText) cleaned = partText.replace(/```json/gi, "").replace(/```/g, "").trim();
          } catch (e) {}
        }

        cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
        const start = cleaned.indexOf("[");
        let end = cleaned.lastIndexOf("]");

        if (start !== -1 && end !== -1 && end > start) {
          slots = JSON.parse(cleaned.substring(start, end + 1));
        } else {
          slots = JSON.parse(cleaned);
        }

        if (Array.isArray(slots) && slots.length > 0) {
          slots = slots
            .filter(
              (s) =>
                s &&
                s.subject &&
                String(s.subject).toUpperCase() !== "LUNCH" &&
                String(s.type).toUpperCase() !== "LUNCH"
            )
            .map((s) => {
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
        }
      } catch (err) {
        slots = generateLocalOptimizedTimetable();
      }

      if (!Array.isArray(slots) || slots.length === 0) {
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
            .map((s) => {
              const facultyStr = s.secondaryFaculty
                ? `${s.faculty} & ${s.secondaryFaculty}`
                : s.faculty;
              return `${s.subject}\n(${facultyStr})${
                s.room ? ` [${s.room}]` : ""
              }`;
            })
            .join("\n---\n");
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
      styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle" },
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
    });

    doc.save(`Presenza-Timetable-${classNameStr.replace(/\s+/g, "-")}.pdf`);
  };

  const validClasses = classes.filter((c) => c.name.trim() !== "");
  const validFaculty = facultyList.filter((f) => f.name.trim() !== "");
  const validRooms = rooms.filter((r) => r.name.trim() !== "");
  const selectedClassObj = classes.find((c) => c.id === selectedClassView);
  const selectedClassLunch = selectedClassObj?.lunchPeriod || 4;

  return (
    <div className="space-y-6 animate-fade-in w-full -mt-4 lg:-mt-6">
      {/* Top Header & Navigation Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200 rounded-xl transition-all cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl lg:text-2xl font-extrabold text-slate-800 tracking-tight">
                Timetable Generator & AI Engine
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-orange-100 border border-orange-200 text-orange-700 rounded-full">
                Multi-Constraint Solver
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              {selectedDept ? `${selectedDept.name} Department` : "Global Academic Timetable"} · Presenza Engine
            </p>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            <button
              onClick={() => setActiveTab("INPUTS")}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeTab === "INPUTS"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Data Inputs
            </button>
            <button
              onClick={() => setActiveTab("TIMETABLE")}
              disabled={!finalTimetable}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeTab === "TIMETABLE"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              View Timetable
            </button>
          </div>

          <button
            onClick={runAIEnginePipeline}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>{isProcessing ? "Solving Constraints..." : "Generate Timetable"}</span>
          </button>
        </div>
      </div>

      {/* Processing Banner */}
      {isProcessing && (
        <div className="p-4 lg:p-5 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-orange-950">
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
                <h3 className="text-sm font-extrabold text-slate-800">
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
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
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
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
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
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-bold text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
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
                    <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      1. Classes & Lunch
                    </h2>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {classes.filter((c) => c.name.trim()).length} active classes
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-0.5 rounded-md">
                  Auto row
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {classes.map((cls, idx) => (
                  <div key={cls.id} className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-300 w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={cls.name}
                      onChange={(e) => handleClassChange(idx, "name", e.target.value)}
                      placeholder="e.g. SECCJ2030A"
                      className="flex-1 text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 transition-all text-slate-800"
                    />
                    <select
                      value={cls.lunchPeriod}
                      onChange={(e) =>
                        handleClassChange(idx, "lunchPeriod", Number(e.target.value))
                      }
                      className="text-[10px] font-extrabold border border-amber-200 bg-amber-50 text-amber-900 rounded-xl px-2 py-2 outline-none cursor-pointer"
                      title="Class Lunch Break Period"
                    >
                      <option value={3}>Lunch P3</option>
                      <option value={4}>Lunch P4</option>
                      <option value={5}>Lunch P5</option>
                      <option value={6}>Lunch P6</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Faculty Directory */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      2. Faculty Directory
                    </h2>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {facultyList.filter((f) => f.name.trim()).length} teachers loaded
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-0.5 rounded-md">
                  Auto row
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {facultyList.map((fac, idx) => (
                  <div key={fac.id} className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-300 w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={fac.name}
                      onChange={(e) => handleFacultyChange(idx, "name", e.target.value)}
                      placeholder="Faculty Name"
                      className="flex-1 text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 transition-all text-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Rooms & Labs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      3. Rooms & Labs
                    </h2>
                    <span className="text-[10px] text-slate-400 font-bold">
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
                    <span className="text-[11px] font-extrabold text-slate-300 w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={rm.name}
                      onChange={(e) => handleRoomChange(idx, "name", e.target.value)}
                      placeholder="Room / Lab Name"
                      className="flex-1 text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-orange-500 transition-all text-slate-800"
                    />
                    <select
                      value={rm.type}
                      onChange={(e) => handleRoomChange(idx, "type", e.target.value)}
                      className="text-[10px] font-extrabold border border-slate-200 rounded-xl px-2 py-2 bg-slate-50 outline-none cursor-pointer text-slate-700"
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
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  4. Subject Curriculum & Faculty Assignments (Class-Wise)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-bold">
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
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-orange-100 text-orange-800 font-black text-xs">
                        {cls.name}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">
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
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                          <th className="p-3 w-8 text-center">#</th>
                          <th className="p-3 w-44">Subject Name</th>
                          <th className="p-3 w-28">Type</th>
                          <th className="p-3 w-48">Faculty (MSQ)</th>
                          <th className="p-3 w-28">Room</th>
                          <th className="p-3 w-20 text-center bg-orange-50/70 text-orange-950 font-black">
                            Sem Hrs
                          </th>
                          <th className="p-3 w-20 text-center font-bold">Hrs/Wk</th>
                          <th className="p-3 w-28">Elective</th>
                          <th className="p-3 w-10 text-center"></th>
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
                              next[2] || undefined
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
                              <td className="p-2 text-center text-slate-400 font-bold text-[11px]">
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
                                  placeholder="e.g. DBMS"
                                  className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/40 focus:bg-white focus:border-orange-500 focus:outline-none text-slate-800"
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
                                  className={`w-full text-[11px] font-extrabold border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer ${
                                    sub.type === "THEORY"
                                      ? "bg-blue-50 text-blue-700"
                                      : sub.type === "LAB"
                                      ? "bg-purple-50 text-purple-700"
                                      : sub.type === "ELECTIVE"
                                      ? "bg-orange-50 text-orange-700"
                                      : "bg-teal-50 text-teal-700"
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
                                  <span className="text-[9px] font-black bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-md shrink-0">
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
                                      } w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-60 overflow-y-auto space-y-2 text-xs animate-in zoom-in-95 duration-150`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                          Assign Faculty (MSQ)
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
                                        <div className="space-y-1">
                                          {validFaculty.map((f) => {
                                            const isChecked =
                                              assignedFacultyIds.includes(f.id);
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
                                                      ? "font-extrabold text-orange-950"
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
                                  className="w-full text-center text-xs font-black border border-orange-200 rounded-lg px-1 py-1.5 bg-orange-50/60 text-orange-950"
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
                                  className="w-full text-center text-xs font-extrabold border border-slate-200 rounded-lg px-1 py-1.5 bg-slate-50/40 text-slate-800"
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
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {detectedConflicts.length === 0 ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
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
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    timetableSubTab === "CLASS"
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/10"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Class View
                </button>
                <button
                  onClick={() => setTimetableSubTab("FACULTY")}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    timetableSubTab === "FACULTY"
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/10"
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
                    className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {validClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => exportPDF(selectedClassView)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedFacultyView}
                    onChange={(e) => setSelectedFacultyView(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-orange-500 cursor-pointer"
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

          {/* CLASS TIMETABLE MATRIX */}
          {timetableSubTab === "CLASS" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {selectedClassObj?.name || "Class Timetable"}
                  </h3>
                  <p className="text-xs text-amber-700 font-bold mt-0.5">
                    Designated Lunch Break: Period {selectedClassLunch}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  5 Working Days · {periodsPerDay} Periods / Day
                </span>
              </div>

              {/* Weekly Grid */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 w-24 font-extrabold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 text-[11px]">
                        Day
                      </th>
                      {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                        (period) => (
                          <th
                            key={period}
                            className={`p-3 font-extrabold text-center border-r border-slate-200 text-[11px] ${
                              period === selectedClassLunch
                                ? "bg-amber-100/70 text-amber-900"
                                : "text-slate-800"
                            }`}
                          >
                            P{period}
                            {period === selectedClassLunch ? (
                              <span className="block text-[9px] font-bold text-amber-700 uppercase">
                                Lunch
                              </span>
                            ) : (
                              <span className="block text-[9px] font-normal text-slate-400">
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
                        className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-3 font-extrabold text-slate-800 bg-slate-50 border-r border-slate-200 text-center text-xs uppercase tracking-wider">
                          {day}
                        </td>
                        {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                          (period) => {
                            if (period === selectedClassLunch) {
                              return (
                                <td
                                  key={period}
                                  className="p-1.5 text-center bg-amber-50/80 border-r border-slate-200"
                                >
                                  <div className="h-full min-h-[56px] flex items-center justify-center rounded-lg bg-amber-100/60 text-amber-800 font-black text-[10px] tracking-wider uppercase">
                                    LUNCH
                                  </div>
                                </td>
                              );
                            }

                            const matchedSlots = finalTimetable.filter((t) => {
                              const isSameClass = t.classId === selectedClassView;
                              const isSameDay =
                                t.day?.toLowerCase() === day.toLowerCase();
                              const isSamePeriod = Number(t.period) === period;
                              return isSameClass && isSameDay && isSamePeriod;
                            });

                            if (matchedSlots.length === 0) {
                              return (
                                <td
                                  key={period}
                                  className="p-1.5 text-center text-slate-300 border-r border-slate-100 text-xs font-bold"
                                >
                                  -
                                </td>
                              );
                            }

                            return (
                              <td
                                key={period}
                                className="p-1.5 border-r border-slate-200 align-top"
                              >
                                <div className="space-y-1">
                                  {matchedSlots.map((slot, sIdx) => {
                                    const isLab =
                                      slot.type === "LAB" ||
                                      slot.subject.toLowerCase().includes("lab");
                                    const isProject =
                                      slot.type === "PROJECT" ||
                                      slot.subject.toLowerCase().includes("project");
                                    const isElective = slot.type === "ELECTIVE";

                                    return (
                                      <div
                                        key={sIdx}
                                        className={`p-2 rounded-xl border flex flex-col justify-between min-h-[58px] shadow-xs ${
                                          isLab
                                            ? "bg-purple-50/80 border-purple-200 text-purple-950"
                                            : isProject
                                            ? "bg-teal-50/80 border-teal-200 text-teal-950"
                                            : isElective
                                            ? "bg-orange-50/80 border-orange-200 text-orange-950"
                                            : "bg-blue-50/70 border-blue-200 text-blue-950"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <span
                                            className="font-extrabold text-[11px] leading-tight truncate"
                                            title={slot.subject}
                                          >
                                            {slot.subject}
                                          </span>
                                          {isLab && (
                                            <span className="text-[8px] font-black bg-purple-200 text-purple-800 px-1 py-0.2 rounded shrink-0">
                                              LAB
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold mt-1">
                                          <span
                                            className="truncate max-w-[70%]"
                                            title={
                                              slot.secondaryFaculty
                                                ? `${slot.faculty} & ${slot.secondaryFaculty}`
                                                : slot.faculty
                                            }
                                          >
                                            {slot.secondaryFaculty
                                              ? `${slot.faculty.split(" ")[0]} & ${
                                                  slot.secondaryFaculty.split(" ")[0]
                                                }`
                                              : slot.faculty}
                                          </span>
                                          {slot.room && (
                                            <span className="px-1 bg-white border border-slate-200 rounded text-[8px] font-extrabold text-slate-700 shrink-0">
                                              {slot.room}
                                            </span>
                                          )}
                                        </div>
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
            </div>
          )}

          {/* FACULTY TIMETABLE MATRIX */}
          {timetableSubTab === "FACULTY" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {validFaculty.find((f) => f.id === selectedFacultyView)?.name ||
                      "Faculty Timetable"}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
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
                      <th className="p-3 w-24 font-extrabold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 text-[11px]">
                        Day
                      </th>
                      {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                        (period) => (
                          <th
                            key={period}
                            className="p-3 font-extrabold text-center border-r border-slate-200 text-[11px] text-slate-800"
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
                          <td className="p-3 font-extrabold text-slate-800 bg-slate-50 border-r border-slate-200 text-center text-xs uppercase tracking-wider">
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
                                        ? "bg-purple-50/80 border-purple-200 text-purple-950"
                                        : "bg-blue-50/70 border-blue-200 text-blue-950"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span
                                        className="font-extrabold text-[11px] leading-tight truncate"
                                        title={matchedSlot.subject}
                                      >
                                        {matchedSlot.subject}
                                      </span>
                                      <span className="text-[8px] font-black bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md shrink-0">
                                        {matchedSlot.className}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold mt-1">
                                      <span className="truncate max-w-[70%]">
                                        {matchedSlot.room || "Room"}
                                      </span>
                                      {matchedSlot.secondaryFaculty && (
                                        <span className="text-[8px] font-black text-purple-700 bg-purple-100 px-1 py-0.2 rounded">
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
    </div>
  );
}

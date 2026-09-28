"use client";

import React from "react";
import {
  Layers,
  ChevronRight,
  Edit,
  Users,
  BookOpen,
  Newspaper,
  LogOut,
  PanelLeftClose,
  Calendar,
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
  semester?: string;
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
  classes: string[];
}

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  departments: Department[];
  loadingDepts: boolean;
  expandedDepts: Set<string>;
  setExpandedDepts: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedDept: Department | null;
  setSelectedDept: (dept: Department | null) => void;
  selectedClass: string;
  setSelectedClass: (cls: string) => void;
  currentView: "students" | "faculty" | "news" | "department-wise" | "events" | "timetable";
  setCurrentView: (view: "students" | "faculty" | "news" | "department-wise" | "events" | "timetable") => void;
  studentSubView: "list" | "attendance" | "timetable";
  setStudentSubView: (subView: "list" | "attendance" | "timetable") => void;
  setFromDeptFaculty: (val: boolean) => void;
  setIsDeptEditorOpen: (open: boolean) => void;
  setEditingDeptId: (id: string) => void;
  setNewDeptNameInput: (name: string) => void;
  setIsAddingDept: (open: boolean) => void;
  setTargetDeptId: (id: string) => void;
  setIsAddingClass: (open: boolean) => void;
  setEditingStudent: (student: Student | null) => void;
  setSearchTerm: (term: string) => void;
  setEditingFaculty: (fac: Faculty | null) => void;
  setFilterDept: (dept: Department | null) => void;
  setFilterClass: (cls: string) => void;
  setShowLogoutConfirm: (show: boolean) => void;
  fromDeptFaculty: boolean;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  departments,
  loadingDepts,
  expandedDepts,
  setExpandedDepts,
  selectedDept,
  setSelectedDept,
  selectedClass,
  setSelectedClass,
  currentView,
  setCurrentView,
  studentSubView,
  setStudentSubView,
  setFromDeptFaculty,
  setIsDeptEditorOpen,
  setEditingDeptId,
  setNewDeptNameInput,
  setIsAddingDept,
  setTargetDeptId,
  setIsAddingClass,
  setEditingStudent,
  setSearchTerm,
  setEditingFaculty,
  setFilterDept,
  setFilterClass,
  setShowLogoutConfirm,
  fromDeptFaculty,
}: SidebarProps) {
  return (
    <aside
      className={`w-64 border-r border-slate-200 bg-white flex flex-col h-screen shrink-0 z-50 transition-transform duration-200 ease-out fixed top-0 left-0 lg:sticky lg:translate-x-0 ${
        sidebarOpen
          ? "translate-x-0 sidebar-slide-in"
          : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-200/80 px-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center p-1 shrink-0">
            <img
              src="/splash_logo_dark.png"
              alt="Presenza Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-sm tracking-tight text-slate-900 block truncate">
              Presenza
            </span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Admin Portal
            </span>
          </div>
        </div>

        {/* Close sidebar button on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          title="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
        {/* Core Management Section */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Overview & Schedules
            </span>
          </div>

          <button
            onClick={() => {
              setCurrentView("events");
              setSelectedDept(null);
              setFilterDept(null);
              setFilterClass("");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === "events"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <Calendar className={`h-4 w-4 shrink-0 ${currentView === "events" ? "text-white" : "text-slate-400"}`} />
            <span className="truncate">Events & Tokens</span>
          </button>

          <button
            onClick={() => {
              setCurrentView("timetable");
              setFromDeptFaculty(false);
              setFilterDept(null);
              setFilterClass("");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === "timetable"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <Calendar className={`h-4 w-4 shrink-0 ${currentView === "timetable" ? "text-white" : "text-slate-400"}`} />
            <span className="truncate">Time Table Generator</span>
          </button>
        </div>

        {/* Departments & Classes Section */}
        <div className="space-y-1">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Departments
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAddingDept(true)}
                className="text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title="Add Department"
              >
                + Dept
              </button>
              <span className="text-slate-300 text-[10px]">·</span>
              <button
                onClick={() => {
                  if (departments.length === 0) {
                    alert("Please add a department first!");
                    return;
                  }
                  setTargetDeptId(departments[0].id);
                  setIsAddingClass(true);
                }}
                className="text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title="Add Class"
              >
                + Class
              </button>
            </div>
          </div>

          {loadingDepts ? (
            <div className="px-2.5 py-2 flex items-center gap-2 text-slate-400 text-xs">
              <div className="animate-spin rounded-full h-3 w-3 border border-slate-300 border-t-slate-600" />
              <span>Loading departments...</span>
            </div>
          ) : departments.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-slate-400 italic">
              No departments configured.
            </div>
          ) : (
            <div className="space-y-0.5">
              {departments.map((dept) => {
                const isOpen = expandedDepts.has(dept.id);
                const isActiveDept = selectedDept?.id === dept.id;
                return (
                  <div key={dept.id} className="space-y-0.5">
                    {/* Dept row */}
                    <div
                      className={`flex items-center justify-between rounded-lg transition-colors group ${
                        isActiveDept
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setExpandedDepts((prev) => {
                            const next = new Set(prev);
                            if (next.has(dept.id)) next.delete(dept.id);
                            else next.add(dept.id);
                            return next;
                          });
                          setSelectedDept(dept);
                          setSelectedClass("");
                          setCurrentView("department-wise");
                          setFromDeptFaculty(false);
                        }}
                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer outline-none min-w-0"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${
                            isOpen ? "rotate-90 text-slate-600" : ""
                          }`}
                        />
                        <span className="truncate">{dept.name}</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setNewDeptNameInput(dept.name);
                          setIsDeptEditorOpen(true);
                        }}
                        className="p-1 mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Edit Department"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Class list (collapsible) */}
                    {isOpen && (
                      <div className="ml-4 pl-2 border-l border-slate-200 space-y-0.5 py-0.5">
                        {dept.classes && dept.classes.length > 0 ? (
                          dept.classes.map((cls) => {
                            const isActiveClass =
                              selectedClass === cls && isActiveDept;
                            return (
                              <button
                                key={cls}
                                onClick={() => {
                                  setSelectedDept(dept);
                                  setSelectedClass(cls);
                                  setEditingStudent(null);
                                  setCurrentView("students");
                                  setStudentSubView("attendance");
                                  setFromDeptFaculty(false);
                                  setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-left ${
                                  isActiveClass
                                    ? "bg-orange-600 text-white font-medium shadow-xs"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/70"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    isActiveClass ? "bg-white" : "bg-slate-300"
                                  }`}
                                />
                                <span className="truncate">{cls}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-2.5 py-1 text-[11px] text-slate-400 italic">
                            No classes assigned
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Directory Management Section */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Directories & Feed
            </span>
          </div>

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
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === "students" && studentSubView === "list"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <Users className={`h-4 w-4 shrink-0 ${currentView === "students" && studentSubView === "list" ? "text-white" : "text-slate-400"}`} />
            <span className="truncate">Student Directory</span>
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
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === "faculty" && !fromDeptFaculty
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <BookOpen className={`h-4 w-4 shrink-0 ${currentView === "faculty" && !fromDeptFaculty ? "text-white" : "text-slate-400"}`} />
            <span className="truncate">Faculty Directory</span>
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
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              currentView === "news"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <Newspaper className={`h-4 w-4 shrink-0 ${currentView === "news" ? "text-white" : "text-slate-400"}`} />
            <span className="truncate">Campus Bulletins</span>
          </button>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/60 shrink-0">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

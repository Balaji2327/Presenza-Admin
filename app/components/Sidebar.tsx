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
  currentView: "students" | "faculty" | "news" | "department-wise";
  setCurrentView: (view: "students" | "faculty" | "news" | "department-wise") => void;
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
      className={`w-64 border-r border-slate-200 bg-white flex flex-col shadow-sm h-screen shrink-0 z-50 transition-transform duration-200 ease-out fixed top-0 left-0 lg:sticky lg:translate-x-0 ${
        sidebarOpen
          ? "translate-x-0 sidebar-slide-in"
          : "-translate-x-full lg:translate-x-0"
      }`}
    >
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
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Section Label */}
        <div className="px-4 pt-4 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Departments
          </span>
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
          <div className="px-4 py-3 text-xs text-slate-400 italic">
            No departments found.
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-0.5">
            {departments.map((dept) => {
              const isOpen = expandedDepts.has(dept.id);
              const isActiveDept = selectedDept?.id === dept.id;
              return (
                <div key={dept.id}>
                  {/* Dept row */}
                  <div
                    className={`flex items-center gap-1 pr-2 rounded-xl transition-all ${
                      isActiveDept
                        ? "bg-orange-50 border border-orange-100"
                        : "hover:bg-slate-50 border border-transparent"
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
                      className={`flex-1 flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold cursor-pointer outline-none ${
                        isActiveDept ? "text-orange-600" : "text-slate-600"
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
                          const isActiveClass =
                            selectedClass === cls && isActiveDept;
                          return (
                            <div
                              key={cls}
                              className={`flex items-center gap-1 pr-1 rounded-lg transition-all ${
                                isActiveClass
                                  ? "bg-orange-500 shadow-sm shadow-orange-500/20"
                                  : "hover:bg-orange-50"
                              }`}
                            >
                              <button
                                onClick={() => {
                                  setSelectedDept(dept);
                                  setSelectedClass(cls);
                                  setEditingStudent(null);
                                  setCurrentView("students");
                                  setStudentSubView("attendance");
                                  setFromDeptFaculty(false);
                                  setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold cursor-pointer outline-none ${
                                  isActiveClass ? "text-white" : "text-slate-500"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    isActiveClass ? "bg-white" : "bg-slate-300"
                                  }`}
                                />
                                {cls}
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-1.5 text-[11px] text-slate-400 italic">
                          No classes
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

      {/* Sticky Manage & Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
        {/* Section Label */}
        <div className="px-2 pb-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Manage
          </span>
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
  );
}

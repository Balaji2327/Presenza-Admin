export interface Department {
  id: string;
  name: string;
  classes?: string[];
}

export interface Student {
  id: string;
  name: string;
  email: string;
  class: string;
  department: string;
  mentor_id?: string;
}

export interface AttendanceRecord {
  date: string;
  status: "present" | "absent" | "od";
  period: string;
  subject?: string;
  markedBy?: string;
}

export interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
  classes?: string[];
}

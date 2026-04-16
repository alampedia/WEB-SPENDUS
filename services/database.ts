import { User, Exam, ExamResult, AppSettings, Question, UserRole, Teacher } from '../types';

// Hardcoded Settings
let MOCK_SETTINGS: AppSettings = {
  appName: 'UJI TKA MANDIRI',
  themeColor: '#2459a9',
  gradientEndColor: '#60a5fa',
  logoStyle: 'circle',
  schoolLogoUrl: 'http://lh3.googleusercontent.com/d/1bh9rNBQ0IK9HvNGTwpsGQRcnEaibm_3Y',
  antiCheat: {
    isActive: true,
    freezeDurationSeconds: 15,
    alertText: 'PERINGATAN! Dilarang berpindah aplikasi.',
    enableSound: true,
    antiFastSubmit: false,
    minWorkTimeMinutes: 10
  },
  globalToken: {
    isActive: false,
    token: 'TOKEN2024'
  }
};

const SCHOOLS = [
  "SMPN 1 PASURUAN",
  "SMPN 2 PASURUAN", 
  "SMP IT BINA INSAN",
  "MTsN 1 PASURUAN"
];

let MOCK_TEACHERS: Teacher[] = [];

let MOCK_USERS: User[] = [
  { id: 'admin-id', name: 'Administrator', username: 'admin', role: UserRole.ADMIN, school: 'PUSAT', password: 'admin' },
];

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

let MOCK_EXAMS: Exam[] = [];

let MOCK_RESULTS: ExamResult[] = [];
let MOCK_ROOMS: any[] = [];
let MOCK_SESSIONS: any[] = [];
let MOCK_PROCTORS: any[] = [];

export const db = {
  generateToken: (): string => {
    return generateToken();
  },
  
  getSettings: async (): Promise<AppSettings> => {
    return { ...MOCK_SETTINGS };
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    MOCK_SETTINGS = { ...settings };
  },

  login: async (input: string, password?: string): Promise<User | undefined> => {
    const cleanInput = input.trim();
    
    // Check Admin/Student
    let user = MOCK_USERS.find(u => u.username === cleanInput || u.nisn === cleanInput);
    
    // Check Proctor
    if (!user) {
      const proctor = MOCK_PROCTORS.find(p => p.username === cleanInput);
      if (proctor) {
        user = {
          id: proctor.id,
          name: proctor.name,
          username: proctor.username,
          password: proctor.password,
          role: UserRole.PROCTOR,
          room: MOCK_ROOMS.find(r => r.id === proctor.room_id)?.name
        };
      }
    }

    // Check Teacher (NIP login)
    if (!user) {
      const teacher = MOCK_TEACHERS.find(t => t.nip === cleanInput || t.username === cleanInput);
      if (teacher) {
        user = {
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          password: teacher.password,
          role: UserRole.PROCTOR, // Teachers act as global proctors
          school: 'GLOBAL' // Flag for global access
        };
      }
    }

    if (!user) return undefined;
    if (user.password !== password) return undefined;

    if (user.role === UserRole.STUDENT) {
        if (user.isLogin) {
            alert("Akun sedang digunakan di perangkat lain. Harap logout terlebih dahulu atau hubungi admin.");
            return undefined;
        }
        if (user.status === 'blocked') {
            alert("Akun diblokir. Hubungi pengawas.");
            return undefined;
        }
        user.isLogin = true;
        user.status = 'idle';
    }

    return { ...user };
  },

  logout: async (userId: string): Promise<void> => {
      const user = MOCK_USERS.find(u => u.id === userId);
      if (user && user.role !== UserRole.ADMIN) {
          user.isLogin = false;
      }
  },

  getExams: async (level?: string): Promise<Exam[]> => {
    return [...MOCK_EXAMS];
  },

  updateExamMapping: async (examId: string, token: string, durationMinutes: number, examDate: string, session: string, schoolAccess: string[]): Promise<void> => {
    const exam = MOCK_EXAMS.find(e => e.id === examId);
    if (exam) {
        exam.token = token;
        exam.durationMinutes = durationMinutes;
        exam.examDate = examDate;
        exam.session = session;
        exam.schoolAccess = schoolAccess;
    }
  },

  createExam: async (exam: Exam): Promise<void> => {
    MOCK_EXAMS.push({ ...exam, id: `ex-${Date.now()}`, token: generateToken() });
  },

  updateExam: async (id: string, updates: Partial<Exam>): Promise<void> => {
    const idx = MOCK_EXAMS.findIndex(e => e.id === id);
    if (idx !== -1) {
      MOCK_EXAMS[idx] = { ...MOCK_EXAMS[idx], ...updates };
    }
  },

  addQuestions: async (examId: string, questions: Question[]): Promise<void> => {
      const exam = MOCK_EXAMS.find(e => e.id === examId);
      if (exam) {
          exam.questions = [...exam.questions, ...questions.map(q => ({ ...q, id: `q-${Date.now()}-${Math.random()}` }))];
          exam.questionCount = exam.questions.length;
      }
  },

  submitResult: async (result: ExamResult): Promise<void> => {
    MOCK_RESULTS.push({ ...result, id: `res-${Date.now()}` });
    const user = MOCK_USERS.find(u => u.id === result.studentId);
    if (user) {
        user.status = 'finished';
    }
  },

  getAllResults: async (): Promise<ExamResult[]> => {
    return MOCK_RESULTS.map(r => {
        const student = MOCK_USERS.find(u => u.id === r.studentId);
        const exam = MOCK_EXAMS.find(e => e.id === r.examId);
        return {
            ...r,
            studentName: student?.name || 'Unknown',
            examTitle: exam?.title || 'Unknown'
        };
    });
  },

  resetCheatingCount: async (resultId: string): Promise<void> => {
      const result = MOCK_RESULTS.find(r => r.id === resultId);
      if (result) {
          result.cheatingAttempts = 0;
      }
  },

  getUsers: async (): Promise<User[]> => {
    return MOCK_USERS.filter(u => u.role !== UserRole.ADMIN);
  },
  
  importStudents: async (users: User[]): Promise<void> => {
      users.forEach(u => {
          const existing = MOCK_USERS.find(ex => ex.nisn === (u.nisn || u.username));
          if (!existing) {
              MOCK_USERS.push({
                  ...u,
                  id: `u-${Date.now()}-${Math.random()}`,
                  nisn: u.nisn || u.username,
                  school: u.school || 'UMUM',
                  password: u.password || '12345',
                  isLogin: false,
                  status: 'idle'
              });
          }
      });
  },

  addUser: async (user: User): Promise<void> => {
      MOCK_USERS.push({
          ...user,
          id: `u-${Date.now()}`,
          nisn: user.nisn || user.username,
          school: user.school || 'UMUM',
          password: user.password || '12345',
          isLogin: false,
          status: 'idle'
      });
  },

  deleteUser: async (id: string): Promise<void> => {
    MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
  },

  resetUserStatus: async (userId: string): Promise<void> => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
        user.isLogin = false;
        user.status = 'idle';
    }
  },

  deleteAllUsers: async (): Promise<void> => {
    MOCK_USERS = MOCK_USERS.filter(u => u.role !== UserRole.STUDENT);
  },

  resetUserPassword: async (userId: string): Promise<void> => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
        user.password = '12345';
    }
  },

  deleteResult: async (studentId: string, examId: string): Promise<void> => {
    MOCK_RESULTS = MOCK_RESULTS.filter(r => !(r.studentId === studentId && r.examId === examId));
  },

  updateStudentRoom: async (studentId: string, roomName: string): Promise<void> => {
    const user = MOCK_USERS.find(u => u.id === studentId);
    if (user) {
      user.room = roomName;
    }
  },

  // --- ROOMS ---
  getRooms: async (): Promise<any[]> => {
    return [...MOCK_ROOMS];
  },
  addRoom: async (room: any): Promise<void> => {
    MOCK_ROOMS.push({ ...room, id: `room-${Date.now()}` });
  },
  updateRoom: async (id: string, room: any): Promise<void> => {
    const idx = MOCK_ROOMS.findIndex(r => r.id === id);
    if (idx !== -1) MOCK_ROOMS[idx] = { ...MOCK_ROOMS[idx], ...room };
  },
  deleteRoom: async (id: string): Promise<void> => {
    MOCK_ROOMS = MOCK_ROOMS.filter(r => r.id !== id);
  },

  // --- SESSIONS ---
  getSessions: async (): Promise<any[]> => {
    return [...MOCK_SESSIONS];
  },
  addSession: async (session: any): Promise<void> => {
    MOCK_SESSIONS.push({ ...session, id: `session-${Date.now()}` });
  },
  updateSession: async (id: string, session: any): Promise<void> => {
    const idx = MOCK_SESSIONS.findIndex(s => s.id === id);
    if (idx !== -1) MOCK_SESSIONS[idx] = { ...MOCK_SESSIONS[idx], ...session };
  },
  deleteSession: async (id: string): Promise<void> => {
    MOCK_SESSIONS = MOCK_SESSIONS.filter(s => s.id !== id);
  },

  // --- PROCTORS ---
  getProctors: async (): Promise<any[]> => {
    return [...MOCK_PROCTORS];
  },
  addProctor: async (proctor: any): Promise<void> => {
    MOCK_PROCTORS.push({ ...proctor, id: `proctor-${Date.now()}` });
  },
  updateProctor: async (id: string, proctor: any): Promise<void> => {
    const idx = MOCK_PROCTORS.findIndex(p => p.id === id);
    if (idx !== -1) MOCK_PROCTORS[idx] = { ...MOCK_PROCTORS[idx], ...proctor };
  },
  deleteProctor: async (id: string): Promise<void> => {
    MOCK_PROCTORS = MOCK_PROCTORS.filter(p => p.id !== id);
  },

  // --- TEACHERS ---
  getTeachers: async (): Promise<Teacher[]> => {
    return [...MOCK_TEACHERS];
  },
  addTeacher: async (teacher: Omit<Teacher, 'id'>): Promise<void> => {
    MOCK_TEACHERS.push({ ...teacher, id: `t-${Date.now()}` });
  },
  updateTeacher: async (id: string, teacher: Teacher): Promise<void> => {
    const idx = MOCK_TEACHERS.findIndex(t => t.id === id);
    if (idx !== -1) MOCK_TEACHERS[idx] = { ...MOCK_TEACHERS[idx], ...teacher };
  },
  deleteTeacher: async (id: string): Promise<void> => {
    MOCK_TEACHERS = MOCK_TEACHERS.filter(t => t.id !== id);
  }
};

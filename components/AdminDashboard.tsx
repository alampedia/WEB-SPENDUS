import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Exam, UserRole, Question, QuestionType, ExamResult, AppSettings, Teacher } from '../types';
import { db } from '../services/database'; 
import { Plus, BookOpen, Save, LogOut, Loader2, Key, RotateCcw, Clock, Upload, Download, FileText, LayoutDashboard, Settings, Printer, Filter, Calendar, FileSpreadsheet, Lock, Link, Edit, ShieldAlert, Activity, ClipboardList, Search, Unlock, Trash2, Database, School, Shuffle, X, CheckSquare, Map as MapIcon, CalendarDays, Flame, Volume2, AlertTriangle, UserX, Info, Check, Monitor, Users, GraduationCap, CheckCircle, XCircle, ArrowLeft, BarChart3, PieChart, Menu, ArrowRight, ShieldCheck, Power } from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  appName: string;
  onSettingsChange: () => void;
  themeColor: string;
  settings: AppSettings;
}

// --- ROBUST CSV PARSER ---
const parseCSV = (text: string): string[][] => {
    const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstLine = cleanText.split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (char === '"') {
            if (insideQuotes && cleanText[i + 1] === '"') {
                currentField += '"';
                i++; 
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if (char === '\n' && !insideQuotes) {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    return rows;
};

const escapeCSV = (field: any): string => {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes('"') || stringField.includes(',') || stringField.includes(';') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

type PivotRow = { 
    studentId: string; 
    name: string; 
    school: string; 
    scores: {[key: string]: number}; 
    lastSubmit: string; 
    averageScore: number;
    rank: number;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, appName, onSettingsChange, themeColor, settings }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  
  // TABS
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MONITORING' | 'HASIL_UJIAN' | 'BANK_SOAL' | 'MAPPING' | 'PESERTA' | 'CETAK_KARTU' | 'ANTI_CHEAT' | 'MANAJEMEN_RUANG' | 'MANAJEMEN_SESI' | 'PENGAWAS' | 'TROUBLESHOOTING' | 'KONFIGURASI_UMUM' | 'DATA_GURU' | 'AKTIVASI_TOKEN'>('DASHBOARD');
  
  // DASHBOARD DRILL-DOWN VIEWS
  const [dashboardView, setDashboardView] = useState<'MAIN' | 'STUDENTS_DETAIL' | 'SCHOOLS_DETAIL' | 'EXAMS_DETAIL'>('MAIN');

  // THEME & ADMIN MANAGEMENT STATE (From SuperAdmin)
  const [primaryColor, setPrimaryColor] = useState(settings.themeColor);
  const [gradientEnd, setGradientEnd] = useState(settings.gradientEndColor);
  const [logoStyle, setLogoStyle] = useState<'circle' | 'rect_4_3' | 'rect_3_4_vert'>(settings.logoStyle);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(settings.schoolLogoUrl);
  const [adminTitle, setAdminTitle] = useState(settings.adminTitle || 'SMP TANGGUL JAYA');
  const [adminSubtitle, setAdminSubtitle] = useState(settings.adminSubtitle || 'Panel Sekolah Menengah Pertama');
  
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // ANTI CHEAT STATE
  const [acActive, setAcActive] = useState(settings.antiCheat.isActive);
  const [acFreeze, setAcFreeze] = useState(settings.antiCheat.freezeDurationSeconds);
  const [acText, setAcText] = useState(settings.antiCheat.alertText);
  const [acSound, setAcSound] = useState(settings.antiCheat.enableSound);

  // NEW STATES
  const [rooms, setRooms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [proctors, setProctors] = useState<any[]>([]);

  // MAPPING / SCHEDULE STATE
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editToken, setEditToken] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editSession, setEditSession] = useState('');
  const [editSchoolAccess, setEditSchoolAccess] = useState<string[]>([]);
  const [mappingSearch, setMappingSearch] = useState(''); 
  
  // QUESTION BANK STATE
  const [viewingQuestionsExam, setViewingQuestionsExam] = useState<Exam | null>(null);
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [targetExamForAdd, setTargetExamForAdd] = useState<Exam | null>(null);
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamGrade, setNewExamGrade] = useState('7');
  
  // MANUAL QUESTION FORM
  const [nqType, setNqType] = useState<QuestionType>('PG');
  const [nqGrade, setNqGrade] = useState<string>('7');
  const [nqText, setNqText] = useState<string>('');
  const [nqImg, setNqImg] = useState<string>('');
  const [nqOptions, setNqOptions] = useState<string[]>(['', '', '', '']);
  const [nqCorrectIndex, setNqCorrectIndex] = useState<number>(0);
  const [nqPoints, setNqPoints] = useState<number>(10);

  // IMPORT REFS
  const [importTargetExamId, setImportTargetExamId] = useState<string | null>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const teacherFileRef = useRef<HTMLInputElement>(null);
  
  // FILTERS & CARD PRINTING
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('ALL'); // For Peserta & Monitoring
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [dashboardSchoolFilter, setDashboardSchoolFilter] = useState<string>('ALL'); // For Dashboard Details
  const [resultSchoolFilter, setResultSchoolFilter] = useState<string>('ALL'); // For Results
  const [resultSubjectFilter, setResultSubjectFilter] = useState<string>('ALL'); // For Results - Subject
  const [resultSortSubject, setResultSortSubject] = useState<string>('AVERAGE'); // AVERAGE or subject name
  const [cardSchoolFilter, setCardSchoolFilter] = useState<string>('ALL'); // For Cards
  const [monitoringSearch, setMonitoringSearch] = useState<string>('');
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  
  // GRAPH FILTERS
  const [graphFilterMode, setGraphFilterMode] = useState<'SCHEDULED' | 'ALL'>('SCHEDULED');
  const [graphDate, setGraphDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSchoolTooltip, setSelectedSchoolTooltip] = useState<{name: string, value: number, x: number, y: number} | null>(null);

  // MONITORING BULK ACTIONS
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // MOBILE SIDEBAR STATE
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // MODAL STATES FOR ROOMS, SESSIONS, PROCTORS
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [isProctorModalOpen, setIsProctorModalOpen] = useState(false);
  const [editingProctor, setEditingProctor] = useState<any>(null);

  // TEACHER STATES
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // TOKEN ACTIVATION STATES
  const [isTokenActivationModalOpen, setIsTokenActivationModalOpen] = useState(false);
  const [selectedExamForToken, setSelectedExamForToken] = useState<Exam | null>(null);
  const [activationDate, setActivationDate] = useState(new Date().toISOString().split('T')[0]);
  const [generatedToken, setGeneratedToken] = useState('');

  // TROUBLESHOOTING STATES
  const [troubleshootResetNisn, setTroubleshootResetNisn] = useState('');
  const [troubleshootUnblockNisn, setTroubleshootUnblockNisn] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    const e = await db.getExams(); 
    const u = await db.getUsers();
    const r = await db.getAllResults();
    const rm = await db.getRooms();
    const s = await db.getSessions();
    const p = await db.getProctors();
    const t = await db.getTeachers();
    setExams(e);
    setUsers(u); 
    setResults(r);
    setRooms(rm);
    setSessions(s);
    setProctors(p);
    setTeachers(t);
    setIsLoadingData(false);
  };

  // --- MEMOIZED PIVOT DATA FOR RESULTS TABLE ---
  const { pivotRows, uniqueSubjects } = useMemo(() => {
      const filteredRawResults = results.filter(r => {
          if (resultSchoolFilter !== 'ALL') {
              const student = users.find(u => u.id === r.studentId);
              if (student?.school !== resultSchoolFilter) return false;
          }
          if (resultSubjectFilter !== 'ALL' && r.examTitle !== resultSubjectFilter) return false;
          return true;
      });

      const subjects = Array.from(new Set(filteredRawResults.map(r => r.examTitle || 'Unknown'))).sort();

      const map = new Map<string, PivotRow>();

      filteredRawResults.forEach(r => {
          if (!map.has(r.studentId)) {
              const student = users.find(u => u.id === r.studentId);
              map.set(r.studentId, {
                  studentId: r.studentId,
                  name: r.studentName || 'Unknown',
                  school: student?.school || '-',
                  scores: {},
                  lastSubmit: r.submittedAt,
                  averageScore: 0,
                  rank: 0
              });
          }
          const entry = map.get(r.studentId)!;
          entry.scores[r.examTitle || 'Unknown'] = r.score;
          
          if (new Date(r.submittedAt) > new Date(entry.lastSubmit)) {
              entry.lastSubmit = r.submittedAt;
          }
      });

      let rows = Array.from(map.values()) as PivotRow[];
      
      // Calculate average score for each row
      rows.forEach(row => {
          const mathScore = row.scores['Matematika'] || 0;
          const indoScore = row.scores['Bahasa Indonesia'] || 0;
          row.averageScore = (mathScore + indoScore) / 2;
      });

      // Sort rows
      rows.sort((a, b) => {
          if (resultSortSubject === 'AVERAGE') {
              if (b.averageScore !== a.averageScore) {
                  return b.averageScore - a.averageScore;
              }
          } else {
              const scoreA = a.scores[resultSortSubject] || 0;
              const scoreB = b.scores[resultSortSubject] || 0;
              if (scoreB !== scoreA) {
                  return scoreB - scoreA;
              }
          }
          // Tie-breaker: fastest submit time
          return new Date(a.lastSubmit).getTime() - new Date(b.lastSubmit).getTime();
      });

      // Assign ranks
      rows.forEach((row, index) => {
          row.rank = index + 1;
      });

      return { pivotRows: rows, uniqueSubjects: subjects };
  }, [results, users, resultSchoolFilter, resultSubjectFilter, resultSortSubject]);

  // --- THEME & ADMIN FUNCTIONS ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const url = URL.createObjectURL(e.target.files[0]);
          setLogoUrl(url);
      }
  };

  const handleSaveTheme = async () => {
      await db.updateSettings({
          ...settings,
          adminTitle: adminTitle,
          adminSubtitle: adminSubtitle,
          themeColor: primaryColor,
          gradientEndColor: gradientEnd,
          logoStyle: logoStyle,
          schoolLogoUrl: logoUrl
      });
      onSettingsChange();
      alert("Tema warna dan logo berhasil disimpan!");
  };

  const getPreviewContainerClass = () => {
      switch(logoStyle) {
          case 'circle': return 'w-24 h-24 rounded-full';
          case 'rect_4_3': return 'w-32 h-24 rounded-lg';
          case 'rect_3_4_vert': return 'w-24 h-32 rounded-lg';
          default: return 'w-24 h-24 rounded-full';
      }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      const newUser: User = {
          id: `usr-${Date.now()}`,
          name: newAdminName,
          username: newAdminUsername,
          password: newAdminPassword,
          role: UserRole.ADMIN,
      };
      await db.addUser(newUser);
      setIsAddAdminModalOpen(false);
      setNewAdminName('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      loadData();
  };

  const handleDeleteAdmin = async (id: string) => {
      if (confirm('Apakah Anda yakin ingin menghapus admin ini?')) {
          await db.deleteUser(id);
          loadData();
      }
  };

  // --- ACTIONS ---
  const handleSaveAntiCheat = async () => {
      await db.updateSettings({
          ...settings,
          antiCheat: {
              isActive: acActive,
              freezeDurationSeconds: acFreeze,
              alertText: acText,
              enableSound: acSound,
              antiFastSubmit: settings.antiCheat?.antiFastSubmit || false,
              minWorkTimeMinutes: settings.antiCheat?.minWorkTimeMinutes || 10
          }
      });
      onSettingsChange();
      alert("Pengaturan Sistem Anti-Curang berhasil diperbarui!");
  };

  const handleResetViolation = async (resultId: string) => {
      if(!confirm("Reset status pelanggaran siswa ini?")) return;
      
      await db.resetCheatingCount(resultId);
      
      // Optimistic update locally
      setResults(prev => prev.map(r => r.id === resultId ? {...r, cheatingAttempts: 0} : r));
      alert("Pelanggaran di-reset.");
  };

  const handleCreateExam = () => {
      setNewExamTitle('');
      setNewExamGrade('7');
      setIsAddExamModalOpen(true);
  };

  const submitNewExam = async () => {
      if(!newExamTitle) return;
      
      const newExam: Exam = {
          id: `temp`, // Will be generated by DB
          title: newExamTitle,
          subject: newExamTitle,
          educationLevel: 'SMP',
          durationMinutes: 60,
          isActive: true,
          token: '12345',
          questions: [],
          questionCount: 0,
          grade: newExamGrade
      };
      await db.createExam(newExam);
      setIsAddExamModalOpen(false);
      loadData();
  };

  // --- MAPPING LOGIC ---
  const openMappingModal = (exam: Exam) => {
      setEditingExam(exam);
      setEditToken(exam.token);
      setEditDuration(exam.durationMinutes);
      setEditDate(exam.examDate || new Date().toISOString().split('T')[0]);
      setEditSession(exam.session || 'Sesi 1');
      setEditSchoolAccess(exam.schoolAccess || []); 
      setMappingSearch('');
      setIsEditModalOpen(true);
  };

  const toggleRoomAccess = (roomName: string) => {
      setEditSchoolAccess(prev => {
          if (prev.includes(roomName)) return prev.filter(s => s !== roomName);
          return [...prev, roomName];
      });
  };

  const addAllAvailableRooms = (available: string[]) => {
      const newAccess = [...editSchoolAccess];
      available.forEach(s => {
          if(!newAccess.includes(s)) newAccess.push(s);
      });
      setEditSchoolAccess(newAccess);
  };

  const handleSaveMapping = async () => {
      if (!editingExam) return;
      if (editToken.length < 3) return alert("Token minimal 3 karakter");
      
      await db.updateExamMapping(
          editingExam.id, 
          editToken.toUpperCase(), 
          editDuration,
          editDate,
          editSession,
          editSchoolAccess
      );
      setIsEditModalOpen(false);
      setEditingExam(null);
      loadData();
      alert("Mapping Jadwal & Akses Sekolah berhasil diperbarui!");
  };

  // --- ROOMS, SESSIONS, PROCTORS HANDLERS ---
  const handleSaveRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const roomData = {
          name: formData.get('name') as string,
          capacity: Number(formData.get('capacity')),
          proctor_username: formData.get('proctor_username') as string,
          teacherId: formData.get('teacherId') as string || undefined
      };
      if (editingRoom) {
          await db.updateRoom(editingRoom.id, roomData);
      } else {
          await db.addRoom(roomData);
      }
      setIsRoomModalOpen(false);
      setEditingRoom(null);
      loadData();
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const teacherData = {
      name: formData.get('name') as string,
      nip: formData.get('nip') as string,
      username: formData.get('username') as string,
      password: formData.get('password') as string,
    };

    if (editingTeacher) {
      await db.updateTeacher(editingTeacher.id, { ...teacherData, id: editingTeacher.id });
    } else {
      await db.addTeacher(teacherData);
    }
    setIsTeacherModalOpen(false);
    setEditingTeacher(null);
    await loadData();
    alert("Data guru berhasil disimpan!");
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Hapus data guru ini?")) return;
    await db.deleteTeacher(id);
    await loadData();
  };

  const handleActivateToken = async () => {
    if (!selectedExamForToken) return;
    if (!generatedToken) return alert("Token tidak boleh kosong!");
    
    await db.updateExam(selectedExamForToken.id, {
      token: generatedToken.toUpperCase(),
      examDate: activationDate,
    });
    setIsTokenActivationModalOpen(false);
    await loadData();
    alert(`Token ${generatedToken.toUpperCase()} berhasil diaktifkan untuk ${selectedExamForToken.title}`);
  };

  const handleDeleteRoom = async (id: string) => {
      if (!confirm("Hapus ruang ini?")) return;
      await db.deleteRoom(id);
      loadData();
  };

  const handleSaveSession = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const sessionData = {
          name: formData.get('name') as string,
          start_time: formData.get('start_time') as string,
          end_time: formData.get('end_time') as string,
          participant_type: formData.get('participant_type') as string
      };
      if (editingSession) {
          await db.updateSession(editingSession.id, sessionData);
      } else {
          await db.addSession(sessionData);
      }
      setIsSessionModalOpen(false);
      setEditingSession(null);
      loadData();
  };

  const handleDeleteSession = async (id: string) => {
      if (!confirm("Hapus sesi ini?")) return;
      await db.deleteSession(id);
      loadData();
  };

  const handleSaveProctor = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const teacherId = formData.get('teacher_id') as string;
      const selectedTeacher = teachers.find(t => t.id === teacherId);

      // If we are editing and not changing the teacher, we might not have a selectedTeacher
      // However, the requested flow is to pick a teacher from the list
      const proctorName = selectedTeacher ? selectedTeacher.name : formData.get('name') as string;
      const proctorUsername = selectedTeacher ? selectedTeacher.username : formData.get('username') as string;

      const proctorData = {
          name: proctorName,
          username: proctorUsername,
          password: formData.get('password') as string,
          room_id: formData.get('room_id') as string,
          school: adminTitle // Assign proctor's school as the adminTitle
      };
      if (editingProctor) {
          await db.updateProctor(editingProctor.id, proctorData);
      } else {
          await db.addProctor(proctorData);
      }
      setIsProctorModalOpen(false);
      setEditingProctor(null);
      loadData();
  };

  const handleDeleteProctor = async (id: string) => {
      if (!confirm("Hapus pengawas ini?")) return;
      await db.deleteProctor(id);
      loadData();
  };

  // --- TROUBLESHOOTING HANDLERS ---
  const handleTroubleshootReset = async () => {
      if (!troubleshootResetNisn) return alert("Masukkan NISN siswa");
      const user = users.find(u => u.nisn === troubleshootResetNisn);
      if (!user) return alert("Siswa dengan NISN tersebut tidak ditemukan");
      if (!confirm(`Reset login untuk siswa ${user.name}?`)) return;
      
      await db.resetUserStatus(user.id);
      alert(`Status login siswa ${user.name} berhasil di-reset.`);
      setTroubleshootResetNisn('');
      loadData();
  };

  const handleTroubleshootUnblock = async () => {
      if (!troubleshootUnblockNisn) return alert("Masukkan NISN siswa");
      const user = users.find(u => u.nisn === troubleshootUnblockNisn);
      if (!user) return alert("Siswa dengan NISN tersebut tidak ditemukan");
      if (!confirm(`Buka blokir untuk siswa ${user.name}?`)) return;
      
      // Find the result that has cheating attempts and reset it
      const result = results.find(r => r.studentId === user.id && r.cheatingAttempts >= 3);
      if (result) {
          await db.resetCheatingCount(result.id);
      }
      await db.resetUserStatus(user.id);
      alert(`Blokir siswa ${user.name} berhasil dibuka.`);
      setTroubleshootUnblockNisn('');
      loadData();
  };

  // --- QUESTION BANK & IMPORT/EXPORT ---
  const handleSaveQuestion = async () => {
      if (!targetExamForAdd) return;
      if (!nqText.trim()) return alert("Teks soal wajib diisi!");
      const newQuestion: Question = {
          id: `manual`,
          type: nqType,
          grade: nqGrade,
          text: nqText,
          imgUrl: nqImg || undefined,
          points: Number(nqPoints) || 0,
          options: nqOptions,
          correctIndex: nqCorrectIndex,
      };
      await db.addQuestions(targetExamForAdd.id, [newQuestion]);
      setIsAddQuestionModalOpen(false);
      loadData();
      alert("Soal berhasil ditambahkan!");
  };

  const downloadQuestionTemplate = () => {
      const headers = "No,Tipe,Jenis,Soal,Url Gambar,Opsi A,Opsi B,Opsi C,Opsi D,Kunci,Bobot";
      const example1 = "1,PG,UMUM,Siapa presiden pertama RI?,,Soekarno,Hatta,Habibie,Gus Dur,A,10";
      const blob = new Blob([headers + "\n" + example1], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'TEMPLATE_SOAL_DB.csv'; link.click();
  };
  
  const downloadStudentTemplate = () => {
      const headers = "NISN,NAMA,SEKOLAH,PASSWORD";
      const example = "1234567890,Ahmad Siswa,SMP NEGERI 1,12345";
      const blob = new Blob([headers + "\n" + example], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'TEMPLATE_SISWA_DB.csv'; link.click();
  };

  const triggerImportQuestions = (examId: string) => { setImportTargetExamId(examId); setTimeout(() => questionFileRef.current?.click(), 100); };
  
  const handleExportQuestions = (exam: Exam) => {
      const headers = ["No", "Tipe", "Jenis", "Soal", "Url Gambar", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Bobot"];
      const rows = exam.questions.map((q, idx) => {
          const options = q.options || ["", "", "", ""];
          const keyMap = ['A', 'B', 'C', 'D'];
          const keyString = typeof q.correctIndex === 'number' ? keyMap[q.correctIndex] : 'A';
          return [String(idx + 1), q.type, "UMUM", escapeCSV(q.text), escapeCSV(q.imgUrl), escapeCSV(options[0]), escapeCSV(options[1]), escapeCSV(options[2]), escapeCSV(options[3]), keyString, String(q.points)].join(",");
      });
      const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `BANK_SOAL_${exam.subject}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const onQuestionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0] || !importTargetExamId) return;
      const file = e.target.files[0];
      const targetExam = exams.find(ex => ex.id === importTargetExamId);
      if (!targetExam) return;

      const processRows = (rows: any[]) => {
          const newQuestions: Question[] = rows.map((row, idx) => {
             let text, img, oa, ob, oc, od, key, points;
             if (Array.isArray(row)) {
                 if (row.length < 4) return null;
                 // Handle TXT (tab separated) or CSV
                 const offset = row[0] === 'PG' ? -1 : 0; // If no 'No' column
                 text = row[3+offset]; img = row[4+offset]; oa = row[5+offset]; ob = row[6+offset]; oc = row[7+offset]; od = row[8+offset]; key = row[9+offset]; points = row[10+offset];
             } else return null;

             if (!text) return null;

             const rawKey = key ? String(key).toUpperCase().trim() : 'A';
             let cIndex = rawKey.charCodeAt(0) - 65;
             if (cIndex < 0 || cIndex > 3) cIndex = 0; 

             return {
                  id: `imp-${idx}-${Date.now()}`,
                  type: 'PG',
                  text: text || 'Soal',
                  imgUrl: img && String(img).startsWith('http') ? img : undefined,
                  options: [oa || '', ob || '', oc || '', od || ''],
                  correctIndex: cIndex,
                  points: parseInt(points || '10')
             };
          }).filter(Boolean) as Question[];

          if (newQuestions.length) { 
              db.addQuestions(targetExam.id, newQuestions).then(() => {
                  loadData();
                  alert(`Berhasil import ${newQuestions.length} soal!`);
              }); 
          }
      };

      try {
          const fileText = await file.text();
          if (file.name.endsWith('.txt')) {
            const rows = fileText.split('\n').map(line => line.split('\t'));
            processRows(rows.slice(1)); // Skip header
          } else {
            const rows = parseCSV(fileText).slice(1);
            processRows(rows);
          }
      } catch (e: any) { console.error(e); alert("Format Salah atau file corrupt."); }
      e.target.value = '';
  };

  const triggerImportStudents = () => { setTimeout(() => studentFileRef.current?.click(), 100); };
  
  const downloadTeacherTemplate = () => {
      const csvContent = "NAMA_LENGKAP,NIP,NAMA_PANGGILAN,USERNAME_PANGGILAN\nJohn Doe,123456789,John,john.proctor";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', 'TEMPLATE_GURU.csv'); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const triggerImportTeachers = () => { setTimeout(() => teacherFileRef.current?.click(), 100); };
  
  const onTeacherFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return;
      setIsProcessingImport(true);
      try {
          const fileText = await e.target.files[0].text();
          const rows = parseCSV(fileText).slice(1); 
          
          let successCount = 0;
          for(const row of rows) {
              if(!row[0] || !row[0].trim()) continue;
              const name = row[0].trim();
              const nip = row[1] ? row[1].trim() : '';
              const nickname = row[2] ? row[2].trim() : name.split(' ')[0] || 'Guru';
              const username = row[3] ? row[3].trim() : nickname.toLowerCase() + '.proctor';
              
              const password = "password"; // default password
              await db.addTeacher({ name, nip, username, password });
              successCount++;
          }
          
          if (successCount > 0) { 
              await loadData(); 
              alert(`Berhasil import ${successCount} data guru!`); 
          } else {
              alert("File kosong atau format salah.");
          }
      } catch (e: any) { alert("Gagal import guru. Pastikan menggunakan Template CSV yang benar."); }
      setIsProcessingImport(false);
      e.target.value = '';
  };

  const onStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return;
      setIsProcessingImport(true);
      try {
          const fileText = await e.target.files[0].text();
          const rows = parseCSV(fileText).slice(1); 
          
          const newUsers = rows.map((row, idx) => {
              if (!row[0] || !row[0].trim()) return null;
              
              const nisn = row[0].trim();
              const name = row[1] ? row[1].trim() : 'Siswa';
              const school = row[2] ? row[2].trim() : 'UMUM';
              const password = row[3] ? row[3].trim() : '12345';

              return {
                  id: `temp-${idx}`,
                  name: name,
                  nisn: nisn,
                  username: nisn,
                  password: password,
                  school: school,
                  role: UserRole.STUDENT
              };
          }).filter(Boolean) as User[];
          
          if (newUsers.length > 0) { 
              await db.importStudents(newUsers); 
              await loadData(); 
              alert(`Berhasil import ${newUsers.length} siswa!`); 
          } else {
              alert("File kosong atau format salah.");
          }
      } catch (e: any) { alert("Gagal import siswa. Pastikan menggunakan Template CSV yang benar."); }
      setIsProcessingImport(false);
      e.target.value = '';
  };

  const handleExportResultsExcel = () => {
      const filteredResults = results.filter(r => {
          const student = users.find(u => u.id === r.studentId);
          if (selectedClassFilter !== 'ALL' && student?.grade !== selectedClassFilter) return false;
          if (selectedRoomFilter !== 'ALL' && student?.room !== selectedRoomFilter) return false;
          if (resultSubjectFilter !== 'ALL' && r.examTitle !== resultSubjectFilter) return false;
          return true;
      });

      if (filteredResults.length === 0) return alert("Tidak ada data untuk diexport");

      const headers = ["No", "Nama Siswa", "Nomor Peserta", "Kelas", "Sekolah", "Mapel", "Nilai", "Waktu Submit"];
      
      const csvRows = filteredResults.map((r, index) => {
          const student = users.find(u => u.id === r.studentId);
          const exam = exams.find(e => e.id === r.examId);
          return [
              String(index + 1),
              escapeCSV(student?.name || r.studentName),
              escapeCSV(student?.username || ''),
              escapeCSV(student?.grade || '-'),
              escapeCSV(student?.school || '-'),
              escapeCSV(exam?.title || r.examTitle),
              r.score.toFixed(2),
              new Date(r.submittedAt).toLocaleString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any)
          ].join(",");
      });

      const blob = new Blob([headers.join(",") + "\n" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const fileName = `HASIL_UJIAN_${selectedClassFilter}_${selectedRoomFilter}_${resultSubjectFilter}.csv`;
      
      const link = document.createElement('a'); 
      link.href = URL.createObjectURL(blob); 
      link.setAttribute('download', fileName); 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link);
  };

  const getMonitoringUsers = (schoolFilter?: string) => {
      let filtered = users;
      if (schoolFilter && schoolFilter !== 'ALL') {
          filtered = filtered.filter(u => u.school === schoolFilter);
      } else if (!schoolFilter) {
          if (selectedClassFilter !== 'ALL') filtered = filtered.filter(u => u.grade?.toString() === selectedClassFilter);
          if (selectedRoomFilter !== 'ALL') filtered = filtered.filter(u => u.room === selectedRoomFilter);
      }
      if (monitoringSearch) filtered = filtered.filter(u => u.name.toLowerCase().includes(monitoringSearch.toLowerCase()) || u.nisn?.includes(monitoringSearch));
      return filtered;
  };

  // --- HELPER FOR STUDENT STATUS COLORS ---
  const getStudentStatusInfo = (u: User) => {
      if (u.status === 'finished') return { color: 'bg-green-100 text-green-700 border-green-200', label: 'Selesai' };
      if (u.isLogin) return { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Mengerjakan' };
      return { color: 'bg-red-100 text-red-700 border-red-200', label: 'Belum Login' };
  };

  const getSubjectStatus = (studentId: string, subjectTitle: string) => {
      const result = results.find(r => r.studentId === studentId && r.examTitle === subjectTitle);
      const student = users.find(u => u.id === studentId);
      const exam = exams.find(e => e.title === subjectTitle);
      
      if (result) {
          return { 
              label: `Selesai (${result.score})`, 
              color: 'bg-green-100 text-green-700 border-green-200',
              canReset: result.score === 0,
              examId: exam?.id
          };
      }
      
      if (student?.isLogin && student?.status === 'working') {
          const today = new Date().toISOString().split('T')[0];
          const isScheduled = exams.some(e => e.title === subjectTitle && e.examDate === today && e.schoolAccess?.includes(student.school || ''));
          if (isScheduled) return { 
              label: 'Mengerjakan', 
              color: 'bg-blue-100 text-blue-700 border-blue-200',
              canReset: true,
              examId: exam?.id
          };
      }
      
      return { 
          label: 'Belum', 
          color: 'bg-gray-100 text-gray-400 border-gray-200',
          canReset: true,
          examId: exam?.id
      };
  };

  const handleResetSubject = async (studentId: string, subjectTitle: string) => {
      const exam = exams.find(e => e.title === subjectTitle);
      if (!exam) return;
      
      if (!confirm(`Reset progress/hasil ujian ${subjectTitle} untuk siswa ini?`)) return;
      
      setIsLoadingData(true);
      try {
          await db.deleteResult(studentId, exam.id);
          await db.resetUserStatus(studentId);
          await loadData();
          alert(`Ujian ${subjectTitle} berhasil di-reset.`);
      } catch (error) {
          console.error(error);
          alert("Gagal reset ujian.");
      }
      setIsLoadingData(false);
  };
  
  // -- BULK ACTION LOGIC --
  const toggleSelectAll = (filteredUsers: User[]) => {
      if (selectedStudentIds.length === filteredUsers.length) {
          setSelectedStudentIds([]);
      } else {
          setSelectedStudentIds(filteredUsers.map(u => u.id));
      }
  };

  const toggleSelectOne = (id: string) => {
      if (selectedStudentIds.includes(id)) {
          setSelectedStudentIds(prev => prev.filter(uid => uid !== id));
      } else {
          setSelectedStudentIds(prev => [...prev, id]);
      }
  };

  const handleBulkReset = async () => {
      if (!selectedStudentIds.length) return;
      if (!confirm(`Reset login status untuk ${selectedStudentIds.length} siswa terpilih?`)) return;
      
      setIsLoadingData(true);
      for (const id of selectedStudentIds) {
          await db.resetUserStatus(id);
      }
      setSelectedStudentIds([]);
      await loadData();
      alert("Berhasil reset masal.");
  };

  // Derived Values
  const schools = (Array.from(new Set(users.map(u => u.school || 'Unknown'))).filter(Boolean) as string[]).sort();
  const classes = (Array.from(new Set(users.map(u => u.grade?.toString() || 'Unknown'))).filter(Boolean) as string[]).sort();
  const availableRoomsList = (Array.from(new Set(users.map(u => u.room || 'Unknown'))).filter(Boolean) as string[]).sort();
  const grades = (Array.from(new Set(users.map(u => u.grade || 'Unknown'))).filter(Boolean) as string[]).sort();
  const totalSchools = schools.length;

  // Responsive Nav Item (Icons on Mobile, Full on Desktop)
  const NavItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
      <button 
        onClick={() => { setActiveTab(id); setDashboardView('MAIN'); }} 
        className={`w-full flex items-center justify-center md:justify-start md:space-x-3 p-3 md:px-4 md:py-3 rounded-lg transition mb-1 text-sm font-medium ${activeTab === id ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/20' : 'text-blue-100 hover:bg-white/5'}`}
        title={label}
      >
          <Icon size={20} className="flex-shrink-0" />
          <span className="hidden md:block truncate">{label}</span>
      </button>
  );
  
  // Monitoring Filtered Users
  const filteredMonitoringUsers = getMonitoringUsers();

  // --- Calculate Available Rooms for Mapping (Filtering Logic) ---
  const getRoomsAvailability = () => {
      const busyRooms = new Set<string>();
      
      exams.forEach(ex => {
          if (editingExam && ex.id === editingExam.id) return;
          if (ex.examDate === editDate && ex.session === editSession && ex.schoolAccess) {
              ex.schoolAccess.forEach(r => busyRooms.add(r));
          }
      });

      const allRoomNames = rooms.map(r => r.name);
      const assigned = editSchoolAccess.sort();
      const available = allRoomNames.filter(r => 
          !assigned.includes(r) && 
          !busyRooms.has(r) && 
          r.toLowerCase().includes(mappingSearch.toLowerCase())
      );
      const busyCount = busyRooms.size;
      return { assigned, available, busyCount };
    };

  const { assigned: assignedRooms, available: availableRooms, busyCount } = isEditModalOpen ? getRoomsAvailability() : { assigned: [], available: [], busyCount: 0 };

  // --- AGGREGATION FOR "JUMLAH SEKOLAH" DASHBOARD VIEW ---
  const getSchoolStats = (schoolName: string) => {
      const studentsInSchool = users.filter(u => u.school === schoolName);
      const notLogin = studentsInSchool.filter(u => !u.isLogin && u.status !== 'finished').length;
      const working = studentsInSchool.filter(u => u.isLogin && u.status !== 'finished').length;
      const finished = studentsInSchool.filter(u => u.status === 'finished').length;
      
      // Get exam mapping for today
      const today = new Date().toISOString().split('T')[0];
      const todayExam = exams.find(e => e.examDate === today && e.schoolAccess?.includes(schoolName));
      
      return { notLogin, working, finished, total: studentsInSchool.length, todayExamTitle: todayExam?.title || '-' };
  };

  const handleDownloadSchoolStats = () => {
      const headers = ["Nama Sekolah", "Total Siswa", "Belum Login", "Mengerjakan", "Selesai", "Mapel Hari Ini"];
      const rows = schools.map(s => {
          const stats = getSchoolStats(s);
          return [escapeCSV(s), stats.total, stats.notLogin, stats.working, stats.finished, escapeCSV(stats.todayExamTitle)].join(",");
      });
      const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `REKAP_SEKOLAH_HARI_INI.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- RENDER SUB-VIEWS FOR DASHBOARD ---
  const renderDashboardContent = () => {
    if (dashboardView === 'STUDENTS_DETAIL') {
        const filteredSchools = dashboardSchoolFilter === 'ALL' ? schools : [dashboardSchoolFilter];
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDashboardView('MAIN')} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft size={20}/></button>
                        <h3 className="font-bold text-lg text-gray-800">Detail Status Siswa (Realtime)</h3>
                    </div>
                    <select className="border rounded p-2 text-sm min-w-[200px]" value={dashboardSchoolFilter} onChange={e => setDashboardSchoolFilter(e.target.value)}>
                        <option value="ALL">Semua Sekolah</option>
                        {schools.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map(school => {
                        const students = users.filter(u => u.school === school);
                        return (
                            <div key={school} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 text-sm truncate" title={school}>{school}</div>
                                <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                                    {students.map(u => {
                                        const status = getStudentStatusInfo(u);
                                        return (
                                            <div key={u.id} className={`flex items-center justify-between p-2 rounded border text-xs ${status.color}`}>
                                                <span className="font-bold truncate w-2/3">{u.name}</span>
                                                <span className="font-bold whitespace-nowrap">{status.label}</span>
                                            </div>
                                        )
                                    })}
                                    {students.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Tidak ada siswa.</p>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }

    if (dashboardView === 'SCHOOLS_DETAIL') {
        const filteredSchoolsList = dashboardSchoolFilter === 'ALL' ? schools : [dashboardSchoolFilter];
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setDashboardView('MAIN')} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft size={20}/></button>
                        <h3 className="font-bold text-lg text-gray-800">Rekap Mapping & Status Sekolah</h3>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                         <select className="border rounded p-2 text-sm flex-1 md:min-w-[200px]" value={dashboardSchoolFilter} onChange={e => setDashboardSchoolFilter(e.target.value)}>
                            <option value="ALL">Semua Sekolah</option>
                            {schools.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={handleDownloadSchoolStats} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center hover:bg-green-700"><Download size={16} className="md:mr-2"/><span className="hidden md:inline">CSV</span></button>
                    </div>
                </div>
                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 font-bold border-b text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="p-4">Nama Sekolah</th>
                                <th className="p-4 text-center">Total Siswa</th>
                                <th className="p-4 text-center text-red-600">Belum Login</th>
                                <th className="p-4 text-center text-blue-600">Mengerjakan</th>
                                <th className="p-4 text-center text-green-600">Selesai</th>
                                <th className="p-4">Jadwal Mapel Hari Ini</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredSchoolsList.map(school => {
                                const stats = getSchoolStats(school);
                                return (
                                    <tr key={school} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-700">{school}</td>
                                        <td className="p-4 text-center font-mono">{stats.total}</td>
                                        <td className="p-4 text-center font-mono text-red-600 font-bold bg-red-50">{stats.notLogin}</td>
                                        <td className="p-4 text-center font-mono text-blue-600 font-bold bg-blue-50">{stats.working}</td>
                                        <td className="p-4 text-center font-mono text-green-600 font-bold bg-green-50">{stats.finished}</td>
                                        <td className="p-4 text-xs font-bold text-gray-500">{stats.todayExamTitle}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (dashboardView === 'EXAMS_DETAIL') {
        const relevantUsers = users.filter(u => {
             const hasAccess = exams.some(e => e.schoolAccess?.includes(u.school || ''));
             return hasAccess && (dashboardSchoolFilter === 'ALL' || u.school === dashboardSchoolFilter);
        });
        const finishedUsers = relevantUsers.filter(u => u.status === 'finished');
        const unfinishedUsers = relevantUsers.filter(u => u.status !== 'finished');
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                         <button onClick={() => setDashboardView('MAIN')} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft size={20}/></button>
                         <h3 className="font-bold text-lg text-gray-800">Detail Status Penyelesaian</h3>
                    </div>
                    <select className="border rounded p-2 text-sm min-w-[200px]" value={dashboardSchoolFilter} onChange={e => setDashboardSchoolFilter(e.target.value)}>
                        <option value="ALL">Semua Sekolah Termapping</option>
                        {schools.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
                            <h4 className="font-bold text-green-800 flex items-center"><CheckCircle size={18} className="mr-2"/> Sudah Selesai ({finishedUsers.length})</h4>
                        </div>
                        <div className="p-0 overflow-y-auto max-h-[500px]">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 font-bold border-b text-gray-500">
                                    <tr><th className="p-3">Nama</th><th className="p-3">Sekolah</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {finishedUsers.map(u => (
                                        <tr key={u.id}>
                                            <td className="p-3 font-medium">{u.name}</td>
                                            <td className="p-3 text-gray-500">{u.school}</td>
                                        </tr>
                                    ))}
                                    {finishedUsers.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-gray-400">Tidak ada data.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                             <h4 className="font-bold text-red-800 flex items-center"><XCircle size={18} className="mr-2"/> Belum Selesai ({unfinishedUsers.length})</h4>
                        </div>
                        <div className="p-0 overflow-y-auto max-h-[500px]">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 font-bold border-b text-gray-500">
                                    <tr><th className="p-3">Nama</th><th className="p-3">Sekolah</th><th className="p-3">Status</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {unfinishedUsers.map(u => {
                                        const st = getStudentStatusInfo(u);
                                        return (
                                            <tr key={u.id}>
                                                <td className="p-3 font-medium">{u.name}</td>
                                                <td className="p-3 text-gray-500">{u.school}</td>
                                                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.color}`}>{st.label}</span></td>
                                            </tr>
                                        )
                                    })}
                                    {unfinishedUsers.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Tidak ada data.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
  };

    // --- LINE CHART DATA PREPARATION (ENHANCED LOGIC) ---
    let targetSchools: string[] = [];
    if (graphFilterMode === 'SCHEDULED') {
        const activeExamsOnDate = exams.filter(e => e.examDate === graphDate);
        const scheduledSet = new Set<string>();
        activeExamsOnDate.forEach(e => {
            if (e.schoolAccess && Array.isArray(e.schoolAccess)) {
                e.schoolAccess.forEach(s => scheduledSet.add(s));
            }
        });
        targetSchools = Array.from(scheduledSet).sort();
    } else {
        targetSchools = schools;
    }

    const chartData: { name: string; notLogin: number; working: number; finished: number }[] = targetSchools.map(school => {
        const schoolStudents = users.filter(u => u.school === school);
        const total = schoolStudents.length;
        const finishedCount = results.filter(r => {
            const rDate = r.submittedAt ? r.submittedAt.split('T')[0] : '';
            const student = users.find(u => u.id === r.studentId);
            return rDate === graphDate && student?.school === school;
        }).length;
        const workingCount = schoolStudents.filter(u => u.isLogin && u.status !== 'finished').length;
        const notLoginCount = Math.max(0, total - workingCount - finishedCount);
        return { name: school, notLogin: notLoginCount, working: workingCount, finished: finishedCount };
    });

    const svgHeight = 400; 
    const svgWidth = 800; 
    const paddingX = 50;
    const paddingTop = 40;
    const paddingBottom = 120;
    const chartAreaWidth = svgWidth - paddingX * 2;
    const chartAreaHeight = svgHeight - paddingTop - paddingBottom;
    const maxVal = Math.max(10, ...chartData.map(d => Math.max(d.notLogin, d.working, d.finished)));
    const yMax = Math.ceil(maxVal / 10) * 10; 

    const getPoints = (key: 'notLogin' | 'working' | 'finished') => {
        return chartData.map((d, i) => {
            const x = paddingX + (i * (chartAreaWidth / (chartData.length - 1 || 1)));
            const val = d[key];
            const y = (svgHeight - paddingBottom) - (val / yMax) * chartAreaHeight;
            return `${x},${y}`;
        }).join(' ');
    };

    const renderMainDashboard = () => {
        const workingUsers = users.filter(u => u.status === 'working').length;
        const totalQuestions = exams.reduce((acc, exam) => acc + (exam.questions?.length || 0), 0);
        const totalViolations = results.reduce((acc, r) => acc + (r.cheatingAttempts || 0), 0);

        return (
            <div className="animate-in fade-in">
                {/* Top Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                            <div className="bg-blue-50 p-3 rounded-xl"><Users className="text-blue-500" size={24}/></div>
                            <ArrowRight className="text-gray-300" size={20}/>
                        </div>
                        <h3 className="text-4xl font-bold text-gray-800 mt-4">{workingUsers}</h3>
                        <p className="text-gray-600 font-bold mt-1">Peserta Online</p>
                        <p className="text-xs text-gray-400 mt-1">{workingUsers} sedang mengerjakan</p>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                            <div className="bg-purple-50 p-3 rounded-xl"><BookOpen className="text-purple-500" size={24}/></div>
                            <ArrowRight className="text-gray-300" size={20}/>
                        </div>
                        <h3 className="text-4xl font-bold text-gray-800 mt-4">{exams.length}</h3>
                        <p className="text-gray-600 font-bold mt-1">Total Mapel</p>
                        <p className="text-xs text-gray-400 mt-1">{totalQuestions} total soal tersedia</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                            <div className="bg-green-50 p-3 rounded-xl"><CheckCircle className="text-green-500" size={24}/></div>
                            <ArrowRight className="text-gray-300" size={20}/>
                        </div>
                        <h3 className="text-4xl font-bold text-gray-800 mt-4">{results.length}</h3>
                        <p className="text-gray-600 font-bold mt-1">Ujian Selesai</p>
                        <p className="text-xs text-gray-400 mt-1">Hasil ujian tersimpan</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                            <div className="bg-red-50 p-3 rounded-xl"><AlertTriangle className="text-red-500" size={24}/></div>
                            <ArrowRight className="text-gray-300" size={20}/>
                        </div>
                        <h3 className="text-4xl font-bold text-gray-800 mt-4">{totalViolations}</h3>
                        <p className="text-gray-600 font-bold mt-1">Pelanggaran</p>
                        <p className="text-xs text-gray-400 mt-1">Deteksi kecurangan sistem</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Status Sistem */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border lg:col-span-1">
                        <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center"><Activity className="mr-2 text-blue-600" size={20}/> Status Sistem</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex items-center text-gray-600"><Database size={18} className="mr-3"/> <span className="font-medium text-sm">Koneksi Database</span></div>
                                <div className="flex items-center text-green-600 text-xs font-bold"><div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Stabil</div>
                            </div>
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex items-center text-gray-600"><ShieldCheck size={18} className="mr-3"/> <span className="font-medium text-sm">Anti-Cheat Engine</span></div>
                                <div className="flex items-center text-green-600 text-xs font-bold"><div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Aktif</div>
                            </div>
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex items-center text-gray-600"><Monitor size={18} className="mr-3"/> <span className="font-medium text-sm">Server Response</span></div>
                                <div className="text-blue-600 text-xs font-bold">24ms</div>
                            </div>
                        </div>
                    </div>

                    {/* Aktivitas Terkini */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border lg:col-span-2">
                        <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center"><Activity className="mr-2 text-purple-600" size={20}/> Aktivitas Terkini</h3>
                        <div className="h-48 flex items-center justify-center text-gray-400 italic text-sm">
                            Belum ada aktivitas ujian.
                        </div>
                    </div>
                </div>
            </div>
        );
    };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden print:h-auto print:overflow-visible">
      <input type="file" ref={studentFileRef} className="hidden" accept=".csv" onChange={onStudentFileChange} />
      <input type="file" ref={questionFileRef} className="hidden" accept=".txt,.csv" onChange={onQuestionFileChange} />
      <input type="file" ref={teacherFileRef} className="hidden" accept=".csv" onChange={onTeacherFileChange} />

      {/* RESPONSIVE SIDEBAR */}
      <aside className="w-16 md:w-64 flex-shrink-0 text-white flex flex-col shadow-xl z-20 transition-all duration-300 print:hidden" style={{ backgroundColor: themeColor }}>
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-center md:justify-start md:space-x-3">
              {settings.schoolLogoUrl ? (
                  <img src={settings.schoolLogoUrl} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain flex-shrink-0 bg-white rounded p-0.5" />
              ) : (
                  <BookOpen size={28} className="text-white drop-shadow-md flex-shrink-0" />
              )}
              <div className="hidden md:block overflow-hidden whitespace-nowrap">
                  <h1 className="font-bold text-lg tracking-wide">{settings.adminTitle || 'SMP TANGGUL JAYA'}</h1>
                  <p className="text-xs text-blue-100 opacity-80">{settings.adminSubtitle || 'Panel Sekolah Menengah Pertama'}</p>
              </div>
          </div>
          <nav className="flex-1 p-2 md:p-4 overflow-y-auto custom-scrollbar space-y-1">
              <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-2 px-2">Menu Utama</div>
              <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
              
              <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-4 px-2">Data Master</div>
              <NavItem id="PESERTA" label="Data Peserta" icon={Users} />
              {user.role === UserRole.ADMIN && (
                  <>
                      <NavItem id="DATA_GURU" label="Data Guru" icon={GraduationCap} />
                      <NavItem id="MANAJEMEN_SESI" label="Manajemen Sesi" icon={Clock} />
                      <NavItem id="PENGAWAS" label="Registrasi Pengawas" icon={UserX} />
                  </>
              )}

              <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-4 px-2">Ujian</div>
              <NavItem id="BANK_SOAL" label="Bank Soal" icon={Database} />
              <NavItem id="MAPPING" label="Mapping Pengawas & Ujian" icon={MapIcon} />
              {user.role === UserRole.ADMIN && (
                  <NavItem id="CETAK_KARTU" label="Cetak Kartu" icon={Printer} />
              )}

              <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-4 px-2">Pelaksanaan</div>
              <NavItem id="AKTIVASI_TOKEN" label="Aktivasi Token" icon={Key} />
              <NavItem id="MONITORING" label="Monitoring Ujian" icon={Activity} />
              {user.role === UserRole.ADMIN && (
                  <NavItem id="TROUBLESHOOTING" label="Troubleshooting" icon={AlertTriangle} />
              )}

              <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-4 px-2">Laporan</div>
              <NavItem id="HASIL_UJIAN" label="Hasil Ujian" icon={ClipboardList} />

              {user.role === UserRole.ADMIN && (
                  <>
                      <div className="hidden md:block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2 mt-4 px-2">Pengaturan</div>
                      <NavItem id="ANTI_CHEAT" label="Sistem Anti-Curang" icon={ShieldAlert} />
                      <NavItem id="KONFIGURASI_UMUM" label="Konfigurasi Umum" icon={Settings} />
                  </>
              )}
          </nav>
          <div className="p-2 md:p-4 border-t border-white/10 bg-black/10">
               <button onClick={onLogout} className="w-full flex items-center justify-center md:space-x-2 bg-red-500/20 hover:bg-red-500/40 text-red-100 p-2 md:py-2 rounded text-xs font-bold transition border border-red-500/30" title="Keluar">
                   <LogOut size={16} /> <span className="hidden md:inline">Keluar</span>
               </button>
          </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50 print:overflow-visible print:h-auto print:absolute print:top-0 print:left-0 print:w-full print:m-0 print:p-0 print:bg-white">
          <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden gap-4">
               <div>
                   <h2 className="text-2xl font-bold text-gray-800 flex items-center">{activeTab.replace('_', ' ')}</h2>
                   {user.role === UserRole.PROCTOR && (
                       <p className="text-sm text-gray-500 mt-1">
                           Selamat datang, <span className="font-bold text-blue-600">{user.name}</span> dari <span className="font-bold text-gray-700">{user.school || 'Sekolah'}</span>
                       </p>
                   )}
               </div>
               {isLoadingData && <span className="text-xs text-blue-500 animate-pulse flex items-center"><Loader2 size={12} className="animate-spin mr-1"/> Memuat Data...</span>}
          </header>

          {activeTab === 'DASHBOARD' && (
              dashboardView === 'MAIN' ? renderMainDashboard() : renderDashboardContent()
          )}



          {activeTab === 'MANAJEMEN_SESI' && (
              <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 animate-in fade-in">
                  <h3 className="font-bold text-lg mb-4 flex items-center"><Clock size={20} className="mr-2 text-blue-600"/> Manajemen Sesi</h3>
                  <p className="text-gray-500 text-sm mb-4">Kelola jadwal sesi ujian.</p>
                  <div className="flex justify-end mb-4">
                      <button onClick={() => { setEditingSession(null); setIsSessionModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold flex items-center text-sm shadow-sm transition">
                          <Plus size={16} className="mr-2"/> Tambah Sesi
                      </button>
                  </div>
                  <div className="overflow-x-auto border rounded bg-white">
                      <table className="w-full text-sm text-left border-collapse">
                          <thead className="bg-gray-50 font-bold border-b">
                              <tr>
                                  <th className="p-3 border-r">Nama Sesi</th>
                                  <th className="p-3 border-r text-center">Waktu Mulai</th>
                                  <th className="p-3 border-r text-center">Waktu Selesai</th>
                                  <th className="p-3 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {sessions.length === 0 ? (
                                  <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Belum ada data sesi.</td></tr>
                              ) : (
                                  sessions.map(s => (
                                      <tr key={s.id} className="hover:bg-gray-50">
                                          <td className="p-3 border-r font-medium">{s.name}</td>
                                          <td className="p-3 border-r text-center">{s.start_time}</td>
                                          <td className="p-3 border-r text-center">{s.end_time}</td>
                                          <td className="p-3 text-center">
                                              <button onClick={() => { setEditingSession(s); setIsSessionModalOpen(true); }} className="text-blue-600 hover:text-blue-800 mr-2"><Edit size={16}/></button>
                                              <button onClick={() => handleDeleteSession(s.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16}/></button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'DATA_GURU' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider"><GraduationCap size={20} className="mr-2 text-blue-600"/> DATA GURU</h3>
                      <div className="flex gap-2">
                          <button onClick={downloadTeacherTemplate} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition shadow-sm">
                              <FileText size={16} className="mr-2 text-blue-600"/> Template CSV
                          </button>
                          <button onClick={triggerImportTeachers} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-green-700 transition shadow-sm">
                              <Upload size={16} className="mr-2"/> Import Massal
                          </button>
                          <button onClick={() => { setEditingTeacher(null); setIsTeacherModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center shadow-sm transition">
                              <Plus size={16} className="mr-2"/> Tambah Guru
                          </button>
                      </div>
                  </div>

                  <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                      <table className="w-full text-sm text-left border-collapse">
                          <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                              <tr>
                                  <th className="p-4 border-r w-12 text-center">No</th>
                                  <th className="p-4 border-r">Nama Guru</th>
                                  <th className="p-4 border-r">NIP</th>
                                  <th className="p-4 border-r">Username</th>
                                  <th className="p-4 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {teachers.length === 0 ? (
                                  <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada data guru.</td></tr>
                              ) : (
                                  teachers.map((t, index) => (
                                      <tr key={t.id} className="hover:bg-gray-50 transition">
                                          <td className="p-4 text-center text-gray-500 border-r">{index + 1}</td>
                                          <td className="p-4 font-bold text-gray-800 border-r">{t.name}</td>
                                          <td className="p-4 font-mono text-gray-600 border-r">{t.nip}</td>
                                          <td className="p-4 font-mono text-gray-600 border-r">{t.username}</td>
                                          <td className="p-4 text-center flex justify-center gap-2">
                                              <button onClick={() => { setEditingTeacher(t); setIsTeacherModalOpen(true); }} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition" title="Edit Guru">
                                                  <Edit size={16}/>
                                              </button>
                                              <button onClick={() => handleDeleteTeacher(t.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition" title="Hapus Guru">
                                                  <Trash2 size={16}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
          {activeTab === 'PENGAWAS' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider"><UserX size={20} className="mr-2 text-blue-600"/> MANAJEMEN PENGAWAS</h3>
                      <button onClick={() => { setEditingProctor(null); setIsProctorModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center shadow-sm transition">
                          <Plus size={16} className="mr-2"/> Tambah Pengawas
                      </button>
                  </div>

                  <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                      <table className="w-full text-sm text-left border-collapse">
                          <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                              <tr>
                                  <th className="p-4 border-r w-12 text-center">No</th>
                                  <th className="p-4 border-r">Nama Pengawas</th>
                                  <th className="p-4 border-r">Username</th>
                                  <th className="p-4 border-r">Ruang</th>
                                  <th className="p-4 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {proctors.length === 0 ? (
                                  <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada data pengawas.</td></tr>
                              ) : (
                                  proctors.map((p, index) => (
                                      <tr key={p.id} className="hover:bg-gray-50 transition">
                                          <td className="p-4 text-center text-gray-500 border-r">{index + 1}</td>
                                          <td className="p-4 font-bold text-gray-800 border-r">{p.name}</td>
                                          <td className="p-4 font-mono text-gray-600 border-r">{p.username}</td>
                                          <td className="p-4 border-r">
                                              <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                                                  {rooms.find(r => r.id === p.room_id)?.name || 'Belum di-set'}
                                              </span>
                                          </td>
                                          <td className="p-4 text-center flex justify-center gap-2">
                                              <button onClick={() => { setEditingProctor(p); setIsProctorModalOpen(true); }} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition" title="Edit Pengawas">
                                                  <Edit size={16}/>
                                              </button>
                                              <button onClick={() => handleDeleteProctor(p.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition" title="Hapus Pengawas">
                                                  <Trash2 size={16}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeTab === 'TROUBLESHOOTING' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider"><AlertTriangle size={20} className="mr-2 text-red-600"/> TROUBLESHOOTING</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border border-red-200 rounded-xl p-6 bg-red-50/30 shadow-sm hover:shadow-md transition">
                          <div className="flex items-center mb-4">
                              <div className="bg-red-100 p-3 rounded-lg mr-4">
                                  <RotateCcw size={24} className="text-red-600"/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-red-800 text-lg">Reset Status Login</h4>
                                  <p className="text-sm text-red-600">Gunakan jika siswa tidak bisa login karena status "sedang aktif di perangkat lain".</p>
                              </div>
                          </div>
                          <div className="flex gap-3 mt-6">
                              <input type="text" placeholder="Masukkan NISN Siswa" className="flex-1 border border-red-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none" value={troubleshootResetNisn} onChange={e => setTroubleshootResetNisn(e.target.value)} />
                              <button onClick={handleTroubleshootReset} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition shadow-sm flex items-center">
                                  <RotateCcw size={16} className="mr-2"/> Reset
                              </button>
                          </div>
                      </div>
                      
                      <div className="border border-orange-200 rounded-xl p-6 bg-orange-50/30 shadow-sm hover:shadow-md transition">
                          <div className="flex items-center mb-4">
                              <div className="bg-orange-100 p-3 rounded-lg mr-4">
                                  <Unlock size={24} className="text-orange-600"/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-orange-800 text-lg">Buka Blokir Ujian</h4>
                                  <p className="text-sm text-orange-600">Gunakan jika siswa terblokir oleh sistem anti-curang.</p>
                              </div>
                          </div>
                          <div className="flex gap-3 mt-6">
                              <input type="text" placeholder="Masukkan NISN Siswa" className="flex-1 border border-orange-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none" value={troubleshootUnblockNisn} onChange={e => setTroubleshootUnblockNisn(e.target.value)} />
                              <button onClick={handleTroubleshootUnblock} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold text-sm transition shadow-sm flex items-center">
                                  <Unlock size={16} className="mr-2"/> Buka Blokir
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'AKTIVASI_TOKEN' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider">AKTIVASI UJIAN & TOKEN</h3>
                      <button onClick={loadData} className="text-blue-500 text-sm flex items-center hover:text-blue-700 transition"><RotateCcw size={14} className="mr-1"/> Memuat Data...</button>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                      {/* Aktivasi Ujian & Token */}
                      <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-6 mb-8">
                          <h4 className="font-bold text-blue-800 mb-4 flex items-center"><Key size={20} className="mr-2"/> Aktivasi Ujian & Token</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                              <div className="flex-1">
                                  <label className="block text-xs font-bold text-blue-600 uppercase mb-2">PILIH MATA PELAJARAN</label>
                                  <select 
                                    className="w-full border border-blue-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onChange={(e) => {
                                        const exam = exams.find(ex => ex.id === e.target.value);
                                        if (exam) {
                                            setSelectedExamForToken(exam);
                                            setGeneratedToken(db.generateToken());
                                            setIsTokenActivationModalOpen(true);
                                        }
                                    }}
                                    value=""
                                  >
                                      <option value="">-- Pilih Mapel --</option>
                                      {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                                  </select>
                              </div>
                              <div className="flex-1">
                                  <div className="bg-white p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                                      <div>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase">Token Aktif Saat Ini</p>
                                          <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                                              {exams.filter(e => e.token).map(e => (
                                                  <span key={e.id} className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center whitespace-nowrap">
                                                      {e.subject}: {e.token}
                                                  </span>
                                              ))}
                                              {exams.filter(e => e.token).length === 0 && <span className="text-xs text-gray-400 italic">Belum ada token aktif</span>}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Tabel Token Aktif */}
                      <div className="mb-8">
                          <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center uppercase tracking-wider"><Link size={16} className="mr-2 text-blue-600"/> Daftar Token Aktif</h4>
                          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                              <table className="w-full text-sm text-left border-collapse">
                                  <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                                      <tr>
                                          <th className="p-4 border-r w-12 text-center">No</th>
                                          <th className="p-4 border-r">Mata Pelajaran</th>
                                          <th className="p-4 border-r text-center">Token</th>
                                          <th className="p-4 border-r text-center">Tanggal</th>
                                          <th className="p-4 text-center">Aksi</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {exams.filter(e => e.token).length === 0 ? (
                                          <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada token yang diaktifkan.</td></tr>
                                      ) : (
                                          exams.filter(e => e.token).map((e, idx) => (
                                              <tr key={e.id} className="hover:bg-gray-50 transition">
                                                  <td className="p-4 text-center text-gray-500 border-r">{idx + 1}</td>
                                                  <td className="p-4 font-bold text-gray-800 border-r">{e.title}</td>
                                                  <td className="p-4 text-center border-r">
                                                      <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded font-mono font-bold border border-orange-200">{e.token}</span>
                                                  </td>
                                                  <td className="p-4 text-center border-r font-medium text-gray-600">{e.examDate}</td>
                                                  <td className="p-4 text-center flex justify-center gap-2">
                                                      <button onClick={() => { setSelectedExamForToken(e); setGeneratedToken(e.token || ''); setActivationDate(e.examDate || ''); setIsTokenActivationModalOpen(true); }} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition">
                                                          <Edit size={16}/>
                                                      </button>
                                                      <button onClick={async () => { if(confirm('Hapus token ini?')) { await db.updateExam(e.id, { token: '' }); loadData(); } }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition">
                                                          <Trash2 size={16}/>
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
              </div>
          )}

          {activeTab === 'MONITORING' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider">MONITORING</h3>
                      <button onClick={loadData} className="text-blue-500 text-sm flex items-center hover:text-blue-700 transition"><RotateCcw size={14} className="mr-1"/> Memuat Data...</button>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                      {/* Live Status Peserta */}
                      <div>
                          <h4 className="font-bold text-gray-800 text-lg mb-4 flex items-center"><Activity size={24} className="mr-2 text-blue-600"/> Live Status Peserta</h4>
                          
                          <div className="flex flex-wrap items-center gap-3 mb-6">
                              <select className="border rounded-lg p-2 text-sm bg-white min-w-[120px]" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
                                  <option value="ALL">Semua Kelas</option>
                                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select className="border rounded-lg p-2 text-sm bg-white min-w-[150px]">
                                  <option value="ALL">Semua Mapel</option>
                              </select>
                              <select className="border rounded-lg p-2 text-sm bg-white min-w-[120px]" value={selectedRoomFilter} onChange={e => setSelectedRoomFilter(e.target.value)}>
                                  <option value="ALL">Semua Ruang</option>
                                  {availableRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <select className="border rounded-lg p-2 text-sm bg-white min-w-[120px]">
                                  <option value="ALL">Semua Sesi</option>
                              </select>
                              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition shadow-sm">
                                  <Power size={16} className="mr-2"/> Paksa Selesai Semua
                              </button>
                          </div>

                          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 font-bold text-gray-700 border-b">
                                      <tr>
                                          <th className="p-4 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={filteredMonitoringUsers.length > 0 && selectedStudentIds.length === filteredMonitoringUsers.length} onChange={() => toggleSelectAll(filteredMonitoringUsers)}/></th>
                                          <th className="p-4">Nama</th>
                                          <th className="p-4">Nomor Peserta</th>
                                          <th className="p-4 text-center">Ruang</th>
                                          <th className="p-4 text-center">Sesi</th>
                                          <th className="p-4 text-center">Status</th>
                                          <th className="p-4 text-center">Kontrol</th>
                                          <th className="p-4 text-center">Hapus</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {filteredMonitoringUsers.map(u => (
                                          <tr key={u.id} className="hover:bg-gray-50 transition">
                                              <td className="p-4 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selectedStudentIds.includes(u.id)} onChange={() => toggleSelectOne(u.id)}/></td>
                                              <td className="p-4 font-medium text-gray-800 uppercase">{u.name}</td>
                                              <td className="p-4 text-gray-600">{u.nisn}</td>
                                              <td className="p-4 text-center"><span className="inline-flex px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold border border-green-200">{u.room || 'Ruang 1'}</span></td>
                                              <td className="p-4 text-center"><span className="inline-flex px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-bold border border-purple-200">{u.session || '-'}</span></td>
                                              <td className="p-4 text-center">
                                                  <span className={`inline-flex px-2 py-1 rounded text-xs font-bold border ${u.status === 'working' ? 'bg-blue-50 text-blue-700 border-blue-200' : u.status === 'finished' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                      {u.status === 'working' ? 'Mengerjakan' : u.status === 'finished' ? 'Selesai' : 'Belum Login'}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <button onClick={async () => { await db.resetUserStatus(u.id); alert('Status login siswa di-reset (Unlock).'); loadData(); }} className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 p-1.5 rounded transition" title="Reset Login"><Flame size={18}/></button>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <button onClick={() => { if(confirm('Hapus data siswa ini?')) { db.deleteUser(u.id); loadData(); } }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition" title="Hapus Data"><Trash2 size={18}/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'HASIL_UJIAN' && (
              <div className="animate-in fade-in print:hidden space-y-4">
                  <h2 className="font-bold text-2xl uppercase tracking-wider text-slate-800 bg-white p-4 rounded-xl shadow-sm border">HASIL UJIAN</h2>
                  
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                      <div className="flex justify-between items-start mb-6">
                          <div>
                              <h3 className="font-bold text-lg mb-4">Hasil Ujian</h3>
                              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                                  <button className="px-4 py-1.5 text-sm font-bold bg-white text-blue-600 rounded shadow-sm">Rekap Hasil</button>
                                  <button className="px-4 py-1.5 text-sm font-bold text-gray-500 hover:text-gray-700">Review Jawaban</button>
                              </div>
                          </div>
                          <button onClick={handleExportResultsExcel} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-sm flex items-center hover:bg-green-700 shadow-sm transition">
                              <FileSpreadsheet size={16} className="mr-2"/> Export Excel (.xls)
                          </button>
                      </div>
                      
                      <div className="mb-6 bg-gray-50 p-4 rounded-xl border flex items-center gap-4 flex-wrap">
                          <span className="text-sm font-bold text-gray-500 flex items-center"><Filter size={16} className="mr-2"/> Filter:</span>
                          <select className="border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[120px]" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
                              <option value="ALL">Semua Kelas</option>
                              {classes.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select className="border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[120px]" value={selectedRoomFilter} onChange={e => setSelectedRoomFilter(e.target.value)}>
                              <option value="ALL">Semua Ruang</option>
                              {availableRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <select className="border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[120px]">
                              <option value="ALL">Semua Sesi</option>
                          </select>
                          <select className="border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[150px]" value={resultSubjectFilter} onChange={e => setResultSubjectFilter(e.target.value)}>
                              <option value="ALL">Semua Mapel</option>
                              {exams.map(ex => <option key={ex.id} value={ex.title}>{ex.title}</option>)}
                          </select>
                      </div>

                  <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                      <table className="w-full text-sm text-left border-collapse">
                                  <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                                      <tr>
                                          <th className="p-4 border-r align-middle whitespace-nowrap">Nama ↑</th>
                                          <th className="p-4 border-r align-middle text-center">Nomor Peserta</th>
                                          <th className="p-4 border-r align-middle text-center text-blue-600">Kelas</th>
                                          <th className="p-4 border-r align-middle text-center">Ruang</th>
                                          <th className="p-4 border-r align-middle text-center">Mapel</th>
                                          <th className="p-4 border-r align-middle text-center">Nilai</th>
                                          <th className="p-4 align-middle text-center">Waktu Submit</th>
                                      </tr>
                                  </thead>
                          <tbody className="divide-y divide-gray-100">
                              {results.filter(r => {
                                  const student = users.find(u => u.id === r.studentId);
                                  if (selectedClassFilter !== 'ALL' && student?.grade !== selectedClassFilter) return false;
                                  if (selectedRoomFilter !== 'ALL' && student?.room !== selectedRoomFilter) return false;
                                  if (resultSubjectFilter !== 'ALL' && r.examTitle !== resultSubjectFilter) return false;
                                  return true;
                              }).length === 0 ? (
                                  <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">Belum ada data hasil ujian.</td></tr>
                              ) : (
                                  results.filter(r => {
                                      const student = users.find(u => u.id === r.studentId);
                                      if (selectedClassFilter !== 'ALL' && student?.grade !== selectedClassFilter) return false;
                                      if (selectedRoomFilter !== 'ALL' && student?.room !== selectedRoomFilter) return false;
                                      if (resultSubjectFilter !== 'ALL' && r.examTitle !== resultSubjectFilter) return false;
                                      return true;
                                  }).map((r, idx) => {
                                      const student = users.find(u => u.id === r.studentId);
                                      const exam = exams.find(e => e.id === r.examId);
                                      return (
                                          <tr key={idx} className="hover:bg-gray-50 transition">
                                              <td className="p-4 font-bold text-gray-800 border-r uppercase">{student?.name || r.studentName}</td>
                                              <td className="p-4 text-center border-r">{student?.username}</td>
                                              <td className="p-4 text-center font-bold text-blue-600 border-r">{student?.grade || '-'}</td>
                                              <td className="p-4 text-center border-r">{student?.room || '-'}</td>
                                              <td className="p-4 text-center border-r">{exam?.title || r.examTitle}</td>
                                              <td className="p-4 text-center font-bold border-r">{r.score.toFixed(2)}</td>
                                              <td className="p-4 text-center text-xs text-gray-500">
                                                  {new Date(r.submittedAt).toLocaleString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any)}
                                              </td>
                                          </tr>
                                      );
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
                  </div>
              </div>
          )}

          {activeTab === 'BANK_SOAL' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center uppercase tracking-wider">BANK SOAL & MATERI</h3>
                      <button onClick={handleCreateExam} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center shadow-sm transition">
                          <Plus size={16} className="mr-2"/> Tambah Mapel Baru
                      </button>
                  </div>

                  {viewingQuestionsExam ? (
                      <div className="bg-white p-6 rounded-xl shadow-sm border">
                          <button onClick={() => setViewingQuestionsExam(null)} className="text-blue-600 mb-4 text-sm font-bold flex items-center hover:underline">
                              <ArrowLeft size={16} className="mr-1"/> Kembali ke Daftar
                          </button>
                          
                          <div className="flex justify-between items-center mb-6 border-b pb-4">
                              <div>
                                  <h4 className="text-xl font-bold text-gray-800">{viewingQuestionsExam.title}</h4>
                                  <p className="text-sm text-gray-500 mt-1">Kelola soal untuk mata pelajaran ini</p>
                              </div>
                              <span className="text-sm bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full font-bold border border-blue-200">
                                  {viewingQuestionsExam.questions.length} Soal Tersedia
                              </span>
                          </div>

                          <div className="flex flex-wrap gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <button onClick={() => {setTargetExamForAdd(viewingQuestionsExam); setIsAddQuestionModalOpen(true);}} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-green-700 transition shadow-sm">
                                  <Plus size={16} className="mr-2"/> Input Manual
                              </button>
                              
                              <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>
                              
                              <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                      <button onClick={downloadQuestionTemplate} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition shadow-sm">
                                          <FileText size={16} className="mr-2 text-blue-600"/> Template CSV
                                      </button>
                                      <button onClick={() => {
                                          const content = `Tipe Soal\tJenis Soal\tSoal\tOpsi A\tOpsi B\tOpsi C\tOpsi D\tKunci\tBobot\tUrl Gambar\nPG\tUMUM\tApa ibukota Indonesia?\tJakarta\tBandung\tSurabaya\tMedan\tA\t10\t`;
                                          const blob = new Blob([content], { type: 'text/plain' });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = 'template_soal.txt';
                                          a.click();
                                      }} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition shadow-sm">
                                          <FileText size={16} className="mr-2 text-purple-600"/> Template TXT
                                      </button>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => triggerImportQuestions(viewingQuestionsExam.id)} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-orange-600 transition shadow-sm">
                                          <Upload size={16} className="mr-2"/> Import CSV
                                      </button>
                                      <button onClick={() => {
                                          setImportTargetExamId(viewingQuestionsExam.id);
                                          if (questionFileRef.current) {
                                              questionFileRef.current.accept = ".txt";
                                              questionFileRef.current.click();
                                          }
                                      }} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-orange-600 transition shadow-sm">
                                          <Upload size={16} className="mr-2"/> Import TXT
                                      </button>
                                  </div>
                              </div>

                              <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>

                              <button onClick={() => handleExportQuestions(viewingQuestionsExam)} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-100 transition shadow-sm self-start">
                                  <Download size={16} className="mr-2"/> Export CSV
                              </button>
                          </div>

                          <div className="space-y-4">
                              {viewingQuestionsExam.questions.length === 0 ? (
                                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                      <Database size={48} className="mx-auto text-gray-300 mb-4"/>
                                      <p className="text-gray-500 font-medium">Belum ada soal untuk mata pelajaran ini.</p>
                                      <p className="text-sm text-gray-400 mt-1">Silakan input manual atau import dari file CSV/TXT.</p>
                                  </div>
                              ) : (
                                  viewingQuestionsExam.questions.map((q, i) => (
                                      <div key={q.id} className="p-5 border rounded-xl bg-white hover:border-blue-300 transition shadow-sm group">
                                          <div className="flex justify-between items-start">
                                              <div className="flex gap-4">
                                                  <div className="flex-shrink-0">
                                                      <span className="font-bold bg-blue-50 text-blue-700 w-10 h-10 flex items-center justify-center rounded-full text-sm border border-blue-100">
                                                          {i+1}
                                                      </span>
                                                  </div>
                                                  <div>
                                                      <div className="flex items-center gap-2 mb-2">
                                                          <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded uppercase tracking-wider">{q.type}</span>
                                                          <span className="text-[10px] font-bold px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100">Bobot: {q.points || 10}</span>
                                                      </div>
                                                      <p className="text-gray-800 font-medium leading-relaxed">{q.text}</p>
                                                      {q.options && q.options.length > 0 && (
                                                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                              {q.options.map((opt, optIdx) => (
                                                                  <div key={optIdx} className={`p-2 rounded border text-sm ${q.correctIndex === optIdx ? 'bg-green-50 border-green-200 text-green-800 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                                                      <span className="mr-2 font-bold opacity-50">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                                                                  </div>
                                                              ))}
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Soal"><Edit size={16}/></button>
                                                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus Soal"><Trash2 size={16}/></button>
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {['7', '8', '9'].map(grade => (
                              <div key={grade} className="space-y-4">
                                  <h4 className="font-bold text-lg text-gray-800 border-b pb-2">Kelas {grade}</h4>
                                  {exams.filter(e => e.grade === grade).length === 0 ? (
                                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                          <p className="text-gray-500 text-sm">Belum ada mapel.</p>
                                      </div>
                                  ) : (
                                      exams.filter(e => e.grade === grade).map(ex => (
                                          <div key={ex.id} className="bg-white p-4 rounded-xl border hover:shadow-md transition cursor-pointer group" onClick={() => setViewingQuestionsExam(ex)}>
                                              <div className="flex justify-between items-start mb-3">
                                                  <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                                      <Database size={20} className="text-blue-600 group-hover:text-white"/>
                                                  </div>
                                                  <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full border">
                                                      {ex.questions?.length || 0} Soal
                                                  </span>
                                              </div>
                                              <h4 className="font-bold text-gray-800 text-sm mb-2 line-clamp-1">{ex.title}</h4>
                                              <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-1.5 rounded border border-gray-100">
                                                  <Key size={12} className="mr-1.5 text-orange-500"/>
                                                  <span className="font-mono font-bold">{ex.token || 'Belum ada token'}</span>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'MAPPING' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center"><h3 className="font-bold text-lg flex items-center"><MapIcon size={24} className="mr-2 text-blue-600"/> Mapping Pengawas</h3></div>
                  <div className="grid grid-cols-1 gap-6">
                      {/* MANAJEMEN RUANG & PROKTOR */}
                      <div className="bg-white rounded-xl shadow-sm border p-6">
                          <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><Database size={18} className="mr-2 text-blue-600"/> Manajemen Ruang & Proktor</h4>
                          
                          <div className="bg-gray-50 rounded-xl border p-4 mb-6">
                              <h5 className="font-bold text-sm text-gray-700 mb-3 flex items-center"><Plus size={16} className="mr-1"/> Tambah Ruang Baru</h5>
                              <form onSubmit={handleSaveRoom} className="flex flex-col md:flex-row gap-4 items-end">
                                  <div className="flex-1 w-full">
                                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">NAMA RUANG</label>
                                      <input type="text" name="name" required placeholder="Contoh: Ruang 01, LAB KOMPUTER" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                  <input type="hidden" name="capacity" value="40" />
                                  <input type="hidden" name="proctor_username" value={`PROCTOR-${Math.floor(Math.random()*1000)}`} />
                                  <button type="submit" className="w-full md:w-auto bg-blue-400 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center whitespace-nowrap">
                                      <Plus size={16} className="mr-1"/> Tambah Ruang
                                  </button>
                              </form>
                              <p className="text-[10px] text-gray-400 mt-2 italic">* Akun proktor akan digenerate otomatis.</p>
                          </div>

                          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                              <table className="w-full text-sm text-left border-collapse">
                                  <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                                      <tr>
                                          <th className="p-4 border-r w-12 text-center">No</th>
                                          <th className="p-4 border-r">Nama Ruang</th>
                                          <th className="p-4 border-r text-center">Kapasitas</th>
                                          <th className="p-4 border-r">Pengawas</th>
                                          <th className="p-4 text-center">Aksi</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {rooms.length === 0 ? (
                                          <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada data ruang.</td></tr>
                                      ) : (
                                          rooms.map((r, idx) => (
                                              <tr key={r.id} className="hover:bg-gray-50">
                                                  <td className="p-4 border-r text-center text-gray-500">{idx + 1}</td>
                                                  <td className="p-4 border-r font-medium">{r.name}</td>
                                                  <td className="p-4 border-r text-center">{r.capacity}</td>
                                                  <td className="p-4 border-r">{r.proctor_username || '-'}</td>
                                                  <td className="p-4 text-center">
                                                      <button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition" title="Hapus"><Trash2 size={18}/></button>
                                                  </td>
                                              </tr>
                                          ))
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      {/* MAPPING SISWA DAN KELAS */}
                      <div className="bg-white rounded-xl shadow-sm border p-6">
                          <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><Users size={18} className="mr-2 text-blue-600"/> Mapping Siswa & Kelas</h4>
                          
                          <div className="mb-6 flex flex-wrap gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <div className="flex-1 min-w-[250px] relative">
                                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                  <input placeholder="Cari nama atau nomor peserta..." className="border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" value={monitoringSearch} onChange={e => setMonitoringSearch(e.target.value)} />
                              </div>
                              <select className="border border-gray-300 rounded-lg p-2.5 text-sm min-w-[150px] bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
                                  <option value="ALL">Semua Kelas</option>
                                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select className="border border-gray-300 rounded-lg p-2.5 text-sm min-w-[150px] bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedRoomFilter} onChange={e => setSelectedRoomFilter(e.target.value)}>
                                  <option value="ALL">Semua Ruang</option>
                                  {availableRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                          </div>

                          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                              <table className="w-full text-sm text-left border-collapse">
                                  <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                                      <tr>
                                          <th className="p-4 border-r w-12 text-center">No</th>
                                          <th className="p-4 border-r">Nama Siswa</th>
                                          <th className="p-4 border-r text-center">Kelas</th>
                                          <th className="p-4 border-r text-center">Ruang</th>
                                          <th className="p-4 text-center">Aksi</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {users.filter(u => {
                                          if (u.role !== UserRole.STUDENT) return false;
                                          if (selectedClassFilter !== 'ALL' && u.grade !== selectedClassFilter) return false;
                                          if (selectedRoomFilter !== 'ALL' && u.room !== selectedRoomFilter) return false;
                                          if (monitoringSearch && !u.name.toLowerCase().includes(monitoringSearch.toLowerCase()) && !u.nisn?.includes(monitoringSearch)) return false;
                                          return true;
                                      }).map((student, index) => {
                                          return (
                                              <tr key={student.id} className="hover:bg-gray-50 transition">
                                                  <td className="p-4 text-center text-gray-500 border-r">{index + 1}</td>
                                                  <td className="p-4 font-bold text-gray-800 border-r uppercase">{student.name}</td>
                                                  <td className="p-4 text-center border-r font-bold text-blue-600">
                                                      {student.grade || '-'}
                                                  </td>
                                                  <td className="p-4 text-center border-r">
                                                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${student.room ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                          {student.room || 'Belum Mapping'}
                                                      </span>
                                                  </td>
                                                  <td className="p-4 text-center">
                                                      <button onClick={async () => {
                                                          const newRoom = prompt("Masukkan nama ruang baru:", student.room || "");
                                                          if (newRoom !== null) {
                                                              await db.updateStudentRoom(student.id, newRoom);
                                                              await loadData();
                                                          }
                                                      }} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-full font-bold text-xs shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center mx-auto">
                                                          <Settings size={14} className="mr-2"/> Atur Ruang
                                                      </button>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                      {users.filter(u => u.role === UserRole.STUDENT).length === 0 && (
                                          <tr>
                                              <td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada data siswa.</td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'PESERTA' && (
               <div className="bg-white rounded-xl shadow-sm border p-6 animate-in fade-in print:hidden">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-lg flex items-center uppercase tracking-wider"><Users size={20} className="mr-2 text-blue-600"/> DATA PESERTA</h3>
                       <div className="flex gap-2">
                           <button onClick={downloadStudentTemplate} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition shadow-sm">
                               <FileText size={16} className="mr-2 text-blue-600"/> Template CSV
                           </button>
                           <button onClick={triggerImportStudents} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 transition shadow-sm">
                               <Upload size={16} className="mr-2"/> Import Data
                           </button>
                       </div>
                   </div>

                   <div className="mb-6 flex flex-wrap gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <div className="flex-1 min-w-[250px] relative">
                           <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                           <input placeholder="Cari nama atau nomor peserta..." className="border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" value={monitoringSearch} onChange={e => setMonitoringSearch(e.target.value)} />
                       </div>
                       <select className="border border-gray-300 rounded-lg p-2.5 text-sm min-w-[150px] bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
                           <option value="ALL">Semua Kelas</option>
                           {classes.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                       <select className="border border-gray-300 rounded-lg p-2.5 text-sm min-w-[150px] bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedRoomFilter} onChange={e => setSelectedRoomFilter(e.target.value)}>
                           <option value="ALL">Semua Ruang</option>
                           {availableRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                       <button onClick={async () => { if(confirm('Hapus SEMUA data peserta?')) { await db.deleteAllUsers(); loadData(); alert('Semua data peserta dihapus.'); } }} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-red-100 transition shadow-sm">
                           <Trash2 size={16} className="mr-2"/> Hapus Semua
                       </button>
                   </div>

                   <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                       <table className="w-full text-sm text-left border-collapse">
                           <thead className="bg-gray-50 font-bold text-gray-700 border-b-2 border-gray-200">
                               <tr>
                                   <th className="p-4 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/></th>
                                   <th className="p-4">Nama</th>
                                   <th className="p-4">Nomor Peserta</th>
                                   <th className="p-4">Sekolah</th>
                                   <th className="p-4">Kelas</th>
                                   <th className="p-4 text-center">Kontrol</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {getMonitoringUsers().map(u => (
                                   <tr key={u.id} className="hover:bg-gray-50 transition">
                                       <td className="p-4 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/></td>
                                       <td className="p-4 font-bold text-gray-800 uppercase">{u.name}</td>
                                       <td className="p-4 font-mono text-gray-600">{u.nisn}</td>
                                       <td className="p-4 text-gray-600 uppercase">{u.school}</td>
                                       <td className="p-4 text-gray-600">{u.grade || '-'}</td>
                                       <td className="p-4 text-center flex justify-center gap-2">
                                           <button title="Reset Login (Unlock)" onClick={async () => { await db.resetUserStatus(u.id); alert('Status login siswa di-reset (Unlock).'); loadData(); }} className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 p-2 rounded-lg transition">
                                               <Unlock size={16}/>
                                           </button>
                                           <button title="Reset Password (12345)" onClick={async () => { if(confirm('Reset password jadi 12345?')) { await db.resetUserPassword(u.id); alert('Password di-reset menjadi 12345'); } }} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition">
                                               <Key size={16}/>
                                           </button>
                                           <button title="Hapus Siswa" onClick={() => {if(confirm('Hapus siswa?')) {db.deleteUser(u.id); loadData();}}} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition">
                                               <Trash2 size={16}/>
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                               {getMonitoringUsers().length === 0 && (
                                   <tr>
                                       <td colSpan={7} className="p-8 text-center text-gray-400 italic">Tidak ada data peserta.</td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
          )}

          {activeTab === 'CETAK_KARTU' && (
              <div className="bg-white rounded-xl shadow-sm border p-6 animate-in fade-in print:shadow-none print:border-none print:p-0">
                  <div className="flex flex-col md:flex-row justify-between items-center mb-6 no-print gap-4 print:hidden"><h3 className="font-bold text-lg">Cetak Kartu Peserta</h3><div className="flex flex-wrap gap-4 items-center bg-gray-50 p-3 rounded-lg border"><div><label className="block text-xs font-bold text-gray-500 mb-1">Filter Sekolah</label><select className="border rounded p-1.5 text-sm w-48" value={cardSchoolFilter} onChange={e => setCardSchoolFilter(e.target.value)}><option value="ALL">Semua Sekolah</option>{schools.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs font-bold text-gray-500 mb-1">Tanggal Cetak</label><input type="date" className="border rounded p-1.5 text-sm" value={printDate} onChange={e => setPrintDate(e.target.value)}/></div><button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm flex items-center hover:bg-blue-700 h-full mt-4 md:mt-0 shadow-lg transform active:scale-95 transition-all"><Download size={16} className="mr-2"/> Download PDF / Cetak</button></div></div>
                  <div id="printable-area"><div className="print-grid">{getMonitoringUsers(cardSchoolFilter).map(u => (<div key={u.id} className="card-container bg-white relative flex overflow-hidden"><div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none z-0">{settings.schoolLogoUrl && <img src={settings.schoolLogoUrl} className="w-32 h-32 object-contain grayscale" />}</div><div className="z-10 flex w-full h-full relative"><div className="w-[30%] border-r-2 border-dashed border-gray-400 flex flex-col items-center justify-between p-2 text-center bg-gray-50/30"><div className="mt-1">{settings.schoolLogoUrl && <img src={settings.schoolLogoUrl} className="w-10 h-10 object-contain mix-blend-multiply" alt="Logo"/>}</div><div className="w-full flex-1 flex flex-col items-center justify-center my-1"><div className="w-[20mm] h-[25mm] border border-gray-400 bg-white shadow-inner overflow-hidden"></div></div><div className="mb-1 w-full border-t border-gray-400 pt-1"><div className="h-4"></div><p className="text-[7px] font-bold text-gray-500 uppercase">Tanda Tangan</p></div></div><div className="flex-1 p-2 flex flex-col justify-between"><div className="border-b-2 border-gray-800 pb-1 mb-1"><h2 className="font-black text-sm text-gray-900 leading-none mb-0.5 uppercase">KARTU PESERTA</h2><p className="text-[8px] font-bold text-gray-600 tracking-widest uppercase">UJI TKA MANDIRI</p></div><div className="flex-1 space-y-0.5 text-[9px] text-gray-900 font-medium mt-0.5"><div className="flex items-start"><span className="w-14 font-bold text-gray-500">NAMA</span><span className="font-bold uppercase flex-1 leading-tight truncate">: {u.name}</span></div><div className="flex items-center"><span className="w-14 font-bold text-gray-500">NISN</span><span className="font-mono font-bold">: {u.nisn || u.username}</span></div><div className="flex items-center"><span className="w-14 font-bold text-gray-500">PASS</span><span className="font-mono font-bold bg-gray-100 px-1 border border-gray-200 rounded">: {u.password}</span></div><div className="flex items-start"><span className="w-14 font-bold text-gray-500">SEKOLAH</span><span className="flex-1 truncate leading-tight">: {u.school || '-'}</span></div><div className="flex items-center"><span className="w-14 font-bold text-gray-500">SESI</span><span>: 1 (07.30 - 09.30)</span></div></div><div className="mt-1 pt-1 border-t border-gray-200 flex justify-between items-end"><div className="text-[7px] text-gray-400 italic max-w-[100px] leading-tight">*Bawa kartu saat ujian.</div><div className="text-center min-w-[80px]"><p className="text-[7px] text-gray-600 mb-2 leading-none">Pasuruan, {new Date(printDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric', day: 'numeric' })}</p><p className="text-[7px] font-bold underline">Panitia Pelaksana</p></div></div></div></div></div>))}</div></div>
              </div>
          )}

          {activeTab === 'ANTI_CHEAT' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center"><h3 className="font-bold text-lg flex items-center"><ShieldAlert size={24} className="mr-2 text-red-600"/> Konfigurasi Sistem Anti-Curang</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl shadow-sm border p-6"><h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Pengaturan Deteksi & Alert</h4><div className="space-y-4"><div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border"><div><p className="font-bold text-sm text-gray-700">Status Sistem</p><p className="text-xs text-gray-500">Aktifkan deteksi pindah tab/window.</p></div><button onClick={() => setAcActive(!acActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${acActive ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${acActive ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><div><label className="block text-sm font-bold text-gray-700 mb-1 flex items-center"><Clock size={14} className="mr-2"/> Durasi Freeze (Detik)</label><input type="number" min="0" value={acFreeze} onChange={(e) => setAcFreeze(parseInt(e.target.value))} className="w-full border rounded-lg p-2 text-sm"/></div><div><label className="block text-sm font-bold text-gray-700 mb-1 flex items-center"><AlertTriangle size={14} className="mr-2"/> Pesan Peringatan</label><textarea value={acText} onChange={(e) => setAcText(e.target.value)} className="w-full border rounded-lg p-2 text-sm h-20" placeholder="Pesan yang muncul saat layar dikunci..."/></div><div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border"><Volume2 size={18} className="text-gray-600"/><label className="flex-1 text-sm font-bold text-gray-700 cursor-pointer select-none" htmlFor="acSound">Bunyi Alert (Beep)</label><input type="checkbox" id="acSound" checked={acSound} onChange={(e) => setAcSound(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/></div><button onClick={handleSaveAntiCheat} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-900 transition flex items-center justify-center"><Save size={16} className="mr-2"/> Simpan Konfigurasi</button></div></div>
                      <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full"><h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center text-red-600"><UserX size={18} className="mr-2"/> Riwayat Pelanggaran Siswa</h4><div className="flex-1 overflow-y-auto">{results.filter(r => r.cheatingAttempts > 0).length === 0 ? (<div className="flex flex-col items-center justify-center h-48 text-gray-400"><ShieldAlert size={48} className="mb-2 opacity-50"/><p className="text-sm">Belum ada data pelanggaran.</p></div>) : (<table className="w-full text-sm text-left"><thead className="bg-red-50 text-red-800 font-bold"><tr><th className="p-2 rounded-tl-lg">Nama Siswa</th><th className="p-2">Mapel</th><th className="p-2 text-center">Pelanggaran</th><th className="p-2 rounded-tr-lg text-right">Nilai</th></tr></thead><tbody className="divide-y">{results.filter(r => r.cheatingAttempts > 0).sort((a, b) => b.cheatingAttempts - a.cheatingAttempts).map(r => (<tr key={r.id} className="hover:bg-red-50/50"><td className="p-2"><div className="font-bold text-gray-800">{r.studentName}</div><div className="text-xs text-gray-500">{users.find(u => u.id === r.studentId)?.school || '-'}</div></td><td className="p-2 text-xs text-gray-600">{r.examTitle}</td><td className="p-2 text-center"><span className="inline-flex items-center justify-center px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold text-xs">{r.cheatingAttempts}x</span></td><td className="p-2 text-right font-bold text-gray-700">{r.score}</td></tr>))}</tbody></table>)}</div></div>
                  </div>
              </div>
          )}

          {activeTab === 'KONFIGURASI_UMUM' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                  <div className="flex justify-between items-center"><h3 className="font-bold text-lg flex items-center"><Settings size={24} className="mr-2 text-blue-600"/> Konfigurasi Umum</h3></div>
                  <div className="grid grid-cols-1 gap-6">
                      {/* THEME SETTINGS */}
                      <div className="bg-white rounded-xl shadow-sm border p-6">
                          <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center"><Settings size={18} className="mr-2 text-blue-600"/> Pengaturan Umum</h4>
                          <div className="space-y-4">
                              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex flex-col md:flex-row md:items-center gap-4">
                                  <div className="md:w-1/3">
                                      <label className="block text-sm font-bold text-blue-900 mb-1">Judul Kegiatan</label>
                                      <p className="text-xs text-blue-600">Ganti nama aplikasi di header.</p>
                                  </div>
                                  <div className="flex-1">
                                      <input type="text" value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white" />
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sub-Judul</label>
                                      <input type="text" value={adminSubtitle} onChange={(e) => setAdminSubtitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Logo Sekolah</label>
                                  <div className="flex items-start gap-4">
                                      <div className={`flex-shrink-0 flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 overflow-hidden ${getPreviewContainerClass()}`}>
                                          {logoUrl ? <img src={logoUrl} alt="Preview" className="w-full h-full object-contain bg-white" /> : <span className="text-gray-400 text-xs">No Logo</span>}
                                      </div>
                                      <div className="flex-1 space-y-2">
                                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border rounded p-1" />
                                          <input type="text" value={logoUrl || ''} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Atau URL Gambar" className="w-full px-3 py-1.5 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                          <div className="flex gap-1 flex-wrap">
                                              <button onClick={() => setLogoStyle('circle')} className={`px-2 py-1 rounded text-[10px] font-bold border ${logoStyle === 'circle' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200'}`}>Bulat</button>
                                              <button onClick={() => setLogoStyle('rect_4_3')} className={`px-2 py-1 rounded text-[10px] font-bold border ${logoStyle === 'rect_4_3' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200'}`}>Persegi 4:3</button>
                                              <button onClick={() => setLogoStyle('rect_3_4_vert')} className={`px-2 py-1 rounded text-[10px] font-bold border ${logoStyle === 'rect_3_4_vert' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200'}`}>Vertikal 3:4</button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Warna Utama</label>
                                      <div className="flex items-center gap-2"><input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-8 p-0 border-0 rounded cursor-pointer"/><span className="font-mono text-xs">{primaryColor}</span></div>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Warna Gradasi</label>
                                      <div className="flex items-center gap-2"><input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="h-8 w-8 p-0 border-0 rounded cursor-pointer"/><span className="font-mono text-xs">{gradientEnd}</span></div>
                                  </div>
                              </div>
                              <button onClick={handleSaveTheme} className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-900 transition flex items-center justify-center"><Save size={16} className="mr-2"/> Simpan Tema</button>
                          </div>
                      </div>

                      {/* ADMIN MANAGEMENT */}
                      <div className="bg-white rounded-xl shadow-sm border p-6">
                          <div className="flex justify-between items-center mb-4 border-b pb-2">
                              <h4 className="font-bold text-gray-800">Manajemen Admin</h4>
                              <button onClick={() => setIsAddAdminModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center"><Plus size={14} className="mr-1"/> Tambah Admin</button>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 font-bold text-gray-600 text-xs">
                                      <tr><th className="p-2">Nama</th><th className="p-2">Username</th><th className="p-2 text-center">Aksi</th></tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {users.filter(u => u.role === UserRole.ADMIN).map(u => (
                                          <tr key={u.id} className="hover:bg-gray-50">
                                              <td className="p-2 font-medium">{u.name}</td>
                                              <td className="p-2 text-gray-500">{u.username}</td>
                                              <td className="p-2 text-center">
                                                  {u.id !== user.id && (
                                                      <button onClick={() => handleDeleteAdmin(u.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14}/></button>
                                                  )}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </main>

      {/* ADD EXAM MODAL */}
      {isAddExamModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Tambah Mapel Baru</h3><button onClick={() => setIsAddExamModalOpen(false)}><X/></button></div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold mb-1">Nama Mata Pelajaran</label>
                          <input required className="w-full border rounded p-2" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="Contoh: Matematika" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold mb-1">Kelas</label>
                          <select className="w-full border rounded p-2" value={newExamGrade} onChange={e => setNewExamGrade(e.target.value)}>
                              <option value="7">Kelas 7</option>
                              <option value="8">Kelas 8</option>
                              <option value="9">Kelas 9</option>
                          </select>
                      </div>
                      <button onClick={submitNewExam} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Simpan Mapel</button>
                  </div>
              </div>
          </div>
      )}

      {/* ADD ADMIN MODAL */}
      {isAddAdminModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Tambah Admin Baru</h3><button onClick={() => setIsAddAdminModalOpen(false)}><X/></button></div>
                  <form onSubmit={handleAddAdmin} className="space-y-4">
                      <div><label className="block text-sm font-bold mb-1">Nama Lengkap</label><input required className="w-full border rounded p-2" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} /></div>
                      <div><label className="block text-sm font-bold mb-1">Username</label><input required className="w-full border rounded p-2" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} /></div>
                      <div><label className="block text-sm font-bold mb-1">Password</label><input required className="w-full border rounded p-2" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} /></div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Simpan Admin</button>
                  </form>
              </div>
          </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md print:hidden">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-0 animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-5 text-white flex justify-between items-center" style={{ background: `linear-gradient(to right, ${themeColor}, #60a5fa)` }}><div><h3 className="font-bold text-xl flex items-center"><MapIcon className="mr-2" size={24}/> Mapping Jadwal & Akses</h3><p className="text-white/80 text-sm">{editingExam?.title}</p></div><button onClick={() => setIsEditModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition"><X size={20}/></button></div>
                  <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                           <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><label className="block text-xs font-bold uppercase text-gray-500 mb-2">Token Ujian</label><div className="flex gap-2"><div className="relative flex-1"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input className="border-2 border-gray-300 rounded-lg py-2 pl-9 pr-2 w-full font-mono uppercase font-bold text-lg tracking-wider focus:border-blue-500 focus:outline-none transition text-center" value={editToken} onChange={e => setEditToken(e.target.value.toUpperCase())}/></div><button onClick={() => setEditToken(Math.random().toString(36).substring(2,8).toUpperCase())} className="bg-white border-2 border-gray-300 hover:border-blue-400 hover:text-blue-600 px-3 rounded-lg transition"><Shuffle size={20}/></button></div></div>
                           <div className="space-y-3"><div className="flex gap-3"><div className="flex-1"><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tanggal</label><input type="date" className="border rounded-lg p-2 w-full text-sm font-medium" value={editDate} onChange={e => setEditDate(e.target.value)}/></div><div className="w-24"><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Durasi</label><div className="relative"><input type="number" className="border rounded-lg p-2 w-full text-sm font-medium pr-8" value={editDuration} onChange={e => setEditDuration(Number(e.target.value))}/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">m</span></div></div></div><div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Sesi</label><select className="border rounded-lg p-2 w-full text-sm font-medium bg-white" value={editSession} onChange={e => setEditSession(e.target.value)}><option value="Sesi 1">Sesi 1 (Pagi)</option><option value="Sesi 2">Sesi 2 (Siang)</option><option value="Sesi 3">Sesi 3 (Sore)</option></select></div></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4"><div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center"><p className="text-[10px] uppercase font-bold text-blue-400">Total Akses</p><p className="text-2xl font-extrabold text-blue-600 leading-none mt-1">{editSchoolAccess.length}</p></div><div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center"><p className="text-[10px] uppercase font-bold text-green-400">Tersedia</p><p className="text-2xl font-extrabold text-green-600 leading-none mt-1">{availableRooms.length}</p></div><div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center"><p className="text-[10px] uppercase font-bold text-orange-400">Sibuk/Bentrok</p><p className="text-2xl font-extrabold text-orange-600 leading-none mt-1">{busyCount}</p></div></div>
                      <div className="mb-4"><div className="flex justify-between items-center mb-2"><label className="text-sm font-bold text-gray-700 flex items-center"><CheckSquare size={16} className="mr-2 text-blue-600"/> Ruang Terpilih (Akses Diberikan)</label>{editSchoolAccess.length > 0 && (<button onClick={() => setEditSchoolAccess([])} className="text-xs text-red-500 font-bold hover:underline">Hapus Semua</button>)}</div><div className="bg-white border-2 border-blue-100 rounded-xl p-3 min-h-[80px] flex flex-wrap gap-2 content-start shadow-inner">{editSchoolAccess.length === 0 && (<p className="text-sm text-gray-400 italic w-full text-center py-4">Belum ada ruang yang dipilih.</p>)}{editSchoolAccess.map(r => (<div key={r} className="group bg-blue-600 text-white pl-3 pr-1 py-1 rounded-full text-xs font-bold flex items-center shadow-sm animate-in zoom-in duration-200"><span>{r}</span><button onClick={() => toggleRoomAccess(r)} className="ml-2 p-1 hover:bg-white/20 rounded-full transition"><X size={12}/></button></div>))}</div></div>
                      <div><div className="flex justify-between items-center mb-2"><label className="text-sm font-bold text-gray-700 flex items-center"><Plus size={16} className="mr-2 text-green-600"/> Tambah Akses (Tersedia Sesi Ini)</label>{availableRooms.length > 0 && (<button onClick={() => addAllAvailableRooms(availableRooms)} className="text-xs text-blue-600 font-bold hover:underline">Pilih Semua ({availableRooms.length})</button>)}</div><div className="relative mb-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="w-full border rounded-lg py-2 pl-9 pr-3 text-xs bg-gray-50 focus:bg-white transition outline-none focus:ring-1 focus:ring-blue-400" placeholder="Cari nama ruang..." value={mappingSearch} onChange={e => setMappingSearch(e.target.value)}/></div><div className="border rounded-xl bg-gray-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">{availableRooms.length === 0 ? (<div className="p-6 text-center text-gray-400 text-xs"><Info size={24} className="mx-auto mb-2 opacity-50"/><p>Tidak ada ruang tersedia untuk ditambahkan.</p>{busyCount > 0 && <p className="mt-1 text-orange-400">({busyCount} ruang sedang ujian mapel lain)</p>}</div>) : (availableRooms.map(r => (<div key={r} onClick={() => toggleRoomAccess(r)} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-blue-50 cursor-pointer transition group bg-white"><div className="flex items-center space-x-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs group-hover:bg-blue-200 group-hover:text-blue-700 transition"><Monitor size={14}/></div><span className="text-sm font-medium text-gray-700 group-hover:text-blue-800">{r}</span></div><div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center group-hover:border-blue-500"><Plus size={12} className="text-white group-hover:text-blue-600"/></div></div>)))}</div>{busyCount > 0 && (<div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg p-2 flex items-center gap-2 text-xs text-orange-700"><AlertTriangle size={14} className="flex-shrink-0"/><span><strong>{busyCount} Ruang</strong> disembunyikan karena sudah ada jadwal ujian lain di sesi ini.</span></div>)}</div>
                  </div>
                  <div className="p-4 bg-gray-50 border-t flex gap-3"><button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold text-sm hover:bg-gray-200 rounded-xl transition">Batal</button><button onClick={handleSaveMapping} className="flex-[2] py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center"><Save size={18} className="mr-2"/> Simpan Perubahan</button></div>
              </div>
          </div>
      )}

      {/* ADD QUESTION MODAL */}
      {isAddQuestionModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 h-[90vh] overflow-y-auto animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Tambah Soal Manual</h3><button onClick={() => setIsAddQuestionModalOpen(false)}><X/></button></div>
                  <div className="space-y-4">
                      <div className="flex gap-4">
                          <select className="border rounded p-2 flex-1" value={nqType} onChange={e => setNqType(e.target.value as QuestionType)}><option value="PG">Pilihan Ganda</option></select>
                          <select className="border rounded p-2 flex-1" value={nqGrade} onChange={e => setNqGrade(e.target.value)}>
                              <option value="7">Kelas 7</option>
                              <option value="8">Kelas 8</option>
                              <option value="9">Kelas 9</option>
                          </select>
                      </div>
                      <textarea className="border rounded p-2 w-full h-24" placeholder="Teks Soal..." value={nqText} onChange={e => setNqText(e.target.value)}></textarea>
                      <div className="grid grid-cols-1 gap-2">{nqOptions.map((opt, i) => (<div key={i} className="flex items-center gap-2"><span className="font-bold w-6">{String.fromCharCode(65+i)}.</span><input className="border rounded p-2 flex-1" value={opt} onChange={e => {const n = [...nqOptions]; n[i] = e.target.value; setNqOptions(n);}} placeholder={`Opsi ${String.fromCharCode(65+i)}`}/><input type="radio" name="correct" checked={nqCorrectIndex === i} onChange={() => setNqCorrectIndex(i)}/></div>))}</div>
                      <button onClick={handleSaveQuestion} className="bg-green-600 text-white w-full py-3 rounded font-bold">Simpan Soal</button>
                  </div>
              </div>
          </div>
      )}

      {/* ROOM MODAL */}
      {isRoomModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingRoom ? 'Edit Ruang' : 'Tambah Ruang'}</h3><button onClick={() => setIsRoomModalOpen(false)}><X/></button></div>
                  <form onSubmit={handleSaveRoom} className="space-y-4">
                      <div><label className="block text-sm font-bold mb-1">Nama Ruang</label><input name="name" defaultValue={editingRoom?.name} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Kapasitas</label><input type="number" name="capacity" defaultValue={editingRoom?.capacity} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Username Pengawas</label><input name="proctor_username" defaultValue={editingRoom?.proctor_username} className="w-full border rounded p-2"/></div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Simpan</button>
                  </form>
              </div>
          </div>
      )}

      {/* SESSION MODAL */}
      {isSessionModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingSession ? 'Edit Sesi' : 'Tambah Sesi'}</h3><button onClick={() => setIsSessionModalOpen(false)}><X/></button></div>
                  <form onSubmit={handleSaveSession} className="space-y-4">
                      <div><label className="block text-sm font-bold mb-1">Nama Sesi</label><input name="name" defaultValue={editingSession?.name} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Waktu Mulai</label><input type="time" name="start_time" defaultValue={editingSession?.start_time} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Waktu Selesai</label><input type="time" name="end_time" defaultValue={editingSession?.end_time} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Tipe Peserta</label><input name="participant_type" defaultValue={editingSession?.participant_type} className="w-full border rounded p-2"/></div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Simpan</button>
                  </form>
              </div>
          </div>
      )}

      {/* PROCTOR MODAL */}
      {isProctorModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingProctor ? 'Edit Pengawas' : 'Tambah Pengawas'}</h3><button onClick={() => setIsProctorModalOpen(false)}><X/></button></div>
                  <form onSubmit={handleSaveProctor} className="space-y-4">
                      {!editingProctor && (
                          <div>
                              <label className="block text-sm font-bold mb-1">Pilih Guru (Opsional)</label>
                              <select name="teacher_id" className="w-full border rounded p-2" onChange={(e) => {
                                  const teacher = teachers.find(t => t.id === e.target.value);
                                  if (teacher) {
                                      const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
                                      const usernameInput = document.querySelector('input[name="username"]') as HTMLInputElement;
                                      if (nameInput) nameInput.value = teacher.name;
                                      if (usernameInput) usernameInput.value = teacher.username;
                                  }
                              }}>
                                  <option value="">-- Pilih dari Data Guru --</option>
                                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                          </div>
                      )}
                      <div><label className="block text-sm font-bold mb-1">Nama Pengawas</label><input name="name" defaultValue={editingProctor?.name} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Username</label><input name="username" defaultValue={editingProctor?.username} required className="w-full border rounded p-2"/></div>
                      <div><label className="block text-sm font-bold mb-1">Password</label><input name="password" defaultValue={editingProctor?.password} required className="w-full border rounded p-2"/></div>
                      <div>
                          <label className="block text-sm font-bold mb-1">Ruang</label>
                          <select name="room_id" defaultValue={editingProctor?.room_id} className="w-full border rounded p-2" required>
                              <option value="">Pilih Ruang</option>
                              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">{editingProctor ? 'Simpan Perubahan' : 'Tambah Pengawas'}</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
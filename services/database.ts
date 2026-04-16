import { supabase } from './supabase';
import { User, Exam, ExamResult, AppSettings, Question, UserRole, Teacher } from '../types';

// Hardcoded Default Settings just in case DB is completely empty
let DEFAULT_SETTINGS: AppSettings = {
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

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const db = {
  generateToken: (): string => {
    return generateToken();
  },
  
  getSettings: async (): Promise<AppSettings> => {
    const { data, error } = await supabase.from('settings').select('data').eq('id', 'app_settings').single();
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...data.data };
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    const { error } = await supabase.from('settings').upsert({ id: 'app_settings', data: settings });
    if (error) console.error("Error updating settings", error);
  },

  login: async (input: string, password?: string): Promise<User | undefined> => {
    const cleanInput = input.trim();
    
    // Check Users (Admin/Student)
    let { data: users, error: userErr } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${cleanInput},nisn.eq.${cleanInput}`);
    
    if (users && users.length > 0) {
        const u = users[0];
        if (u.password !== password) return undefined;
        
        if (u.role === UserRole.STUDENT) {
            if (u.is_login) {
                alert("Akun sedang digunakan di perangkat lain. Harap logout terlebih dahulu atau hubungi admin.");
                return undefined;
            }
            if (u.status === 'blocked') {
                alert("Akun diblokir. Hubungi pengawas.");
                return undefined;
            }
            await supabase.from('users').update({ is_login: true, status: 'idle' }).eq('id', u.id);
        }
        return {
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            school: u.school,
            password: u.password,
            isLogin: true,
            status: u.status,
            grade: u.grade,
            nisn: u.nisn,
            gender: u.gender,
            birthDate: u.birth_date,
            isLocked: u.is_locked,
            room: u.room,
            session: u.session,
            level: u.level
        };
    }

    // Check Teachers (since they can login like Proctors but Global)
    let { data: teachers } = await supabase
        .from('teachers')
        .select('*')
        .or(`nip.eq.${cleanInput},username.eq.${cleanInput}`);
        
    if (teachers && teachers.length > 0) {
        const t = teachers[0];
        if (t.password !== password) return undefined;
        return {
            id: t.id,
            name: t.name,
            username: t.username,
            password: t.password,
            role: UserRole.PROCTOR, 
            school: 'GLOBAL' 
        };
    }

    // Since Proctors are attached to classrooms conceptually in UI, or maybe we don't have separate proctors table?
    // Oh wait, rooms table has proctor_username. Or we query users table if proctors are there.
    let { data: proctors } = await supabase.from('users').select('*').eq('role', 'PROCTOR').eq('username', cleanInput);
    if (proctors && proctors.length > 0) {
        const p = proctors[0];
        if (p.password !== password) return undefined;
        return {
            id: p.id,
            name: p.name,
            username: p.username,
            role: UserRole.PROCTOR,
            school: p.school,
            room: p.room
        };
    }

    return undefined;
  },

  logout: async (userId: string): Promise<void> => {
      const { data: user } = await supabase.from('users').select('role').eq('id', userId).single();
      if (user && user.role !== 'ADMIN') {
          await supabase.from('users').update({ is_login: false }).eq('id', userId);
      }
  },

  getExams: async (level?: string): Promise<Exam[]> => {
    let query = supabase.from('exams').select('*, questions(*)').order('exam_date', { ascending: false });
    if (level) query = query.eq('education_level', level);
    const { data: exams } = await query;
    if (!exams) return [];
    
    return exams.map((e: any) => ({
        id: e.id,
        title: e.title,
        subject: e.subject,
        durationMinutes: e.duration_minutes,
        questionCount: e.question_count,
        token: e.token,
        isActive: e.is_active,
        grade: e.grade,
        examDate: e.exam_date,
        session: e.session,
        schoolAccess: e.school_access,
        educationLevel: e.education_level,
        questions: e.questions ? e.questions.map((q: any) => ({
             id: q.id,
             examId: q.exam_id,
             nomor: q.nomor,
             type: q.type,
             category: q.category,
             grade: q.grade,
             text: q.text,
             imgUrl: q.img_url,
             options: q.options || [],
             correctIndex: q.correct_index,
             correctIndices: q.correct_indices || [],
             points: q.points
        })) : []
    }));
  },

  updateExamMapping: async (examId: string, token: string, durationMinutes: number, examDate: string, session: string, schoolAccess: string[]): Promise<void> => {
     await supabase.from('exams').update({
        token,
        duration_minutes: durationMinutes,
        exam_date: examDate,
        session,
        school_access: schoolAccess
     }).eq('id', examId);
  },

  createExam: async (exam: Exam): Promise<void> => {
     const { data, error } = await supabase.from('exams').insert({
         title: exam.title,
         subject: exam.subject,
         duration_minutes: exam.durationMinutes,
         question_count: exam.questionCount,
         token: generateToken(),
         is_active: exam.isActive,
         grade: exam.grade,
         exam_date: exam.examDate,
         session: exam.session,
         school_access: exam.schoolAccess,
         education_level: exam.educationLevel
     }).select().single();
     // Should also insert questions if exam has them, though usually they are added after.
  },

  updateExam: async (id: string, updates: Partial<Exam>): Promise<void> => {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.subject !== undefined) payload.subject = updates.subject;
      if (updates.durationMinutes !== undefined) payload.duration_minutes = updates.durationMinutes;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;
      if (updates.token !== undefined) payload.token = updates.token;
      
      await supabase.from('exams').update(payload).eq('id', id);
  },

  addQuestions: async (examId: string, questions: Question[]): Promise<void> => {
      const rows = questions.map(q => ({
          exam_id: examId,
          type: q.type,
          text: q.text,
          options: q.options,
          correct_index: q.correctIndex,
          points: q.points,
          img_url: q.imgUrl
      }));
      await supabase.from('questions').insert(rows);
      
      // Update exam question count
      const { data: currentQ } = await supabase.from('questions').select('id', { count: 'exact' }).eq('exam_id', examId);
      if (currentQ) {
         await supabase.from('exams').update({ question_count: currentQ.length }).eq('id', examId);
      }
  },

  submitResult: async (result: ExamResult): Promise<void> => {
    // Save Result
    await supabase.from('results').insert({
       student_id: result.studentId,
       exam_id: result.examId,
       score: result.score,
       cheating_attempts: result.cheatingAttempts
    });
    
    // Set user as finished
    await supabase.from('users').update({ status: 'finished' }).eq('id', result.studentId);
  },

  getAllResults: async (): Promise<ExamResult[]> => {
    // Use joining in supabase
    const { data: results, error } = await supabase.from('results').select('*, users(name), exams(title, question_count)');
    if (error || !results) return [];
    
    return results.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        examId: r.exam_id,
        score: r.score,
        cheatingAttempts: r.cheating_attempts,
        submittedAt: r.submitted_at,
        studentName: r.users?.name || 'Unknown',
        examTitle: r.exams?.title || 'Unknown',
        totalQuestions: r.exams?.question_count || 0
    }));
  },

  resetCheatingCount: async (resultId: string): Promise<void> => {
      await supabase.from('results').update({ cheating_attempts: 0 }).eq('id', resultId);
  },

  getUsers: async (): Promise<User[]> => {
    const { data: users } = await supabase.from('users').select('*').neq('role', 'ADMIN');
    if (!users) return [];
    return users.map((u: any) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      school: u.school,
      password: u.password,
      isLogin: u.is_login,
      status: u.status,
      grade: u.grade,
      nisn: u.nisn,
      gender: u.gender,
      birthDate: u.birth_date,
      isLocked: u.is_locked,
      room: u.room,
      session: u.session,
      level: u.level
    }));
  },
  
  importStudents: async (users: User[]): Promise<void> => {
      const rows = users.map(u => ({
          name: u.name,
          username: u.nisn || u.username,
          nisn: u.nisn || u.username,
          school: u.school || 'UMUM',
          password: u.password || '12345',
          role: 'STUDENT',
          grade: u.grade,
          room: u.room,
          session: u.session
      }));
      // In Supabase, if username is unique, we should handle conflicts or ignore them.
      // Easiest is insert, but ignore duplicates if unique constraint on username.
      for (const row of rows) {
          await supabase.from('users').insert(row).select(); // we ignore errors of duplicate internally or handle in bulk later if preferred
      }
  },

  addUser: async (user: User): Promise<void> => {
      await supabase.from('users').insert({
          name: user.name,
          username: user.nisn || user.username,
          nisn: user.nisn || user.username,
          school: user.school || 'UMUM',
          password: user.password || '12345',
          role: 'STUDENT'
      });
  },

  deleteUser: async (id: string): Promise<void> => {
      await supabase.from('users').delete().eq('id', id);
  },

  resetUserStatus: async (userId: string): Promise<void> => {
      await supabase.from('users').update({ is_login: false, status: 'idle' }).eq('id', userId);
  },

  deleteAllUsers: async (): Promise<void> => {
      await supabase.from('users').delete().eq('role', 'STUDENT');
  },

  resetUserPassword: async (userId: string): Promise<void> => {
      await supabase.from('users').update({ password: '12345' }).eq('id', userId);
  },

  deleteResult: async (studentId: string, examId: string): Promise<void> => {
      await supabase.from('results').delete().eq('student_id', studentId).eq('exam_id', examId);
  },

  updateStudentRoom: async (studentId: string, roomName: string): Promise<void> => {
      await supabase.from('users').update({ room: roomName }).eq('id', studentId);
  },

  // --- ROOMS ---
  getRooms: async (): Promise<any[]> => {
      const { data } = await supabase.from('rooms').select('*');
      return data || [];
  },
  addRoom: async (room: any): Promise<void> => {
      await supabase.from('rooms').insert({
          name: room.name,
          capacity: room.capacity,
          proctor_username: room.proctor_username,
          teacher_id: room.teacher_id
      });
  },
  updateRoom: async (id: string, room: any): Promise<void> => {
      await supabase.from('rooms').update({
          name: room.name,
          capacity: room.capacity,
          proctor_username: room.proctor_username, // Map correctly
      }).eq('id', id);
  },
  deleteRoom: async (id: string): Promise<void> => {
      await supabase.from('rooms').delete().eq('id', id);
  },

  // --- SESSIONS ---
  getSessions: async (): Promise<any[]> => {
      const { data } = await supabase.from('sessions').select('*').order('start_time', { ascending: true });
      return data ? data.map((s:any) => ({ id: s.id, name: s.name, startTime: s.start_time, endTime: s.end_time, participantType: s.participant_type })) : [];
  },
  addSession: async (session: any): Promise<void> => {
      await supabase.from('sessions').insert({
          name: session.name,
          start_time: session.startTime || session.start_time,
          end_time: session.endTime || session.end_time,
          participant_type: session.participantType || session.participant_type
      });
  },
  updateSession: async (id: string, session: any): Promise<void> => {
      await supabase.from('sessions').update({
          name: session.name,
          start_time: session.startTime || session.start_time,
          end_time: session.endTime || session.end_time,
          participant_type: session.participantType || session.participant_type
      }).eq('id', id);
  },
  deleteSession: async (id: string): Promise<void> => {
      await supabase.from('sessions').delete().eq('id', id);
  },

  // --- PROCTORS ---
  getProctors: async (): Promise<any[]> => {
      const { data } = await supabase.from('users').select('*').eq('role', 'PROCTOR');
      return data ? data.map((p: any) => ({
          id: p.id,
          name: p.name,
          username: p.username,
          password: p.password,
          room_id: p.room, // room mapping
          school: p.school
      })) : [];
  },
  addProctor: async (proctor: any): Promise<void> => {
      await supabase.from('users').insert({
          name: proctor.name,
          username: proctor.username,
          password: proctor.password,
          role: 'PROCTOR',
          room: proctor.room_id,
          school: proctor.school
      });
  },
  updateProctor: async (id: string, proctor: any): Promise<void> => {
      await supabase.from('users').update({
          name: proctor.name,
          username: proctor.username,
          password: proctor.password,
          room: proctor.room_id
      }).eq('id', id);
  },
  deleteProctor: async (id: string): Promise<void> => {
      await supabase.from('users').delete().eq('id', id);
  },

  // --- TEACHERS ---
  getTeachers: async (): Promise<Teacher[]> => {
      const { data } = await supabase.from('teachers').select('*').order('name');
      return data || [];
  },
  addTeacher: async (teacher: Omit<Teacher, 'id'>): Promise<void> => {
      await supabase.from('teachers').insert({
          name: teacher.name,
          nip: teacher.nip,
          username: teacher.username,
          password: teacher.password || 'password'
      });
  },
  updateTeacher: async (id: string, teacher: Teacher): Promise<void> => {
      await supabase.from('teachers').update({
          name: teacher.name,
          nip: teacher.nip,
          username: teacher.username,
          password: teacher.password
      }).eq('id', id);
  },
  deleteTeacher: async (id: string): Promise<void> => {
      await supabase.from('teachers').delete().eq('id', id);
  }
};


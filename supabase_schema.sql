-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUMS
CREATE TYPE user_role AS ENUM ('ADMIN', 'STUDENT', 'PROCTOR', 'TEACHER');

-- TABLE: settings
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
);

-- Initialize default settings
INSERT INTO public.settings (id, data) VALUES (
    'app_settings', 
    '{"appName": "UJI TKA MANDIRI", "themeColor": "#2459a9", "gradientEndColor": "#60a5fa", "logoStyle": "circle", "antiCheat": {"isActive": true, "freezeDurationSeconds": 15, "alertText": "PERINGATAN! Dilarang berpindah aplikasi.", "enableSound": true, "antiFastSubmit": false, "minWorkTimeMinutes": 10}, "globalToken": {"isActive": false, "token": "TOKEN2024"}}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- TABLE: users
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  school TEXT,
  password TEXT,
  is_login BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'idle', -- 'idle' | 'working' | 'finished' | 'blocked'
  grade TEXT,
  nisn TEXT,
  gender TEXT,
  birth_date DATE,
  is_locked BOOLEAN DEFAULT false,
  room TEXT,
  session TEXT,
  level TEXT
);

-- Insert central admin
INSERT INTO public.users (name, username, password, role, school) 
VALUES ('Administrator', 'admin', 'admin', 'ADMIN', 'PUSAT')
ON CONFLICT (username) DO NOTHING;

-- TABLE: teachers
CREATE TABLE public.teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nip TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT
);

-- TABLE: rooms
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 0,
  proctor_username TEXT,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL
);

-- TABLE: sessions
CREATE TABLE public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  participant_type TEXT
);

-- TABLE: exams
CREATE TABLE public.exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  token TEXT,
  is_active BOOLEAN DEFAULT false,
  grade TEXT,
  exam_date DATE,
  session TEXT,
  school_access JSONB,
  education_level TEXT
);

-- TABLE: questions
CREATE TABLE public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  nomor TEXT,
  type TEXT NOT NULL,
  category TEXT,
  grade TEXT,
  text TEXT NOT NULL,
  img_url TEXT,
  options JSONB,
  correct_index INTEGER,
  correct_indices JSONB,
  points INTEGER NOT NULL DEFAULT 10
);

-- TABLE: results
CREATE TABLE public.results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cheating_attempts INTEGER DEFAULT 0
);

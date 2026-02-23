import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  Mail, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Plus, 
  BarChart3, 
  ClipboardList,
  Eye,
  Trash2,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { useExamProctoring } from './hooks/useExamProctoring';
import confetti from 'canvas-confetti';

// --- Types ---
interface Question {
  id?: string;
  text: string;
  options: string[];
  correct: number;
}

interface Exam {
  id: string;
  title: string;
  duration: number;
  total_marks: number;
  created_at: string;
}

interface Attempt {
  id: string;
  student_name: string;
  student_id: string;
  score: number;
  status: string;
  violations: string[];
  submitted_at: string;
}

// --- Components ---

const Button = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button 
    className={cn(
      "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
      className
    )} 
    {...props}
  >
    {children}
  </button>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      "w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
      className
    )} 
    {...props} 
  />
);

const Card = ({ className, children, onClick }: { className?: string, children: React.ReactNode, onClick?: () => void, key?: React.Key }) => (
  <div 
    className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}
    onClick={onClick}
  >
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard' | 'create-exam' | 'exam-lobby' | 'exam-active' | 'exam-result' | 'view-results'>('landing');
  const [user, setUser] = useState<{ token: string; name: string; email: string } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [examResults, setExamResults] = useState<Attempt[]>([]);
  const [studentInfo, setStudentInfo] = useState({ name: '', id: '' });
  const [examState, setExamState] = useState<{
    currentQuestion: number;
    answers: Record<number, number>;
    violations: string[];
    timeLeft: number;
    status: 'In Progress' | 'Completed' | 'Terminated';
  }>({
    currentQuestion: 0,
    answers: {},
    violations: [],
    timeLeft: 0,
    status: 'In Progress'
  });

  const [newQuestions, setNewQuestions] = useState<Question[]>([]);
  const [currentNewQuestion, setCurrentNewQuestion] = useState<{ text: string; options: string[]; correct: number }>({
    text: '',
    options: ['', '', '', ''],
    correct: 0
  });

  // --- Effects ---
  useEffect(() => {
    const savedUser = localStorage.getItem('examiner');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (user && view === 'dashboard') {
      fetchExams();
    }
  }, [user, view]);

  useEffect(() => {
    let timer: any;
    if (view === 'exam-active' && examState.timeLeft > 0 && examState.status === 'In Progress') {
      timer = setInterval(() => {
        setExamState(prev => {
          if (prev.timeLeft <= 1) {
            submitExam(prev.answers, prev.violations, 'Completed');
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [view, examState.timeLeft, examState.status]);

  // --- API Calls ---
  const fetchExams = async () => {
    const res = await fetch('/api/exams', {
      headers: { 'Authorization': `Bearer ${user?.token}` }
    });
    const data = await res.json();
    setExams(data);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    
    const res = await fetch('/api/examiner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      localStorage.setItem('examiner', JSON.stringify(data));
      setView('dashboard');
    } else {
      alert('Invalid credentials');
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    
    const res = await fetch('/api/examiner/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    if (res.ok) {
      setView('login');
    } else {
      alert('Registration failed');
    }
  };

  const createExam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title');
    const duration = parseInt(formData.get('duration') as string);
    
    if (newQuestions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    const res = await fetch('/api/exam/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      },
      body: JSON.stringify({ title, duration, questions: newQuestions })
    });

    if (res.ok) {
      setNewQuestions([]);
      setView('dashboard');
    }
  };

  const startExam = async (examId: string) => {
    const res = await fetch(`/api/exam/public/${examId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedExam(data);
      setExamState({
        currentQuestion: 0,
        answers: {},
        violations: [],
        timeLeft: data.duration * 60,
        status: 'In Progress'
      });
      setView('exam-lobby');
    }
  };

  const submitExam = async (answers: any, violations: string[], status: string) => {
    const res = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: selectedExam.id,
        studentName: studentInfo.name,
        studentId: studentInfo.id,
        answers,
        violations,
        status
      })
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedExam({ ...selectedExam, result: data });
      setView('exam-result');
      if (status === 'Completed') confetti();
    }
  };

  const viewResults = async (examId: string) => {
    const res = await fetch(`/api/exam/${examId}/results`, {
      headers: { 'Authorization': `Bearer ${user?.token}` }
    });
    const data = await res.json();
    setExamResults(data);
    setView('view-results');
  };

  // --- Proctoring Hook ---
  const { enterFullscreen } = useExamProctoring((type) => {
    if (view === 'exam-active' && examState.status === 'In Progress') {
      setExamState(prev => {
        const newViolations = [...prev.violations, type];
        
        // AI Proctoring Logic: Threshold for termination
        // Points: Tab switch (2), Exit fullscreen (3), Right click (1)
        const score = newViolations.reduce((acc, v) => {
          if (v.includes('Tab')) return acc + 2;
          if (v.includes('fullscreen')) return acc + 3;
          return acc + 1;
        }, 0);

        if (score >= 5) {
          submitExam(prev.answers, newViolations, 'Terminated');
          return { ...prev, violations: newViolations, status: 'Terminated' };
        }
        
        return { ...prev, violations: newViolations };
      });
    }
  });

  // --- Render Helpers ---

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Shield size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">IntegrityShield</span>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold">{user.name}</span>
                  <span className="text-xs text-slate-500">Examiner</span>
                </div>
                <Button 
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                  onClick={() => {
                    localStorage.removeItem('examiner');
                    setUser(null);
                    setView('landing');
                  }}
                >
                  <LogOut size={18} />
                </Button>
              </>
            ) : (
              view !== 'exam-active' && (
                <div className="flex gap-2">
                  <Button className="text-slate-600 hover:bg-slate-100" onClick={() => setView('login')}>Login</Button>
                  <Button className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100" onClick={() => setView('register')}>Get Started</Button>
                </div>
              )
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Landing Page */}
          {view === 'landing' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center py-12 sm:py-20"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold mb-6">
                <Shield size={16} />
                Smart Secure Examination Platform
              </div>
              <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                Integrity in Every <span className="text-indigo-600">Submission.</span>
              </h1>
              <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
                The most advanced online examination system with AI-powered proctoring, 
                anti-cheat mechanisms, and automated evaluation.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <Card className="flex-1 p-6 hover:border-indigo-500 transition-colors cursor-pointer" onClick={() => setView('register')}>
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                    <User size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-1">For Examiners</h3>
                  <p className="text-sm text-slate-500">Create exams, manage questions, and view detailed analytics.</p>
                </Card>
                
                <Card className="flex-1 p-6 hover:border-emerald-500 transition-colors cursor-pointer" onClick={() => {
                  const id = prompt("Enter Exam ID:");
                  if (id) startExam(id);
                }}>
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
                    <ClipboardList size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-1">For Students</h3>
                  <p className="text-sm text-slate-500">Join an exam session using a secure link or exam ID.</p>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Login / Register */}
          {(view === 'login' || view === 'register') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">
                  {view === 'login' ? 'Welcome Back' : 'Create Examiner Account'}
                </h2>
                <form className="space-y-4" onSubmit={view === 'login' ? handleLogin : handleRegister}>
                  {view === 'register' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <Input name="name" placeholder="John Doe" required />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                    <Input name="email" type="email" placeholder="john@example.com" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <Input name="password" type="password" placeholder="••••••••" required />
                  </div>
                  <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2 py-3">
                    {view === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-6">
                  {view === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                  <button 
                    className="text-indigo-600 font-semibold hover:underline"
                    onClick={() => setView(view === 'login' ? 'register' : 'login')}
                  >
                    {view === 'login' ? 'Register' : 'Login'}
                  </button>
                </p>
              </Card>
            </motion.div>
          )}

          {/* Dashboard */}
          {view === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Examiner Dashboard</h2>
                  <p className="text-slate-500">Manage your exams and monitor student performance.</p>
                </div>
                <Button 
                  className="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                  onClick={() => setView('create-exam')}
                >
                  <Plus size={20} /> Create New Exam
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-white border-l-4 border-l-indigo-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <ClipboardList size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Exams</span>
                  </div>
                  <div className="text-3xl font-bold">{exams.length}</div>
                </Card>
                <Card className="p-6 bg-white border-l-4 border-l-emerald-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <CheckCircle2 size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submissions</span>
                  </div>
                  <div className="text-3xl font-bold">--</div>
                </Card>
                <Card className="p-6 bg-white border-l-4 border-l-amber-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <AlertTriangle size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Violations</span>
                  </div>
                  <div className="text-3xl font-bold">--</div>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">Active Exams</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {exams.map(exam => (
                    <Card key={exam.id} className="p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-bold text-slate-800">{exam.title}</h4>
                        <div className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded">
                          {exam.duration}m
                        </div>
                      </div>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <ClipboardList size={16} /> {exam.total_marks} Questions
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Clock size={16} /> Created {new Date(exam.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-indigo-600 font-mono bg-indigo-50 p-2 rounded select-all">
                          ID: {exam.id}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm"
                          onClick={() => viewResults(exam.id)}
                        >
                          <BarChart3 size={16} className="mr-2 inline" /> Results
                        </Button>
                        <Button 
                          className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                          onClick={() => startExam(exam.id)}
                        >
                          <Eye size={16} className="mr-2 inline" /> Preview
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {exams.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400">No exams created yet. Click "Create New Exam" to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Create Exam */}
          {view === 'create-exam' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <Button className="p-2 bg-slate-100 text-slate-600" onClick={() => setView('dashboard')}>
                    <ChevronRight className="rotate-180" />
                  </Button>
                  <h2 className="text-2xl font-bold">Create New Examination</h2>
                </div>
                
                <form className="space-y-8" onSubmit={createExam}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Exam Title</label>
                      <Input name="title" placeholder="e.g. Computer Science Final 2024" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Duration (minutes)</label>
                      <Input name="duration" type="number" placeholder="60" required />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-8">
                    <h3 className="text-lg font-bold mb-4">Questions ({newQuestions.length})</h3>
                    
                    {/* Question List */}
                    <div className="space-y-4 mb-8">
                      {newQuestions.map((q, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-800">{idx + 1}. {q.text}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {q.options.length} options • Correct: {q.options[q.correct]}
                            </p>
                          </div>
                          <button 
                            type="button"
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Question Form */}
                    <div className="p-6 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
                      <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Plus size={18} /> Add Question
                      </h4>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-indigo-700 uppercase">Question Text</label>
                        <Input 
                          value={currentNewQuestion.text}
                          onChange={e => setCurrentNewQuestion({ ...currentNewQuestion, text: e.target.value })}
                          placeholder="What is the capital of France?" 
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentNewQuestion.options.map((opt, i) => (
                          <div key={i} className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Option {i + 1}</label>
                            <div className="flex gap-2">
                              <Input 
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...currentNewQuestion.options];
                                  newOpts[i] = e.target.value;
                                  setCurrentNewQuestion({ ...currentNewQuestion, options: newOpts });
                                }}
                                placeholder={`Option ${i + 1}`} 
                              />
                              <button
                                type="button"
                                className={cn(
                                  "p-2 rounded-lg border-2 transition-all",
                                  currentNewQuestion.correct === i 
                                    ? "bg-emerald-500 border-emerald-500 text-white" 
                                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                )}
                                onClick={() => setCurrentNewQuestion({ ...currentNewQuestion, correct: i })}
                                title="Mark as correct"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button 
                        type="button"
                        className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={() => {
                          if (!currentNewQuestion.text || currentNewQuestion.options.some(o => !o)) {
                            alert('Please fill in question and all options');
                            return;
                          }
                          setNewQuestions([...newQuestions, currentNewQuestion]);
                          setCurrentNewQuestion({
                            text: '',
                            options: ['', '', '', ''],
                            correct: 0
                          });
                        }}
                      >
                        Add to Exam
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700 py-4 text-lg font-bold shadow-lg shadow-emerald-100">
                    Publish Examination
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {/* View Results */}
          {view === 'view-results' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <Button className="p-2 bg-slate-100 text-slate-600" onClick={() => setView('dashboard')}>
                  <ChevronRight className="rotate-180" />
                </Button>
                <h2 className="text-2xl font-bold">Examination Results</h2>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Violations</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {examResults.map(result => (
                        <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium">{result.student_name}</td>
                          <td className="px-6 py-4 text-slate-500">{result.student_id}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-indigo-600">{result.score}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-bold",
                              result.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                            )}>
                              {result.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {result.violations.length > 0 ? (
                              <span className="text-red-500 text-sm flex items-center gap-1">
                                <AlertTriangle size={14} /> {result.violations.length}
                              </span>
                            ) : (
                              <span className="text-emerald-500 text-sm">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(result.submitted_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {examResults.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                            No submissions yet for this exam.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Exam Lobby */}
          {view === 'exam-lobby' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto"
            >
              <Card className="p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Shield size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{selectedExam.title}</h2>
                  <p className="text-slate-500">Please provide your details to begin the examination.</p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Duration</div>
                      <div className="text-xl font-bold">{selectedExam.duration}m</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Questions</div>
                      <div className="text-xl font-bold">{selectedExam.questions.length}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input 
                        value={studentInfo.name} 
                        onChange={e => setStudentInfo({ ...studentInfo, name: e.target.value })}
                        placeholder="Enter your full name" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Student ID</label>
                      <Input 
                        value={studentInfo.id} 
                        onChange={e => setStudentInfo({ ...studentInfo, id: e.target.value })}
                        placeholder="Enter your ID number" 
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                      <Lock size={18} /> Security Notice
                    </h4>
                    <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                      <li>The exam will run in <b>Fullscreen Mode</b>.</li>
                      <li><b>Tab switching</b> is strictly prohibited.</li>
                      <li><b>Right-click</b> and <b>Refresh</b> are disabled.</li>
                      <li>Violations will lead to <b>Auto-termination</b>.</li>
                    </ul>
                  </div>

                  <Button 
                    className="w-full bg-indigo-600 text-white hover:bg-indigo-700 py-4 text-lg shadow-lg shadow-indigo-200"
                    disabled={!studentInfo.name || !studentInfo.id}
                    onClick={() => {
                      enterFullscreen();
                      setView('exam-active');
                    }}
                  >
                    Start Examination
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Active Exam */}
          {view === 'exam-active' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Main Exam Area */}
                <div className="flex-1 space-y-6">
                  <Card className="p-8">
                    <div className="flex justify-between items-center mb-8">
                      <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold">
                        Question {examState.currentQuestion + 1} of {selectedExam.questions.length}
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 font-mono text-xl font-bold",
                        examState.timeLeft < 60 ? "text-red-500 animate-pulse" : "text-slate-700"
                      )}>
                        <Timer size={24} /> {formatTime(examState.timeLeft)}
                      </div>
                    </div>

                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-slate-800 leading-relaxed">
                        {selectedExam.questions[examState.currentQuestion].question_text}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {selectedExam.questions[examState.currentQuestion].options.map((option: string, i: number) => (
                        <button
                          key={i}
                          className={cn(
                            "w-full p-4 text-left rounded-xl border-2 transition-all flex items-center justify-between group",
                            examState.answers[examState.currentQuestion] === i
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-100 hover:border-slate-200 bg-white"
                          )}
                          onClick={() => setExamState(prev => ({
                            ...prev,
                            answers: { ...prev.answers, [prev.currentQuestion]: i }
                          }))}
                        >
                          <span className="font-medium">{option}</span>
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            examState.answers[examState.currentQuestion] === i
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 group-hover:border-slate-300"
                          )}>
                            {examState.answers[examState.currentQuestion] === i && <CheckCircle2 size={14} />}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-between mt-10 pt-6 border-t border-slate-100">
                      <Button 
                        className="bg-slate-100 text-slate-600 disabled:opacity-30"
                        disabled={examState.currentQuestion === 0}
                        onClick={() => setExamState(prev => ({ ...prev, currentQuestion: prev.currentQuestion - 1 }))}
                      >
                        Previous
                      </Button>
                      
                      {examState.currentQuestion === selectedExam.questions.length - 1 ? (
                        <Button 
                          className="bg-emerald-600 text-white hover:bg-emerald-700 px-8"
                          onClick={() => submitExam(examState.answers, examState.violations, 'Completed')}
                        >
                          Submit Exam
                        </Button>
                      ) : (
                        <Button 
                          className="bg-indigo-600 text-white hover:bg-indigo-700 px-8"
                          onClick={() => setExamState(prev => ({ ...prev, currentQuestion: prev.currentQuestion + 1 }))}
                        >
                          Next Question
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Sidebar Monitor */}
                <div className="w-full md:w-72 space-y-4">
                  <Card className="p-4 bg-white">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Proctoring Monitor</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Status</span>
                        <span className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={14} /> Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Violations</span>
                        <span className={cn(
                          "text-sm font-bold",
                          examState.violations.length > 0 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {examState.violations.length}
                        </span>
                      </div>
                    </div>
                    
                    {examState.violations.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                        <div className="text-xs font-bold text-red-600 mb-1">Recent Violation:</div>
                        <div className="text-xs text-red-500">{examState.violations[examState.violations.length - 1]}</div>
                      </div>
                    )}
                  </Card>

                  <Card className="p-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Progress</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedExam.questions.map((_: any, i: number) => (
                        <div 
                          key={i}
                          className={cn(
                            "h-8 rounded flex items-center justify-center text-xs font-bold transition-all",
                            examState.currentQuestion === i ? "ring-2 ring-indigo-500 ring-offset-1" : "",
                            examState.answers[i] !== undefined ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                          )}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {/* Exam Result (Student View) */}
          {view === 'exam-result' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto"
            >
              <Card className="p-8 text-center">
                {selectedExam.result.status === 'Terminated' ? (
                  <>
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-red-600 mb-2">Exam Terminated</h2>
                    <p className="text-slate-600 mb-8">
                      Your examination was automatically terminated due to multiple security violations. 
                      Please contact your examiner for further instructions.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Submission Successful</h2>
                    <p className="text-slate-600 mb-8">
                      Thank you, <b>{studentInfo.name}</b>. Your answers have been securely recorded and evaluated.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Your Score</div>
                        <div className="text-4xl font-black text-indigo-600">{selectedExam.result.score}</div>
                        <div className="text-sm text-slate-500 mt-1">out of {selectedExam.result.total}</div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Percentage</div>
                        <div className="text-4xl font-black text-indigo-600">
                          {Math.round((selectedExam.result.score / selectedExam.result.total) * 100)}%
                        </div>
                        <div className="text-sm text-slate-500 mt-1">Accuracy</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3">
                  <Button 
                    className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen();
                      setView('landing');
                    }}
                  >
                    Return to Home
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      {view !== 'exam-active' && (
        <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 mt-20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 opacity-50">
              <Shield size={20} />
              <span className="font-bold">IntegrityShield</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-500 font-medium">
              <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Security Audit</a>
            </div>
            <p className="text-sm text-slate-400">© 2024 IntegrityShield. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
}

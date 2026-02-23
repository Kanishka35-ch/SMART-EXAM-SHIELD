import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("exam_system.db");
const JWT_SECRET = process.env.JWT_SECRET || "integrity-shield-secret-key";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS examiners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    examiner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    duration INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (examiner_id) REFERENCES examiners(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON string
    correct_option INTEGER NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    exam_id TEXT NOT NULL,
    answers TEXT, -- JSON string
    score INTEGER,
    status TEXT DEFAULT 'In Progress', -- 'Completed', 'Terminated'
    violations TEXT, -- JSON string
    submitted_at DATETIME,
    FOREIGN KEY (exam_id) REFERENCES exams(id)
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- Examiner Routes ---
  app.post("/api/examiner/register", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    try {
      db.prepare("INSERT INTO examiners (id, name, email, password) VALUES (?, ?, ?, ?)").run(id, name, email, hashedPassword);
      res.status(201).json({ message: "Examiner registered" });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/examiner/login", async (req, res) => {
    const { email, password } = req.body;
    const examiner = db.prepare("SELECT * FROM examiners WHERE email = ?").get(email) as any;
    if (examiner && await bcrypt.compare(password, examiner.password)) {
      const token = jwt.sign({ id: examiner.id, email: examiner.email, name: examiner.name }, JWT_SECRET);
      res.json({ token, user: { id: examiner.id, name: examiner.name, email: examiner.email } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // --- Exam Management ---
  app.post("/api/exam/create", authenticateToken, (req: any, res) => {
    const { title, duration, questions } = req.body;
    const examId = crypto.randomUUID();
    const totalMarks = questions.length;

    const insertExam = db.prepare("INSERT INTO exams (id, examiner_id, title, duration, total_marks) VALUES (?, ?, ?, ?, ?)");
    const insertQuestion = db.prepare("INSERT INTO questions (id, exam_id, question_text, options, correct_option) VALUES (?, ?, ?, ?, ?)");

    const transaction = db.transaction((examData, questionsData) => {
      insertExam.run(examData.id, examData.examiner_id, examData.title, examData.duration, examData.total_marks);
      for (const q of questionsData) {
        insertQuestion.run(crypto.randomUUID(), examData.id, q.text, JSON.stringify(q.options), q.correct);
      }
    });

    transaction({ id: examId, examiner_id: req.user.id, title, duration, total_marks: totalMarks }, questions);
    res.status(201).json({ examId });
  });

  app.get("/api/exams", authenticateToken, (req: any, res) => {
    const exams = db.prepare("SELECT * FROM exams WHERE examiner_id = ?").all(req.user.id);
    res.json(exams);
  });

  app.get("/api/exam/:id/results", authenticateToken, (req: any, res) => {
    const results = db.prepare("SELECT * FROM attempts WHERE exam_id = ?").all(req.params.id);
    res.json(results.map((r: any) => ({
      ...r,
      answers: JSON.parse(r.answers || "[]"),
      violations: JSON.parse(r.violations || "[]")
    })));
  });

  // --- Student Routes ---
  app.get("/api/exam/public/:id", (req, res) => {
    const exam = db.prepare("SELECT id, title, duration, total_marks FROM exams WHERE id = ?").get(req.params.id) as any;
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    
    const questions = db.prepare("SELECT id, question_text, options FROM questions WHERE exam_id = ?").all(req.params.id);
    res.json({
      ...exam,
      questions: questions.map((q: any) => ({
        ...q,
        options: JSON.parse(q.options)
      }))
    });
  });

  app.post("/api/exam/submit", (req, res) => {
    const { examId, studentName, studentId, answers, violations, status } = req.body;
    const attemptId = crypto.randomUUID();
    
    // Evaluate score
    const questions = db.prepare("SELECT id, correct_option FROM questions WHERE exam_id = ?").all(examId) as any[];
    let score = 0;
    const studentAnswers = answers || {};
    
    questions.forEach((q, index) => {
      if (studentAnswers[index] === q.correct_option) {
        score++;
      }
    });

    db.prepare(`
      INSERT INTO attempts (id, student_name, student_id, exam_id, answers, score, status, violations, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      attemptId,
      studentName,
      studentId,
      examId,
      JSON.stringify(answers),
      score,
      status || 'Completed',
      JSON.stringify(violations || []),
    );

    res.json({ attemptId, score, total: questions.length });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

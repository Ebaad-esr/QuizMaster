/*
================================================================================
  Unified Quiz Server - All-in-One LOCAL Node.js File
================================================================================
  MODEL: Self-Hosted with Multi-File SQLite Database & Multi-Host System

  --- HOW TO RUN ---
  1. Create a folder and place all the project files inside.
  2. Open your terminal in that folder.
  3. Run this command once to install all dependencies:
     npm install
  4. The server will automatically create `public/uploads` and `databases` folders.
  5. Start the server by running:
     npm start
  6. Open your browser to the following pages:
     - Home Page: http://localhost:3000
     - Player Page: http://localhost:3000/player
     - Host Login: http://localhost:3000/host
     - Super Admin Login: http://localhost:3000/admin (Password: 'admin')
  
================================================================================
*/

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = '3gbup38id9'; // Super Admin password
const SALT_ROUNDS = 10;

// --- DIRECTORY SETUP ---
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const dbDir = path.join(__dirname, 'databases');
[publicDir, uploadsDir, dbDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- FILE UPLOAD SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- DATABASE CONNECTION MANAGEMENT ---
const masterDb = new Database(path.join(dbDir, 'master.db'));
masterDb.exec(`CREATE TABLE IF NOT EXISTS hosts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, db_path TEXT NOT NULL UNIQUE);`);

const dbConnections = new Map();

function getHostDb(hostId) {
    if (dbConnections.has(hostId)) {
        return dbConnections.get(hostId);
    }
    const host = masterDb.prepare('SELECT db_path FROM hosts WHERE id = ?').get(hostId);
    if (!host) throw new Error('Host not found');
    
    const dbPath = path.join(__dirname, host.db_path);
    const hostDb = new Database(dbPath);
    hostDb.pragma('foreign_keys = ON');
    hostDb.exec(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL, 
            status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
            UNIQUE(name)
        );
        CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL, text TEXT NOT NULL, options TEXT NOT NULL, correctOptionIndex INTEGER NOT NULL, timeLimit INTEGER NOT NULL, score INTEGER NOT NULL, negativeScore INTEGER NOT NULL, imageUrl TEXT, FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL, name TEXT NOT NULL, branch TEXT, year TEXT, score INTEGER NOT NULL, finishTime INTEGER, UNIQUE(quiz_id, name));
    `);
    dbConnections.set(hostId, hostDb);
    return hostDb;
}

// --- IN-MEMORY STATE ---
let quizState = { status: 'waiting', hostId: null, quizId: null, quizName: '', questions: [] };
const players = new Map();

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- EXPRESS ROUTES ---
// Serve static files from 'public' directory (for images, css, client-side js)
app.use(express.static(publicDir));

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/player', (req, res) => res.sendFile(path.join(publicDir, 'player.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'admin-dashboard.html')));
app.get('/host', (req, res) => res.sendFile(path.join(publicDir, 'host.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
app.get('/leaderboard', (req, res) => res.sendFile(path.join(publicDir, 'leaderboard.html')));


// --- SUPER ADMIN API ---
const superAdminAuth = (req, res, next) => {
    if (req.headers.authorization !== ADMIN_PASSWORD) return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
};
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true, token: ADMIN_PASSWORD });
    else res.json({ success: false, message: 'Invalid password' });
});
app.post('/api/admin/hosts', superAdminAuth, (req, res) => {
    const hosts = masterDb.prepare('SELECT id, email FROM hosts').all();
    res.json({ success: true, hosts });
});
app.post('/api/admin/add-host', superAdminAuth, (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
        const hash = bcrypt.hashSync(password, SALT_ROUNDS);
        const info = masterDb.prepare('INSERT INTO hosts (email, password, db_path) VALUES (?, ?, ?)')
            .run(email, hash, `databases/host_${Date.now()}.db`);
        getHostDb(info.lastInsertRowid); // This initializes the new DB file
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: 'Email already exists.' }); }
});
app.post('/api/admin/delete-host', superAdminAuth, (req, res) => {
    const host = masterDb.prepare('SELECT * FROM hosts WHERE id = ?').get(req.body.hostId);
    if (host) {
        fs.unlink(path.join(__dirname, host.db_path), (err) => {
            if (err) console.error("Error deleting host DB file:", err);
        });
        masterDb.prepare('DELETE FROM hosts WHERE id = ?').run(req.body.hostId);
    }
    res.json({ success: true });
});

// --- HOST API ---
const hostAuthMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization;
        const host = masterDb.prepare('SELECT id FROM hosts WHERE id = ?').get(token); // Simple token auth
        if (!host) return res.status(403).json({ success: false, message: 'Forbidden' });
        req.hostId = host.id;
        req.db = getHostDb(host.id);
        next();
    } catch (e) { res.status(403).json({ success: false, message: 'Forbidden' }); }
};
app.post('/api/host/login', (req, res) => {
    const { email, password } = req.body;
    const host = masterDb.prepare('SELECT * FROM hosts WHERE email = ?').get(email);
    if (host && bcrypt.compareSync(password, host.password)) {
        res.json({ success: true, token: host.id });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});
app.post('/api/host/quizzes', hostAuthMiddleware, (req, res) => {
    const quizzes = req.db.prepare('SELECT * FROM quizzes ORDER BY id DESC').all();
    res.json({ success: true, quizzes });
});
app.post('/api/host/create-quiz', hostAuthMiddleware, (req, res) => {
    try {
        const { name } = req.body;
        const info = req.db.prepare('INSERT INTO quizzes (name) VALUES (?)').run(name);
        res.json({ success: true, quizId: info.lastInsertRowid });
    } catch (e) { res.status(500).json({ success: false, message: 'A quiz with this name already exists.' }); }
});
app.post('/api/host/delete-quiz', hostAuthMiddleware, (req, res) => {
    req.db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.body.quizId);
    res.json({ success: true });
});
app.post('/api/host/quiz-details', hostAuthMiddleware, (req, res) => {
    const { quizId } = req.body;
    const quiz = req.db.prepare('SELECT status FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found'});

    const questions = req.db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC').all(quizId);
    const playerCount = (quizState.quizId === parseInt(quizId) && quizState.hostId === req.hostId) ? players.size : 0;
    
    res.json({ success: true, details: { status: quiz.status, playerCount, questions }});
});
app.post('/api/host/add-question', hostAuthMiddleware, upload.single('questionImage'), (req, res) => {
    try {
        const { quizId, text, options, correctOptionIndex, timeLimit, score, negativeScore } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const parsedOptions = options.split(',').map(s => s.trim());
        const stmt = req.db.prepare('INSERT INTO questions (quiz_id, text, options, correctOptionIndex, timeLimit, score, negativeScore, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        stmt.run(quizId, text, JSON.stringify(parsedOptions), correctOptionIndex, timeLimit, score, negativeScore, imageUrl);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.post('/api/host/delete-question', hostAuthMiddleware, (req, res) => {
    const question = req.db.prepare('SELECT imageUrl FROM questions WHERE id = ?').get(req.body.id);
    if (question && question.imageUrl) {
        const imagePath = path.join(__dirname, 'public', question.imageUrl);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
    req.db.prepare('DELETE FROM questions WHERE id = ?').run(req.body.id);
    res.json({ success: true });
});
app.post('/api/host/start-quiz', hostAuthMiddleware, (req, res) => {
    // Ensure no other quizzes are active globally
    if (quizState.status === 'active') return res.json({ success: false, message: 'Another quiz is already active on the server.'});
    
    const { quizId } = req.body;
    
    // Ensure this host has no other quizzes marked as active
    req.db.prepare("UPDATE quizzes SET status = 'waiting'").run();
    req.db.prepare("UPDATE quizzes SET status = 'active' WHERE id = ?").run(quizId);
    
    const quiz = req.db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) return res.json({ success: false, message: 'Quiz not found.' });

    quizState.questions = req.db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC').all(quizId);
    if (quizState.questions.length === 0) return res.json({ success: false, message: 'This quiz has no questions.'});
    
    quizState.status = 'active';
    quizState.hostId = req.hostId;
    quizState.quizId = quizId;
    quizState.quizName = quiz.name;
    req.db.prepare('DELETE FROM results WHERE quiz_id = ?').run(quizId);
    
    players.forEach(p => { p.score = 0; p.answers = {}; p.questionIndex = -1; });
    io.emit('quizStarted', { quizName: quiz.name });
    io.emit('leaderboardUpdate', { results: [], quizName: quiz.name });
    res.json({ success: true });
});
app.post('/api/host/end-quiz', hostAuthMiddleware, (req, res) => {
    if (quizState.status !== 'active' || quizState.hostId !== req.hostId) {
        return res.json({ success: false, message: 'No active quiz for this host.'});
    }
    endQuiz();
    res.json({ success: true });
});

// ** BUG FIX **
// This route now uses hostAuthMiddleware to get the correct host database.
app.get('/api/host/results', hostAuthMiddleware, (req, res) => {
    try {
        const { quizId } = req.query;
        if (!quizId) return res.status(400).send("quizId is required.");
        
        // The host's DB is now correctly identified from the middleware
        const results = req.db.prepare('SELECT name, branch, year, score FROM results WHERE quiz_id = ? ORDER BY score DESC').all(quizId);
        
        let csv = 'Name,Branch,Year,Score\n';
        results.forEach(r => { csv += `${r.name},${r.branch || ''},${r.year || ''},${r.score}\n`; });
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`quiz_${quizId}_results.csv`);
        res.send(csv);
    } catch(e) { 
        console.error("Error generating results:", e);
        res.status(500).send("Error generating results"); 
    }
});

// --- QUIZ LOGIC ---
function endQuiz() {
    if (quizState.status !== 'active') return;

    const hostDb = getHostDb(quizState.hostId);
    hostDb.prepare("UPDATE quizzes SET status = 'waiting' WHERE id = ?").run(quizState.quizId);

    quizState.status = 'finished'; // temporary state for players
    players.forEach((player, socketId) => io.to(socketId).emit('quizFinished', { score: player.score }));
    
    quizState.status = 'waiting';
    quizState.quizId = null;
    quizState.hostId = null;
}
io.on('connection', (socket) => {
    socket.emit('quizState', { status: quizState.status, quizName: quizState.quizName });
    io.emit('playerCount', players.size);
    socket.on('join', (playerData) => {
        if (quizState.status === 'active') return socket.emit('error', { message: 'Quiz is already in progress.' });
        players.set(socket.id, { ...playerData, score: 0, answers: {}, questionIndex: -1 });
        io.emit('playerCount', players.size);
        socket.emit('joined', { name: playerData.name });
    });
    socket.on('requestNextQuestion', () => {
        const player = players.get(socket.id);
        if (!player || quizState.status !== 'active') return;
        player.questionIndex++;
        if (player.questionIndex >= quizState.questions.length) {
            socket.emit('quizFinished', { score: player.score });
        } else {
            const question = quizState.questions[player.questionIndex];
            socket.emit('question', { question, index: player.questionIndex });
        }
    });
    socket.on('submitAnswer', ({ optionIndex }) => {
        const player = players.get(socket.id);
        if (!player || !quizState.questions[player.questionIndex]) return;
        const question = quizState.questions[player.questionIndex];
        if (player.answers[question.id] !== undefined) return;
        
        let scoreChange = 0;
        const isCorrect = optionIndex === question.correctOptionIndex;
        if (optionIndex === null) { scoreChange = -question.negativeScore; } 
        else if (isCorrect) { scoreChange = question.score; } 
        else { scoreChange = -question.negativeScore; }
        player.score += scoreChange;
        player.answers[question.id] = optionIndex;
        socket.emit('answerResult', { isCorrect, scoreChange, correctOptionIndex: question.correctOptionIndex, selectedOptionIndex: optionIndex, score: player.score });
        
        const hostDb = getHostDb(quizState.hostId);
        const stmt = hostDb.prepare('INSERT INTO results (quiz_id, name, branch, year, score, finishTime) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(quiz_id, name) DO UPDATE SET score=excluded.score, finishTime=excluded.finishTime');
        stmt.run(quizState.quizId, player.name, player.branch, player.year, player.score, Date.now());
        io.emit('leaderboardUpdate', { results: getLeaderboard(), quizName: quizState.quizName });
    });
    socket.on('getLeaderboard', () => socket.emit('leaderboardUpdate', { results: getLeaderboard(), quizName: quizState.quizName }));
    socket.on('disconnect', () => { players.delete(socket.id); io.emit('playerCount', players.size); });
});

function getLeaderboard() {
    if (!quizState.hostId || !quizState.quizId) return [];
    const hostDb = getHostDb(quizState.hostId);
    return hostDb.prepare('SELECT name, score FROM results WHERE quiz_id = ? ORDER BY score DESC, finishTime ASC LIMIT 20').all(quizState.quizId);
}

server.listen(PORT, () => {
    console.log(`🚀 Quiz server running locally at http://localhost:${PORT}`);
    console.log(`   Player Page: http://localhost:${PORT}/player`);
    console.log(`   Host Login:  http://localhost:${PORT}/host`);
    console.log(`   Admin Login: http://localhost:${PORT}/admin (Password: 'admin')`);
});
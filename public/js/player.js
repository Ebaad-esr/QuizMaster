const socket = io();

const ui = {
    joinPage: document.getElementById("join-page"),
    waitingPage: document.getElementById("waiting-page"),
    quizPage: document.getElementById("quiz-page"),
    finishedPage: document.getElementById("finished-page"),
    joinError: document.getElementById("join-error"),
    welcomeMessage: document.getElementById("welcome-message"),
    quizTitle: document.getElementById("quiz-title-display"),
    questionText: document.getElementById("question-text"),
    questionImage: document.getElementById("question-image"),
    optionsContainer: document.getElementById("options-container"),
    timerDisplay: document.getElementById("timer-display"),
    questionScoreDisplay: document.getElementById("question-score-display"),
    scoreDisplay: document.getElementById("score-display"),
    feedbackContainer: document.getElementById("feedback-container"),
    feedbackText: document.getElementById("feedback-text"),
    feedbackScore: document.getElementById("feedback-score"),
    nextQuestionBtn: document.getElementById("next-question-btn"),
    finalScore: document.getElementById("final-score"),
    playerCount: document.getElementById("player-count-display")
};

let timerInterval;

function showPage(pageId) {
    ["join-page", "waiting-page", "quiz-page", "finished-page"].forEach(id => {
        document.getElementById(id).classList.add("hide");
    });
    document.getElementById(pageId).classList.remove("hide");
}

// ** UPDATED JOIN FORM LISTENER **
document.getElementById("join-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("name-input").value.trim();
    const joinCode = document.getElementById("joincode-input").value.trim().toUpperCase();
    const branch = document.getElementById("branch-input").value.trim();
    const year = document.getElementById("year-input").value.trim();
    
    if (name && joinCode) {
        socket.emit("join", { name, branch, year, joinCode });
    }
});

ui.nextQuestionBtn.addEventListener("click", () => socket.emit("requestNextQuestion"));

// ** NOTE: The 'joined' event is no longer used by the server **
socket.on("joined", ({ name }) => {
    ui.welcomeMessage.textContent = `Welcome, ${name}!`;
    showPage("waiting-page");
});

socket.on("quizState", state => {
    ui.quizTitle.textContent = state.quizName || "QuizMaster Pro";
    if (state.status === "active") {
        // This message is no longer accurate, but we'll leave it
    }
});

socket.on("playerCount", count => {
    ui.playerCount.textContent = `Players: ${count}`;
});

socket.on("error", ({ message }) => {
    ui.joinError.textContent = message;
    ui.joinError.classList.remove("hide");
});

socket.on("quizStarted", state => {
    ui.quizTitle.textContent = state.quizName;
    showPage("quiz-page");
    socket.emit("requestNextQuestion");
});

socket.on("question", ({ question, index }) => {
    ui.feedbackContainer.classList.add("hide");
    ui.nextQuestionBtn.classList.add("hide");
    ui.questionText.textContent = `${index + 1}. ${question.text}`;
    ui.questionScoreDisplay.textContent = `Points: ${question.score} / -${question.negativeScore}`;

    if (question.imageUrl) {
        ui.questionImage.src = question.imageUrl;
        ui.questionImage.classList.remove("hide");
    } else {
        ui.questionImage.src = "";
        ui.questionImage.classList.add("hide");
    }

    ui.optionsContainer.innerHTML = "";
    JSON.parse(question.options).forEach((optionText, optionIndex) => {
        const button = document.createElement("button");
        button.className = "p-4 rounded-lg text-left text-lg font-semibold transition-all duration-300 border-2 bg-black/20 border-transparent hover:bg-purple-600/50 hover:border-purple-500";
        button.textContent = optionText;
        button.onclick = () => submitAnswer(optionIndex);
        ui.optionsContainer.appendChild(button);
    });

    clearInterval(timerInterval);
    let timeLeft = question.timeLimit;
    ui.timerDisplay.textContent = `${timeLeft}s`;
    timerInterval = setInterval(() => {
        timeLeft--;
        ui.timerDisplay.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAnswer(null);
        }
    }, 1000);
});

socket.on("answerResult", ({ isCorrect, scoreChange, correctOptionIndex, selectedOptionIndex, score }) => {
    ui.scoreDisplay.textContent = score;
    ui.feedbackContainer.classList.remove("hide");
    ui.nextQuestionBtn.classList.remove("hide");

    ui.feedbackText.textContent = isCorrect ? "Correct!" : "Wrong!";
    ui.feedbackText.className = isCorrect ? "text-2xl font-bold text-green-400" : "text-2xl font-bold text-red-400";
    ui.feedbackScore.textContent = `Score change: ${scoreChange > 0 ? "+" : ""}${scoreChange}`;

    const buttons = ui.optionsContainer.querySelectorAll("button");
    buttons.forEach((button, index) => {
        let baseClass = "p-4 rounded-lg text-left text-lg font-semibold border-2 ";
        if (index === correctOptionIndex) {
            button.className = baseClass + "bg-green-600/80 border-transparent";
        } else if (index === selectedOptionIndex) {
            button.className = baseClass + "bg-red-600/80 border-transparent";
        } else {
            button.className = baseClass + "bg-black/20 opacity-60 border-transparent";
        }
        button.style.boxShadow = (index === selectedOptionIndex) ? "0 0 0 3px #FBBF24" : "none";
    });
});

socket.on("quizFinished", ({ score }) => {
    ui.finalScore.textContent = score;
    showPage("finished-page");
});

// ** UPDATED - TIMER NO LONGER CLEARED **
function submitAnswer(optionIndex) {
    // clearInterval(timerInterval); // <-- This line is removed
    ui.optionsContainer.querySelectorAll("button").forEach(btn => btn.disabled = true);
    socket.emit("submitAnswer", { optionIndex });
}

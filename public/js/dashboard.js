const ui = {
    quizListView: document.getElementById("quiz-list-view"),
    quizDetailView: document.getElementById("quiz-detail-view"),
    createQuizForm: document.getElementById("create-quiz-form"),
    quizListTable: document.getElementById("quiz-list-table"),
    quizDetailTitle: document.getElementById("quiz-detail-title"),
    backToListBtn: document.getElementById("back-to-list-btn"),
    statusDisplay: document.getElementById("status-display"),
    playersDisplay: document.getElementById("players-display"),
    joinCodeDisplay: document.getElementById("join-code-display"),
    questionsCount: document.getElementById("questions-count-display"),
    startBtn: document.getElementById("start-btn"),
    launchBtn: document.getElementById("launch-btn"), // <-- ADDED
    endBtn: document.getElementById("end-btn"),
    resultsBtn: document.getElementById("results-btn"),
    questionsTable: document.getElementById("questions-table"),
    questionForm: document.getElementById("question-form"),
    logoutBtnList: document.getElementById("logout-btn-list"),
    logoutBtnDetail: document.getElementById("logout-btn-detail")
};

let hostToken = sessionStorage.getItem("host-token");
let currentQuizId = null;
let refreshInterval;

function showView(viewName) {
    ["quizListView", "quizDetailView"].forEach(v => ui[v].classList.add("hide"));
    ui[viewName].classList.remove("hide");
}

async function api(endpoint, body) {
    const headers = { "Content-Type": "application/json" };
    if (hostToken) {
        headers.Authorization = hostToken;
    }
    const response = await fetch(`/api/host/${endpoint}`, {
        method: "POST",
        headers: headers, 
        body: JSON.stringify(body)
    });
    return await response.json();
}

function logout() {
    sessionStorage.removeItem("host-token");
    window.location.href = "/host";
}

async function showQuizList() {
    showView("quizListView");
    const result = await api("quizzes");
    if (result.success) {
        ui.quizListTable.innerHTML = result.quizzes.map(quiz => `
            <tr class="border-b">
                <td class="p-3 font-bold">#${quiz.id}</td>
                <td class="p-3">${quiz.name}</td>
                <td class="p-3">
                    <button class="text-blue-500 font-semibold mr-4" onclick="showQuizDetail(${quiz.id},'${quiz.name}')">Manage</button>
                    <button class="text-red-500 font-semibold" onclick="deleteQuiz(${quiz.id})">Delete</button>
                </td>
            </tr>
        `).join("");
    }
}

async function showQuizDetail(quizId, quizName) {
    currentQuizId = quizId;
    ui.quizDetailTitle.textContent = quizName;
    ui.resultsBtn.dataset.quizId = quizId; 
    showView("quizDetailView");
    await refreshQuizDetail();
    clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshQuizDetail, 5000);
}

async function refreshQuizDetail() {
    if (!hostToken || currentQuizId === null) return;
    const result = await api("quiz-details", { quizId: currentQuizId });
    if (result.success) {
        const { status, playerCount, questions, joinCode } = result.details;
        
        let statusText = status.charAt(0).toUpperCase() + status.slice(1);
        if (status === 'waiting') {
            statusText = 'Waiting (In Lobby)';
        }
        
        ui.statusDisplay.textContent = statusText;
        ui.playersDisplay.textContent = playerCount;
        ui.questionsCount.textContent = questions.length;
        ui.joinCodeDisplay.textContent = joinCode || "-";
        
        // ** NEW BUTTON LOGIC **
        // status can be 'finished', 'waiting', 'active'
        ui.startBtn.disabled = (status === 'waiting' || status === 'active'); // Can only prepare if 'finished'
        ui.launchBtn.disabled = (status !== 'waiting'); // Can only launch if 'waiting' (in lobby)
        ui.endBtn.disabled = (status === 'finished'); // Can end if 'waiting' or 'active'

        ui.questionsTable.innerHTML = questions.map(q => `
            <tr class="border-b">
                <td class="p-3">#${q.id}</td>
                <td class="p-3">${q.text}</td>
                <td class="p-3">${q.imageUrl ? '<img src="'+q.imageUrl+'" class="h-10 w-10 object-cover">' : "No Image"}</td>
                <td class="p-3">
                    <button class="text-red-500 font-semibold" onclick="deleteQuestion(${q.id})">Delete</button>
                </td>
            </tr>
        `).join("");
    }
}

ui.logoutBtnList.addEventListener("click", logout);
ui.logoutBtnDetail.addEventListener("click", logout);
ui.backToListBtn.addEventListener("click", () => {
    clearInterval(refreshInterval);
    showQuizList();
});

ui.createQuizForm.addEventListener("submit", async e => {
    e.preventDefault();
    const result = await api("create-quiz", { name: e.target.name.value });
    if (result.success) {
        e.target.reset();
        showQuizList();
    } else {
        alert(result.message);
    }
});

ui.questionForm.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append("quizId", currentQuizId);

    const response = await fetch("/api/host/add-question", {
        method: "POST",
        headers: { Authorization: hostToken },
        body: formData
    });
    const result = await response.json();
    if (result.success) {
        e.target.reset();
        refreshQuizDetail();
    } else {
        alert(result.message);
    }
});

// "Prepare Quiz"
ui.startBtn.addEventListener("click", async () => {
    await api("start-quiz", { quizId: currentQuizId });
    refreshQuizDetail();
});

// "Launch Quiz" (NEW)
ui.launchBtn.addEventListener("click", async () => {
    await api("launch-quiz", { quizId: currentQuizId });
    refreshQuizDetail();
});

// "End Quiz"
ui.endBtn.addEventListener("click", async () => {
    await api("end-quiz");
    refreshQuizDetail();
});

ui.resultsBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const quizId = ui.resultsBtn.dataset.quizId;
    if (!quizId) return;

    const response = await fetch(`/api/host/results?quizId=${quizId}`, {
        method: 'GET',
        headers: { 'Authorization': hostToken }
    });

    if (response.ok) {
        const blob = await response.blob();
        const filename = `quiz_${quizId}_results_detailed.csv`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } else {
        alert('Failed to download results.');
    }
});


async function deleteQuiz(quizId) {
    if (confirm("Delete this quiz and all its questions?")) {
        const result = await api("delete-quiz", { quizId });
        if (result.success) showQuizList();
    }
}

async function deleteQuestion(questionId) {
    if (confirm("Delete this question?")) {
        const result = await api("delete-question", { id: questionId });
        if (result.success) refreshQuizDetail();
    }
}

if (hostToken) {
    showQuizList();
} else {
    window.location.href = "/host";
}

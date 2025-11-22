const ui = {
    quizListView: document.getElementById("quiz-list-view"), quizDetailView: document.getElementById("quiz-detail-view"),
    createQuizForm: document.getElementById("create-quiz-form"), quizListTable: document.getElementById("quiz-list-table"),
    quizDetailTitle: document.getElementById("quiz-detail-title"), backToListBtn: document.getElementById("back-to-list-btn"),
    statusDisplay: document.getElementById("status-display"), playersDisplay: document.getElementById("players-display"),
    joinCodeDisplay: document.getElementById("join-code-display"), questionsCount: document.getElementById("questions-count-display"),
    startBtn: document.getElementById("start-btn"), launchBtn: document.getElementById("launch-btn"), endBtn: document.getElementById("end-btn"),
    resultsBtn: document.getElementById("results-btn"), questionsTable: document.getElementById("questions-table"),
    questionForm: document.getElementById("question-form"), logoutBtnList: document.getElementById("logout-btn-list"), logoutBtnDetail: document.getElementById("logout-btn-detail")
};
let hostToken = sessionStorage.getItem("host-token"), currentQuizId = null, refreshInterval;

function showView(view) { ["quizListView", "quizDetailView"].forEach(v => ui[v].classList.add("hide")); ui[view].classList.remove("hide"); }
async function api(ep, body) {
    const headers = { "Content-Type": "application/json" };
    if (hostToken) headers.Authorization = hostToken;
    return await (await fetch(`/api/host/${ep}`, { method: "POST", headers, body: JSON.stringify(body) })).json();
}
function logout() { sessionStorage.removeItem("host-token"); window.location.href = "/host"; }

async function showQuizList() {
    showView("quizListView");
    const res = await api("quizzes");
    if (res.success) ui.quizListTable.innerHTML = res.quizzes.map(q => `<tr class="border-b"><td class="p-3 font-bold">#${q.id}</td><td class="p-3">${q.name}</td><td class="p-3"><button class="text-blue-500 font-semibold mr-4" onclick="showQuizDetail(${q.id},'${q.name}')">Manage</button><button class="text-red-500 font-semibold" onclick="deleteQuiz(${q.id})">Delete</button></td></tr>`).join("");
}
async function showQuizDetail(id, name) {
    currentQuizId = id; ui.quizDetailTitle.textContent = name; ui.resultsBtn.dataset.quizId = id;
    showView("quizDetailView"); await refreshQuizDetail();
    clearInterval(refreshInterval); refreshInterval = setInterval(refreshQuizDetail, 5000);
}
async function refreshQuizDetail() {
    if (!hostToken || currentQuizId === null) return;
    const res = await api("quiz-details", { quizId: currentQuizId });
    if (res.success) {
        const { status, playerCount, questions, joinCode } = res.details;
        ui.statusDisplay.textContent = status === 'waiting' ? 'Waiting (In Lobby)' : status.charAt(0).toUpperCase() + status.slice(1);
        ui.playersDisplay.textContent = playerCount; ui.questionsCount.textContent = questions.length;
        ui.joinCodeDisplay.textContent = joinCode || "-";
        ui.startBtn.disabled = status !== 'finished'; ui.launchBtn.disabled = status !== 'waiting'; ui.endBtn.disabled = status === 'finished';
        ui.questionsTable.innerHTML = questions.map(q => `<tr class="border-b"><td class="p-3">#${q.id}</td><td class="p-3">${q.text}</td><td class="p-3">${q.imageUrl ? '<img src="'+q.imageUrl+'" class="h-10 w-10 object-cover">' : "No Image"}</td><td class="p-3"><button class="text-red-500 font-semibold" onclick="deleteQuestion(${q.id})">Delete</button></td></tr>`).join("");
    }
}
ui.createQuizForm.addEventListener("submit", async e => { e.preventDefault(); if ((await api("create-quiz", { name: e.target.name.value })).success) { e.target.reset(); showQuizList(); } else alert("Error"); });
ui.questionForm.addEventListener("submit", async e => {
    e.preventDefault(); const fd = new FormData(e.target); fd.append("quizId", currentQuizId);
    if ((await (await fetch("/api/host/add-question", { method: "POST", headers: { Authorization: hostToken }, body: fd })).json()).success) { e.target.reset(); refreshQuizDetail(); } else alert("Error");
});
ui.startBtn.addEventListener("click", async () => { const res = await api("start-quiz", { quizId: currentQuizId }); if (!res.success) alert(res.message); refreshQuizDetail(); });
ui.launchBtn.addEventListener("click", async () => { await api("launch-quiz", { quizId: currentQuizId }); refreshQuizDetail(); });
ui.endBtn.addEventListener("click", async () => { await api("end-quiz"); refreshQuizDetail(); });
ui.resultsBtn.addEventListener('click', async e => {
    e.preventDefault(); const qId = ui.resultsBtn.dataset.quizId;
    const res = await fetch(`/api/host/results?quizId=${qId}`, { method: 'GET', headers: { 'Authorization': hostToken } });
    if (res.ok) { const a = document.createElement('a'); a.href = window.URL.createObjectURL(await res.blob()); a.download = `quiz_${qId}_results.csv`; a.click(); } else alert('Failed');
});
async function deleteQuiz(id) { if (confirm("Delete?")) if ((await api("delete-quiz", { quizId: id })).success) showQuizList(); }
async function deleteQuestion(id) { if (confirm("Delete?")) if ((await api("delete-question", { id })).success) refreshQuizDetail(); }
ui.logoutBtnList.addEventListener("click", logout); ui.logoutBtnDetail.addEventListener("click", logout); ui.backToListBtn.addEventListener("click", () => { clearInterval(refreshInterval); showQuizList(); });
hostToken ? showQuizList() : window.location.href = "/host";

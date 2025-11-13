const socket = io();
const leaderboardBody = document.getElementById("leaderboard-body");
const quizNameEl = document.getElementById("leaderboard-quiz-name");

socket.on("connect", () => socket.emit("getLeaderboard"));

socket.on("leaderboardUpdate", ({ results, quizName }) => {
    quizNameEl.textContent = quizName;
    const rankColors = ["text-yellow-400", "text-gray-300", "text-yellow-600"];
    
    leaderboardBody.innerHTML = results.map((r, index) => `
        <tr class="border-b border-gray-700">
            <td class="p-4 text-2xl font-bold ${rankColors[index] || ""}">${index + 1}</td>
            <td class="p-4 text-xl">${r.name}</td>
            <td class="p-4 text-xl font-bold text-purple-400">${r.score}</td>
        </tr>
    `).join("");
});
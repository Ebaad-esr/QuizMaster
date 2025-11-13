let adminToken = sessionStorage.getItem("admin-token");

async function api(endpoint, body) {
    const headers = { "Content-Type": "application/json" };
    if (adminToken) {
        headers.Authorization = adminToken;
    }
    const response = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    });
    return await response.json();
}

function logout() {
    sessionStorage.removeItem("admin-token");
    window.location.href = "/admin";
}

async function refreshHosts() {
    const result = await api("hosts");
    if (result.success) {
        document.getElementById("host-list-table").innerHTML = result.hosts.map(host => `
            <tr class="border-b">
                <td class="p-3 font-bold">#${host.id}</td>
                <td class="p-3">${host.email}</td>
                <td class="p-3">
                    <button class="text-red-500 font-semibold" onclick="deleteHost(${host.id})">Delete</button>
                </td>
            </tr>
        `).join("");
    } else {
        logout();
    }
}

async function deleteHost(hostId) {
    if (confirm("Delete this host and all their quizzes?")) {
        const result = await api("delete-host", { hostId });
        if (result.success) {
            refreshHosts();
        }
    }
}

document.getElementById("logout-btn").addEventListener("click", logout);

document.getElementById("create-host-form").addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = await api("add-host", data);
    if (result.success) {
        e.target.reset();
        refreshHosts();
    } else {
        alert(result.message);
    }
});

if (adminToken) {
    refreshHosts();
} else {
    window.location.href = "/admin";
}
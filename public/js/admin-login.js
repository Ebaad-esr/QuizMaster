document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const password = document.getElementById("password-input").value;
    const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (result.success) {
        sessionStorage.setItem("admin-token", result.token);
        window.location.href = "/admin/dashboard";
    } else {
        alert("Login failed");
    }
});
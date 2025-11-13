document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("email-input").value;
    const password = document.getElementById("password-input").value;
    const response = await fetch("/api/host/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (result.success) {
        sessionStorage.setItem("host-token", result.token);
        window.location.href = "/dashboard";
    } else {
        alert("Login failed");
    }
});
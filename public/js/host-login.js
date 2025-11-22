const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");

function toggleTab(isLogin) {
    if (isLogin) {
        loginForm.classList.remove("hide");
        registerForm.classList.add("hide");
        tabLogin.classList.add("border-yellow-500", "text-black");
        tabLogin.classList.remove("text-gray-500");
        tabRegister.classList.remove("border-yellow-500", "text-black", "border-b-2");
        tabRegister.classList.add("text-gray-500");
    } else {
        loginForm.classList.add("hide");
        registerForm.classList.remove("hide");
        tabRegister.classList.add("border-yellow-500", "text-black", "border-b-2");
        tabRegister.classList.remove("text-gray-500");
        tabLogin.classList.remove("border-yellow-500", "text-black");
        tabLogin.classList.add("text-gray-500");
    }
}

tabLogin.addEventListener("click", () => toggleTab(true));
tabRegister.addEventListener("click", () => toggleTab(false));

loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const res = await (await fetch("/api/host/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: document.getElementById("email-input").value, password: document.getElementById("password-input").value }) })).json();
    if (res.success) { sessionStorage.setItem("host-token", res.token); window.location.href = "/dashboard"; } else alert("Login failed");
});

registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-pass").value;
    const confirm = document.getElementById("reg-confirm").value;

    if (password !== confirm) {
        alert("Passwords do not match");
        return;
    }

    const res = await (await fetch("/api/host/register", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ email, password }) 
    })).json();

    if (res.success) { 
        sessionStorage.setItem("host-token", res.token); 
        window.location.href = "/dashboard"; 
    } else {
        alert(res.message || "Registration failed");
    }
});

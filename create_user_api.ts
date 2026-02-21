
const email = `test.safari.${Date.now()}@example.com`;
const password = "Password123!";
const name = "Test Safari";

console.log("Attempting to create user:", email);

try {
    const response = await fetch("https://agendamento-nota-backend.vercel.app/api/auth/sign-up/email", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Origin": "https://agendamento-nota-front.vercel.app" 
        },
        body: JSON.stringify({ email, password, name })
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Body:", text);

    if (response.ok) {
        console.log("SUCCESS: User created.");
        console.log(`export TEST_EMAIL="${email}"`);
        console.log(`export TEST_PASSWORD="${password}"`);
    } else {
        console.log("FAILED to create user.");
    }
} catch (e) {
    console.error("Error:", e);
}

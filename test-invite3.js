const API = "http://localhost:3001";

// Use fetch with a cookie jar manually via a single session
const session = new Set();

async function loggedFetch(url, options = {}) {
  const cookieHeader = [...session].join("; ");
  const headers = new Headers(options.headers || {});
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  
  const res = await fetch(url, { ...options, headers, credentials: "include" });
  
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const cookieName = setCookie.split("=")[0].trim();
    session.add(`${cookieName}=dummy`);
  }
  
  return res;
}

async function main() {
  // Step 1: Sign in
  console.log("=== Sign-in ===");
  const loginRes = await loggedFetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
    body: JSON.stringify({ email: "lucassa1324@gmail.com", password: "Aura@2025!" }),
  });
  console.log("Login status:", loginRes.status);
  const loginBody = await loginRes.text();
  console.log("Login body:", loginBody.slice(0, 300));

  // Step 2: Check session
  console.log("\n=== Session ===");
  const sessRes = await loggedFetch(`${API}/api/auth/session`, {
    headers: { "Accept": "application/json", "Origin": "http://localhost:3001" },
  });
  console.log("Session status:", sessRes.status);
  const sessBody = await sessRes.text();
  console.log("Session body:", sessBody.slice(0, 300));

  if (!sessBody || sessBody.trim() === "" || sessBody.includes("null")) {
    console.log("No active session - trying wrong password to get error...");
    const tryRes = await loggedFetch(`${API}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
      body: JSON.stringify({ email: "lucassa1324@gmail.com", password: "wrongpass" }),
    });
    console.log("Wrong password status:", tryRes.status);
    const tryBody = await tryRes.text();
    console.log("Wrong password body:", tryBody.slice(0, 300));
    return;
  }

  // Step 3: Try invite with session
  console.log("\n=== Invite with session ===");
  const inviteRes = await loggedFetch(`${API}/api/staff/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
    body: JSON.stringify({ email: "nuno.nova@teste.com", name: "Nuno Nova", companyId: "company-123" }),
  });
  console.log("Invite status:", inviteRes.status);
  const inviteBody = await inviteRes.text();
  console.log("Invite body:", inviteBody.slice(0, 500));
}

main().catch(console.error);

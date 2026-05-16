const API = "http://localhost:3001";

async function main() {
  // Step 1: Try sign-in with a known admin email (empty body to see validation)
  console.log("=== Step 1: Sign-in attempt ===");
  try {
    const r = await fetch(`${API}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
      body: JSON.stringify({ email: "lucassa1324@gmail.com", password: "wrong" }),
    });
    console.log("Status:", r.status);
    const t = await r.text();
    console.log("Body:", t.slice(0, 300));
  } catch(e) { console.error(e.message); }

  // Step 2: Check session
  console.log("\n=== Step 2: Session check ===");
  try {
    const r = await fetch(`${API}/api/auth/session`, {
      credentials: "include",
      headers: { "Accept": "application/json", "Origin": "http://localhost:3001" },
    });
    console.log("Status:", r.status);
    const t = await r.text();
    console.log("Body:", t.slice(0, 300));
  } catch(e) { console.error(e.message); }

  // Step 3: Hit staff invite without session
  console.log("\n=== Step 3: Invite without session ===");
  try {
    const r = await fetch(`${API}/api/staff/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
      body: JSON.stringify({ email: "test@test.com", name: "Test", companyId: "abc123" }),
    });
    console.log("Status:", r.status);
    const t = await r.text();
    console.log("Body:", t.slice(0, 500));
  } catch(e) { console.error(e.message); }
}

main().catch(console.error);

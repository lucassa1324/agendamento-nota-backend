// Test invite flow - requires valid session cookie
const API = "http://localhost:3001";

async function main() {
  // Step 1: Get session to check if any user is logged in
  console.log("=== Checking session ===");
  try {
    const sessionRes = await fetch(`${API}/api/auth/session`, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    console.log("Session status:", sessionRes.status);
    const sessionText = await sessionRes.text();
    console.log("Session body:", sessionText.slice(0, 500));
  } catch (e) {
    console.error("Session error:", e.message);
  }

  // Step 2: Try hitting staff endpoints without auth to see error
  console.log("\n=== Staff invite without auth ===");
  try {
    const inviteRes = await fetch(`${API}/api/staff/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nuno@teste.com", name: "Nuno", companyId: "abc" }),
      credentials: "include",
    });
    console.log("Invite status:", inviteRes.status);
    const inviteText = await inviteRes.text();
    console.log("Invite body:", inviteText.slice(0, 500));
  } catch (e) {
    console.error("Invite error:", e.message);
  }

  // Step 3: List staff without auth
  console.log("\n=== Staff list without auth ===");
  try {
    const listRes = await fetch(`${API}/api/staff/company/abc`, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    console.log("List status:", listRes.status);
    const listText = await listRes.text();
    console.log("List body:", listText.slice(0, 500));
  } catch (e) {
    console.error("List error:", e.message);
  }
}

main().catch(console.error);

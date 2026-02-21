
const { webkit } = require('playwright');

(async () => {
  console.log("Launching WebKit (Safari)...");
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const email = "evellyn@gmail.com";
  const password = "123123123";
  const backendUrl = "https://agendamento-nota-backend.vercel.app";
  const frontendUrl = "https://agendamento-nota-front.vercel.app";

  try {
    console.log(`Navigating to frontend: ${frontendUrl}...`);
    try {
      await page.goto(frontendUrl, { waitUntil: 'networkidle' });
    } catch (e) {
      console.log("Navigation timeout or error, but continuing...", e.message);
    }

    // Handle potential redirect
    console.log("Current URL after navigation:", page.url());

    // Check if we are on landing page
    if (page.url().includes("landing") || page.url().includes("landin")) {
      console.log("Detected landing page. Looking for login button...");
      const loginBtn = await page.$('a[href*="login"], a[href*="signin"], button:has-text("Entrar"), button:has-text("Login")');
      if (loginBtn) {
        console.log("Clicking login button on landing page...");
        await loginBtn.click();
        await page.waitForLoadState('networkidle');
        console.log("URL after clicking login:", page.url());
      } else {
        console.log("No login button found on landing page. Trying direct navigation to /login...");
        await page.goto('https://agendamento-nota-front.vercel.app/login', { waitUntil: 'networkidle' });
      }
    }

    console.log("Final URL for test:", page.url());
    console.log("Page loaded.");

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    let capturedSetCookie = null;

    // Monitor network responses to capture Set-Cookie
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('/api/auth/sign-in/email')) {
            console.log(`Intercepted response from ${url}`);
            const headers = await response.allHeaders();
            console.log("Response Headers keys:", Object.keys(headers));
            
            // Try different cases for set-cookie
            const setCookie = headers['set-cookie'] || headers['Set-Cookie'] || headers['SET-COOKIE'];
            
            if (setCookie) {
                capturedSetCookie = setCookie;
                console.log("Captured Set-Cookie:", setCookie);
                if (setCookie.toLowerCase().includes('partitioned')) {
                     console.log("✅ Cookie has Partitioned attribute (CHIPS support).");
                } else {
                     console.log("⚠️ Cookie missing Partitioned attribute.");
                }
            } else {
                console.log("WARNING: No Set-Cookie header found in intercepted response.");
            }
        }
    });
  
    console.log("Attempting login via fetch() in browser context (Cross-Site)...");
    
    // Execute fetch in the browser context to simulate frontend calling backend
    const loginResult = await page.evaluate(async ({ url, email, password }) => {
      console.log("Current Origin:", window.location.origin);
      
      try {
        // First try a simple health check or OPTIONS
        try {
            const health = await fetch(url, { method: 'OPTIONS' });
            console.log("Health check status:", health.status);
        } catch (h) {
            console.error("Health check failed:", h);
        }

        const res = await fetch(`${url}/api/auth/sign-in/email`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        // Cannot access Set-Cookie here due to browser security restrictions
        
        return {
          status: res.status,
          ok: res.ok,
          text: await res.text(), // Capture response text for debugging
        };
      } catch (e) {
        return { error: e.toString() };
      }
    }, { url: backendUrl, email, password });

    console.log("Login Fetch Result:", loginResult);
    
    // Check captured cookie from network interceptor
    if (capturedSetCookie) {
        console.log("Final Cookie Analysis:");
        const hasPartitioned = capturedSetCookie.toLowerCase().includes("partitioned");
        const hasSameSiteNone = capturedSetCookie.toLowerCase().includes("samesite=none");
        const hasSecure = capturedSetCookie.toLowerCase().includes("secure");
        
        if (hasPartitioned && hasSameSiteNone && hasSecure) {
             console.log("✅ SUCCESS: All required attributes for Safari (Partitioned, SameSite=None, Secure) are present!");
        } else {
             console.log("❌ FAILURE: Missing required attributes for Safari.");
             if (!hasPartitioned) console.log("   - Missing: Partitioned");
             if (!hasSameSiteNone) console.log("   - Missing: SameSite=None");
             if (!hasSecure) console.log("   - Missing: Secure");
        }
    } else {
        console.log("WARNING: No Set-Cookie header was intercepted!");
    }

    if (loginResult.ok) {
      console.log("Login request successful via API.");

      console.log("Checking cookies in browser context...");
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes("session") || c.name.includes("token"));

      if (sessionCookie) {
        console.log("✅ Session cookie found:", sessionCookie.name);
        console.log("   Domain:", sessionCookie.domain);
        console.log("   Secure:", sessionCookie.secure);
        console.log("   SameSite:", sessionCookie.sameSite);
        console.log("   HttpOnly:", sessionCookie.httpOnly);

        if (sessionCookie.secure && sessionCookie.sameSite === 'None') {
          console.log("✅ SUCCESS: Safari (WebKit) accepted the cross-site cookie with Secure=true and SameSite=None!");
        } else {
          console.error("❌ FAILURE: Cookie attributes are incorrect for Safari cross-site.");
        }
      } else {
        console.error("❌ FAILURE: No session cookie found. The browser might have blocked it.");
        console.log("All cookies found:", cookies.map(c => `${c.name} (${c.domain})`).join(", "));
      }

    } else {
      console.error("❌ Login failed at API level:", loginResult);
    }

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await browser.close();
  }
})();

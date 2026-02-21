"use strict";
onRequest(({ request }) => {
    console.log(`[CORS_DEBUG] ${request.method} ${request.url}`);
    console.log(`[CORS_DEBUG] Origin: ${request.headers.get("origin")}`);
});

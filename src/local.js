import app from "./index";
const port = 3001;
console.log(`\n>>> [LOCAL] Iniciando servidor na porta ${port}...`);
console.log(
	`>>> [LOCAL] Frontend URL esperada: ${process.env.FRONTEND_URL || "http://localhost:3000"}`,
);
app.listen(port, () => {
	console.log(`\n🦊 Elysia está rodando em http://localhost:${port}`);
	console.log(
		`🚀 Diagnósticos em http://localhost:${port}/diagnostics/headers`,
	);
});

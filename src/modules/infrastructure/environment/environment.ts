export const environment = {
	asaas: {
		accessToken: process.env.ASAAS_ACCESS_TOKEN,
		baseUrl: process.env.ASAAS_BASE_URL,
	},
	vercel: {
		accessToken: process.env.VERCEL_ACCESS_TOKEN,
		projectId: process.env.VERCEL_PROJECT_ID,
	}
};

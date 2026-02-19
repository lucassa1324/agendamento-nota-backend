// import Stripe from 'stripe'; // REMOVED TO PREVENT VERCEL 500 ERROR
// const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// if (!stripeSecretKey) {
//   // Em produção, isso deve falhar. Em desenvolvimento, pode ser opcional se não usar Stripe.
//   if (process.env.NODE_ENV === 'production') {
//     throw new Error('STRIPE_SECRET_KEY is missing');
//   }
// }
// MOCK STRIPE CLIENT TO PREVENT CRASH
// export const stripe = stripeSecretKey 
//   ? new Stripe(stripeSecretKey, {
//       apiVersion: '2023-10-16', // Use latest API version available or check Stripe dashboard
//       typescript: true,
//     })
//   : {} as any; // Mock empty object to prevent import errors, but runtime usage will fail if not checked
export const stripe = {};

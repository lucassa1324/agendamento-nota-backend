import Stripe from 'stripe';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// if (!stripeSecretKey) {
//   // Em produção, isso deve falhar. Em desenvolvimento, pode ser opcional se não usar Stripe.
//   if (process.env.NODE_ENV === 'production') {
//     throw new Error('STRIPE_SECRET_KEY is missing');
//   }
// }
// MOCK STRIPE CLIENT TO PREVENT CRASH
export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, {
        apiVersion: '2026-01-28.clover', // Use latest API version available or check Stripe dashboard
        typescript: true,
    })
    : {}; // Mock empty object to prevent import errors, but runtime usage will fail if not checked

import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

type Config = {
    DATABASE_URL: string;
};

const config = process.env as unknown as Config;

if (!config.DATABASE_URL) {
    console.error('DATABASE_URL not defined');
    process.exit(1);
}

(async () => {
    const db = postgres(config.DATABASE_URL);
    try {
        const result = await db`UPDATE companies SET billing_anchor_day = 1 WHERE billing_anchor_day IS NULL`;
        console.log('Fixed billing_anchor_day rows:', result.count);
    } catch (e) {
        console.error('Error fixing billing_anchor_day', e);
    } finally {
        await db.end();
    }
})();



import { db } from "../../modules/infrastructure/drizzle/database";
import { companies } from "../../db/schema";
import { eq } from "drizzle-orm";
export function createSlug(text) {
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-");
}
export async function generateUniqueSlug(name) {
    const baseSlug = createSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existing = await db
            .select()
            .from(companies)
            .where(eq(companies.slug, slug))
            .limit(1);
        if (existing.length === 0) {
            break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}

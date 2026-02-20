export class CreateBusinessUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    slugify(text) {
        const slug = text
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]+/g, "")
            .replace(/\-\-+/g, "-");
        return slug || "empresa";
    }
    async generateUniqueSlug(name) {
        const baseSlug = this.slugify(name);
        let slug = baseSlug;
        let counter = 1;
        // Loop de verificação de unicidade
        while (true) {
            const existing = await this.businessRepository.findBySlug(slug);
            if (!existing) {
                return slug;
            }
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
    }
    async execute(userId, data) {
        const slug = await this.generateUniqueSlug(data.name);
        const newBusiness = await this.businessRepository.create({
            id: crypto.randomUUID(),
            name: data.name,
            slug: slug,
            ownerId: userId,
        });
        return newBusiness;
    }
}

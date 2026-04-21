import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";

export class TemplateService {
  private readonly templatesPath = path.join(process.cwd(), "src", "modules", "notifications", "infrastructure", "templates");

  async render(templateName: string, data: any): Promise<string> {
    const filePath = path.join(this.templatesPath, `${templateName}.hbs`);
    const templateSource = await readFile(filePath, "utf8");
    const template = Handlebars.compile(templateSource);
    return template(data);
  }
}

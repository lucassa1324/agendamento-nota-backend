import os

def update_context():
    # Root directory is the parent of 'scripts/context'
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
    output_file = os.path.join(current_dir, "gemni-context-back.md")
    
    exclude_dirs = {
        'node_modules', 'dist', '.git', 'drizzle/meta', 'public', 'Modelo banco', '__pycache__'
    }
    exclude_files = {
        'bun.lock', 'gemni-context-back.md', 'update_back_context.py', '.gitignore', 'logs.txt', 'vercel_logs.txt', 'package-lock.json'
    }
    allowed_extensions = {
        '.ts', '.js', '.json', '.sql', '.txt', '.md', '.http', '.yml', '.yaml'
    }

    print(f"Atualizando contexto em: {output_file}")
    print(f"Diretório raiz: {backend_root}")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# Contexto Backend - Agendamento Nota\n\n")
        f.write("Este arquivo contém o código fonte do backend para referência do Gemini.\n\n")
        
        for root, dirs, files in os.walk(backend_root):
            # Exclude directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            # Check if current root path contains any excluded directory
            rel_root = os.path.relpath(root, backend_root)
            if any(part in exclude_dirs for part in rel_root.split(os.sep)):
                continue

            for file in sorted(files):
                if file in exclude_files:
                    continue
                
                ext = os.path.splitext(file)[1]
                if ext not in allowed_extensions:
                    continue

                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, backend_root)
                
                print(f"Processando: {rel_path}")
                
                try:
                    with open(file_path, "r", encoding="utf-8") as file_content:
                        content = file_content.read()
                        
                        f.write(f"## Arquivo: `{rel_path}`\n")
                        
                        # Determine language for markdown block
                        lang = "typescript" if ext == ".ts" else \
                               "javascript" if ext == ".js" else \
                               "json" if ext == ".json" else \
                               "sql" if ext == ".sql" else \
                               "markdown" if ext == ".md" else \
                               ""
                        
                        f.write(f"```{lang}\n")
                        f.write(content)
                        if not content.endswith('\n'):
                            f.write('\n')
                        f.write("```\n\n")
                except Exception as e:
                    print(f"Erro ao ler {rel_path}: {e}")

    print("\nAtualização concluída com sucesso!")

if __name__ == "__main__":
    update_context()

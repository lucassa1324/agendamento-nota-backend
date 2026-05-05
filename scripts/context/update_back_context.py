import os

def update_context():
    # Root directory is the parent of 'scripts/context'
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
    output_file = os.path.join(current_dir, "gemni-context-back.md")
    
    # Apenas os 4 arquivos solicitados
    target_files = [
        "src/index.ts",
        "src/modules/infrastructure/auth/auth.ts",
        "src/modules/infrastructure/drizzle/database.ts",
        "src/modules/infrastructure/di/repositories.plugin.ts"
    ]

    print(f"Atualizando contexto em: {output_file}")
    print(f"Diretório raiz: {backend_root}")
    print(f"Processando apenas {len(target_files)} arquivos específicos")

    # Abre o arquivo de saída (apaga o conteúdo anterior)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# Contexto Backend - Agendamento Nota\n\n")
        f.write("Este arquivo contém o código fonte do backend para referência.\n\n")
        f.write("**Arquivos processados:**\n")
        for tf in target_files:
            f.write(f"- {tf}\n")
        f.write("\n---\n\n")
        
        for rel_path in target_files:
            file_path = os.path.join(backend_root, rel_path)
            
            if not os.path.exists(file_path):
                print(f"ARQUIVO NÃO ENCONTRADO: {rel_path}")
                f.write(f"## Arquivo: `{rel_path}`\n\n**ERRO: Arquivo não encontrado**\n\n---\n\n")
                continue
            
            print(f"Processando: {rel_path}")
            
            try:
                ext = os.path.splitext(file_path)[1]
                with open(file_path, "r", encoding="utf-8") as file_content:
                    content = file_content.read()
                    
                    # Título claro com caminho absoluto e relativo
                    f.write(f"## Arquivo: `{rel_path}`\n")
                    f.write(f"**Caminho completo:** `{file_path}`\n\n")
                    
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
                    f.write("---\n\n")
            except Exception as e:
                print(f"Erro ao ler {rel_path}: {e}")
                f.write(f"## Arquivo: `{rel_path}`\n\n**ERRO ao ler arquivo: {e}**\n\n---\n\n")

    print("\nAtualização concluída com sucesso!")

if __name__ == "__main__":
    update_context()

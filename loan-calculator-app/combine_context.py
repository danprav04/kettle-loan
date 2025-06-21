import os

# --- Configuration ---
# List of directories to completely ignore.
EXCLUDED_DIRS = {
    'node_modules', 
    '.next', 
    '.git',
    # Add any other directories you want to exclude
}

# Specific filenames to always exclude.
EXCLUDED_FILENAMES = {
    'package-lock.json',
    'llm_context.txt',
    'combine_context.py',
    'next-env.d.ts',
    'README.md',
    # Add any other specific files you want to exclude
}

# File extensions to include.
INCLUDED_EXTENSIONS = {
    '.js', '.ts', '.tsx', '.json', '.sql', '.css',
}

# Specific filenames to always include, even if their extension isn't listed above.
INCLUDED_FILENAMES = {
    '.env.local',
    'middleware.ts',
    'schema.sql',
    'package.json',
    'tailwind.config.ts',
    'next.config.ts',
    'tsconfig.json',
}

# Name of the output file.
OUTPUT_FILENAME = 'llm_context.txt'
# --- End of Configuration ---

def should_include_file(filename):
    """
    Check if a file should be included.
    A file is included if its name is in INCLUDED_FILENAMES or
    if its extension is in INCLUDED_EXTENSIONS.
    """
    if filename in INCLUDED_FILENAMES:
        return True
    return any(filename.endswith(ext) for ext in INCLUDED_EXTENSIONS)

def combine_files_to_context(root_dir, output_file):
    """
    Walks through the directory, reads relevant files, and combines them
    into a single output file for LLM context.
    """
    file_count = 0
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Walk through the directory structure.
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Modify dirnames in-place to efficiently skip excluded directories.
            dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
            
            for filename in filenames:
                # First, check if the file should be explicitly excluded.
                if filename in EXCLUDED_FILENAMES:
                    continue

                if should_include_file(filename):
                    file_path = os.path.join(dirpath, filename)
                    # Use forward slashes for cross-platform compatibility in the header.
                    relative_path = os.path.relpath(file_path, root_dir).replace(os.sep, '/')
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                            content = infile.read()
                            
                        # Write a header for each file to provide context.
                        header = f"--- File: {relative_path} ---\n"
                        outfile.write(header)
                        outfile.write(content.strip())
                        outfile.write("\n\n---\n\n") # Add a clear separator
                        
                        file_count += 1
                        print(f"Added: {relative_path}")
                        
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")

    print(f"\n✅ Successfully combined {file_count} files into '{OUTPUT_FILENAME}'")

if __name__ == '__main__':
    # The script assumes it's located in the project root.
    project_root = os.path.dirname(os.path.abspath(__file__))
    print(f"Starting script in root directory: {project_root}")
    combine_files_to_context(project_root, os.path.join(project_root, OUTPUT_FILENAME))
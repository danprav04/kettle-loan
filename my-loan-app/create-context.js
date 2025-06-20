const fs = require('fs');
const path = require('path');

// --- Configuration ---

// The name of the output file
const outputFile = 'llm-context.txt';

// List of files and directories to include in the context.
const includePaths = [
    'app',
    'components',
    'lib',
    'locales',
    'prisma',
    'i18n.ts',
    'middleware.ts',
    'package.json',
    'tailwind.config.ts',
    '.env.example', // Use the example file, not the real .env
];

// List of file extensions to include.
const allowedExtensions = [
    '.js', '.ts', '.tsx', '.css', '.json', '.prisma', '.example'
];

// --- MODIFIED ---
// List of directories and files to explicitly exclude.
const excludePatterns = [
    'node_modules',
    '.next',
    '.git',
    'package-lock.json',
    'generated', // Exclude auto-generated directories
    outputFile, // Exclude the script's own output
];

// --- Script Logic ---

const projectRoot = __dirname;
let combinedContent = `This file contains the combined source code for the project. Each file is separated by a header indicating its path.\n\n`;

/**
 * Recursively walks through directories to find files.
 * @param {string} dir The directory to walk.
 * @returns {string[]} A list of file paths.
 */
function walk(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        console.error(`Could not read directory: ${dir}. Skipping.`);
        return [];
    }
    
    let fileList = [];
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(projectRoot, fullPath);

        // --- CORRECTED EXCLUSION LOGIC ---
        // Split the path into components and check if any part matches an exclude pattern.
        // This is more robust than `startsWith` and correctly handles nested directories.
        const pathParts = relativePath.split(path.sep);
        if (excludePatterns.some(pattern => pathParts.includes(pattern))) {
            continue;
        }

        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                fileList = fileList.concat(walk(fullPath));
            } else if (allowedExtensions.includes(path.extname(fullPath))) {
                fileList.push(fullPath);
            }
        } catch (e) {
            console.error(`Could not stat path: ${fullPath}. Skipping.`, e);
        }
    }
    return fileList;
}

/**
 * Main function to process paths and generate the output file.
 */
async function createContextFile() {
    console.log("Starting to gather project files...");

    const allFiles = [];

    for (const p of includePaths) {
        const fullPath = path.join(projectRoot, p);
        if (!fs.existsSync(fullPath)) {
            console.warn(`Warning: Path not found, skipping: ${p}`);
            continue;
        }
        
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                allFiles.push(...walk(fullPath));
            } else {
                // Ensure single files are also checked for allowed extensions
                if (allowedExtensions.includes(path.extname(fullPath))) {
                    allFiles.push(fullPath);
                }
            }
        } catch (e) {
             console.error(`Could not stat path: ${fullPath}. Skipping.`, e);
        }
    }

    // Sort files for consistent order and remove duplicates
    const uniqueFiles = [...new Set(allFiles)].sort();
    
    console.log(`Found ${uniqueFiles.length} files to include.`);

    for (const file of uniqueFiles) {
        // Use forward slashes for consistency in the output file header
        const relativePath = path.relative(projectRoot, file).replace(/\\/g, '/');
        try {
            const content = fs.readFileSync(file, 'utf-8');
            combinedContent += `--- FILE: ${relativePath} ---\n\n`;
            combinedContent += `${content}\n\n`;
        } catch (e) {
            console.error(`Error reading file ${file}:`, e);
        }
    }

    try {
        fs.writeFileSync(outputFile, combinedContent);
        console.log(`\n✅ Successfully created ${outputFile}`);
        console.log("You can now provide the contents of this file to an LLM as context.");
    } catch(e) {
        console.error(`\n❌ Failed to write to ${outputFile}:`, e);
    }
}

createContextFile();
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

// List of directories and files to explicitly exclude.
const excludePatterns = [
    'node_modules',
    '.next',
    '.git',
    'package-lock.json',
    outputFile, // Exclude the script's own output
];

// --- Script Logic ---

const projectRoot = __dirname;
let combinedContent = `This file contains the combined source code for the Next.js Loan Tracker project. Each file is separated by a header indicating its path.\n\n`;

// Recursive function to walk through directories
function walk(dir) {
    let files = [];
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

        if (excludePatterns.some(pattern => relativePath.startsWith(pattern))) {
            continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            fileList = fileList.concat(walk(fullPath));
        } else if (allowedExtensions.includes(path.extname(fullPath))) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

// Main function to process paths and generate the output
async function createContextFile() {
    console.log("Starting to gather project files...");

    const allFiles = [];

    for (const p of includePaths) {
        const fullPath = path.join(projectRoot, p);
        if (!fs.existsSync(fullPath)) {
            console.warn(`Warning: Path not found, skipping: ${p}`);
            continue;
        }
        
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            allFiles.push(...walk(fullPath));
        } else {
            allFiles.push(fullPath);
        }
    }

    // Sort files for consistent order
    allFiles.sort();
    
    // Remove duplicates
    const uniqueFiles = [...new Set(allFiles)];
    
    console.log(`Found ${uniqueFiles.length} files to include.`);

    for (const file of uniqueFiles) {
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
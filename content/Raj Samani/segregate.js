const fs = require('fs');
const path = require('path');

const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');
const ENGLISH_DIR = path.join(TRANSCRIPTS_DIR, 'English');
const HINDI_DIR = path.join(TRANSCRIPTS_DIR, 'Hindi');

if (!fs.existsSync(ENGLISH_DIR)) fs.mkdirSync(ENGLISH_DIR);
if (!fs.existsSync(HINDI_DIR)) fs.mkdirSync(HINDI_DIR);

const files = fs.readdirSync(TRANSCRIPTS_DIR);

let englishCount = 0;
let hindiCount = 0;

for (const file of files) {
  if (!file.endsWith('.md')) continue;

  const filePath = path.join(TRANSCRIPTS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Regex to match Devanagari characters
  const hindiMatches = content.match(/[\u0900-\u097F]/g);
  
  // If we find a significant amount of Hindi characters (e.g. > 100 characters), we classify as Hindi
  const isHindi = hindiMatches && hindiMatches.length > 50;

  if (isHindi) {
    fs.renameSync(filePath, path.join(HINDI_DIR, file));
    hindiCount++;
  } else {
    fs.renameSync(filePath, path.join(ENGLISH_DIR, file));
    englishCount++;
  }
}

console.log(`✅ Successfully segregated transcripts!`);
console.log(`📂 Moved ${englishCount} files to English folder.`);
console.log(`📂 Moved ${hindiCount} files to Hindi folder.`);

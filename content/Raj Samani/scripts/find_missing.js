const fs = require('fs');
const readline = require('readline');
const path = require('path');

const CSV_FILE = path.join(__dirname, 'Videos.csv');
const OUTPUT_DIR = path.join(__dirname, 'transcripts');

async function findMissing() {
  const fileStream = fs.createReadStream(CSV_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const missing = [];
  let total = 0;

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith(',,')) continue;
    
    total++;
    const lastCommaIndex = trimmedLine.lastIndexOf(',');
    const urlStr = trimmedLine.substring(lastCommaIndex + 1).trim();
    const firstCommaIndex = trimmedLine.indexOf(',');
    let title = trimmedLine.substring(firstCommaIndex + 1, lastCommaIndex).trim();
    
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.substring(1, title.length - 1);
    }
    
    let videoId = '';
    try {
      const parsedUrl = new URL(urlStr);
      videoId = parsedUrl.searchParams.get('v');
    } catch (e) { }

    if (!videoId) {
      const match = urlStr.match(/youtu\.be\/([^?]+)/);
      if (match) videoId = match[1];
    }
    
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim() || videoId;
    const mdFileName = path.join(OUTPUT_DIR, `${safeTitle}.md`);
    
    if (!fs.existsSync(mdFileName)) {
      missing.push({ id: total, title: title, url: urlStr });
    }
  }
  
  console.log(`\n----- MISSING TRANSCRIPTS (${missing.length}) -----`);
  missing.forEach(v => {
    console.log(`Row ${v.id}: ${v.title}`);
  });
  console.log('-------------------------------------\n');
}

findMissing();

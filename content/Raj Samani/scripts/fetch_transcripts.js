const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Replace with your API key if needed
const API_KEY = process.env.API_KEY || 'sk_biaEqbsIp2GrkjrfQF0T0N6m29Sjawf5VsnP9it43ZQ';
const CSV_FILE = 'Videos.csv';
const OUTPUT_DIR = 'transcripts';

// Only process exactly these row numbers (1-indexed based on your CSV)
const TARGET_LINES = [11, 68, 73, 104, 129, 133, 136, 154, 164, 166, 168];

// Helper to sleep for a given number of milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processVideos() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  const fileStream = fs.createReadStream(CSV_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    
    // Skip rows that are not exactly in our target list
    if (TARGET_LINES.length > 0 && !TARGET_LINES.includes(lineNumber)) {
      continue;
    }

    const trimmedLine = line.trim();
    // Skip empty lines or trailing empty commas (e.g., ,,)
    if (!trimmedLine || trimmedLine.startsWith(',,')) continue;

    // Parse the CSV line manually since title might contain commas
    // Format is: id,"title",url
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
    } catch (e) {
      console.log(`Skipping invalid URL: ${urlStr}`);
      continue;
    }

    if (!videoId) {
      // In case the URL structure is different (e.g. youtu.be/...)
      const match = urlStr.match(/youtu\.be\/([^?]+)/);
      if (match) {
        videoId = match[1];
      } else {
        console.log(`Could not extract video ID from: ${urlStr}`);
        continue;
      }
    }

    // Sanitize title for file name
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim() || videoId;
    const mdFileName = path.join(OUTPUT_DIR, `${safeTitle}.md`);

    // Skip if already processed to save API calls
    if (fs.existsSync(mdFileName)) {
      console.log(`[SKIPPING] Transcript already exists for: ${title}`);
      continue;
    }

    console.log(`[FETCHING] ${title} (${videoId})...`);

    try {
      const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=json`;
      const res = await fetch(url, { 
        headers: { Authorization: 'Bearer ' + API_KEY } 
      });

      if (!res.ok) {
        console.error(`  -> HTTP Error ${res.status}`);
        if (res.status === 429) {
          console.log('  -> Rate limited! Sleeping for 10 seconds...');
          await sleep(10000); // Backoff on rate limit
        }
        continue;
      }

      const data = await res.json();
      const transcriptData = data.transcript || data;

      if (transcriptData) {
        // The API returns an array (e.g., [{ text: '...', start: 1, duration: 2 }])
        let contentToWrite = transcriptData;
        
        if (Array.isArray(transcriptData)) {
          // If the array contains objects with a 'text' property, join them
          contentToWrite = transcriptData
            .map(item => (item && typeof item === 'object' && item.text) ? item.text : JSON.stringify(item))
            .join(' ');
        } else if (typeof transcriptData === 'object') {
          contentToWrite = JSON.stringify(transcriptData, null, 2);
        }

        fs.writeFileSync(mdFileName, contentToWrite);
        console.log(`  -> Saved to: ${mdFileName}`);
      } else {
        console.log(`  -> No transcript text found.`);
      }

    } catch (error) {
      console.error(`  -> Failed to fetch: ${error.message}`);
    }

    // Sleep 2-3 seconds between calls to avoid API rate limits
    const sleepTime = Math.floor(Math.random() * 1000) + 2000;
    console.log(`  Waiting ${sleepTime}ms before next call...\n`);
    await sleep(sleepTime);
  }

  console.log('✅ Finished processing all videos.');
}

processVideos().catch(console.error);

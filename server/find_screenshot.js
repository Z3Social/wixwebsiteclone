const fs = require('fs');
const path = require('path');

const baseDir = 'D:\\Studio 42 Productions\\2025-01-04-eff34bd4b2a8b04ed7ed80d1b936ac082819655fc70fb7296f6c90ffa823a4b0\\data';

const tweetsContent = fs.readFileSync(path.join(baseDir, 'tweets.js'), 'utf8');
const jsonStr = tweetsContent.slice(tweetsContent.indexOf('['), tweetsContent.lastIndexOf(']') + 1);
const tweets = JSON.parse(jsonStr);

console.log('Total tweets:', tweets.length);
const juneJuly2023 = tweets.filter(t => {
  const d = t.tweet?.created_at || '';
  return (d.includes('Jun') || d.includes('Jul')) && d.includes('2023');
});

console.log('Tweets in Jun/Jul 2023:', juneJuly2023.length);

for (const t of juneJuly2023) {
  const tw = t.tweet;
  const media = tw.extended_entities?.media || tw.entities?.media;
  if (media || tw.full_text.toLowerCase().includes('nexify') || tw.full_text.toLowerCase().includes('error') || tw.full_text.toLowerCase().includes('broken') || tw.full_text.toLowerCase().includes('crash')) {
    console.log(`\nDate: ${tw.created_at} | ID: ${tw.id_str}`);
    console.log(`Text: ${tw.full_text}`);
    if (media) {
      console.log('Media items:', media.map(m => m.media_url_https));
    }
  }
}

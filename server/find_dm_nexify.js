const fs = require('fs');
const path = require('path');
const baseDir = 'D:\\Studio 42 Productions\\2025-01-04-eff34bd4b2a8b04ed7ed80d1b936ac082819655fc70fb7296f6c90ffa823a4b0\\data';

const dmFiles = fs.readdirSync(baseDir).filter(f => f.startsWith('direct-message') && f.endsWith('.js'));
console.log('DM files:', dmFiles);

for (const file of dmFiles) {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  const jsonStr = content.slice(content.indexOf('['), content.lastIndexOf(']') + 1);
  try {
    const dms = JSON.parse(jsonStr);
    console.log(`Checking ${file}: ${dms.length} items`);
    for (const item of dms) {
      const convo = item.dmConversation || item;
      const msgs = convo.messages || [item];
      for (const m of msgs) {
        const msg = m.messageCreate || m;
        const text = msg.text || '';
        const created = msg.createdAt || '';
        if (text.toLowerCase().includes('nexify') || text.toLowerCase().includes('creaous') || (created.includes('2023-06') && (text.includes('http') || text.includes('error')))) {
          console.log(`\n[${created}] in ${file}:`);
          console.log(`Text: ${text}`);
          if (msg.mediaUrls) console.log('Media:', msg.mediaUrls);
        }
      }
    }
  } catch (e) {
    console.error('Error in ' + file, e.message);
  }
}

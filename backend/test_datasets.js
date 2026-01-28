import fs from 'fs';
import path from 'path';

const listsDir = './src/lib/bully_lists';
const languages = ['eng', 'hin', 'hing', 'mar', 'tam', 'tel', 'kan', 'mal', 'pan', 'guj', 'ben'];

console.log('\n📊 MULTILINGUAL BULLYING DETECTION DATASET SUMMARY\n');
console.log('='.repeat(80));

let totalKeywords = 0;

languages.forEach(lang => {
  const filePath = path.join(listsDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const high = data.high ? data.high.length : 0;
  const medium = data.medium ? data.medium.length : 0;
  const low = data.low ? data.low.length : 0;
  const total = high + medium + low;
  
  totalKeywords += total;
  
  console.log(`\n${lang.toUpperCase().padEnd(8)} | HIGH: ${high.toString().padEnd(3)} | MEDIUM: ${medium.toString().padEnd(3)} | LOW: ${low.toString().padEnd(3)} | TOTAL: ${total}`);
});

console.log('\n' + '='.repeat(80));
console.log(`\n✅ TOTAL KEYWORDS ACROSS ALL LANGUAGES: ${totalKeywords}\n`);

// Check meanings
const meaningsPath = path.join(listsDir, 'meanings.json');
const meanings = JSON.parse(fs.readFileSync(meaningsPath, 'utf8'));
console.log(`✅ MEANINGS MAPPINGS CONFIGURED FOR: ${Object.keys(meanings).length} languages\n`);

console.log('🎯 SUPPORTED LANGUAGES:');
console.log('   1. English (eng)');
console.log('   2. Hindi (hin)');
console.log('   3. Hinglish/Roman Hindi (hing)');
console.log('   4. Marathi (mar)');
console.log('   5. Tamil (tam)');
console.log('   6. Telugu (tel)');
console.log('   7. Kannada (kan)');
console.log('   8. Malayalam (mal)');
console.log('   9. Punjabi (pan)');
console.log('  10. Gujarati (guj)');
console.log('  11. Bengali (ben)\n');

console.log('📋 SEVERITY LEVELS:');
console.log('   🔴 HIGH: Violence threats, death wishes, suicide prompts');
console.log('   🟡 MEDIUM: Insults, derogatory terms, vulgar language');
console.log('   🟢 LOW: Mild insults, teasing, dismissive comments\n');

console.log('✨ FEATURES:');
console.log('   ✓ Multi-language keyword detection');
console.log('   ✓ Script detection (Devanagari, Tamil, Telugu, etc.)');
console.log('   ✓ Language auto-detection via franc library');
console.log('   ✓ Hinglish (Romanized Hindi) support');
console.log('   ✓ Severity level classification');
console.log('   ✓ Meaning translation mappings');
console.log('   ✓ Confidence scoring');
console.log('   ✓ Context awareness\n');

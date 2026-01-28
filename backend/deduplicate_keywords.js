import fs from 'fs';
import path from 'path';

const listsDir = './src/lib/bully_lists';
const languages = ['eng', 'hin', 'hing', 'mar', 'tam', 'tel', 'kan', 'mal', 'pan', 'guj', 'ben'];

// Map of keywords to their primary language
const keywordLanguageMap = {
  // English
  'kill yourself': 'eng',
  'i will kill you': 'eng',
  'i will hurt you': 'eng',
  'you\'re dead': 'eng',
  'go kill yourself': 'eng',
  'die in a fire': 'eng',
  'get beaten up': 'eng',
  'i\'ll beat you': 'eng',
  'go jump off a bridge': 'eng',
  'you should die': 'eng',
  'idiot': 'eng',
  'stupid': 'eng',
  'moron': 'eng',
  'bastard': 'eng',
  'asshole': 'eng',
  'loser': 'eng',
  'trash': 'eng',
  'creep': 'eng',
  'dumb': 'eng',
  'imbecile': 'eng',
  'scumbag': 'eng',
  'worthless': 'eng',
  'pathetic': 'eng',
  'disgusting': 'eng',
  'ugly': 'eng',
  'fat': 'eng',
  'racist': 'eng',
  'hate you': 'eng',
  'nerd': 'eng',
  'geek': 'eng',
  'get lost': 'eng',
  'go away': 'eng',
  'boring': 'eng',
  'annoying': 'eng',
  'weak': 'eng',
  
  // Hindi - should be removed from other languages
  'maar dunga': 'hin',
  'main tujhe maarunga': 'hin',
  'tumhe maar dunga': 'hin',
  'mar jao': 'hin',
  'khudkushi kar lo': 'hin',
  'aatma hatya kar': 'hin',
  'pitai kar dunga': 'hin',
  'bewakoof': 'hin',
  'murkh': 'hin',
  'chutiya': 'hin',
  'gandu': 'hin',
  'sala': 'hin',
  'kamina': 'hin',
  'gadha': 'hin',
  'ullu': 'hin',
  'chomu': 'hin',
  'fattu': 'hin',
  'bakwas': 'hin',
  'kutti': 'hin',
  'nalayak': 'hin',
  'bheek': 'hin',
  'bodhu': 'hin',
  'bekaar': 'hin',
  'pagal': 'hin',
  'bevda': 'hin',
  
  // Hinglish (Roman Hindi) - unique to this
  'marta hoon tumhe': 'hing',
  'kutf dunga': 'hing',
  'marob': 'hing',
  'haath thodkaunga': 'hing',
  'bhaag jao yahan se': 'hing',
  
  // Marathi - should be removed from other languages
  'mara dein': 'mar',
  'mi tujhe maru': 'mar',
  'tujhe marnar': 'mar',
  'marayl': 'mar',
  'veda la mar de': 'mar',
  'dhaandel kar dein': 'mar',
  'bhand': 'mar',
  'veda': 'mar',
  'bokya': 'mar',
  'harami': 'mar',
  'faltu': 'mar',
  'mand': 'mar',
  'vedya': 'mar',
  'bhadya': 'mar',
  'salaa': 'mar',
  
  // Tamil - unique Tamil words only
  'nee solriya maaran': 'tam',
  'theruthai': 'tam',
  'porandai': 'tam',
  'punda': 'tam',
  'dhookudu': 'tam',
  'pandi': 'tam',
  'mola': 'tam',
  
  // Telugu - unique Telugu words only
  'nuvvu chaccu chestha': 'tel',
  'bonda': 'tel',
  'gulabi': 'tel',
  'challa': 'tel',
  'vachadi': 'tel',
  'vella': 'tel',
  'lanja': 'tel',
  'jora': 'tel',
  'kone': 'tel',
  
  // Kannada - unique Kannada words only
  'naan nin baduku': 'kan',
  'durmurkh': 'kan',
  'jangali': 'kan',
  'takka': 'kan',
  'surya': 'kan',
  'looji': 'kan',
  'chameli': 'kan',
  'beevi': 'kan',
  'kothi': 'kan',
  'pandu': 'kan',
  
  // Malayalam - unique Malayalam words only
  'nee kolarnul': 'mal',
  'kettavan': 'mal',
  'murkhan': 'mal',
  'paglan': 'mal',
  'komaran': 'mal',
  'mone': 'mal',
  'chempil': 'mal',
  'pothu': 'mal',
  'ottapan': 'mal',
  
  // Punjabi - unique Punjabi words only
  'main tenu mara': 'pan',
  'tenu maarna': 'pan',
  'mara dinda': 'pan',
  'budha': 'pan',
  'chamla': 'pan',
  'loora': 'pan',
  'ande': 'pan',
  'rangar': 'pan',
  'katora': 'pan',
  
  // Gujarati - unique Gujarati words only
  'tne maru chu': 'guj',
  'murkh': 'guj',  // This is shared - belongs to Hindi
  'gadho': 'guj',
  'bhadon': 'guj',
  'paglo': 'guj',
  'bevkufo': 'guj',
  'shaitan': 'guj',
  'locha': 'guj',
  'khatiya': 'guj',
  'batasa': 'guj',
  
  // Bengali - unique Bengali words only
  'tomake maro': 'ben',
  'ami tomake marbo': 'ben',
  'dhondo': 'ben',
  'loorer': 'ben',
  'mira': 'ben',
  'boka': 'ben'
};

// Load all language files
const allData = {};
languages.forEach(lang => {
  const filePath = path.join(listsDir, `${lang}.json`);
  allData[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

// Clean up - remove duplicates from non-primary languages
languages.forEach(lang => {
  const data = allData[lang];
  
  // Process high severity
  if (data.high) {
    data.high = data.high.filter(word => {
      const primaryLang = keywordLanguageMap[word.toLowerCase()];
      return !primaryLang || primaryLang === lang;
    });
  }
  
  // Process medium severity
  if (data.medium) {
    data.medium = data.medium.filter(word => {
      const primaryLang = keywordLanguageMap[word.toLowerCase()];
      return !primaryLang || primaryLang === lang;
    });
  }
  
  // Process low severity
  if (data.low) {
    data.low = data.low.filter(word => {
      const primaryLang = keywordLanguageMap[word.toLowerCase()];
      return !primaryLang || primaryLang === lang;
    });
  }
});

// Save cleaned data
languages.forEach(lang => {
  const filePath = path.join(listsDir, `${lang}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allData[lang], null, 2), 'utf8');
  
  const total = (allData[lang].high?.length || 0) + 
                (allData[lang].medium?.length || 0) + 
                (allData[lang].low?.length || 0);
  console.log(`✅ ${lang.toUpperCase()}: ${total} keywords (deduplicated)`);
});

console.log('\n✨ All duplicate keywords removed!');

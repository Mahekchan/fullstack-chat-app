import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = process.env.MESSAGE_SECRET_KEY ? Buffer.from(process.env.MESSAGE_SECRET_KEY, "hex") : null;
const IV_LENGTH = 12; // AES-GCM standard IV length

const BULLY_KEYWORDS = [
  // Bullying
  "idiot", "stupid", "loser", "dumb", "moron", "fool", "clown", "jerk", "useless", 
  "kill yourself", "pathetic", "worthless", "failure", "trash", "garbage", "nerd", "geek", 
  "crybaby", "weakling", "coward", "pig", "dog", "rat", "snake", "fatty", "ugly", "mad",

  // Hate speech
  "i hate u", "i hate you", "hate you", "hate u", "racist", "terrorist", "bigot", "scum", 
  "go back to your country", "you don't belong here", "nazi", "hitler", "slave", "vermin", 
  "subhuman", "animal", "degenerate", "parasite", "filthy", "uncivilized", "barbarian",

  // Harassment phrases
  "kill yourself", "go die", "nobody likes you", "you don't matter",
  "you're a failure", "no one cares about you", "go away forever",
  "you suck", "get lost", "drop dead",

  // Body shaming
  "fat", "fatty", "obese", "ugly", "disgusting", "pig", "cow", "gross", "fatso",
  "skinny", "toothpick", "stick", "string bean", "bony", "skeleton",

  // Intelligence insults
  "brain dead", "slow", "retard", "retarded", "dimwit", "halfwit", "simpleton",
  "pea brain", "empty head", "blockhead", "airhead",

  // Profanity / derogatory terms
  "bitch", "bastard", "asshole", "dick", "prick", "slut", "whore", "hoe",
  "tramp", "skank", "scumbag", "jackass", "punk", "douche", "douchebag",

  // Threats
  "i will hurt you", "i will kill you", "watch your back", "you'll regret this",
  "you're dead", "i'll beat you", "i'll smash you", "break your face",
  "i'll break you", "beat you up", "smash your head",

  // School-specific bullying
  "nerd", "geek", "teacher's pet", "crybaby", "baby", "loser face", "four eyes",
  "know-it-all", "brown noser", "tattletale",

  // Hate speech: race/ethnicity
  "chink", "coon", "spic", "paki", "gypsy", "fob", "terrorist", "raghead",
  "wetback", "beaner", "jungle bunny", "gook", "sand nigger",

  // Hate speech: religion
  "islamophobe", "muslim terrorist", "fake jew", "christfag", "catholic dog",
  "infidel", "heathen scum",

  // Hate speech: gender/sexuality
  "fag", "faggot", "dyke", "tranny", "shemale", "queer", "homophobe", "gender freak",
  "ladyboy", "pansy", "poof", "fairy",

  // Hate speech: disability
  "cripple", "crip", "spaz", "vegetable", "psycho", "mental case", "invalid", "lunatic"
];

export function containsBullying(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BULLY_KEYWORDS.some(word => lower.includes(word));
}

export function encryptMessage(plainText) {
  if (!KEY) throw new Error("Encryption key not set");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptMessage(ciphertext, iv, tag) {
  if (!KEY) throw new Error("Encryption key not set");
  if (!ciphertext || !iv || !tag) {
    throw new Error("Missing ciphertext, iv, or tag for decryption");
  }
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err.message);
    throw new Error("Failed to decrypt message. Data may be corrupted or key/IV/tag mismatch.");
  }
}
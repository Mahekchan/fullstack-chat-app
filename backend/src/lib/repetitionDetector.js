const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory store: key -> array of timestamps (ms)
// key format: `${senderId}:${receiverKey}` where receiverKey is receiverId or `group:${groupId}`
const store = new Map();

function _now() {
  return Date.now();
}

function _prune(arr, now) {
  const cutoff = now - WINDOW_MS;
  // keep timestamps >= cutoff
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

export function recordFlag({ senderId, receiverId, groupId, timestamp = null, occurrences = 1 }) {
  const now = timestamp ? new Date(timestamp).getTime() : _now();
  const receiverKey = groupId ? `group:${groupId}` : (receiverId || "unknown");
  const key = `${senderId}:${receiverKey}`;

  let arr = store.get(key);
  if (!arr) {
    arr = [];
    store.set(key, arr);
  }

  // prune old entries
  _prune(arr, now);

  // push `occurrences` entries with current timestamp
  for (let i = 0; i < occurrences; i++) arr.push(now);

  // keep array sorted (we always push current time so it's already sorted)

  // decide severity
  const count = arr.length;
  let severity = "low";
  let shouldAlert = false;
  if (count >= 5) {
    severity = "high";
    shouldAlert = true;
  } else if (count >= 3) {
    severity = "medium";
  }

  // cleanup if empty (not necessary here)
  return {
    repetitionCount: count,
    severity,
    shouldAlert,
  };
}

export function getCount({ senderId, receiverId, groupId }) {
  const receiverKey = groupId ? `group:${groupId}` : (receiverId || "unknown");
  const key = `${senderId}:${receiverKey}`;
  const arr = store.get(key) || [];
  _prune(arr, _now());
  return arr.length;
}

export function resetCounts({ senderId, receiverId, groupId }) {
  const receiverKey = groupId ? `group:${groupId}` : (receiverId || "unknown");
  const key = `${senderId}:${receiverKey}`;
  store.delete(key);
}


// This is a very simple in-memory lock, suitable for a single-process application.
// For a multi-process or distributed environment, you'd need a distributed lock manager (e.g., using Redis).

const locks = new Set();

function tryLock(lockKey, timeoutMillis = 10000) {
  // This simple implementation doesn't truly support timeouts in a non-blocking way as Apps Script does.
  // It's more of a check-and-set.
  // For a real implementation with timeouts, you'd need more complex logic, possibly involving Promises and setTimeout.
  if (locks.has(lockKey)) {
    return false; 
  }
  locks.add(lockKey);
  return true;
}

function releaseLock(lockKey) {
  locks.delete(lockKey);
}

function waitLock(lockKey, timeoutMillis = 10000) {
    // Basic waitLock, not fully equivalent to Apps Script due to single-threaded nature of Node.js event loop
    // A true waitLock would require async/await and polling or a more sophisticated mechanism.
    const acquired = tryLock(lockKey, timeoutMillis);
    if (!acquired) {
        throw new Error(`Could not acquire lock for ${lockKey} within ${timeoutMillis}ms`);
    }
    // In this simple model, if tryLock succeeds, it's immediate.
}


module.exports = {
  tryLock,
  releaseLock,
  waitLock
  // getScriptLock, getUserLock, etc. would need more specific implementations
  // For now, we provide generic lock functions.
};

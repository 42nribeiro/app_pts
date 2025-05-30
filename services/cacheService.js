
// This is a very simple in-memory cache.
// For production, consider using a more robust solution like Redis, Memcached,
// or a Node.js caching library (node-cache).

const cache = new Map();
const expirations = new Map();

function get(key) {
  if (expirations.has(key) && expirations.get(key) < Date.now()) {
    cache.delete(key);
    expirations.delete(key);
    return null;
  }
  return cache.get(key) || null;
}

function put(key, value, expirationInSeconds) {
  cache.set(key, value);
  if (expirationInSeconds) {
    expirations.set(key, Date.now() + expirationInSeconds * 1000);
  }
}

function remove(key) {
  cache.delete(key);
  expirations.delete(key);
}

function removeAll(keys) {
    keys.forEach(key => remove(key));
}

module.exports = {
  get,
  put,
  remove,
  removeAll
};

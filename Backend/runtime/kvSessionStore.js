import session from "express-session";
import { getContext } from "./context.js";

function getTTL(sessionData) {
  const expires = sessionData.cookie?.expires;

  if (expires) {
    return Math.max(
      60,
      Math.ceil((new Date(expires).getTime() - Date.now()) / 1000),
    );
  }

  const maxAge = sessionData.cookie?.maxAge;

  return Math.max(60, Math.ceil((maxAge || 604800000) / 1000));
}

export class KVSessionStore extends session.Store {
  get(sid, callback) {
    const kv = getContext()?.env?.SESSIONS;

    if (!kv) return callback(new Error("KV session binding unavailable"));

    kv.get(sid, "json")
      .then((data) => callback(null, data))
      .catch(callback);
  }

  set(sid, sessionData, callback = () => {}) {
    const kv = getContext()?.env?.SESSIONS;

    if (!kv) return callback(new Error("KV session binding unavailable"));

    kv.put(sid, JSON.stringify(sessionData), {
      expirationTtl: getTTL(sessionData),
    })
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sid, callback = () => {}) {
    const kv = getContext()?.env?.SESSIONS;

    if (!kv) return callback(new Error("KV session binding unavailable"));

    kv.delete(sid)
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, sessionData, callback = () => {}) {
    this.set(sid, sessionData, callback);
  }
}

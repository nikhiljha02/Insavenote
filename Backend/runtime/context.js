import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage();

export function runWithContext(context, callback) {
  return requestContext.run(context, callback);
}

export function getContext() {
  return requestContext.getStore();
}

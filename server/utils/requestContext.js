import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage();

export const requestContextMiddleware = (req, _res, next) => {
  requestContext.run(
    {
      method: req.method,
      path: req.path,
      url: req.originalUrl,
    },
    next
  );
};

const getStore = () => requestContext.getStore();

export const inRequestContext = () => Boolean(getStore());
export const getRequestPath = () => getStore()?.path || null;
export const getRequestMethod = () => getStore()?.method || null;

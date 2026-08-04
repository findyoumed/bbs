/**
 * [LOG_ID: 20260804_1114] Native-module lazy facades keep optional screens and
 * command routers out of the initial dependency graph without a build step.
 */

function retryable(load) {
  let pending = null;
  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(load)
        .catch((error) => {
          pending = null;
          throw error;
        });
    }
    return pending;
  };
}

export function createLazyObjectFactory(loadFactory, methodNames) {
  return (deps) => {
    const getInstance = retryable(async () => {
      const factory = await loadFactory();
      return factory(deps);
    });
    return Object.fromEntries(methodNames.map((methodName) => [
      methodName,
      async (...args) => {
        const instance = await getInstance();
        return instance[methodName](...args);
      }
    ]));
  };
}

export function createLazyHandlerFactory(loadFactory) {
  return (deps) => {
    const getHandler = retryable(async () => {
      const factory = await loadFactory();
      return factory(deps);
    });
    return async (...args) => {
      const handler = await getHandler();
      return handler(...args);
    };
  };
}

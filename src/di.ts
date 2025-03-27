import "reflect-metadata/lite";

export interface InitializableProvider {
  onInit: () => Promise<void>;
}

export interface ShutdownableProvider {
  shutdown: () => Promise<void>;
}

export interface Container {
  resolveProvider(): Promise<void>;
}

export type Class<T = any> = new (...args: any[]) => T;

export type ProviderClass<T = any> = Class<
  | T
  | (T & InitializableProvider)
  | (T & ShutdownableProvider)
  | (T & InitializableProvider & ShutdownableProvider)
>;

export type ContainerClass<T = any> = Class<T> & Container;

export type ClassDecorator = (
  value: Class,
  ctx: ClassDecoratorContext
) => Class;

export type ProviderDecorator = (
  value: ProviderClass,
  ctx: ClassDecoratorContext
) => ProviderClass;

export type ContainerDecorator = (
  value: Class,
  ctx: ClassDecoratorContext
) => ContainerClass;

export type InjectableValue = { name: string; value: unknown };

export interface ContainerParams {
  providers?: Array<Class>;
  containers?: Array<Class>;
  values?: Array<InjectableValue>;
}

export interface ContainerMetadata {
  providers: Map<string, object>;
  containers: Map<string, Class>;
}

const formatInjectableName = (providerName: string): string => {
  providerName = providerName.trim();
  return providerName.charAt(0).toLowerCase() + providerName.slice(1);
};

export const Injectable = (): ProviderDecorator => {
  return (value: ProviderClass, ctx: ClassDecoratorContext): typeof value => {
    if (ctx.kind !== "class") {
      throw new Error(
        `@Injectable() decorator only allowed on classes! (${ctx.name})`
      );
    }

    if (!ctx.metadata) {
      throw new Error(`This runtime not support decorator metadata!`);
    }

    ctx.metadata["injectable"] = true;
    ctx.metadata["injectable_name"] = formatInjectableName(
      ctx.name || "UNKNOWN"
    );

    ctx.metadata["injectable_meta"] = {
      className: ctx.name,
    };

    const resultObj = {
      [value.name]: class extends value {
        #__registedDone = false;
        #__shutdownDone = false;

        constructor(...args: unknown[]) {
          super(...args);
        }

        async __register() {
          if (
            (this as any).onInit &&
            typeof (this as any).onInit === "function" &&
            !this.#__registedDone
          ) {
            this.#__registedDone = true;
            await (this as any).onInit();
          }
        }

        async __shutdown() {
          if (
            (this as any).shutdown &&
            typeof (this as any).shutdown === "function" &&
            !this.#__shutdownDone
          ) {
            this.#__shutdownDone = true;
            try {
              await (this as any).shutdown();
            } catch (_) {}
          }
        }
      },
    };

    return resultObj[value.name];
  };
};

export const Container = (params: ContainerParams): ClassDecorator => {
  const instances: Map<string, object> = new Map();
  const providers: Map<string, Class> = new Map();
  const values: Map<string, unknown> = new Map();

  return (value: Class, ctx: ClassDecoratorContext): typeof value => {
    if (ctx.kind !== "class") {
      throw new Error(
        `@Container() decorator only allowed on classes! (${ctx.name})`
      );
    }

    const instantiateProvider = (
      name: string,
      handler: ProxyHandler<object>,
      provider?: Class
    ): object | undefined => {
      var result: object | undefined = undefined;

      if (!provider && providers.has(name)) {
        provider = providers.get(name)!;
      }

      if (!instances.has(name)) {
        if (provider) {
          result = new provider(new Proxy({}, handler)) as object;

          instances.set(name, result);

          return result;
        }
      }

      return instances.get(name)!;
    };

    params.containers?.forEach((container: Class) => {
      if (!container[Symbol.metadata]?.container) {
        throw new Error(
          `Class ${container.name} is not @Container !  (${ctx.name})`
        );
      }

      const containerMeta = container[Symbol.metadata]?.container_meta as {
        instances: Map<string, object>;
        providers: Map<string, Class>;
        values: Map<string, unknown>;
      };

      const containerInstances = containerMeta?.instances;
      const containerProviders = containerMeta?.providers;
      const containerValues = containerMeta?.values;

      containerInstances?.forEach(
        (val, key) => !instances.has(key) && instances.set(key, val)
      );
      containerProviders?.forEach(
        (val, key) => !providers.has(key) && providers.set(key, val)
      );

      containerValues?.forEach(
        (val, key) =>
          !values.has(key) && !instances.has(key) && values.set(key, val)
      );
    });

    params.providers?.forEach((provider: Class) => {
      if (!provider[Symbol.metadata]?.injectable) {
        throw new Error(
          `Dependency ${provider.name} should be @Injectable  (${ctx.name})`
        );
      }

      const injectableName: string = provider[Symbol.metadata]
        ?.injectable_name as string;

      if (!providers.has(injectableName)) {
        providers.set(injectableName, provider);
        return;
      }

      throw new Error(
        `Provider ${injectableName} already exist in container ${ctx.name}`
      );
    });

    params.values?.forEach((value: InjectableValue) => {
      if (
        !values.has(value.name) &&
        !instances.has(value.name) &&
        !providers.has(value.name)
      ) {
        values.set(value.name, value.value);
        return;
      }

      throw Error(
        `Value name '${value.name}' already injected! Use another name! (${ctx.name})`
      );
    });

    providers.forEach((provider, injectableName) => {
      // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get
      const proxyHandler: ProxyHandler<object> = {
        get(_, prop) {
          prop = String(prop);

          if (values.has(prop)) {
            return values.get(prop)!;
          }

          // Cyclic dependencies occurs here
          if (injectableName === prop) {
            return undefined;
          }

          return instantiateProvider(prop, proxyHandler);
        },
      };

      instantiateProvider(injectableName, proxyHandler, provider);
    });

    ctx.metadata["container"] = true;
    ctx.metadata["container_meta"] = { instances, providers, values };

    ctx.metadata["container_reg_fn"] = async () => {
      for (const [_, instance] of instances) {
        var regMethod = (instance as { __register: () => Promise<void> })
          ?.__register;

        if (regMethod && typeof regMethod === "function") {
          await regMethod.apply(instance);
        }
      }
    };

    ctx.metadata["container_shutdown_fn"] = async () => {
      for (const [_, instance] of instances) {
        var shutdownMethod = (instance as { __shutdown: () => Promise<void> })
          ?.__shutdown;

        if (shutdownMethod && typeof shutdownMethod === "function") {
          await shutdownMethod.apply(instance);
        }
      }
    };

    const resultObj = {
      [value.name]: class extends value {
        constructor(...args: any[]) {
          super(...args);
        }

        static resolveProvider<T extends Class>(
          provider: Class
        ): T | undefined {
          const isInjectable = provider[Symbol.metadata]?.injectable as boolean;
          const injectableName: string = provider[Symbol.metadata]
            ?.injectable_name as string;

          if (provider.name && isInjectable) {
            if (instances.has(injectableName)) {
              const foundInstance = instances.get(injectableName);

              if (foundInstance) {
                return foundInstance as T;
              }
            }
          }
        }
      },
    };

    return resultObj[value.name];
  };
};
export const registerContainer = async (container: Class) => {
  if (!container[Symbol.metadata]?.container) {
    throw new Error(
      `registerContainer error! ${container?.name} is not @Container()!`
    );
  }

  const regFn = container[Symbol.metadata]
    ?.container_reg_fn as () => Promise<void>;

  if (regFn && typeof regFn === "function") {
    await regFn();
  }
};

export const shutdownContainer = async (container: Class) => {
  if (!container[Symbol.metadata]?.container) {
    throw new Error(
      `shutdownContainer error! ${container?.name} is not @Container()!`
    );
  }

  const shutdownFn = container[Symbol.metadata]
    ?.container_shutdown_fn as () => Promise<void>;

  if (shutdownFn && typeof shutdownFn === "function") {
    await shutdownFn();
  }
};

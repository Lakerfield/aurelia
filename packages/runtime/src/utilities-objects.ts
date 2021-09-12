import { Metadata, Protocol } from '@aurelia/kernel';

/**
 * A shortcut to Object.prototype.hasOwnProperty
 * Needs to do explicit .call
 *
 * @internal
 */
export const hasOwnProp = Object.prototype.hasOwnProperty;

/** @internal */ export const def = Reflect.defineProperty;

// eslint-ignore-next-line
/** @internal */ export const isFunction = <T, K extends Function>(v: unknown): v is K => typeof v === 'function';

/** @internal */ export const isString = (v: unknown): v is string => typeof v === 'string';

/** @internal */ export function defineHiddenProp<T extends unknown>(obj: object, key: PropertyKey, value: T): T {
  def(obj, key, {
    enumerable: false,
    configurable: true,
    writable: true,
    value
  });
  return value;
}

/** @internal */ export function ensureProto<T extends object, K extends keyof T>(
  proto: T,
  key: K,
  defaultValue: unknown,
  force: boolean = false
): void {
  if (force || !hasOwnProp.call(proto, key)) {
    defineHiddenProp(proto, key, defaultValue);
  }
}

/** @internal */ export const createLookup = <T>(): Record<string, T> => Object.create(null);

/** @internal */ export const getOwnMetadata = Metadata.getOwn;
/** @internal */ export const hasOwnMetadata = Metadata.hasOwn;
/** @internal */ export const defineMetadata = Metadata.define;
/** @internal */ export const getAnnotationKeyFor = Protocol.annotation.keyFor;
/** @internal */ export const getResourceKeyFor = Protocol.resource.keyFor;
/** @internal */ export const appendResourceKey = Protocol.resource.appendTo;

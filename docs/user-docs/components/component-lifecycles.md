# Component lifecycles

Every component instance has a lifecycle that you can tap into. This makes it easy for you to perform various actions at particular times.

For example, you may want to execute some code as soon as your component properties are bound but before the component is first rendered. Or, you may want to run some code to manipulate the DOM as soon as possible after your element is attached to the document.

{% hint style="info" %}
Every lifecycle callback is optional. Implement whatever makes sense for your component, but don't feel obligated to implement any of them if they aren't needed for your scenario. Some of the lifecycle callbacks make sense to implement in pairs (`binding/unbinding`, `attaching/detaching`) to clean up any resources you have allocated.&#x20;
{% endhint %}

{% hint style="warning" %}
If you register a listener or subscriber in one callback, remember to remove it in the opposite callback. For example, a native event listener registered in `attached` should be removed in `detached`
{% endhint %}

{% hint style="info" %}
All arguments on these callback lifecycle methods are optional and, in most cases, will not be needed.
{% endhint %}

## Constructor

When the framework instantiates a component, it calls your class's constructor, just like any JavaScript class. This is the best place to put your basic initialization code that is not dependent on bindable properties.

Furthermore, the constructor is where you handle the injection of dependencies using dependency injection. You will learn about DI in the [dependency injection section](../getting-to-know-aurelia/dependency-injection-di/), but here is a basic example of where the constructor is used.

```typescript
import { IRouter } from '@aurelia/router-lite';

export class MyComponent {
    constructor(@IRouter readonly router: IRouter) {
    }
}
```

## Define

The "define" hook is the go-to hook for dynamic contextual composition. It runs just after the constructor and can be treated like a late interceptor for the `@customElement` decorator / `CustomElement.define` api: it allows you to change the `CustomElementDefinition` created by the framework before it is compiled, as well as making certain changes to the controller (for example, wrapping or overriding the `scope`).

You'll have the compiled definition of the parent (owning) element available and the custom element's hydration context. The returned definition is the cache key for the compiled definition.

To make a change only the first time the hook is invoked for an instance underneath a particular parent definition (affecting all instances of the type underneath that parent definition), mutate and return the existing definition; to make a contextual change (that needs to be re-compiled per instance), clone the definition before mutating and returning it.

```typescript
export class MyComponent {
    define(controller: IDryCustomElementController<this>, hydrationContext: IHydrationContext<unknown>, definition: CustomElementDefinition<Constructable<{}>>) {

    }
}
```

## Hydrating

The "hydrating" hook allows you to add contextual DI registrations (to `controller.container`) to influence which resources are resolved when the template is compiled. It runs synchronously right after the `define` hook and is still considered part of "construction".

From a caching perspective, it has a direct 1-1 parity with the `define` hook: the hydration is cached per a unique definition that is returned from `define` (or per parent definition, if no new definition is returned from `define`).&#x20;

Therefore, if you need true per-instance contextual registrations (which should be rare), make sure to bust the cache per instance by returning a clone from the `define` hook.

```typescript
export class MyComponent {
    hydrating(controller: IContextualCustomElementController<this>) {

    }
}
```

## Hydrated

The "hydrated" hook is a good place to influence how child components are constructed and rendered contextually. It runs synchronously after the definition is compiled (which happens synchronously after `hydrating`) and, like `hydrating`, can still be considered part of "construction" and has a direct 1-1 parity with the `define` hook from a caching perspective.&#x20;

{% hint style="info" %}
This is the last opportunity to add DI registrations specifically for child components in this container or any other way, affecting what is rendered and how it is rendered.
{% endhint %}

```typescript
export class MyComponent {
    hydrated(controller: IContextualCustomElementController<this>) {

    }
}
```

## Created

The "created" hook is the last hook that can be considered part of "construction". It is called (synchronously) after this component is hydrated, which includes resolving, compiling and hydrating child components. In terms of the component hierarchy, the created hooks execute bottom-up, from child to parent (whereas `define`, `hydrating` and `hydrated` are all top-down). This is also the last hook that runs only once per instance.

Here you can perform any last-minute work that requires having all child components hydrated, which might affect the `bind` and `attach` lifecycles.

```typescript
export class MyComponent {
    created(controller: IContextualCustomElementController<this>) {

    }
}
```

## Binding

If your component has a method named "binding", then the framework will invoke it after the bindable properties of your component are assigned. In terms of the component hierarchy, the binding hooks execute top-down, from parent to child, so your bindables will have their values set by the owning components, but the bindings in your view are not yet set.

{% hint style="info" %}
This is a good place to perform any work or change anything your view would depend on because data still flows down synchronously. This is the best time to do anything that might affect children. We prefer using this hook over `bound`, unless you specifically need `bound` for a situation when `binding` is too early.
{% endhint %}

You can optionally return a `Promise` either making the method asynchronous or creating a promise object. If you do so, it will suspend the binding and attaching of the children until the promise is resolved. This is useful for fetching/save of data before rendering.

```typescript
export class MyComponent {
    binding(initiator: IHydratedController, parent: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Bound

If your component has a method named "bound", then the framework will invoke it when the bindings between your component and its view have been set. This is the best place to do anything that requires the values from `let`, `from-view` or `ref` bindings to be set.

```typescript
export class MyComponent {
    bound(initiator: IHydratedController, parent: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Attaching

If your component has a method named "attaching, " the framework will invoke it when it has attached the component's HTML element. You can queue animations and/or initialize certain 3rd party libraries.&#x20;

{% hint style="info" %}
If you return a `Promise` from this method, it will not suspend the binding/attaching of child components, but it will be awaited before the `attached` hook is invoked.
{% endhint %}

```typescript
export class MyComponent {
    attaching(initiator: IHydratedController, parent: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Attached

If your component has a method named "attached", the framework will invoke it when it has attached the current component and all of its children. In terms of the component hierarchy, the attached hooks execute bottom-up.

{% hint style="info" %}
This is the best time to invoke code that requires measuring of elements or integrating a 3rd party JavaScript library that requires the whole component subtree to be mounted to the DOM.
{% endhint %}

```typescript
export class MyComponent {
    attached(initiator: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Detaching

If your component has a method named "detaching", then the framework will invoke it when removing your HTML element from the document. In terms of the component hierarchy, the detaching hooks execute bottom-up.

{% hint style="info" %}
If you return a `Promise` (for example, from an outgoing animation), it will be awaited before the element is detached. It will run in parallel with promises returned from the `detaching` hooks of siblings/parents.
{% endhint %}

```typescript
export class MyComponent {
    detaching(initiator: IHydratedController, parent: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Unbinding

If your component has a method named "unbinding, " the framework will invoke it when it has fully removed your HTML element from the document. In terms of the component hierarchy, the `unbinding` hooks execute bottom-up.

```typescript
export class MyComponent {
    unbinding(initiator: IHydratedController, parent: IHydratedController, flags: LifecycleFlags) {

    }
}
```

## Dispose

If your component has a method named "dispose", then the framework will invoke it when the component is to be cleared from memory completely. It may be called, for example, when a component is in a repeater, and some items are removed that are not returned to the cache.

{% hint style="warning" %}
**This is an advanced hook** mostly useful for cleaning up resources and references that might cause memory leaks if never explicitly dereferenced.
{% endhint %}

```typescript
export class MyComponent {
    dispose() {
    }
}
```

## Lifecycle Hooks

The lifecycle hooks API supports all of the above lifecycle methods. Using the `lifecycleHooks` decorator, you can perform actions at various points of the component lifecycle. Because the router uses lifecycle hooks, they are documented [here](component-lifecycles.md#lifecycle-hooks) in the router section, but do not require the use of the router to use (except for router-specific hooks).

## Others

**For `<au-compose>`**, there are extra lifecycle hooks that are `activate`/`deactivate`. Refers to [dynamic composition doc](../getting-to-know-aurelia/dynamic-composition.md) for more details.

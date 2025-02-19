import {
  AccessorOrObserver,
  AccessorType,
  astBind,
  astEvaluate,
  astUnbind,
  connectable,
  IAstEvaluator,
  IConnectableBinding
} from '@aurelia/runtime';
import { State } from '../templating/controller';
import { mixinAstEvaluator, mixinUseScope, mixingBindingLimited } from './binding-utils';
import { BindingMode } from './interfaces-bindings';

import type { IServiceLocator } from '@aurelia/kernel';
import type { ITask, QueueTaskOptions, TaskQueue } from '@aurelia/platform';
import type {
  IBinding, ICollectionSubscriber,
  Interpolation,
  IObserverLocator,
  IsExpression, Scope
} from '@aurelia/runtime';
import type { IPlatform } from '../platform';
import { isArray, safeString } from '../utilities';
import type { IBindingController } from './interfaces-bindings';

const queueTaskOptions: QueueTaskOptions = {
  reusable: false,
  preempt: true,
};

// a pseudo binding to manage multiple InterpolationBinding s
// ========
// Note: the child expressions of an Interpolation expression are full Aurelia expressions, meaning they may include
// value converters and binding behaviors.
// Each expression represents one ${interpolation}, and for each we create a child TextBinding unless there is only one,
// in which case the renderer will create the TextBinding directly
export interface InterpolationBinding extends IBinding {}
export class InterpolationBinding implements IBinding {

  public isBound: boolean = false;

  /** @internal */
  public _scope?: Scope = void 0;

  public partBindings: InterpolationPartBinding[];

  /** @internal */
  private readonly _targetObserver: AccessorOrObserver;

  /** @internal */
  private _task: ITask | null = null;

  /**
   * A semi-private property used by connectable mixin
   *
   * @internal
   */
  public readonly oL: IObserverLocator;

  /** @internal */
  private readonly _taskQueue: TaskQueue;

  /** @internal */
  private readonly _controller: IBindingController;

  public constructor(
    controller: IBindingController,
    locator: IServiceLocator,
    observerLocator: IObserverLocator,
    taskQueue: TaskQueue,
    public ast: Interpolation,
    public target: object,
    public targetProperty: string,
    public mode: BindingMode,
  ) {
    this._controller = controller;
    this.oL = observerLocator;
    this._taskQueue = taskQueue;
    this._targetObserver = observerLocator.getAccessor(target, targetProperty);
    const expressions = ast.expressions;
    const partBindings = this.partBindings = Array(expressions.length);
    const ii = expressions.length;
    let i = 0;
    for (; ii > i; ++i) {
      partBindings[i] = new InterpolationPartBinding(expressions[i], target, targetProperty, locator, observerLocator, this);
    }
  }

  /** @internal */
  public _handlePartChange() {
    this.updateTarget();
  }

  public updateTarget(): void {
    const partBindings = this.partBindings;
    const staticParts = this.ast.parts;
    const ii = partBindings.length;
    let result = '';
    let i = 0;
    if (ii === 1) {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      result = staticParts[0] + partBindings[0]._value + staticParts[1];
    } else {
      result = staticParts[0];
      for (; ii > i; ++i) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        result += partBindings[i]._value + staticParts[i + 1];
      }
    }

    const targetObserver = this._targetObserver;
    // Alpha: during bind a simple strategy for bind is always flush immediately
    // todo:
    //  (1). determine whether this should be the behavior
    //  (2). if not, then fix tests to reflect the changes/platform to properly yield all with aurelia.start()
    const shouldQueueFlush = this._controller.state !== State.activating && (targetObserver.type & AccessorType.Layout) > 0;
    let task: ITask | null;
    if (shouldQueueFlush) {
      // Queue the new one before canceling the old one, to prevent early yield
      task = this._task;
      this._task = this._taskQueue.queueTask(() => {
        this._task = null;
        targetObserver.setValue(result, this.target, this.targetProperty);
      }, queueTaskOptions);
      task?.cancel();
      task = null;
    } else {
      targetObserver.setValue(result, this.target, this.targetProperty);
    }
  }

  public bind(_scope: Scope): void {
    if (this.isBound) {
      if (this._scope === _scope) {
        return;
      }
      this.unbind();
    }
    this._scope = _scope;

    const partBindings = this.partBindings;
    const ii = partBindings.length;
    let i = 0;
    for (; ii > i; ++i) {
      partBindings[i].bind(_scope);
    }
    this.updateTarget();
    this.isBound = true;
  }

  public unbind(): void {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    this._scope = void 0;
    const partBindings = this.partBindings;
    const ii = partBindings.length;
    let i = 0;
    for (; ii > i; ++i) {
      partBindings[i].unbind();
    }
    this._task?.cancel();
    this._task = null;
  }
}

// a pseudo binding, part of a larger interpolation binding
// employed to support full expression per expression part of an interpolation
export interface InterpolationPartBinding extends IAstEvaluator, IConnectableBinding {}

export class InterpolationPartBinding implements IBinding, ICollectionSubscriber {

  // at runtime, mode may be overriden by binding behavior
  // but it wouldn't matter here, just start with something for later check
  public readonly mode: BindingMode = BindingMode.toView;
  public _scope?: Scope;
  public task: ITask | null = null;
  public isBound: boolean = false;

  /** @internal */
  public _value: unknown = '';
  /**
   * A semi-private property used by connectable mixin
   *
   * @internal
   */
  public readonly oL: IObserverLocator;

  /** @internal */
  public readonly l: IServiceLocator;
  // see Listener binding for explanation
  /** @internal */
  public readonly boundFn = false;

  public constructor(
    public readonly ast: IsExpression,
    public readonly target: object,
    public readonly targetProperty: string,
    locator: IServiceLocator,
    observerLocator: IObserverLocator,
    public readonly owner: InterpolationBinding,
  ) {
    this.l = locator;
    this.oL = observerLocator;
  }

  public updateTarget() {
    this.owner._handlePartChange();
  }

  public handleChange(): void {
    if (!this.isBound) {
      return;
    }
    this.obs.version++;
    const newValue = astEvaluate(
      this.ast,
      this._scope!,
      this,
      // should observe?
      (this.mode & BindingMode.toView) > 0 ? this : null
    );
    this.obs.clear();
    // todo(!=): maybe should do strict comparison?
    // eslint-disable-next-line eqeqeq
    if (newValue != this._value) {
      this._value = newValue;
      if (isArray(newValue)) {
        this.observeCollection(newValue);
      }
      this.updateTarget();
    }
  }

  public handleCollectionChange(): void {
    this.handleChange();
  }

  public bind(_scope: Scope): void {
    if (this.isBound) {
      if (this._scope === _scope) {
        return;
      }
      this.unbind();
    }
    this._scope = _scope;

    astBind(this.ast, _scope, this);

    this._value = astEvaluate(
      this.ast,
      this._scope,
      this,
      (this.mode & BindingMode.toView) > 0 ?  this : null,
    );
    if (isArray(this._value)) {
      this.observeCollection(this._value);
    }

    this.isBound = true;
  }

  public unbind(): void {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;

    astUnbind(this.ast, this._scope!, this);

    this._scope = void 0;
    this.obs.clearAll();
  }
}

mixinUseScope(InterpolationPartBinding);
mixingBindingLimited(InterpolationPartBinding, () => 'updateTarget');
connectable(InterpolationPartBinding);
mixinAstEvaluator(true)(InterpolationPartBinding);

export interface ContentBinding extends IAstEvaluator, IConnectableBinding {}

/**
 * A binding for handling the element content interpolation
 */
export class ContentBinding implements IBinding, ICollectionSubscriber {
  public isBound: boolean = false;

  // at runtime, mode may be overriden by binding behavior
  // but it wouldn't matter here, just start with something for later check
  public readonly mode: BindingMode = BindingMode.toView;

  /** @internal */
  public _scope?: Scope;

  /** @internal */
  public _task: ITask | null = null;

  /**
   * A semi-private property used by connectable mixin
   *
   * @internal
   */
  public readonly oL: IObserverLocator;
  /** @internal */
  private readonly _taskQueue: TaskQueue;

  /** @internal */
  public readonly l: IServiceLocator;

  /** @internal */
  private _value: unknown = '';
  /** @internal */
  private readonly _controller: IBindingController;
  // see Listener binding for explanation
  /** @internal */
  public readonly boundFn = false;

  public constructor(
    controller: IBindingController,
    locator: IServiceLocator,
    observerLocator: IObserverLocator,
    taskQueue: TaskQueue,
    private readonly p: IPlatform,
    public readonly ast: IsExpression,
    public readonly target: Text,
    public readonly strict: boolean,
  ) {
    this.l = locator;
    this._controller = controller;
    this.oL = observerLocator;
    this._taskQueue = taskQueue;
  }

  public updateTarget(value: unknown): void {
    const target = this.target;
    const NodeCtor = this.p.Node;
    const oldValue = this._value;
    this._value = value;
    if (oldValue instanceof NodeCtor) {
      oldValue.parentNode?.removeChild(oldValue);
    }
    if (value instanceof NodeCtor) {
      target.textContent = '';
      target.parentNode?.insertBefore(value, target);
    } else {
      target.textContent = safeString(value);
    }
  }

  public handleChange(): void {
    if (!this.isBound) {
      return;
    }
    this.obs.version++;
    const newValue = astEvaluate(
      this.ast,
      this._scope!,
      this,
      // should observe?
      (this.mode & BindingMode.toView) > 0 ? this : null
    );
    this.obs.clear();
    if (newValue === this._value) {
      // in a frequent update, e.g collection mutation in a loop
      // value could be changing frequently and previous update task may be stale at this point
      // cancel if any task going on because the latest value is already the same
      this._task?.cancel();
      this._task = null;
      return;
    }
    const shouldQueueFlush = this._controller.state !== State.activating;
    if (shouldQueueFlush) {
      this._queueUpdate(newValue);
    } else {
      this.updateTarget(newValue);
    }
  }

  public handleCollectionChange(): void {
    if (!this.isBound) {
      return;
    }
    this.obs.version++;
    const v = this._value = astEvaluate(
      this.ast,
      this._scope!,
      this,
      (this.mode & BindingMode.toView) > 0 ?  this : null,
    );
    this.obs.clear();
    if (isArray(v)) {
      this.observeCollection(v);
    }
    const shouldQueueFlush = this._controller.state !== State.activating;
    if (shouldQueueFlush) {
      this._queueUpdate(v);
    } else {
      this.updateTarget(v);
    }
  }

  public bind(_scope: Scope): void {
    if (this.isBound) {
      if (this._scope === _scope) {
        return;
      }
      this.unbind();
    }
    this._scope = _scope;

    astBind(this.ast, _scope, this);

    const v = this._value = astEvaluate(
      this.ast,
      this._scope,
      this,
      (this.mode & BindingMode.toView) > 0 ?  this : null,
    );
    if (isArray(v)) {
      this.observeCollection(v);
    }
    this.updateTarget(v);

    this.isBound = true;
  }

  public unbind(): void {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;

    astUnbind(this.ast, this._scope!, this);

    // TODO: should existing value (either connected node, or a string)
    // be removed when this binding is unbound?
    // this.updateTarget('');
    this._scope = void 0;
    this.obs.clearAll();
    this._task?.cancel();
    this._task = null;
  }

  // queue a force update
  /** @internal */
  private _queueUpdate(newValue: unknown): void {
    const task = this._task;
    this._task = this._taskQueue.queueTask(() => {
      this._task = null;
      this.updateTarget(newValue);
    }, queueTaskOptions);
    task?.cancel();
  }
}

mixinUseScope(ContentBinding);
mixingBindingLimited(ContentBinding, () => 'updateTarget');
connectable()(ContentBinding);
mixinAstEvaluator(void 0, false)(ContentBinding);

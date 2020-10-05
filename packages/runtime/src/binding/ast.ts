import {
  IIndexable,
  IServiceLocator,
  PLATFORM,
  Reporter,
  StrictPrimitive,
  isNumberOrBigInt,
  isStringOrDate,
} from '@aurelia/kernel';
import {
  ExpressionKind,
  LifecycleFlags,
} from '../flags';
import { IBinding } from '../lifecycle';
import {
  Collection,
  IBindingContext,
  IOverrideContext,
  IScope,
  ObservedCollection,
} from '../observation';
import { BindingContext } from '../observation/binding-context';
import { ProxyObserver } from '../observation/proxy-observer';
import { ISignaler } from '../observation/signaler';
import {
  BindingBehavior, BindingBehaviorInstance, BindingBehaviorFactory,
} from '../resources/binding-behavior';
import {
  ValueConverter, ValueConverterInstance,
} from '../resources/value-converter';
import { IConnectableBinding } from './connectable';
import { CustomElementDefinition } from '../resources/custom-element';

export type UnaryOperator = 'void' | 'typeof' | '!' | '-' | '+';

export type BinaryOperator = '&&' | '||' | '==' | '===' | '!=' | '!==' | 'instanceof' | 'in' | '+' | '-' | '*' | '/' | '%' | '<' | '>' | '<=' | '>=';

export type IsPrimary = AccessThisExpression | AccessScopeExpression | ArrayLiteralExpression | ObjectLiteralExpression | PrimitiveLiteralExpression | TemplateExpression;
export type IsLiteral = ArrayLiteralExpression | ObjectLiteralExpression | PrimitiveLiteralExpression | TemplateExpression;
export type IsLeftHandSide = IsPrimary | CallFunctionExpression | CallMemberExpression | CallScopeExpression | AccessMemberExpression | AccessKeyedExpression | TaggedTemplateExpression;
export type IsUnary = IsLeftHandSide | UnaryExpression;
export type IsBinary = IsUnary | BinaryExpression;
export type IsConditional = IsBinary | ConditionalExpression;
export type IsAssign = IsConditional | AssignExpression;
export type IsValueConverter = IsAssign | ValueConverterExpression;
export type IsBindingBehavior = IsValueConverter | BindingBehaviorExpression;
export type IsAssignable = AccessScopeExpression | AccessKeyedExpression | AccessMemberExpression | AssignExpression;
export type IsExpression = IsBindingBehavior | Interpolation;
export type BindingIdentifierOrPattern = BindingIdentifier | ArrayBindingPattern | ObjectBindingPattern;
export type IsExpressionOrStatement = IsExpression | ForOfStatement | BindingIdentifierOrPattern | HtmlLiteralExpression;
export type AnyBindingExpression = Interpolation | ForOfStatement | IsBindingBehavior;

export interface IHydrator {
  hydrate(jsonExpr: any): any;
}
export interface IVisitor<T = unknown> {
  visitAccessKeyed(expr: AccessKeyedExpression): T;
  visitAccessMember(expr: AccessMemberExpression): T;
  visitAccessScope(expr: AccessScopeExpression): T;
  visitAccessThis(expr: AccessThisExpression): T;
  visitArrayBindingPattern(expr: ArrayBindingPattern): T;
  visitArrayLiteral(expr: ArrayLiteralExpression): T;
  visitAssign(expr: AssignExpression): T;
  visitBinary(expr: BinaryExpression): T;
  visitBindingBehavior(expr: BindingBehaviorExpression): T;
  visitBindingIdentifier(expr: BindingIdentifier): T;
  visitCallFunction(expr: CallFunctionExpression): T;
  visitCallMember(expr: CallMemberExpression): T;
  visitCallScope(expr: CallScopeExpression): T;
  visitConditional(expr: ConditionalExpression): T;
  visitForOfStatement(expr: ForOfStatement): T;
  visitHtmlLiteral(expr: HtmlLiteralExpression): T;
  visitInterpolation(expr: Interpolation): T;
  visitObjectBindingPattern(expr: ObjectBindingPattern): T;
  visitObjectLiteral(expr: ObjectLiteralExpression): T;
  visitPrimitiveLiteral(expr: PrimitiveLiteralExpression): T;
  visitTaggedTemplate(expr: TaggedTemplateExpression): T;
  visitTemplate(expr: TemplateExpression): T;
  visitUnary(expr: UnaryExpression): T;
  visitValueConverter(expr: ValueConverterExpression): T;
}

function chooseScope(accessHostScope: boolean, scope: IScope, hostScope: IScope | null){
  if (accessHostScope) {
    if (hostScope === null || hostScope === void 0) { throw new Error('Host scope is missing. Are you using `$host` outside the `au-slot`? Or missing the `au-slot` attribute?'); }
    return hostScope;
  }
  return scope;
}
const enum RuntimeError {
  NoLocator = 202,
  NoBehaviorFound = 203,
  BehaviorAlreadyApplied = 204,
  NoConverterFound = 205,
  NoBinding = 206,
  NotAFunction = 207,
  UnknownOperator = 208,
  NilScope = 250,
}

type BindingWithBehavior = IConnectableBinding & { [key: string]: BindingBehaviorInstance | undefined };

export class CustomExpression {
  public constructor(
    public readonly value: string,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): string {
    return this.value;
  }
}

/** @internal - only exists to workaround circular reference caused by emitted metadata */
export interface IBindingBehaviorExpression extends BindingBehaviorExpression {}
export class BindingBehaviorExpression {
  public readonly $kind: ExpressionKind.BindingBehavior = ExpressionKind.BindingBehavior;
  public get hasBind(): true { return true; }
  public get hasUnbind(): true { return true; }
  public readonly behaviorKey: string;

  public constructor(
    public readonly expression: IsBindingBehavior,
    public readonly name: string,
    public readonly args: readonly IsAssign[],
  ) {
    this.behaviorKey = BindingBehavior.keyFrom(name);
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    return this.expression.evaluate(flags, scope, hostScope, locator);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    return this.expression.assign!(flags, scope, hostScope, locator, value);
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    this.expression.connect(flags, scope, hostScope, binding);
  }

  public bind(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    if (scope == null) {
      throw Reporter.error(RuntimeError.NilScope, this);
    }
    if (!binding) {
      throw Reporter.error(RuntimeError.NoBinding, this);
    }
    const locator = binding.locator;
    if (!locator) {
      throw Reporter.error(RuntimeError.NoLocator, this);
    }
    if (this.expression.hasBind) {
      this.expression.bind(flags, scope, hostScope, binding);
    }
    const behaviorKey = this.behaviorKey;
    const behavior = locator.get<BindingBehaviorInstance>(behaviorKey);
    if (!behavior) {
      throw Reporter.error(RuntimeError.NoBehaviorFound, this);
    }
    if (!(behavior instanceof BindingBehaviorFactory)) {
      if ((binding as BindingWithBehavior)[behaviorKey] === void 0) {
        (binding as BindingWithBehavior)[behaviorKey] = behavior;
        (behavior.bind.call as (...args: unknown[]) => void)(behavior, flags, scope, hostScope, binding, ...evalList(flags, scope, locator, this.args, hostScope));
      } else {
        Reporter.write(RuntimeError.BehaviorAlreadyApplied, this);
      }
    }
  }

  public unbind(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const behaviorKey = this.behaviorKey;
    if ((binding as BindingWithBehavior)[behaviorKey] !== void 0) {
      if (typeof (binding as BindingWithBehavior)[behaviorKey]!.unbind === 'function') {
        (binding as BindingWithBehavior)[behaviorKey]!.unbind(flags, scope, hostScope, binding);
      }
      (binding as BindingWithBehavior)[behaviorKey] = void 0;
    }
    if (this.expression.hasUnbind) {
      this.expression.unbind(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitBindingBehavior(this);
  }
}

export class ValueConverterExpression {
  public readonly $kind: ExpressionKind.ValueConverter = ExpressionKind.ValueConverter;
  public readonly converterKey: string;
  public get hasBind(): false { return false; }
  public get hasUnbind(): true { return true; }

  public constructor(
    public readonly expression: IsValueConverter,
    public readonly name: string,
    public readonly args: readonly IsAssign[],
  ) {
    this.converterKey = ValueConverter.keyFrom(name);
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    if (!locator) {
      throw Reporter.error(RuntimeError.NoLocator, this);
    }
    const converter = locator.get<ValueConverterExpression & ValueConverterInstance>(this.converterKey);
    if (!converter) {
      throw Reporter.error(RuntimeError.NoConverterFound, this);
    }
    if ('toView' in converter) {
      const args = this.args;
      const len = args.length;
      const result = Array(len + 1);
      result[0] = this.expression.evaluate(flags, scope, hostScope, locator);
      for (let i = 0; i < len; ++i) {
        result[i + 1] = args[i].evaluate(flags, scope, hostScope, locator);
      }
      return (converter.toView.call as (...args: unknown[]) => void)(converter, ...result);
    }
    return this.expression.evaluate(flags, scope, hostScope, locator);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    if (!locator) {
      throw Reporter.error(RuntimeError.NoLocator, this);
    }
    const converter = locator.get<ValueConverterExpression & ValueConverterInstance>(this.converterKey);
    if (!converter) {
      throw Reporter.error(RuntimeError.NoConverterFound, this);
    }
    if ('fromView' in converter) {
      value = (converter.fromView!.call as (...args: unknown[]) => void)(converter, value, ...(evalList(flags, scope, locator, this.args, hostScope)));
    }
    return this.expression.assign!(flags, scope, hostScope, locator, value);
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    if (scope == null) {
      throw Reporter.error(RuntimeError.NilScope, this);
    }
    if (!binding) {
      throw Reporter.error(RuntimeError.NoBinding, this);
    }
    const locator = binding.locator;
    if (!locator) {
      throw Reporter.error(RuntimeError.NoLocator, this);
    }
    this.expression.connect(flags, scope, hostScope, binding);
    const args = this.args;
    for (let i = 0, ii = args.length; i < ii; ++i) {
      args[i].connect(flags, scope, hostScope, binding);
    }
    const converter = locator.get(this.converterKey) as { signals?: string[] };
    if (!converter) {
      throw Reporter.error(RuntimeError.NoConverterFound, this);
    }
    const signals = converter.signals;
    if (signals === void 0) {
      return;
    }
    const signaler = locator.get(ISignaler);
    for (let i = 0, ii = signals.length; i < ii; ++i) {
      signaler.addSignalListener(signals[i], binding);
    }
  }

  public unbind(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const locator = binding.locator;
    const converter = locator.get(this.converterKey) as { signals?: string[] };
    const signals = converter.signals;
    if (signals === void 0) {
      return;
    }
    const signaler = locator.get(ISignaler);
    for (let i = 0, ii = signals.length; i < ii; ++i) {
      signaler.removeSignalListener(signals[i], binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitValueConverter(this);
  }
}

export class AssignExpression {
  public readonly $kind: ExpressionKind.Assign = ExpressionKind.Assign;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly target: IsAssignable,
    public readonly value: IsAssign,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    return this.target.assign(flags, scope, hostScope, locator, this.value.evaluate(flags, scope, hostScope, locator));
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    this.value.assign!(flags, scope, hostScope, locator, value);
    return this.target.assign(flags, scope, hostScope, locator, value);
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitAssign(this);
  }
}

export class ConditionalExpression {
  public readonly $kind: ExpressionKind.Conditional = ExpressionKind.Conditional;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly condition: IsBinary,
    public readonly yes: IsAssign,
    public readonly no: IsAssign,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    return (!!this.condition.evaluate(flags, scope, hostScope, locator))
      ? this.yes.evaluate(flags, scope, hostScope, locator)
      : this.no.evaluate(flags, scope, hostScope, locator);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const condition = this.condition;
    if (condition.evaluate(flags, scope, hostScope, binding.locator)) {
      this.condition.connect(flags, scope, hostScope, binding);
      this.yes.connect(flags, scope, hostScope, binding);
    } else {
      this.condition.connect(flags, scope, hostScope, binding);
      this.no.connect(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitConditional(this);
  }
}

export class AccessThisExpression {
  public static readonly $this: AccessThisExpression = new AccessThisExpression(0);
  // $host and $this are loosely the same thing. $host is used in the context of `au-slot` with the primary objective of determining the scope.
  public static readonly $host: AccessThisExpression = new AccessThisExpression(0);
  public static readonly $parent: AccessThisExpression = new AccessThisExpression(1);
  public readonly $kind: ExpressionKind.AccessThis = ExpressionKind.AccessThis;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly ancestor: number = 0,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): IBindingContext | undefined {
    if (scope == null) {
      throw Reporter.error(RuntimeError.NilScope, this);
    }
    if (this === AccessThisExpression.$host) {
      scope = chooseScope(true, scope, hostScope);
    }
    let oc: IOverrideContext | null = scope.overrideContext;
    let currentScope: IScope | null = scope;
    let i = this.ancestor;
    while (i-- && oc) {
      currentScope = currentScope!.parentScope;
      oc = currentScope?.overrideContext ?? null;
    }
    return i < 1 && oc ? oc.bindingContext : void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitAccessThis(this);
  }
}

export class AccessScopeExpression {
  public readonly $kind: ExpressionKind.AccessScope = ExpressionKind.AccessScope;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly name: string,
    public readonly ancestor: number = 0,
    public readonly accessHostScope: boolean = false,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): IBindingContext | IBinding | IOverrideContext {
    const obj = BindingContext.get(chooseScope(this.accessHostScope, scope, hostScope), this.name, this.ancestor, flags, hostScope) as IBindingContext;
    const evaluatedValue = obj[this.name] as ReturnType<AccessScopeExpression['evaluate']>;
    if (flags & LifecycleFlags.isStrictBindingStrategy) {
      return evaluatedValue;
    }
    return evaluatedValue == null ? '' as unknown as ReturnType<AccessScopeExpression['evaluate']> : evaluatedValue;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    const obj = BindingContext.get(chooseScope(this.accessHostScope, scope, hostScope), this.name, this.ancestor, flags, hostScope) as IBindingContext;
    if (obj instanceof Object) {
      if (obj.$observers !== void 0 && obj.$observers[this.name] !== void 0) {
        obj.$observers[this.name].setValue(value, flags);
        return value;
      } else {
        return obj[this.name] = value;
      }
    }
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const context = BindingContext.get(chooseScope(this.accessHostScope, scope, hostScope), this.name, this.ancestor, flags, hostScope)!;
    binding.observeProperty(flags, context, this.name);
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitAccessScope(this);
  }
}

export class AccessMemberExpression {
  public readonly $kind: ExpressionKind.AccessMember = ExpressionKind.AccessMember;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly object: IsLeftHandSide,
    public readonly name: string,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    const instance = this.object.evaluate(flags, scope, hostScope, locator) as IIndexable;
    if (flags & LifecycleFlags.isStrictBindingStrategy) {
      return instance == null ? instance : instance[this.name];
    }
    return instance ? instance[this.name] : '';
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    const obj = this.object.evaluate(flags, scope, hostScope, locator) as IBindingContext;
    if (obj instanceof Object) {
      if (obj.$observers !== void 0 && obj.$observers[this.name] !== void 0) {
        obj.$observers[this.name].setValue(value, flags);
      } else {
        obj[this.name] = value;
      }
    } else {
      this.object.assign!(flags, scope, hostScope, locator, { [this.name]: value });
    }
    return value;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const obj = this.object.evaluate(flags, scope, hostScope, binding.locator) as IIndexable;
    if ((flags & LifecycleFlags.observeLeafPropertiesOnly) === 0) {
      this.object.connect(flags, scope, hostScope, binding);
    }
    if (obj instanceof Object) {
      binding.observeProperty(flags, obj, this.name);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitAccessMember(this);
  }
}

export class AccessKeyedExpression {
  public readonly $kind: ExpressionKind.AccessKeyed = ExpressionKind.AccessKeyed;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly object: IsLeftHandSide,
    public readonly key: IsAssign,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    const instance = this.object.evaluate(flags, scope, hostScope, locator) as IIndexable;
    if (instance instanceof Object) {
      const key = this.key.evaluate(flags, scope, hostScope, locator) as string;
      return instance[key];
    }
    return void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, value: unknown): unknown {
    const instance = this.object.evaluate(flags, scope, hostScope, locator) as IIndexable;
    const key = this.key.evaluate(flags, scope, hostScope, locator) as string;
    return instance[key] = value;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const obj = this.object.evaluate(flags, scope, hostScope, binding.locator);
    if ((flags & LifecycleFlags.observeLeafPropertiesOnly) === 0) {
      this.object.connect(flags, scope, hostScope, binding);
    }
    if (obj instanceof Object) {
      this.key.connect(flags, scope, hostScope, binding);
      const key = this.key.evaluate(flags, scope, hostScope, binding.locator);
      // (note: string indexers behave the same way as numeric indexers as long as they represent numbers)
      binding.observeProperty(flags, obj, key as string);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitAccessKeyed(this);
  }
}

export class CallScopeExpression {
  public readonly $kind: ExpressionKind.CallScope = ExpressionKind.CallScope;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly name: string,
    public readonly args: readonly IsAssign[],
    public readonly ancestor: number = 0,
    public readonly accessHostScope: boolean = false,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    scope = chooseScope(this.accessHostScope, scope, hostScope);
    const args = evalList(flags, scope, locator, this.args, hostScope);
    const context = BindingContext.get(scope, this.name, this.ancestor, flags, hostScope)!;
    const func = getFunction(flags, context, this.name);
    if (func) {
      return func.apply(context, args as unknown[]);
    }
    return void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const args = this.args;
    for (let i = 0, ii = args.length; i < ii; ++i) {
      args[i].connect(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitCallScope(this);
  }
}

export class CallMemberExpression {
  public readonly $kind: ExpressionKind.CallMember = ExpressionKind.CallMember;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly object: IsLeftHandSide,
    public readonly name: string,
    public readonly args: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    const instance = this.object.evaluate(flags, scope, hostScope, locator) as IIndexable;
    const args = evalList(flags, scope, locator, this.args, hostScope);
    const func = getFunction(flags, instance, this.name);
    if (func) {
      return func.apply(instance, args as unknown[]);
    }
    return void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const obj = this.object.evaluate(flags, scope, hostScope, binding.locator) as IIndexable;
    if ((flags & LifecycleFlags.observeLeafPropertiesOnly) === 0) {
      this.object.connect(flags, scope, hostScope, binding);
    }
    if (getFunction(flags & ~LifecycleFlags.mustEvaluate, obj, this.name)) {
      const args = this.args;
      for (let i = 0, ii = args.length; i < ii; ++i) {
        args[i].connect(flags, scope, hostScope, binding);
      }
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitCallMember(this);
  }
}

export class CallFunctionExpression {
  public readonly $kind: ExpressionKind.CallFunction = ExpressionKind.CallFunction;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly func: IsLeftHandSide,
    public readonly args: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    const func = this.func.evaluate(flags, scope, hostScope, locator);
    if (typeof func === 'function') {
      return func(...evalList(flags, scope, locator, this.args, hostScope));
    }
    if (!(flags & LifecycleFlags.mustEvaluate) && (func == null)) {
      return void 0;
    }
    throw Reporter.error(RuntimeError.NotAFunction, this);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const func = this.func.evaluate(flags, scope, hostScope, binding.locator);
    this.func.connect(flags, scope, hostScope, binding);
    if (typeof func === 'function') {
      const args = this.args;
      for (let i = 0, ii = args.length; i < ii; ++i) {
        args[i].connect(flags, scope, hostScope, binding);
      }
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitCallFunction(this);
  }
}

export class BinaryExpression {
  public readonly $kind: ExpressionKind.Binary = ExpressionKind.Binary;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly operation: BinaryOperator,
    public readonly left: IsBinary,
    public readonly right: IsBinary,
  ) {
    // what we're doing here is effectively moving the large switch statement from evaluate to the constructor
    // so that the check only needs to be done once, and evaluate (which is called many times) will have a lot less
    // work to do; we can do this because the operation can't change after it's parsed
    this.evaluate = this[operation];
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    throw Reporter.error(RuntimeError.UnknownOperator, this);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    this.left.connect(flags, scope, hostScope, binding);
    this.right.connect(flags, scope, hostScope, binding);
  }

  /* eslint-disable no-useless-computed-key */
  private ['&&'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): unknown {
    return this.left.evaluate(f, s, hs, l) && this.right.evaluate(f, s, hs, l);
  }
  private ['||'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): unknown {
    return this.left.evaluate(f, s, hs, l) || this.right.evaluate(f, s, hs, l);
  }
  private ['=='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    // eslint-disable-next-line eqeqeq
    return this.left.evaluate(f, s, hs, l) == this.right.evaluate(f, s, hs, l);
  }
  private ['==='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return this.left.evaluate(f, s, hs, l) === this.right.evaluate(f, s, hs, l);
  }
  private ['!='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    // eslint-disable-next-line eqeqeq
    return this.left.evaluate(f, s, hs, l) != this.right.evaluate(f, s, hs, l);
  }
  private ['!=='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return this.left.evaluate(f, s, hs, l) !== this.right.evaluate(f, s, hs, l);
  }
  private ['instanceof'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    const right = this.right.evaluate(f, s, hs, l);
    if (typeof right === 'function') {
      return this.left.evaluate(f, s, hs, l) instanceof right;
    }
    return false;
  }
  private ['in'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    const right = this.right.evaluate(f, s, hs, l);
    if (right instanceof Object) {
      return this.left.evaluate(f, s, hs, l) as string in right;
    }
    return false;
  }

  // note: autoConvertAdd (and the null check) is removed because the default spec behavior is already largely similar
  // and where it isn't, you kind of want it to behave like the spec anyway (e.g. return NaN when adding a number to undefined)
  // this makes bugs in user code easier to track down for end users
  // also, skipping these checks and leaving it to the runtime is a nice little perf boost and simplifies our code
  private ['+'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number | string {
    const left: any = this.left.evaluate(f, s, hs, l);
    const right: any = this.right.evaluate(f, s, hs, l);

    if ((f & LifecycleFlags.isStrictBindingStrategy) > 0) {
      return (left as number) + (right as number);
    }

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!left || !right) {
      if (isNumberOrBigInt(left) || isNumberOrBigInt(right)) {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
        return (left as number || 0) + (right as number || 0);
      }
      if (isStringOrDate(left) || isStringOrDate(right)) {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
        return (left as string || '') + (right as string || '');
      }
    }
    return (left as number) + (right as number);
  }
  private ['-'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return (this.left.evaluate(f, s, hs, l) as number) - (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['*'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return (this.left.evaluate(f, s, hs, l) as number) * (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['/'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return (this.left.evaluate(f, s, hs, l) as number) / (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['%'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return (this.left.evaluate(f, s, hs, l) as number) % (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['<'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return (this.left.evaluate(f, s, hs, l) as number) < (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['>'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return (this.left.evaluate(f, s, hs, l) as number) > (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['<='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return (this.left.evaluate(f, s, hs, l) as number) <= (this.right.evaluate(f, s, hs, l) as number);
  }
  private ['>='](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return (this.left.evaluate(f, s, hs, l) as number) >= (this.right.evaluate(f, s, hs, l) as number);
  }
  /* eslint-enable no-useless-computed-key */

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitBinary(this);
  }
}

export class UnaryExpression {
  public readonly $kind: ExpressionKind.Unary = ExpressionKind.Unary;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly operation: UnaryOperator,
    public readonly expression: IsLeftHandSide,
  ) {
    // see Binary (we're doing the same thing here)
    this.evaluate = this[operation];
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    throw Reporter.error(RuntimeError.UnknownOperator, this);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    this.expression.connect(flags, scope, hostScope, binding);
  }

  /* eslint-disable no-useless-computed-key */
  public ['void'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): undefined {
    return void this.expression.evaluate(f, s, hs, l);
  }
  public ['typeof'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): string {
    return typeof this.expression.evaluate(f | LifecycleFlags.isStrictBindingStrategy, s, hs, l);
  }
  public ['!'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): boolean {
    return !this.expression.evaluate(f, s, hs, l);
  }
  public ['-'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return -(this.expression.evaluate(f, s, hs, l) as number);
  }
  public ['+'](f: LifecycleFlags, s: IScope, hs: IScope | null, l: IServiceLocator): number {
    return +(this.expression.evaluate(f, s, hs, l) as number);
  }
  /* eslint-enable no-useless-computed-key */

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitUnary(this);
  }
}
export class PrimitiveLiteralExpression<TValue extends StrictPrimitive = StrictPrimitive> {
  public static readonly $undefined: PrimitiveLiteralExpression<undefined> = new PrimitiveLiteralExpression<undefined>(void 0);
  public static readonly $null: PrimitiveLiteralExpression<null> = new PrimitiveLiteralExpression<null>(null);
  public static readonly $true: PrimitiveLiteralExpression<true> = new PrimitiveLiteralExpression<true>(true);
  public static readonly $false: PrimitiveLiteralExpression<false> = new PrimitiveLiteralExpression<false>(false);
  public static readonly $empty: PrimitiveLiteralExpression<string> = new PrimitiveLiteralExpression<''>('');
  public readonly $kind: ExpressionKind.PrimitiveLiteral = ExpressionKind.PrimitiveLiteral;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly value: TValue,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): TValue {
    return this.value;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitPrimitiveLiteral(this);
  }
}

export class HtmlLiteralExpression {
  public readonly $kind: ExpressionKind.HtmlLiteral = ExpressionKind.HtmlLiteral;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly parts: readonly HtmlLiteralExpression[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): string {
    const elements = this.parts;
    let result = '';
    let value;
    for (let i = 0, ii = elements.length; i < ii; ++i) {
      value = elements[i].evaluate(flags, scope, hostScope, locator);
      if (value == null) {
        continue;
      }
      result += value;
    }
    return result;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown, rojection?: CustomElementDefinition): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    for (let i = 0, ii = this.parts.length; i < ii; ++i) {
      this.parts[i].connect(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitHtmlLiteral(this);
  }
}

export class ArrayLiteralExpression {
  public static readonly $empty: ArrayLiteralExpression = new ArrayLiteralExpression(PLATFORM.emptyArray);
  public readonly $kind: ExpressionKind.ArrayLiteral = ExpressionKind.ArrayLiteral;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly elements: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): readonly unknown[] {
    const elements = this.elements;
    const length = elements.length;
    const result = Array(length);
    for (let i = 0; i < length; ++i) {
      result[i] = elements[i].evaluate(flags, scope, hostScope, locator);
    }
    return result;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const elements = this.elements;
    for (let i = 0, ii = elements.length; i < ii; ++i) {
      elements[i].connect(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitArrayLiteral(this);
  }
}

export class ObjectLiteralExpression {
  public static readonly $empty: ObjectLiteralExpression = new ObjectLiteralExpression(PLATFORM.emptyArray, PLATFORM.emptyArray);
  public readonly $kind: ExpressionKind.ObjectLiteral = ExpressionKind.ObjectLiteral;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly keys: readonly (number | string)[],
    public readonly values: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): Record<string, unknown> {
    const instance: Record<string, unknown> = {};
    const keys = this.keys;
    const values = this.values;
    for (let i = 0, ii = keys.length; i < ii; ++i) {
      instance[keys[i]] = values[i].evaluate(flags, scope, hostScope, locator);
    }
    return instance;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const keys = this.keys;
    const values = this.values;
    for (let i = 0, ii = keys.length; i < ii; ++i) {
      values[i].connect(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitObjectLiteral(this);
  }
}

export class TemplateExpression {
  public static readonly $empty: TemplateExpression = new TemplateExpression(['']);
  public readonly $kind: ExpressionKind.Template = ExpressionKind.Template;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly cooked: readonly string[],
    public readonly expressions: readonly IsAssign[] = PLATFORM.emptyArray,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): string {
    const expressions = this.expressions;
    const cooked = this.cooked;
    let result = cooked[0];
    for (let i = 0, ii = expressions.length; i < ii; ++i) {
      result += expressions[i].evaluate(flags, scope, hostScope, locator);
      result += cooked[i + 1];
    }
    return result;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const expressions = this.expressions;
    for (let i = 0, ii = expressions.length; i < ii; ++i) {
      expressions[i].connect(flags, scope, hostScope, binding);
      i++;
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitTemplate(this);
  }
}

export class TaggedTemplateExpression {
  public readonly $kind: ExpressionKind.TaggedTemplate = ExpressionKind.TaggedTemplate;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly cooked: readonly string[] & { raw?: readonly string[] },
    raw: readonly string[],
    public readonly func: IsLeftHandSide,
    public readonly expressions: readonly IsAssign[] = PLATFORM.emptyArray,
  ) {
    cooked.raw = raw;
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): string {
    const expressions = this.expressions;
    const len = expressions.length;
    const results = Array(len);
    for (let i = 0, ii = len; i < ii; ++i) {
      results[i] = expressions[i].evaluate(flags, scope, hostScope, locator);
    }
    const func = this.func.evaluate(flags, scope, hostScope, locator);
    if (typeof func !== 'function') {
      throw Reporter.error(RuntimeError.NotAFunction, this);
    }
    return func(this.cooked, ...results);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    const expressions = this.expressions;
    for (let i = 0, ii = expressions.length; i < ii; ++i) {
      expressions[i].connect(flags, scope, hostScope, binding);
    }
    this.func.connect(flags, scope, hostScope, binding);
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitTaggedTemplate(this);
  }
}

export class ArrayBindingPattern {
  public readonly $kind: ExpressionKind.ArrayBindingPattern = ExpressionKind.ArrayBindingPattern;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  // We'll either have elements, or keys+values, but never all 3
  public constructor(
    public readonly elements: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    // TODO
    return void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    // TODO
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitArrayBindingPattern(this);
  }
}

export class ObjectBindingPattern {
  public readonly $kind: ExpressionKind.ObjectBindingPattern = ExpressionKind.ObjectBindingPattern;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  // We'll either have elements, or keys+values, but never all 3
  public constructor(
    public readonly keys: readonly (string | number)[],
    public readonly values: readonly IsAssign[],
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    // TODO
    return void 0;
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    // TODO
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitObjectBindingPattern(this);
  }
}

export class BindingIdentifier {
  public readonly $kind: ExpressionKind.BindingIdentifier = ExpressionKind.BindingIdentifier;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly name: string,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator | null): string {
    return this.name;
  }
  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitBindingIdentifier(this);
  }
}

const toStringTag = Object.prototype.toString as {
  call(obj: unknown): keyof '[object Array]' | '[object Map]' | '[object Set]' | '[object Number]' | '[object Null]' | '[object Undefined]';
};

// https://tc39.github.io/ecma262/#sec-iteration-statements
// https://tc39.github.io/ecma262/#sec-for-in-and-for-of-statements
export class ForOfStatement {
  public readonly $kind: ExpressionKind.ForOfStatement = ExpressionKind.ForOfStatement;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly declaration: BindingIdentifierOrPattern,
    public readonly iterable: IsBindingBehavior,
  ) {}

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): unknown {
    return this.iterable.evaluate(flags, scope, hostScope, locator);
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public count(flags: LifecycleFlags, result: ObservedCollection | number | null | undefined): number {
    switch (toStringTag.call(result)) {
      case '[object Array]': return (result as unknown[]).length;
      case '[object Map]': return (result as Map<unknown, unknown>).size;
      case '[object Set]': return (result as Set<unknown>).size;
      case '[object Number]': return result as number;
      case '[object Null]': return 0;
      case '[object Undefined]': return 0;
      default: throw Reporter.error(0); // TODO: Set error code
    }
  }

  public iterate(flags: LifecycleFlags, result: ObservedCollection | number | null | undefined, func: (arr: Collection, index: number, item: unknown) => void): void {
    switch (toStringTag.call(result)) {
      case '[object Array]': return $array(flags, result as unknown[], func);
      case '[object Map]': return $map(flags, result as Map<unknown, unknown>, func);
      case '[object Set]': return $set(flags, result as Set<unknown>, func);
      case '[object Number]': return $number(flags, result as number, func);
      case '[object Null]': return;
      case '[object Undefined]': return;
      default: throw Reporter.error(0); // TODO: Set error code
    }
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    this.declaration.connect(flags, scope, hostScope, binding);
    this.iterable.connect(flags, scope, hostScope, binding);
  }

  public bind(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    if (this.iterable.hasBind) {
      this.iterable.bind(flags, scope, hostScope, binding);
    }
  }

  public unbind(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    if (this.iterable.hasUnbind) {
      this.iterable.unbind(flags, scope, hostScope, binding);
    }
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitForOfStatement(this);
  }
}

/*
* Note: this implementation is far simpler than the one in vCurrent and might be missing important stuff (not sure yet)
* so while this implementation is identical to Template and we could reuse that one, we don't want to lock outselves in to potentially the wrong abstraction
* but this class might be a candidate for removal if it turns out it does provide all we need
*/
export class Interpolation {
  public readonly $kind: ExpressionKind.Interpolation = ExpressionKind.Interpolation;
  public readonly isMulti: boolean;
  public readonly firstExpression: IsBindingBehavior;
  public get hasBind(): false { return false; }
  public get hasUnbind(): false { return false; }

  public constructor(
    public readonly parts: readonly string[],
    public readonly expressions: readonly IsBindingBehavior[] = PLATFORM.emptyArray,
  ) {
    this.isMulti = expressions.length > 1;
    this.firstExpression = expressions[0];
  }

  public evaluate(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator): string {
    if (this.isMulti) {
      const expressions = this.expressions;
      const parts = this.parts;
      let result = parts[0];
      for (let i = 0, ii = expressions.length; i < ii; ++i) {
        result += expressions[i].evaluate(flags, scope, hostScope, locator);
        result += parts[i + 1];
      }
      return result;
    } else {
      const parts = this.parts;
      return `${parts[0]}${this.firstExpression.evaluate(flags, scope, hostScope, locator)}${parts[1]}`;
    }
  }

  public assign(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, locator: IServiceLocator, obj: unknown): unknown {
    return void 0;
  }

  public connect(flags: LifecycleFlags, scope: IScope, hostScope: IScope | null, binding: IConnectableBinding): void {
    return;
  }

  public accept<T>(visitor: IVisitor<T>): T {
    return visitor.visitInterpolation(this);
  }
}

/// Evaluate the [list] in context of the [scope].
function evalList(flags: LifecycleFlags, scope: IScope, locator: IServiceLocator, list: readonly IsExpression[], hostScope: IScope | null): readonly unknown[] {
  const len = list.length;
  const result = Array(len);
  for (let i = 0; i < len; ++i) {
    result[i] = list[i].evaluate(flags, scope, hostScope, locator);
  }
  return result;
}

function getFunction(flags: LifecycleFlags, obj: object, name: string): ((...args: unknown[]) => unknown) | null {
  const func = obj == null ? null : (obj as IIndexable)[name];
  if (typeof func === 'function') {
    return func as (...args: unknown[]) => unknown;
  }
  if (!(flags & LifecycleFlags.mustEvaluate) && func == null) {
    return null;
  }
  throw Reporter.error(RuntimeError.NotAFunction, obj, name, func);
}

const proxyAndOriginalArray = LifecycleFlags.proxyStrategy;

function $array(flags: LifecycleFlags, result: unknown[], func: (arr: Collection, index: number, item: unknown) => void): void {
  if ((flags & proxyAndOriginalArray) === proxyAndOriginalArray) {
    // If we're in proxy mode, and the array is the original "items" (and not an array we created here to iterate over e.g. a set)
    // then replace all items (which are Objects) with proxies so their properties are observed in the source view model even if no
    // observers are explicitly created
    const rawArray = ProxyObserver.getRawIfProxy(result);
    const len = rawArray.length;
    let item: unknown;
    let i = 0;
    for (; i < len; ++i) {
      item = rawArray[i];
      if (item instanceof Object) {
        item = rawArray[i] = ProxyObserver.getOrCreate(item).proxy;
      }
      func(rawArray, i, item);
    }
  } else {
    for (let i = 0, ii = result.length; i < ii; ++i) {
      func(result, i, result[i]);
    }
  }
}

function $map(flags: LifecycleFlags, result: Map<unknown, unknown>, func: (arr: Collection, index: number, item: unknown) => void): void {
  const arr = Array(result.size);
  let i = -1;
  for (const entry of result.entries()) {
    arr[++i] = entry;
  }
  $array(flags, arr, func);
}

function $set(flags: LifecycleFlags, result: Set<unknown>, func: (arr: Collection, index: number, item: unknown) => void): void {
  const arr = Array(result.size);
  let i = -1;
  for (const key of result.keys()) {
    arr[++i] = key;
  }
  $array(flags, arr, func);
}

function $number(flags: LifecycleFlags, result: number, func: (arr: Collection, index: number, item: unknown) => void): void {
  const arr = Array(result);
  for (let i = 0; i < result; ++i) {
    arr[i] = i;
  }
  $array(flags, arr, func);
}

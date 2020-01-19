(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "tslib", "../binding-behavior", "../../scheduler", "../../binding/ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require("tslib");
    const binding_behavior_1 = require("../binding-behavior");
    const scheduler_1 = require("../../scheduler");
    const ast_1 = require("../../binding/ast");
    let DebounceBindingBehavior = class DebounceBindingBehavior extends binding_behavior_1.BindingInterceptor {
        constructor(binding, expr) {
            super(binding, expr);
            this.opts = { delay: 0 };
            this.firstArg = null;
            this.task = null;
            this.taskQueue = binding.locator.get(scheduler_1.IScheduler).getPostRenderTaskQueue();
            if (expr.args.length > 0) {
                this.firstArg = expr.args[0];
            }
        }
        callSource(args) {
            this.queueTask(() => this.binding.callSource(args));
            return void 0;
        }
        handleChange(newValue, previousValue, flags) {
            this.queueTask(() => this.binding.handleChange(newValue, previousValue, flags));
        }
        queueTask(callback) {
            if (this.task !== null) {
                this.task.cancel();
            }
            this.task = this.taskQueue.queueTask(callback, this.opts);
        }
        $bind(flags, scope, part) {
            if (this.firstArg !== null) {
                const delay = Number(this.firstArg.evaluate(flags, scope, this.locator, part));
                if (!isNaN(delay)) {
                    this.opts.delay = delay;
                }
            }
            this.binding.$bind(flags, scope, part);
        }
    };
    DebounceBindingBehavior = tslib_1.__decorate([
        binding_behavior_1.bindingBehavior('debounce'),
        tslib_1.__metadata("design:paramtypes", [Object, ast_1.BindingBehaviorExpression])
    ], DebounceBindingBehavior);
    exports.DebounceBindingBehavior = DebounceBindingBehavior;
});
//# sourceMappingURL=debounce.js.map
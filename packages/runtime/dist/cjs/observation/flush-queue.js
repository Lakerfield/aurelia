"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlushQueue = exports.withFlushQueue = void 0;
const utilities_objects_js_1 = require("../utilities-objects.js");
function withFlushQueue(target) {
    return target == null ? queueableDeco : queueableDeco(target);
}
exports.withFlushQueue = withFlushQueue;
function queueableDeco(target) {
    const proto = target.prototype;
    utilities_objects_js_1.def(proto, 'queue', { get: getFlushQueue });
}
class FlushQueue {
    constructor() {
        this.flushing = false;
        this.items = new Set();
    }
    get count() {
        return this.items.size;
    }
    add(callable) {
        this.items.add(callable);
        if (this.flushing) {
            return;
        }
        this.flushing = true;
        const items = this.items;
        let item;
        try {
            for (item of items) {
                items.delete(item);
                item.flush();
            }
        }
        finally {
            this.flushing = false;
        }
    }
    clear() {
        this.items.clear();
        this.flushing = false;
    }
}
exports.FlushQueue = FlushQueue;
FlushQueue.instance = new FlushQueue();
function getFlushQueue() {
    return FlushQueue.instance;
}
//# sourceMappingURL=flush-queue.js.map
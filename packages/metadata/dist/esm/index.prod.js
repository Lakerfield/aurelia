function t(t){return"object"==typeof t&&null!==t||"function"==typeof t}function e(t){return null==t}const n=new WeakMap;function r(t,e,n,r,a){return new TypeError(`${t}(${e.map(String).join(",")}) - Expected '${n}' to be of type ${a}, but got: ${Object.prototype.toString.call(r)} (${String(r)})`)}function a(t){switch(typeof t){case"undefined":case"string":case"symbol":return t;default:return`${t}`}}function o(t,e,r){let a=n.get(t);if(void 0===a){if(!r)return;a=new Map,n.set(t,a)}let o=a.get(e);if(void 0===o){if(!r)return;o=new Map,a.set(e,o)}return o}function i(t,e,n){const r=o(e,n,!1);return void 0!==r&&r.has(t)}function u(t,e,n){if(i(t,e,n))return!0;const r=Object.getPrototypeOf(e);return null!==r&&u(t,r,n)}function c(t,e,n){const r=o(e,n,!1);if(void 0!==r)return r.get(t)}function f(t,e,n){if(i(t,e,n))return c(t,e,n);const r=Object.getPrototypeOf(e);return null!==r?f(t,r,n):void 0}function d(t,e,n,r){o(n,r,!0).set(t,e)}function l(t,e){const n=[],r=o(t,e,!1);if(void 0===r)return n;const a=r.keys();let i=0;for(const t of a)n[i]=t,++i;return n}function s(t,e){const n=l(t,e),r=Object.getPrototypeOf(t);if(null===r)return n;const a=s(r,e),o=n.length;if(0===o)return a;const i=a.length;if(0===i)return n;const u=new Set,c=[];let f,d=0;for(let t=0;t<o;++t)f=n[t],u.has(f)||(u.add(f),c[d]=f,++d);for(let t=0;t<i;++t)f=a[t],u.has(f)||(u.add(f),c[d]=f,++d);return c}function g(e,n){return function(a,o){if(!t(a))throw r("@metadata",[e,n,a,o],"target",a,"Object or Function");d(e,n,a,function(t){switch(typeof t){case"undefined":case"string":case"symbol":return t;default:throw new TypeError(`Invalid metadata propertyKey: ${t}.`)}}(o))}}function y(n,a,o,i){if(void 0!==o){if(!Array.isArray(n))throw r("Metadata.decorate",[n,a,o,i],"decorators",n,"Array");if(!t(a))throw r("Metadata.decorate",[n,a,o,i],"target",a,"Object or Function");if(!t(i)&&!e(i))throw r("Metadata.decorate",[n,a,o,i],"attributes",i,"Object, Function, null, or undefined");return null===i&&(i=void 0),function(n,a,o,i){for(let u=n.length-1;u>=0;--u){const c=(0,n[u])(a,o,i);if(!e(c)){if(!t(c))throw r("DecorateProperty",[n,a,o,i],"decorated",c,"Object, Function, null, or undefined");i=c}}return i}(n,a,o=function(t){switch(typeof t){case"string":case"symbol":return t;default:return`${t}`}}(o),i)}if(!Array.isArray(n))throw r("Metadata.decorate",[n,a,o,i],"decorators",n,"Array");if("function"!=typeof a)throw r("Metadata.decorate",[n,a,o,i],"target",a,"Function");return function(t,n){for(let a=t.length-1;a>=0;--a){const o=(0,t[a])(n);if(!e(o)){if("function"!=typeof o)throw r("DecorateConstructor",[t,n],"decorated",o,"Function, null, or undefined");n=o}}return n}(n,a)}function h(e,n,o,i){if(!t(o))throw r("Metadata.define",[e,n,o,i],"target",o,"Object or Function");return d(e,n,o,a(i))}function w(e,n,o){if(!t(n))throw r("Metadata.has",[e,n,o],"target",n,"Object or Function");return u(e,n,a(o))}function p(e,n,o){if(!t(n))throw r("Metadata.hasOwn",[e,n,o],"target",n,"Object or Function");return i(e,n,a(o))}function M(e,n,o){if(!t(n))throw r("Metadata.get",[e,n,o],"target",n,"Object or Function");return f(e,n,a(o))}function b(e,n,o){if(!t(n))throw r("Metadata.getOwn",[e,n,o],"target",n,"Object or Function");return c(e,n,a(o))}function O(e,n){if(!t(e))throw r("Metadata.getKeys",[e,n],"target",e,"Object or Function");return s(e,a(n))}function m(e,n){if(!t(e))throw r("Metadata.getOwnKeys",[e,n],"target",e,"Object or Function");return l(e,a(n))}function j(e,n,i){if(!t(n))throw r("Metadata.delete",[e,n,i],"target",n,"Object or Function");return function(t,e,n){const r=o(t,n,!1);return void 0!==r&&r.delete(e)}(n,e,a(i))}const $={define:h,has:w,hasOwn:p,get:M,getOwn:b,getKeys:O,getOwnKeys:m,delete:j};function v(t,e,n,r,a){if(!Reflect.defineProperty(t,e,{writable:r,enumerable:!1,configurable:a,value:n}))throw new Error(`Unable to apply metadata polyfill: could not add property '${e}' to the global Reflect object`)}function F(t,e,r){v(t,"[[$au]]",n,e,r),v(t,"metadata",g,e,r),v(t,"decorate",y,e,r),v(t,"defineMetadata",h,e,r),v(t,"hasMetadata",w,e,r),v(t,"hasOwnMetadata",p,e,r),v(t,"getMetadata",M,e,r),v(t,"getOwnMetadata",b,e,r),v(t,"getMetadataKeys",O,e,r),v(t,"getOwnMetadataKeys",m,e,r),v(t,"deleteMetadata",j,e,r)}function K(t,e=!0,r=!1,a=!0,o=!0){if(function(t){return"[[$au]]"in t}(t)){if(t["[[$au]]"]===n)return;throw new Error("Conflicting @aurelia/metadata module import detected. Please make sure you have the same version of all Aurelia packages in your dependency tree.")}const i=["metadata","decorate","defineMetadata","hasMetadata","hasOwnMetadata","getMetadata","getOwnMetadata","getMetadataKeys","getOwnMetadataKeys","deleteMetadata"].filter((function(t){return t in Reflect}));if(i.length>0){if(e){const t=i.map((function(t){return`${t}:\n${`${Reflect[t].toString().slice(0,100)}...`}`})).join("\n\n");throw new Error(`Conflicting reflect.metadata polyfill found. If you have 'reflect-metadata' or any other reflect polyfill imported, please remove it, if not (or if you must use a specific polyfill) please file an issue at https://github.com/aurelia/aurelia/issues so that we can look into compatibility options for this scenario. Implementation summary:\n\n${t}`)}r&&F(t,a,o)}else F(t,a,o)}export{$ as Metadata,K as applyMetadataPolyfill,e as isNullOrUndefined,t as isObject,g as metadata};

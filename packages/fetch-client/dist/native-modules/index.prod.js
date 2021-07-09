import{DI as e}from"../../../kernel/dist/native-modules/index.js";function t(e,t){return JSON.stringify(void 0!==e?e:{},t)}const r={fixed:0,incremental:1,exponential:2,random:3},s={maxRetries:3,interval:1e3,strategy:r.fixed};class n{constructor(e){if(this.retryConfig={...s,...void 0!==e?e:{}},this.retryConfig.strategy===r.exponential&&this.retryConfig.interval<=1e3)throw new Error("An interval less than or equal to 1 second is not allowed when using the exponential retry strategy")}request(e){return e.retryConfig||(e.retryConfig={...this.retryConfig},e.retryConfig.counter=0),e.retryConfig.requestClone=e.clone(),e}response(e,t){return Reflect.deleteProperty(t,"retryConfig"),e}responseError(e,t,s){const{retryConfig:n}=t,{requestClone:i}=n;return Promise.resolve().then((()=>{if(n.counter<n.maxRetries){const c=void 0===n.doRetry||n.doRetry(e,t);return Promise.resolve(c).then((c=>{if(c){n.counter++;const e=function(e){const{interval:t,strategy:s,minRandomInterval:n,maxRandomInterval:i,counter:c}=e;if("function"==typeof s)return e.strategy(c);switch(s){case r.fixed:return o[r.fixed](t);case r.incremental:return o[r.incremental](c,t);case r.exponential:return o[r.exponential](c,t);case r.random:return o[r.random](c,t,n,i);default:throw new Error("Unrecognized retry strategy")}}(n);return new Promise((t=>setTimeout(t,isNaN(e)?0:e))).then((()=>{const e=i.clone();return"function"==typeof n.beforeRetry?n.beforeRetry(e,s):e})).then((e=>{const t={...e,retryConfig:n};return s.fetch(t)}))}throw Reflect.deleteProperty(t,"retryConfig"),e}))}throw Reflect.deleteProperty(t,"retryConfig"),e}))}}const o=[e=>e,(e,t)=>t*e,(e,t)=>1===e?t:t**e/1e3,(e,t,r=0,s=6e4)=>Math.random()*(s-r)+r];class i{constructor(){this.baseUrl="",this.defaults={},this.interceptors=[],this.dispatcher=null}withBaseUrl(e){return this.baseUrl=e,this}withDefaults(e){return this.defaults=e,this}withInterceptor(e){return this.interceptors.push(e),this}useStandardConfiguration(){return Object.assign(this.defaults,{credentials:"same-origin"},this.defaults),this.rejectErrorResponses()}rejectErrorResponses(){return this.withInterceptor({response:c})}withRetry(e){const t=new n(e);return this.withInterceptor(t)}withDispatcher(e){return this.dispatcher=e,this}}function c(e){if(!e.ok)throw e;return e}const a=/^([a-z][a-z0-9+\-.]*:)?\/\//i,h=e.createInterface("IHttpClient",(e=>e.singleton(l)));class l{constructor(){this.dispatcher=null,this.activeRequestCount=0,this.isRequesting=!1,this.isConfigured=!1,this.baseUrl="",this.defaults=null,this.interceptors=[]}configure(e){let t;if("object"==typeof e){t={defaults:e}}else{if("function"!=typeof e)throw new Error("invalid config");{t=new i,t.baseUrl=this.baseUrl,t.defaults={...this.defaults},t.interceptors=this.interceptors,t.dispatcher=this.dispatcher;const r=e(t);Object.prototype.isPrototypeOf.call(i.prototype,r)&&(t=r)}}const r=t.defaults;if(void 0!==r&&Object.prototype.isPrototypeOf.call(Headers.prototype,r.headers))throw new Error("Default headers must be a plain object.");const s=t.interceptors;if(void 0!==s&&s.length){if(s.filter((e=>Object.prototype.isPrototypeOf.call(n.prototype,e))).length>1)throw new Error("Only one RetryInterceptor is allowed.");const e=s.findIndex((e=>Object.prototype.isPrototypeOf.call(n.prototype,e)));if(e>=0&&e!==s.length-1)throw new Error("The retry interceptor must be the last interceptor defined.")}return this.baseUrl=t.baseUrl,this.defaults=r,this.interceptors=void 0!==t.interceptors?t.interceptors:[],this.dispatcher=t.dispatcher,this.isConfigured=!0,this}fetch(e,t){this.trackRequestStart();let r=this.buildRequest(e,t);return this.processRequest(r,this.interceptors).then((e=>{let t;if(Object.prototype.isPrototypeOf.call(Response.prototype,e))t=Promise.resolve(e);else{if(!Object.prototype.isPrototypeOf.call(Request.prototype,e))throw new Error(`An invalid result was returned by the interceptor chain. Expected a Request or Response instance, but got [${e}]`);r=e,t=fetch(r)}return this.processResponse(t,this.interceptors,r)})).then((e=>Object.prototype.isPrototypeOf.call(Request.prototype,e)?this.fetch(e):e)).then((e=>(this.trackRequestEnd(),e)),(e=>{throw this.trackRequestEnd(),e}))}buildRequest(e,t){const r=null!==this.defaults?this.defaults:{};let s,n,o;const i=function(e){const t={},r=void 0!==e?e:{};for(const e in r)Object.prototype.hasOwnProperty.call(r,e)&&(t[e]="function"==typeof r[e]?r[e]():r[e]);return t}(r.headers);if(Object.prototype.isPrototypeOf.call(Request.prototype,e))s=e,o=new Headers(s.headers).get("Content-Type");else{t||(t={}),n=t.body;const i=void 0!==n?{body:n}:null,c={...r,headers:{},...t,...i};o=new Headers(c.headers).get("Content-Type"),s=new Request(function(e,t){if(a.test(t))return t;return(void 0!==e?e:"")+t}(this.baseUrl,e),c)}return o||(new Headers(i).has("content-type")?s.headers.set("Content-Type",new Headers(i).get("content-type")):void 0!==n&&function(e){try{JSON.parse(e)}catch(e){return!1}return!0}(n)&&s.headers.set("Content-Type","application/json")),function(e,t){const r=void 0!==t?t:{};for(const t in r)Object.prototype.hasOwnProperty.call(r,t)&&!e.has(t)&&e.set(t,r[t])}(s.headers,i),void 0!==n&&Object.prototype.isPrototypeOf.call(Blob.prototype,n)&&n.type&&s.headers.set("Content-Type",n.type),s}get(e,t){return this.fetch(e,t)}post(e,t,r){return this.callFetch(e,t,r,"POST")}put(e,t,r){return this.callFetch(e,t,r,"PUT")}patch(e,t,r){return this.callFetch(e,t,r,"PATCH")}delete(e,t,r){return this.callFetch(e,t,r,"DELETE")}trackRequestStart(){if(this.isRequesting=!!++this.activeRequestCount,this.isRequesting&&null!==this.dispatcher){const e=new this.dispatcher.ownerDocument.defaultView.CustomEvent("aurelia-fetch-client-request-started",{bubbles:!0,cancelable:!0});setTimeout((()=>{this.dispatcher.dispatchEvent(e)}),1)}}trackRequestEnd(){if(this.isRequesting=!!--this.activeRequestCount,!this.isRequesting&&null!==this.dispatcher){const e=new this.dispatcher.ownerDocument.defaultView.CustomEvent("aurelia-fetch-client-requests-drained",{bubbles:!0,cancelable:!0});setTimeout((()=>{this.dispatcher.dispatchEvent(e)}),1)}}processRequest(e,t){return this.applyInterceptors(e,t,"request","requestError",this)}processResponse(e,t,r){return this.applyInterceptors(e,t,"response","responseError",r,this)}applyInterceptors(e,t,r,s,...n){return(void 0!==t?t:[]).reduce(((e,t)=>{const o=t[r],i=t[s];return e.then(o?e=>o.call(t,e,...n):u,i?e=>i.call(t,e,...n):p)}),Promise.resolve(e))}callFetch(e,t,r,s){return r||(r={}),r.method=s,t&&(r.body=t),this.fetch(e,r)}}function u(e){return e}function p(e){throw e}export{l as HttpClient,i as HttpClientConfiguration,h as IHttpClient,n as RetryInterceptor,t as json,r as retryStrategy};

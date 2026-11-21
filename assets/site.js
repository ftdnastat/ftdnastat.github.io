// Search folding for the header search, table filters and the culture picker: "Únětice" → "unetice".
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Fold = factory();
})(this, function () {
  "use strict";
  // letters that NFD does not split into a base letter and a mark; і is the Cyrillic i that Discover puts into Latin names
  var SPECIAL = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŋ": "n", "ё": "е", "і": "i", "ї": "i" };
  var SPECIAL_RE = /[ßæœøłđðþıħŋёії]/g;
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(SPECIAL_RE, function (c) { return SPECIAL[c]; })
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’'ʼ`´‘]/g, "")
      .replace(/[\s\-‐‑–—_/]+/g, " ")
      .trim();
  }
  return { fold: fold };
});
// Requests belong to the document: consumers share both the parsed value and the in-flight work.
(() => {
  const files = new Map(), scripts = new Map();
  function once(cache, url, load) {
    if (!cache.has(url)) cache.set(url, load().catch(error => {
      cache.delete(url);
      throw error;
    }));
    return cache.get(url);
  }
  const missing = new Set();
  window.ftdJson = (url, optional = false) => {
    if (optional && missing.has(url)) return Promise.resolve(null);
    return once(files, url, async () => {
      const response = await fetch(url);
      if (!response.ok) throw Object.assign(new Error(url + " " + response.status), { status: response.status });
      missing.delete(url);
      return response.json();
    }).catch(error => {
      if (!optional || error.status !== 404) throw error;
      missing.add(url);
      return null;
    });
  };
  window.ftdScript = (name, file) => {
    if (name && window[name]) return Promise.resolve(window[name]);
    return once(scripts, file, () => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/assets/" + file;
      script.onload = () => resolve(window[name]);
      script.onerror = () => { script.remove(); reject(new Error(file)); };
      document.head.appendChild(script);
    }));
  };
})();
window.ftdShareLimits={"SMALL_N":100,"SMALL_K":5};

;(() => {
/* MIT License

Copyright (c) 2017 The Nimiq Foundation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
/*
 jquery-qrcode v0.14.0 - https://larsjung.de/jquery-qrcode/ */
'use strict';let G=null;class H{}H.render=function(w,B){G(w,B)};self.QrCreator=H;
(function(w){function B(t,c,a,e){var b={},h=w(a,c);h.u(t);h.J();e=e||0;var r=h.h(),d=h.h()+2*e;b.text=t;b.level=c;b.version=a;b.O=d;b.a=function(b,a){b-=e;a-=e;return 0>b||b>=r||0>a||a>=r?!1:h.a(b,a)};return b}function C(t,c,a,e,b,h,r,d,g,x){function u(b,a,f,c,d,r,g){b?(t.lineTo(a+r,f+g),t.arcTo(a,f,c,d,h)):t.lineTo(a,f)}r?t.moveTo(c+h,a):t.moveTo(c,a);u(d,e,a,e,b,-h,0);u(g,e,b,c,b,0,-h);u(x,c,b,c,a,h,0);u(r,c,a,e,a,0,h)}function z(t,c,a,e,b,h,r,d,g,x){function u(b,a,c,d){t.moveTo(b+c,a);t.lineTo(b,
a);t.lineTo(b,a+d);t.arcTo(b,a,b+c,a,h)}r&&u(c,a,h,h);d&&u(e,a,-h,h);g&&u(e,b,-h,-h);x&&u(c,b,h,-h)}function A(t,c){var a=c.fill;if("string"===typeof a)t.fillStyle=a;else{var e=a.type,b=a.colorStops;a=a.position.map((b)=>Math.round(b*c.size));if("linear-gradient"===e)var h=t.createLinearGradient.apply(t,a);else if("radial-gradient"===e)h=t.createRadialGradient.apply(t,a);else throw Error("Unsupported fill");b.forEach(([b,a])=>{h.addColorStop(b,a)});t.fillStyle=h}}function y(t,c){a:{var a=c.text,e=
c.v,b=c.N,h=c.K,r=c.P;b=Math.max(1,b||1);for(h=Math.min(40,h||40);b<=h;b+=1)try{var d=B(a,e,b,r);break a}catch(J){}d=void 0}if(!d)return null;a=t.getContext("2d");c.background&&(a.fillStyle=c.background,a.fillRect(c.left,c.top,c.size,c.size));e=d.O;h=c.size/e;a.beginPath();for(r=0;r<e;r+=1)for(b=0;b<e;b+=1){var g=a,x=c.left+b*h,u=c.top+r*h,p=r,q=b,f=d.a,k=x+h,m=u+h,D=p-1,E=p+1,n=q-1,l=q+1,y=Math.floor(Math.min(.5,Math.max(0,c.R))*h),v=f(p,q),I=f(D,n),w=f(D,q);D=f(D,l);var F=f(p,l);l=f(E,l);q=f(E,
q);E=f(E,n);p=f(p,n);x=Math.round(x);u=Math.round(u);k=Math.round(k);m=Math.round(m);v?C(g,x,u,k,m,y,!w&&!p,!w&&!F,!q&&!F,!q&&!p):z(g,x,u,k,m,y,w&&p&&I,w&&F&&D,q&&F&&l,q&&p&&E)}A(a,c);a.fill();return t}var v={minVersion:1,maxVersion:40,ecLevel:"L",left:0,top:0,size:200,fill:"#000",background:null,text:"no text",radius:.5,quiet:0};G=function(t,c){var a={};Object.assign(a,v,t);a.N=a.minVersion;a.K=a.maxVersion;a.v=a.ecLevel;a.left=a.left;a.top=a.top;a.size=a.size;a.fill=a.fill;a.background=a.background;
a.text=a.text;a.R=a.radius;a.P=a.quiet;if(c instanceof HTMLCanvasElement){if(c.width!==a.size||c.height!==a.size)c.width=a.size,c.height=a.size;c.getContext("2d").clearRect(0,0,c.width,c.height);y(c,a)}else t=document.createElement("canvas"),t.width=a.size,t.height=a.size,a=y(t,a),c.appendChild(a)}})(function(){function w(c){var a=C.s(c);return{S:function(){return 4},b:function(){return a.length},write:function(c){for(var b=0;b<a.length;b+=1)c.put(a[b],8)}}}function B(){var c=[],a=0,e={B:function(){return c},
c:function(b){return 1==(c[Math.floor(b/8)]>>>7-b%8&1)},put:function(b,h){for(var a=0;a<h;a+=1)e.m(1==(b>>>h-a-1&1))},f:function(){return a},m:function(b){var h=Math.floor(a/8);c.length<=h&&c.push(0);b&&(c[h]|=128>>>a%8);a+=1}};return e}function C(c,a){function e(b,h){for(var a=-1;7>=a;a+=1)if(!(-1>=b+a||d<=b+a))for(var c=-1;7>=c;c+=1)-1>=h+c||d<=h+c||(r[b+a][h+c]=0<=a&&6>=a&&(0==c||6==c)||0<=c&&6>=c&&(0==a||6==a)||2<=a&&4>=a&&2<=c&&4>=c?!0:!1)}function b(b,a){for(var f=d=4*c+17,k=Array(f),m=0;m<
f;m+=1){k[m]=Array(f);for(var p=0;p<f;p+=1)k[m][p]=null}r=k;e(0,0);e(d-7,0);e(0,d-7);f=y.G(c);for(k=0;k<f.length;k+=1)for(m=0;m<f.length;m+=1){p=f[k];var q=f[m];if(null==r[p][q])for(var n=-2;2>=n;n+=1)for(var l=-2;2>=l;l+=1)r[p+n][q+l]=-2==n||2==n||-2==l||2==l||0==n&&0==l}for(f=8;f<d-8;f+=1)null==r[f][6]&&(r[f][6]=0==f%2);for(f=8;f<d-8;f+=1)null==r[6][f]&&(r[6][f]=0==f%2);f=y.w(h<<3|a);for(k=0;15>k;k+=1)m=!b&&1==(f>>k&1),r[6>k?k:8>k?k+1:d-15+k][8]=m,r[8][8>k?d-k-1:9>k?15-k:14-k]=m;r[d-8][8]=!b;if(7<=
c){f=y.A(c);for(k=0;18>k;k+=1)m=!b&&1==(f>>k&1),r[Math.floor(k/3)][k%3+d-8-3]=m;for(k=0;18>k;k+=1)m=!b&&1==(f>>k&1),r[k%3+d-8-3][Math.floor(k/3)]=m}if(null==g){b=t.I(c,h);f=B();for(k=0;k<x.length;k+=1)m=x[k],f.put(4,4),f.put(m.b(),y.f(4,c)),m.write(f);for(k=m=0;k<b.length;k+=1)m+=b[k].j;if(f.f()>8*m)throw Error("code length overflow. ("+f.f()+">"+8*m+")");for(f.f()+4<=8*m&&f.put(0,4);0!=f.f()%8;)f.m(!1);for(;!(f.f()>=8*m);){f.put(236,8);if(f.f()>=8*m)break;f.put(17,8)}var u=0;m=k=0;p=Array(b.length);
q=Array(b.length);for(n=0;n<b.length;n+=1){var v=b[n].j,w=b[n].o-v;k=Math.max(k,v);m=Math.max(m,w);p[n]=Array(v);for(l=0;l<p[n].length;l+=1)p[n][l]=255&f.B()[l+u];u+=v;l=y.C(w);v=z(p[n],l.b()-1).l(l);q[n]=Array(l.b()-1);for(l=0;l<q[n].length;l+=1)w=l+v.b()-q[n].length,q[n][l]=0<=w?v.c(w):0}for(l=f=0;l<b.length;l+=1)f+=b[l].o;f=Array(f);for(l=u=0;l<k;l+=1)for(n=0;n<b.length;n+=1)l<p[n].length&&(f[u]=p[n][l],u+=1);for(l=0;l<m;l+=1)for(n=0;n<b.length;n+=1)l<q[n].length&&(f[u]=q[n][l],u+=1);g=f}b=g;f=
-1;k=d-1;m=7;p=0;a=y.F(a);for(q=d-1;0<q;q-=2)for(6==q&&--q;;){for(n=0;2>n;n+=1)null==r[k][q-n]&&(l=!1,p<b.length&&(l=1==(b[p]>>>m&1)),a(k,q-n)&&(l=!l),r[k][q-n]=l,--m,-1==m&&(p+=1,m=7));k+=f;if(0>k||d<=k){k-=f;f=-f;break}}}var h=A[a],r=null,d=0,g=null,x=[],u={u:function(b){b=w(b);x.push(b);g=null},a:function(b,a){if(0>b||d<=b||0>a||d<=a)throw Error(b+","+a);return r[b][a]},h:function(){return d},J:function(){for(var a=0,h=0,c=0;8>c;c+=1){b(!0,c);var d=y.D(u);if(0==c||a>d)a=d,h=c}b(!1,h)}};return u}
function z(c,a){if("undefined"==typeof c.length)throw Error(c.length+"/"+a);var e=function(){for(var b=0;b<c.length&&0==c[b];)b+=1;for(var r=Array(c.length-b+a),d=0;d<c.length-b;d+=1)r[d]=c[d+b];return r}(),b={c:function(b){return e[b]},b:function(){return e.length},multiply:function(a){for(var h=Array(b.b()+a.b()-1),c=0;c<b.b();c+=1)for(var g=0;g<a.b();g+=1)h[c+g]^=v.i(v.g(b.c(c))+v.g(a.c(g)));return z(h,0)},l:function(a){if(0>b.b()-a.b())return b;for(var c=v.g(b.c(0))-v.g(a.c(0)),h=Array(b.b()),
g=0;g<b.b();g+=1)h[g]=b.c(g);for(g=0;g<a.b();g+=1)h[g]^=v.i(v.g(a.c(g))+c);return z(h,0).l(a)}};return b}C.s=function(c){for(var a=[],e=0;e<c.length;e++){var b=c.charCodeAt(e);128>b?a.push(b):2048>b?a.push(192|b>>6,128|b&63):55296>b||57344<=b?a.push(224|b>>12,128|b>>6&63,128|b&63):(e++,b=65536+((b&1023)<<10|c.charCodeAt(e)&1023),a.push(240|b>>18,128|b>>12&63,128|b>>6&63,128|b&63))}return a};var A={L:1,M:0,Q:3,H:2},y=function(){function c(b){for(var a=0;0!=b;)a+=1,b>>>=1;return a}var a=[[],[6,18],
[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],
[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e={w:function(b){for(var a=b<<10;0<=c(a)-c(1335);)a^=1335<<c(a)-c(1335);return(b<<10|a)^21522},A:function(b){for(var a=b<<12;0<=c(a)-c(7973);)a^=7973<<c(a)-c(7973);return b<<12|a},G:function(b){return a[b-1]},F:function(b){switch(b){case 0:return function(b,a){return 0==(b+a)%2};case 1:return function(b){return 0==b%2};case 2:return function(b,a){return 0==a%3};case 3:return function(b,a){return 0==
(b+a)%3};case 4:return function(b,a){return 0==(Math.floor(b/2)+Math.floor(a/3))%2};case 5:return function(b,a){return 0==b*a%2+b*a%3};case 6:return function(b,a){return 0==(b*a%2+b*a%3)%2};case 7:return function(b,a){return 0==(b*a%3+(b+a)%2)%2};default:throw Error("bad maskPattern:"+b);}},C:function(b){for(var a=z([1],0),c=0;c<b;c+=1)a=a.multiply(z([1,v.i(c)],0));return a},f:function(b,a){if(4!=b||1>a||40<a)throw Error("mode: "+b+"; type: "+a);return 10>a?8:16},D:function(b){for(var a=b.h(),c=0,
d=0;d<a;d+=1)for(var g=0;g<a;g+=1){for(var e=0,t=b.a(d,g),p=-1;1>=p;p+=1)if(!(0>d+p||a<=d+p))for(var q=-1;1>=q;q+=1)0>g+q||a<=g+q||(0!=p||0!=q)&&t==b.a(d+p,g+q)&&(e+=1);5<e&&(c+=3+e-5)}for(d=0;d<a-1;d+=1)for(g=0;g<a-1;g+=1)if(e=0,b.a(d,g)&&(e+=1),b.a(d+1,g)&&(e+=1),b.a(d,g+1)&&(e+=1),b.a(d+1,g+1)&&(e+=1),0==e||4==e)c+=3;for(d=0;d<a;d+=1)for(g=0;g<a-6;g+=1)b.a(d,g)&&!b.a(d,g+1)&&b.a(d,g+2)&&b.a(d,g+3)&&b.a(d,g+4)&&!b.a(d,g+5)&&b.a(d,g+6)&&(c+=40);for(g=0;g<a;g+=1)for(d=0;d<a-6;d+=1)b.a(d,g)&&!b.a(d+
1,g)&&b.a(d+2,g)&&b.a(d+3,g)&&b.a(d+4,g)&&!b.a(d+5,g)&&b.a(d+6,g)&&(c+=40);for(g=e=0;g<a;g+=1)for(d=0;d<a;d+=1)b.a(d,g)&&(e+=1);return c+=Math.abs(100*e/a/a-50)/5*10}};return e}(),v=function(){for(var c=Array(256),a=Array(256),e=0;8>e;e+=1)c[e]=1<<e;for(e=8;256>e;e+=1)c[e]=c[e-4]^c[e-5]^c[e-6]^c[e-8];for(e=0;255>e;e+=1)a[c[e]]=e;return{g:function(b){if(1>b)throw Error("glog("+b+")");return a[b]},i:function(b){for(;0>b;)b+=255;for(;256<=b;)b-=255;return c[b]}}}(),t=function(){function c(b,c){switch(c){case A.L:return a[4*
(b-1)];case A.M:return a[4*(b-1)+1];case A.Q:return a[4*(b-1)+2];case A.H:return a[4*(b-1)+3]}}var a=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,
2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,
45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,
151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],
[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],
[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],e={I:function(b,a){var e=c(b,a);if("undefined"==
typeof e)throw Error("bad rs block @ typeNumber:"+b+"/errorCorrectLevel:"+a);b=e.length/3;a=[];for(var d=0;d<b;d+=1)for(var g=e[3*d],h=e[3*d+1],t=e[3*d+2],p=0;p<g;p+=1){var q=t,f={};f.o=h;f.j=q;a.push(f)}return a}};return e}();return C}());


})();
window.ftdMtSecondLetters={"L":"01234567","N":"+12356789","R":"-012356789","U":"123456789","K":"123","B":"24568","F":"1234","J":"12T","T":"123","H":"+-123456789V","V":"+-123456789","X":"1234578","A":"+-123456789","W":"+-123456789","I":"12345679","M":"+123456789","D":"-123456","G":"12345","E":"12","C":"1457Z","Z":"-12345678","P":"-123456789","S":"-1234567","O":"12","Y":"12","Q":"123"};
(function () {
  "use strict";
  var lang = document.body.getAttribute("data-lang") || "en";

  // Metrika goals with visit params; the counter loads on the first user action, so early events wait in a queue
  var ymQueue = [], ymWaiting = false;
  var ymFlush = function (tries) {
    if (typeof window.ym === "function") {
      ymQueue.splice(0).forEach(function (e) { try { window.ym(window.ftdYmId, "reachGoal", e[0], e[1]); } catch (err) { /* counter blocked */ } });
      ymWaiting = false;
    } else if (tries < 60) setTimeout(function () { ymFlush(tries + 1); }, 500);
    else { ymQueue.length = 0; ymWaiting = false; }
  };
  window.ftdTrack = function (goal, params) {
    if (!window.ftdYmId) return;
    ymQueue.push([goal, params]);
    if (!ymWaiting) { ymWaiting = true; ymFlush(0); }
  };
  // a query is sent once typing pauses (or at once when a result is picked), once per field;
  // a query that found nothing and looks like a kit number or an e-mail stays here
  var searchTimers = {}, searchSent = {};
  window.ftdTrackSearch = function (where, query, found, now) {
    if (!window.ftdYmId) return;
    clearTimeout(searchTimers[where]);
    var send = function () {
      var v = String(query || "").trim().toLowerCase().slice(0, 40);
      if (v.length < 2 || searchSent[where] === v) return;
      if (!found && /@|\d{5,}/.test(v)) return;
      searchSent[where] = v;
      var p = {};
      p[where] = {};
      p[where][found ? "found" : "empty"] = v;
      window.ftdTrack("search", p);
    };
    if (now) send(); else searchTimers[where] = setTimeout(send, 1500);
  };

  // a page prerendered on hover is not a visit yet: remember its language only once it is shown
  var saveLang = function () { try { localStorage.setItem("ftdnastat_lang", lang); } catch (e) {} };
  if (document.prerendering) document.addEventListener("prerenderingchange", saveLang, { once: true });
  else saveLang();
  var sw = document.querySelector("[data-lang-switch]");
  if (sw) {
    const translatedPath = sw.getAttribute("href");
    const syncLanguageLink = () => { sw.href = translatedPath + location.search + location.hash; };
    syncLanguageLink();
    window.addEventListener("hashchange", syncLanguageLink);
    window.addEventListener("popstate", syncLanguageLink);
    // Filters can also call replaceState, which emits neither event.
    for (const event of ["focus", "pointerdown", "contextmenu", "click"]) sw.addEventListener(event, syncLanguageLink);
  }

  // a deferred card keeps its light content until the trees arrive; after a failed fetch the next card asks again
  var panelsSrc = document.querySelector("[data-panels-src]");
  if (panelsSrc && "IntersectionObserver" in window) {
    const base = panelsSrc.getAttribute("data-panels-src");
    var fill = function (card) {
      const url = card.dataset.batch === undefined ? base : base.replace(/\.json$/, "-" + card.dataset.batch + ".json");
      const slug = card.getAttribute("data-panels");
      window.ftdJson(url, url !== base).then(async function (m) {
        // An open catalog can retain the previous release's batch number.
        if (url !== base && !m?.[slug]) m = await window.ftdJson(base);
        var html = m[slug], head = card.querySelector(".ccard-n");
        if (!html || !head) return;
        while (head.nextSibling) card.removeChild(head.nextSibling);
        head.insertAdjacentHTML("afterend", html);
        io.unobserve(card);
      }).catch(function () { /* Keep the light card. Re-entering the viewport retries the batch. */ });
    };
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) fill(e.target); }); }, { rootMargin: "800px 0px" });
    document.querySelectorAll("[data-panels]").forEach(function (c) { io.observe(c); });
  }

  var box = document.querySelector("[data-filterable]");
  if (box) {
    var grp = "all", minn = 1, name = "", raw = "", sure = false;
    var sel = document.querySelector("[data-filter=minn]");
    var tabs = document.querySelector("[data-filter=grp]");
    var nameInput = document.querySelector("[data-filter=name]");
    var sureBox = document.querySelector("[data-filter=sure]");
    if (sel) minn = +sel.value;
    var defMinn = minn;
    // filter state lives in the hash so a copied link reopens the same view
    // ?q= comes from the header search form without JS
    var readHash = function () {
      var h = new URLSearchParams(location.hash.replace(/^#/, ""));
      var qs = new URLSearchParams(location.search);
      if (qs.get("q") && !h.get("q")) h.set("q", qs.get("q"));
      if (h.get("grp")) grp = h.get("grp");
      if (h.get("n") && !isNaN(+h.get("n"))) minn = +h.get("n");
      if (h.get("q")) { raw = h.get("q"); name = window.Fold.fold(raw); }
      sure = h.get("sure") === "1";
      if (sureBox) sureBox.checked = sure;
      if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === grp); });
      if (sel) { if (![].some.call(sel.options, function (o) { return +o.value === minn; })) { var o = document.createElement("option"); o.value = minn; o.textContent = "≥ " + minn; sel.appendChild(o); } sel.value = String(minn); }
      if (nameInput) nameInput.value = raw;
    };
    var isFilterHash = function (hash) { return /(^|&)(grp|n|q|sure)=/.test(hash.replace(/^#/, "")); };
    var writeHash = function () {
      var h = new URLSearchParams();
      if (grp !== "all") h.set("grp", grp);
      if (minn !== defMinn) h.set("n", String(minn));
      if (name) h.set("q", raw);
      if (sure) h.set("sure", "1");
      var s = h.toString();
      // a section anchor (#турция) is not ours: leave it alone unless filters are set
      if (!s && location.hash && !isFilterHash(location.hash)) return;
      // ?q= is folded into the hash state; any other query param stays as it came
      var qs = new URLSearchParams(location.search);
      qs.delete("q");
      var search = qs.toString() ? "?" + qs.toString() : "";
      var url = location.pathname + search + (s ? "#" + s : "");
      if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
    };
    var count = document.querySelector("[data-count]");
    // one filter drives every list on the page (the ancient page has a Y and an mt table)
    var rows = [];
    // data-search-text: the name filter also reads the visible cells (ancient samples keep only hidden fields in data-name)
    document.querySelectorAll("[data-filterable]").forEach(function (b) { var text = b.hasAttribute("data-search-text"); Array.prototype.forEach.call(b.tagName === "TABLE" ? b.tBodies[0].rows : b.querySelectorAll("[data-grp]"), function (tr) { tr.searchText = text; rows.push(tr); }); });
    var sections = document.querySelectorAll("[data-hide-empty]");
    var apply = function () {
      var shown = 0;
      rows.forEach(function (tr) {
        if (name && tr.folded == null) tr.folded = window.Fold.fold(tr.searchText ? (tr.getAttribute("data-name") || "") + " " + tr.textContent : tr.getAttribute("data-name") || tr.textContent);
        var ok = (grp === "all" || tr.getAttribute("data-grp") === grp) && +tr.getAttribute("data-n") >= minn && (!name || tr.folded.indexOf(name) >= 0) && !(sure && tr.hasAttribute("data-unsure"));
        tr.hidden = !ok;
        if (ok) shown++;
      });
      Array.prototype.forEach.call(sections, function (s) { s.hidden = !s.querySelector("tbody tr:not([hidden])"); });
      if (count) count.textContent = shown + " / " + rows.length;
      var empty = document.querySelector("[data-empty]");
      if (empty) empty.hidden = shown > 0;
      writeHash();
    };
    var reset = document.querySelector("[data-reset]");
    if (reset) reset.addEventListener("click", function (e) { e.preventDefault(); grp = "all"; minn = 1; name = ""; raw = ""; sure = false; if (sureBox) sureBox.checked = false; if (sel) sel.value = "1"; if (nameInput) nameInput.value = ""; if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === "all"); }); apply(); });
    if (nameInput) nameInput.addEventListener("input", function () { raw = nameInput.value.trim(); name = window.Fold.fold(raw); apply(); });
    window.addEventListener("hashchange", function () { if (isFilterHash(location.hash) || !location.hash) { readHash(); apply(); } });
    readHash();
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      grp = b.getAttribute("data-v");
      tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      apply();
    });
    if (sel) sel.addEventListener("change", function () { minn = +sel.value; apply(); });
    if (sureBox) sureBox.addEventListener("change", function () { sure = sureBox.checked; apply(); });
    apply();
  }

  // a link to a row inside a folded list (#b-<branch> among the Mitotree branches) opens the fold
  var openTarget = function () {
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
    var el = id && document.getElementById(id);
    // links from forums still carry the old anchor made from the heading text
    var old = id && !el && [].find.call(document.querySelectorAll("h2[data-old]"), function (h) { return h.getAttribute("data-old") === id; });
    if (old) {
      var to = old.querySelector("a.anchor").getAttribute("href");
      history.replaceState(null, "", to);
      el = document.getElementById(to.slice(1));
      if (el) el.scrollIntoView();
    }
    var d = el && el.closest("details");
    if (d && !d.open) { d.open = true; el.scrollIntoView(); }
  };
  openTarget();
  window.addEventListener("hashchange", openTarget);

  // sticky filter rows sit under the header, whatever height the menu wraps to
  var hdr = document.querySelector("header.top");
  if (hdr && window.ResizeObserver) new ResizeObserver(function () { document.documentElement.style.setProperty("--hdr", hdr.offsetHeight + "px"); }).observe(hdr);

  // lastFound: whether the shown list has real hits; without them it still holds the "all countries" link
  var q = document.getElementById("q"), out = document.getElementById("q-out"), lastFound = false, idx = null, labels = null, cultures = null, peoples = null, shards = {};
  var fold = window.Fold.fold;
  if (q && out) {
    var searchOpen = false, searchRevision = 0, mtInitialTimer = null;
    var hideResults = function () {
      out.hidden = true;
      lastFound = false;
      q.setAttribute("aria-expanded", "false");
    };
    var dismiss = function () {
      searchOpen = false;
      searchRevision++;
      clearTimeout(mtInitialTimer);
      mtInitialTimer = null;
      hideResults();
    };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    // "Z1842", "J-Z1842", "J1-Z1842", "R-L23": the SNP part after the dash names the shard /search/clade-<letter>.json
    var SNP_RE = /^(?:[A-Z]{1,5}\d*[A-Z]?-)?([A-Z]{1,4}\d[A-Z0-9._-]*)$/;
    // a starred remainder label (G-CTS574*) copied from a page still finds its branch
    var snpOf = function (v) { var m = v.toUpperCase().replace(/\*$/, "").match(SNP_RE); return m ? m[1] : null; };
    // branches without a page: /search/small-top-<2 SNP characters>.json answers two or three typed characters, /search/small-<4>.json the rest;
    // their rows point into /search/small-pages.json, and a page slug follows from its name
    var fileKey = function (s) { return s.toLowerCase().replace(/[^a-z0-9]/g, "_"); };
    var slugOf = function (name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
    var smallPages = null;
    var pagesOnce = function () { return smallPages || (smallPages = fetch("/search/small-pages.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).catch(function (err) { smallPages = null; throw err; })); };
    // [name without the page's letter prefix, kits, page, anchor (1 itself)[, label]] → the row shape of the page shards
    var unpack = function (pages, r) { var page = pages[r[2]], name = r[0].indexOf("-") >= 0 ? r[0] : page.slice(0, page.indexOf("-") + 1) + r[0]; return [name, slugOf(page), r[1], r[4] || "", page, r[3] === 1 ? name : r[3] || ""]; };
    var smallRows = function (snp) {
      var full = snp.length >= 4 && shards["small:" + snp.slice(0, 4)];
      if (full) return full;
      var top = snp.length >= 2 && shards["smalltop:" + snp.slice(0, 2)];
      return top ? (top.t[snp.slice(0, 3)] || []).map(function (i) { return top.r[i]; }) : [];
    };
    // a row of a branch without a page names its page (e[4]) and the row to light up there (e[5])
    var cladeHref = function (dir, e) { return "/" + lang + "/" + dir + "/" + (e[1] ? esc(e[1]) + "/" : "") + (e[5] ? "#b-" + esc(encodeURIComponent(e[5])) : ""); };
    // mt names are letters and digits with ' . ! ^ + " - (H1a1, L3'4'6, H1-T16189C!, T2h2^ and A13"56 in Mitotree): the shard is the first letter
    var MT_RE = /^[A-Z][A-Z0-9'.!^+"-]*$/;
    var mtKey = function (v) {
      var u = v.toUpperCase(), prefixes = window.ftdMtSecondLetters;
      if (!MT_RE.test(u)) return null;
      if (prefixes && (!(u[0] in prefixes) || (u.length > 1 && !prefixes[u[0]].includes(u[1])))) return null;
      return "mt:" + u[0];
    };
    // a Mitotree branch counts Discover samples, not kits
    var mtCount = function (e) { return e[6] === "mito" ? (e[2] ? amount(+e[2], "data-samples") + " · Mitotree" : "Mitotree") : amount(+e[2], "data-kits"); };
    // an mt mutation by its position or in full: "16519", "T16519C", "16519C"
    var MTSNP_RE = /^[ACGT]?(\d{2,5})/;
    var mtSnpKey = function (v) { var m = v.toUpperCase().match(MTSNP_RE); return m ? "mtsnp:" + m[1].slice(0, 2) : null; };
    var mtSnpHits = function (v) {
      var key = mtSnpKey(v), shard = key && shards[key];
      if (!shard) return [];
      var up = v.toUpperCase(), pos = /^\d/.test(up) ? up.match(/^\d+/)[0] : null, posOf = function (r) { return (r[0].match(/\d+/) || [""])[0]; };
      // "(G263A)" is an unstable G263A: the brackets do not take part in matching
      var bare = function (r) { return r[0].replace(/^\(/, "").toUpperCase(); };
      var hits = shard.filter(function (r) { return pos ? posOf(r).indexOf(pos) === 0 : bare(r).indexOf(up) === 0; });
      var exact = function (r) { return bare(r).replace(/\)$/, "") === up || (pos && posOf(r) === pos); };
      var order = function (a, b) { return (a[6] ? 1 : 0) - (b[6] ? 1 : 0) || b[3] - a[3]; };
      return hits.filter(exact).sort(order).concat(hits.filter(function (r) { return !exact(r); }).sort(order))
        .map(function (r) { var mito = r[6] === "mito"; return [r[1], r[2], r[3], "", r[4], r[5], mito ? "mito" : "", r[0], mito ? "" : r[6] || ""]; });
    };
    var mtHits = function (v) {
      var key = mtKey(v), shard = key && shards[key], names = {};
      var up = v.toUpperCase();
      var hits = shard ? shard.filter(function (e) { return e[0].toUpperCase().indexOf(up) === 0; }) : [];
      return hits.filter(function (e) { return e[0].toUpperCase() === up; }).concat(hits.filter(function (e) { return e[0].toUpperCase() !== up; }), mtSnpHits(v))
        .filter(function (e) { var k = e[0] + "|" + (e[7] || ""); if (names[k]) return false; names[k] = true; return true; }).slice(0, 6);
    };
    var cladeHits = function (v) {
      var snp = snpOf(v), none = { exact: [], rest: [] };
      if (!snp) return none;
      var shard = (shards[snp[0]] || []).concat(smallRows(snp));
      if (!shard.length) return none;
      var up = v.toUpperCase().replace(/\*$/, "");
      var exact = function (e) { var name = e[0].toUpperCase(), dash = name.indexOf("-"); return name === up || name.slice(dash + 1) === snp || (e[3] && e[3].toUpperCase() === up); };
      var hits = shard.filter(function (e) {
        var name = e[0].toUpperCase(), dash = name.indexOf("-");
        return name.indexOf(up) === 0 || (dash >= 0 && name.slice(dash + 1).indexOf(snp) === 0) || (e[3] && e[3].toUpperCase().indexOf(up) === 0);
      });
      // the shard is sorted by kits; an exact SNP match still goes first (Z1842 before Z18426)
      return { exact: hits.filter(exact), rest: hits.filter(function (e) { return !exact(e); }) };
    };
    // any SNP of a branch: /search/snp-<3 chars>.json, or <4 chars> for the prefixes in /search/snp-split.json; e[6] is the SNP
    var snpSplit = null;
    var snpFile = function (snp) {
      if (!snpSplit || snp.length < 3) return null;
      var split = snpSplit[snp.slice(0, 3).replace(/[^A-Z0-9]/g, "_")];
      return split && snp.length < 4 ? null : "snp:" + snp.slice(0, split ? 4 : 3);
    };
    var snpHits = function (v) {
      var snp = snpOf(v), key = snp && snpFile(snp), shard = key && shards[key];
      if (!shard) return { exact: [], rest: [] };
      var hits = shard.filter(function (e) { return e[6].toUpperCase().indexOf(snp) === 0; });
      // a short prefix of some other SNP of a branch is noise ("M267" → L-M20 by M2673): only from five characters
      var rest = snp.length < 5 ? [] : hits.filter(function (e) { return e[6].toUpperCase() !== snp; }).sort(function (a, b) { return b[2] - a[2]; });
      return { exact: hits.filter(function (e) { return e[6].toUpperCase() === snp; }), rest: rest };
    };
    // "J1", "R1b", "G2a": a label prefix, exact label first, one row per page
    var labelHits = function (v) {
      if (!labels) return [];
      var up = v.toUpperCase().replace(/\*$/, ""), seen = {};
      var hits = labels.filter(function (e) { return e[3].toUpperCase().indexOf(up) === 0; });
      var exact = function (e) { return e[3].toUpperCase() === up; };
      return hits.filter(exact).concat(hits.filter(function (e) { return !exact(e) && !e[4]; }), hits.filter(function (e) { return !exact(e) && e[4]; }))
        .filter(function (e) { if (seen[e[1]]) return false; seen[e[1]] = true; return true; });
    };
    var yHits = function (v) {
      var byLabel = labelHits(v), names = {};
      var c = cladeHits(v), sn = snpHits(v);
      return byLabel.concat(c.exact, sn.exact, c.rest, sn.rest).filter(function (e) { if (names[e[0]]) return false; names[e[0]] = true; return true; }).slice(0, 8);
    };
    // data-kits / data-samples hold the word forms "one|few|many" (ru) or "one|other" (en), as plural() in render.js
    var amount = function (n, attr) {
      var f = q.getAttribute(attr).split("|"), m10 = n % 10, m100 = n % 100;
      var w = f.length < 3 ? f[n === 1 ? 0 : 1] : m10 === 1 && m100 !== 11 ? f[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? f[1] : f[2];
      return n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + w;
    };
    var render = function () {
      if (!searchOpen) return;
      var v = q.value.trim().toLowerCase(), fv = fold(v), mk1 = v.length === 1 ? mtKey(v) : null;
      // one letter may be an mt haplogroup that goes first: countries alone would show and then jump down
      if (mk1 && (shards[mk1] === null || (mtInitialTimer && shards[mk1] === undefined))) { hideResults(); return; }
      var clades = v ? yHits(v) : [], mts = v ? mtHits(v) : [];
      var cults = fv && cultures ? cultures.filter(function (e) { return (e.k || (e.k = fold(e[1] + " | " + e[2] + " | " + e[3]))).indexOf(fv) >= 0; }).slice(0, 6) : [];
      var peops = fv && peoples ? peoples.filter(function (e) { return (e.k || (e.k = fold(e[1] + " | " + e[2] + " | " + e[0]))).indexOf(fv) >= 0; }).slice(0, 6) : [];
      // the country index and the branch shards arrive independently: render whichever is ready
      if (!v || (!idx && !clades.length && !mts.length && !cults.length && !peops.length)) { hideResults(); return; }
      var hits = (fv ? idx || [] : []).filter(function (e) { return (e.k || (e.k = fold(e.en + " | " + e.ru + (e.f ? " | " + e.f : "")))).indexOf(fv) >= 0; }).slice(0, clades.length || mts.length || cults.length || peops.length ? 6 : 12);
      var rows = hits.map(function (e) { return '<a href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; });
      // one letter names an mt haplogroup ("H", "U"): it goes before the countries that merely contain the letter
      var mtRow = function (e) { return '<a href="' + cladeHref("mt-clade", e) + '"><span lang="en">' + esc(e[0]) + (e[7] ? ' <small>' + esc(e[7]) + (e[8] ? " · YFull " + esc(e[8]) : "") + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + esc(mtCount(e)) + "</span></a>"; };
      var mtRows = mts.length ? ['<span class="q-group dim">' + esc(q.getAttribute("data-clades-mt")) + "</span>"].concat(mts.map(mtRow)) : [];
      if (v.length === 1 && mts.length && mts[0][0].toUpperCase() === v.toUpperCase()) { rows = mtRows.concat(rows); mtRows = []; }
      if (peops.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-peoples")) + "</span>", peops.map(function (e) { return '<a href="/' + lang + "/ethnic/" + esc(e[0]) + '/"><span>' + esc(lang === "ru" ? e[1] : e[2]) + '</span><span class="mono dim">' + (+e[3]) + " / " + (+e[4]) + "</span></a>"; }).join(""));
      if (clades.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades")) + "</span>", clades.map(function (e) { return '<a href="' + cladeHref("clade", e) + '"><span lang="en">' + esc(e[0]) + (e[3] && e[3] !== e[0] ? ' <small>' + esc(e[3]) + "</small>" : "") + (e[6] ? ' <small>' + esc(e[6]) + (e[7] ? " · YFull " + esc(e[7]) : "") + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + esc(amount(+e[2], "data-kits")) + "</span></a>"; }).join(""));
      if (mtRows.length) rows.push.apply(rows, mtRows);
      if (cults.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-cultures")) + "</span>", cults.map(function (e) { return '<a href="/' + lang + "/culture/" + esc(e[0]) + '/"><span>' + esc(lang === "ru" ? e[1] : e[2]) + '</span><span class="mono dim">' + esc(amount(+e[4], "data-samples")) + "</span></a>"; }).join(""));
      lastFound = rows.length > 0;
      window.ftdTrackSearch("header", v, lastFound);
      out.innerHTML = rows.length
        ? rows.join("")
        : '<span class="q-none dim">' + esc(q.getAttribute("data-none")) + '</span><a href="/' + lang + "/countries/?q=" + encodeURIComponent(v) + '">' + esc(q.getAttribute("data-all")) + "</a>";
      out.hidden = false;
      q.setAttribute("aria-expanded", "true");
      fit();
    };
    var loading = {};
    var loadShard = function (letter) {
      if (shards[letter] !== undefined) return loading[letter] || Promise.resolve();
      shards[letter] = null;
      var small = letter.indexOf("small:") === 0, top = letter.indexOf("smalltop:") === 0, bySnp = letter.indexOf("snp:") === 0;
      var file = letter.indexOf("mtsnp:") === 0 ? "mtsnp-" + letter.slice(6) : letter.indexOf("mt:") === 0 ? "mt-clade-" + letter.slice(3).toLowerCase() : small ? "small-" + fileKey(letter.slice(6)) : top ? "small-top-" + fileKey(letter.slice(9)) : bySnp ? "snp-" + fileKey(letter.slice(4)) : "clade-" + letter.toLowerCase();
      // a missing file is an empty answer; a failed fetch is forgotten so the next keystroke retries it
      var got = window.ftdJson("/search/" + file + ".json", true);
      return (loading[letter] = (small || top || bySnp ? Promise.all([pagesOnce(), got]).then(function (x) {
        var pages = x[0], j = x[1], un = function (r) { return unpack(pages, r); };
        if (bySnp) return (j || []).map(function (r) { return un(r.slice(1)).concat([r[0], r[6] || ""]); });
        return small ? (j || []).map(un) : { r: j ? j.r.map(un) : [], t: j ? j.t : {} };
      }) : got.then(function (j) { return j || []; })).then(function (j) { shards[letter] = j; render(); }).catch(function () { delete shards[letter]; delete loading[letter]; render(); }));
    };
    var splitLoading = null;
    var loadSnps = function (snp, fromInput) {
      if (!splitLoading) splitLoading = fetch("/search/snp-split.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (keys) {
        snpSplit = {};
        keys.forEach(function (k) { snpSplit[k] = true; });
      }).catch(function () { splitLoading = null; });
      return splitLoading.then(function () {
        if (fromInput && snpOf(q.value.trim()) !== snp) return;
        var key = snpFile(snp);
        if (key) return loadShard(key);
      });
    };
    // Focus and input share in-flight requests; only a failed index needs another fetch.
    var indexes = new Map();
    var loadIndex = function (url, accept) {
      if (!indexes.has(url)) {
        indexes.set(url, window.ftdJson(url)
          .then(function (rows) { accept(rows); render(); })
          .catch(function () { indexes.delete(url); }));
      }
      return indexes.get(url);
    };
    var loadLabels = function () { return loadIndex("/search/clade-labels.json", function (rows) { labels = rows; }); };
    var loadIdx = function () {
      return Promise.all([
        loadIndex("/search.json", function (rows) { idx = rows; }),
        loadIndex("/search/cultures.json", function (rows) { cultures = rows; }),
        loadIndex("/search/peoples.json", function (rows) { peoples = rows; }),
        loadLabels(),
      ]);
    };
    var loadYNames = function (snp) {
      var jobs = [loadShard(snp[0])];
      if (snp.length >= 4) jobs.push(loadShard("small:" + snp.slice(0, 4)));
      else if (snp.length >= 2) jobs.push(loadShard("smalltop:" + snp.slice(0, 2)));
      return Promise.all(jobs);
    };
    var plain = function (s) { return String(s).replace(/&(amp|lt|gt|quot);/g, function (_, c) { return { amp: "&", lt: "<", gt: ">", quot: '"' }[c]; }); };
    var findY = async function (v) {
      var snp = snpOf(v), up = v.toUpperCase().replace(/\*$/, "");
      await Promise.all([loadLabels(), snp && loadYNames(snp)]);
      var e = labelHits(v).find(function (row) { return row[3].toUpperCase() === up; }) || cladeHits(v).exact[0];
      if (!e && snp && snp.length >= 3) {
        await loadSnps(snp);
        e = snpHits(v).exact[0];
      }
      return e && plain(cladeHref("clade", e));
    };
    var findMt = async function (v) {
      var key = mtKey(v), up = v.toUpperCase(), e;
      if (key) {
        await loadShard(key);
        e = mtHits(v).find(function (row) { return row[0].toUpperCase() === up && !row[7]; });
      }
      var mutation = mtSnpKey(v);
      if (!e && mutation) {
        await loadShard(mutation);
        e = mtHits(v).find(function (row) {
          var m = String(row[7] || "").toUpperCase();
          return m === up || m.replace(/^[ACGT]/, "") === up || (m.match(/\d+/) || [""])[0] === up;
        });
      }
      return e && plain(cladeHref("mt-clade", e));
    };
    // The 404 router knows the requested section. Try its tree before expanding the search.
    window.ftdFind = async function (v, kind) {
      v = String(v || "").trim();
      if (!v) return null;
      kind = String(kind || "").toLowerCase();
      if (kind === "clade") return await findY(v) || await findMt(v) || null;
      if (kind === "mt-clade") return await findMt(v) || await findY(v) || null;
      await loadIdx();
      var fv = fold(v);
      var country = function () { var e = (idx || []).filter(function (e) { return e.s === v.toLowerCase() || fold(e.en) === fv || fold(e.ru) === fv; })[0]; return e && "/" + lang + "/c/" + e.s + "/"; };
      var culture = function () { var e = (cultures || []).filter(function (e) { return e[0] === v.toLowerCase() || fold(e[1]) === fv || fold(e[2]) === fv; })[0]; return e && "/" + lang + "/culture/" + e[0] + "/"; };
      var people = function () { var e = (peoples || []).filter(function (e) { return e[0] === v.toLowerCase() || fold(e[1]) === fv || fold(e[2]) === fv; })[0]; return e && "/" + lang + "/ethnic/" + e[0] + "/"; };
      if (kind === "c") return country() || people() || culture() || null;
      if (kind === "culture") return culture() || country() || null;
      if (kind === "ethnic") return people() || country() || null;
      return country() || people() || culture() || await findY(v) || await findMt(v) || null;
    };
    // nothing exact: the header search opens on the name, its list shows what is close
    window.ftdSuggest = function (v) { q.value = v; q.dispatchEvent(new Event("input")); q.focus(); };
    // a phone keyboard takes the lower half: the field goes to the top, the list below it fits what is left
    var narrow = window.matchMedia("(max-width:640px)"), vv = window.visualViewport;
    var lift = function () { if (narrow.matches && document.activeElement === q) q.scrollIntoView({ block: "start" }); };
    var fit = function () {
      if (!narrow.matches || out.hidden) { out.style.maxHeight = ""; return; }
      var bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      out.style.maxHeight = Math.min(320, Math.max(120, bottom - out.getBoundingClientRect().top - 8)) + "px";
    };
    if (vv) { vv.addEventListener("resize", function () { lift(); fit(); }); vv.addEventListener("scroll", fit); }
    var loadSuggestions = function (v, deferInitial) {
      var snp = snpOf(v), mk = mtKey(v), ms = mtSnpKey(v), jobs = [loadIdx()];
      clearTimeout(mtInitialTimer);
      mtInitialTimer = null;
      if (snp) jobs.push(loadYNames(snp));
      if (snp && snp.length >= 3) jobs.push(loadSnps(snp, true));
      if (deferInitial && mk && v.length === 1 && shards[mk] === undefined) {
        mtInitialTimer = setTimeout(function () { mtInitialTimer = null; loadShard(mk); }, 200);
      } else if (mk) jobs.push(loadShard(mk));
      if (ms) jobs.push(loadShard(ms));
      return Promise.all(jobs);
    };
    var updateSearch = function () {
      searchRevision++;
      searchOpen = true;
      loadSuggestions(q.value.trim(), true);
      render();
    };
    q.addEventListener("focus", function () { if (!searchOpen) updateSearch(); lift(); });
    q.addEventListener("input", updateSearch);
    var submitSearch = async function () {
      var revision = ++searchRevision, v = q.value.trim();
      searchOpen = true;
      if (v) await loadSuggestions(v, false);
      if (revision !== searchRevision || q.value.trim() !== v || document.activeElement !== q) return;
      render();
      var link = !out.hidden && out.querySelector("a");
      window.ftdTrackSearch("header", v, lastFound, true);
      location.href = link ? link.getAttribute("href") : "/" + lang + "/countries/?q=" + encodeURIComponent(v);
    };
    // arrows walk the result links; Escape closes and returns to the field
    var move = function (e, dir) {
      var links = Array.prototype.slice.call(out.querySelectorAll("a"));
      if (out.hidden || !links.length) return;
      e.preventDefault();
      var i = links.indexOf(document.activeElement);
      var next = i < 0 ? (dir > 0 ? 0 : links.length - 1) : i + dir;
      if (next < 0 || next >= links.length) { q.focus(); return; }
      links[next].focus();
    };
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submitSearch(); }
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowDown") move(e, 1);
    });
    // a picked result is the end of the query: send it before the page goes
    out.addEventListener("click", function (e) { if (e.target.closest("a")) window.ftdTrackSearch("header", q.value, lastFound, true); });
    out.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") move(e, 1);
      if (e.key === "ArrowUp") move(e, -1);
      if (e.key === "Escape") { q.focus(); dismiss(); }
    });
    document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== q) dismiss(); });
    q.form.addEventListener("focusout", function (e) { if (!q.form.contains(e.relatedTarget)) dismiss(); });
  }

  const migrationFold = document.querySelector("details.ymap-fold");
  if (migrationFold) {
    const load = () => window.ftdScript("YmapCore", "ymap-core.js")
      .then(() => window.ftdScript(null, "ymap.js"))
      .catch(() => {
        const message = migrationFold.querySelector(".ymap-gate p");
        if (message) message.textContent = JSON.parse(document.getElementById("ymap-data").textContent).s.ymapError;
      });
    const openHash = () => {
      if (!/^#ymap(=|$)/.test(location.hash)) return;
      migrationFold.open = true;
      document.getElementById("ymap").scrollIntoView();
      load();
    };
    migrationFold.addEventListener("toggle", () => { if (migrationFold.open) load(); });
    window.addEventListener("hashchange", openHash);
    openHash();
  }

  // CSV export: csv.js is fetched on the first click, not with the page
  var csvBtns = document.querySelectorAll("[data-csv]");
  if (csvBtns.length) {
    var csvReady = null;
    var csvLoad = function () {
      if (window.FtdnaCsv) return Promise.resolve();
      return csvReady || (csvReady = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = "/assets/csv.js";
        s.onload = ok;
        s.onerror = function () { csvReady = null; fail(); };
        document.head.appendChild(s);
      }));
    };
    csvBtns.forEach(function (b) {
      b.hidden = false;
      var label = b.textContent;
      b.addEventListener("click", function () {
        if (b.disabled) return;
        b.disabled = true;
        csvLoad().then(function () { return window.FtdnaCsv.downloadCountry(b); }).catch(function (err) {
          console.error("csv export failed", err);
          b.textContent = b.getAttribute("data-error");
          setTimeout(function () { b.textContent = label; }, 3000);
        }).then(function () { b.disabled = false; });
      });
    });
  }

  // tree-ring.js is fetched on the first circle, not with the page
  var ringBars = document.querySelectorAll(".ring-bar");
  if (ringBars.length) {
    var ringFailed = false;
    var ringLoad = () => window.ftdScript("TreeRing", "tree-ring.js");
    var pref = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    var press = function (bar, sel, val, attr) { bar.querySelectorAll(sel).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === val)); }); };
    // under the circle the bars stay in the page for screen readers, off screen and out of the tab order
    var foldTree = function (box, away) {
      box.classList.toggle("tree-sr", away);
      box.querySelectorAll("a").forEach(function (a) { if (away) a.setAttribute("tabindex", "-1"); else a.removeAttribute("tabindex"); });
    };
    var setView = function (bar, view, levels) {
      var box = bar.nextElementSibling;
      var shown = box.nextElementSibling && box.nextElementSibling.classList.contains("tr-view") ? box.nextElementSibling : null;
      press(bar, "[data-view]", view, "data-view");
      press(bar, "[data-lv]", String(levels), "data-lv");
      bar.querySelector(".ring-opt").hidden = true;
      if (view !== "ring") { foldTree(box, false); if (shown) shown.hidden = true; return Promise.resolve(); }
      return ringLoad().then(function () {
        var v = window.TreeRing.draw(box, levels);
        v.hidden = false;
        foldTree(box, true);
        bar.querySelector(".ring-opt").hidden = false;
      }).catch(function (err) { ringFailed = true; console.error("tree circle failed", err); setView(bar, "bars", levels); });
    };
    var ringLevels = pref("treeLevels") === "2" ? 2 : 3;
    var levelsOf = function () { return ringLevels; };
    var whenVisible = function (el, fn) {
      if (!("IntersectionObserver" in window)) return fn();
      var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: "300px" });
      io.observe(el);
    };
    ringBars.forEach(function (bar) {
      // a block that starts with bars (data-start) keeps its own view: the saved choice neither applies to it nor comes from it
      var fixed = bar.getAttribute("data-start") === "bars";
      bar.hidden = false;
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        // a choice made on one tree is the page's choice: every tree that follows the saved view switches with it
        var peers = fixed ? [bar] : [].filter.call(ringBars, function (o) { return o.getAttribute("data-start") !== "bars"; });
        if (b.hasAttribute("data-view")) { var view = b.getAttribute("data-view"); if (!fixed) pref("treeView", view); peers.forEach(function (o) { setView(o, view, levelsOf()); }); }
        else if (b.hasAttribute("data-lv")) { ringLevels = Number(b.getAttribute("data-lv")); if (!fixed) pref("treeLevels", String(ringLevels)); peers.forEach(function (o) { if (o === bar || !o.querySelector(".ring-opt").hidden) setView(o, "ring", levelsOf()); }); }
        else if (b.hasAttribute("data-exp") && window.TreeRing) {
          var h1 = document.querySelector("h1"), title = h1 ? h1.textContent.trim() : document.title;
          // a subgroup's trees (people under several language codes) are headed by its h3
          var sub = bar.closest(".subgrp"), h3 = sub && sub.querySelector("h3");
          if (h3) title += " · " + h3.textContent.trim();
          Promise.resolve().then(function () { return window.TreeRing.download(bar, levelsOf(), title, b.getAttribute("data-exp")); }).catch(function (err) { console.error("tree export failed", err); });
        }
      });
      // the circle is the default view, drawn as the tree scrolls into view; bars stay for a reader who chose them
      if (!fixed && pref("treeView") !== "bars") whenVisible(bar, function () { if (!ringFailed && pref("treeView") !== "bars") setView(bar, "ring", levelsOf()); });
    });
  }
  // folded table rows: the button opens them and folds them back
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".more-toggle");
    if (!b) return;
    var rows = document.getElementById(b.getAttribute("aria-controls")), open = b.getAttribute("aria-expanded") !== "true";
    if (!rows) return;
    rows.classList.toggle("open", open);
    b.setAttribute("aria-expanded", String(open));
    if (!b.hasAttribute("data-more")) b.setAttribute("data-more", b.textContent);
    b.textContent = open ? b.getAttribute("data-less") : b.getAttribute("data-more");
  });

  // columns as wide as the longest item, so short items leave no wide gaps; refit when a list shows up, resizes or fonts swap
  var colLists = [].slice.call(document.querySelectorAll("ul.plain.cols"));
  var fitCols = function () {
    var narrow = window.matchMedia("(max-width: 640px)").matches;
    var shown = colLists.filter(function (ul) { return ul.offsetWidth > 0; });
    shown.forEach(function (ul) { ul.style.gridTemplateColumns = "max-content"; });
    var widths = shown.map(function (ul) {
      var cs = getComputedStyle(ul), w = Math.min(parseFloat(cs.gridTemplateColumns), 22 * parseFloat(cs.fontSize));
      // a phone keeps at most two columns: narrower ones are too small to tap
      if (narrow) w = Math.max(w, Math.floor((ul.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - 24) / 2) - 1);
      return Math.ceil(w);
    });
    shown.forEach(function (ul, i) { ul.style.gridTemplateColumns = widths[i] > 0 ? "repeat(auto-fill,minmax(min(" + widths[i] + "px,100%)," + widths[i] + "px))" : ""; });
  };
  if (colLists.length) {
    var colTimer = 0, refit = function () { clearTimeout(colTimer); colTimer = setTimeout(fitCols, 100); };
    fitCols();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCols);
    window.addEventListener("resize", refit);
    document.addEventListener("toggle", refit, true);
  }
})();

// Keep the repeated action compact in branch lists. Decode the section only on first export.
for (const script of document.querySelectorAll("script.small-summaries")) {
  const label = document.documentElement.lang === "ru" ? "Поделиться сводкой" : "Share summary";
  let table;
  script.parentElement.querySelectorAll("li[id^='b-']").forEach((item, index) => {
    const button = document.createElement("button");
    const title = item.id.slice(2);
    button.type = "button";
    button.className = "small-share";
    button.textContent = "📤";
    button.title = label + " · " + title;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => {
      table ||= JSON.parse(script.textContent);
      const [n, origins, age, parent] = table.rows[index];
      const lineage = [title];
      for (let id = parent; id >= 0; id = table.paths[id][0]) lineage.unshift(table.paths[id][1]);
      const rows = origins.map(([id, count]) => [table.places[id][0], count, table.places[id][1]]);
      button.dataset.summary = JSON.stringify({ title, n, rows, age, lineage, date: table.date, source: table.source,
        kind: table.kind, slug: title.toLowerCase(), anchor: "#" + item.id });
    }, { once: true });
    item.append(" ", button);
  });
}

document.addEventListener("click", async function (event) {
  const button = event.target.closest("[data-summary]");
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    const data = JSON.parse(button.dataset.summary);
    window.ftdTrack("share_summary", {
      type: data.groups ? "country" : "branch", ...(data.kind && { kind: data.kind }),
      entity: data.slug, lang: document.documentElement.lang,
    });
    const { openSummary } = await import("./share-summary.js");
    await openSummary(button, data);
  } catch (error) {
    console.error(error);
    button.textContent = document.documentElement.lang === "ru" ? "Повторить создание сводки" : "Retry summary";
  } finally {
    button.disabled = false;
  }
});

(() => {
  let reopened = [];
  let mark;
  window.addEventListener("beforeprint", () => {
    // Opening the migration map starts a fetch. Print it only if the reader already opened it.
    for (const detail of document.querySelectorAll("main details.note:not([open]), main details.pmx-how:not([open]), main details.how-cards:not([open]), main details.about-colors:not([open])")) {
      detail.open = true;
      reopened.push(detail);
    }
    if (mark) return;
    const heading = document.querySelector("main h1");
    if (!heading) return;
    mark = document.createElement("a");
    mark.className = "print-source";
    mark.href = location.href;
    mark.setAttribute("aria-label", document.documentElement.lang === "ru" ? "Адрес страницы" : "Page address");
    try {
      window.QrCreator.render({ text: mark.href, size: 384, radius: 0, quiet: 4, ecLevel: "M", background: "#fff" }, mark);
    } catch {
      mark.textContent = mark.href;
    }
    heading.prepend(mark);
  });
  window.addEventListener("afterprint", () => {
    for (const detail of reopened) detail.open = false;
    reopened = [];
    if (mark) mark.remove();
    mark = null;
  });
})();

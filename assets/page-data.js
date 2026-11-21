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

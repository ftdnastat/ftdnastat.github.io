// The same 48-unit mark and wordmark as the share-summary and Open Graph cards.
export function imageBrand(x, y, size) {
  const ns = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(ns, "g");
  group.setAttribute("transform", `translate(${x} ${y}) scale(${size / 48})`);
  const mark = document.createElementNS(ns, "rect");
  for (const [key, value] of Object.entries({ width: 48, height: 48, rx: 9, fill: "#2a78d6" })) mark.setAttribute(key, value);
  group.appendChild(mark);
  function text(label, attrs) {
    const node = document.createElementNS(ns, "text");
    node.setAttribute("font-family", "monospace");
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    node.textContent = label;
    group.appendChild(node);
  }
  text("f", { x: 24, y: 37, "text-anchor": "middle", "font-size": 40, fill: "#fff" });
  text("ftdnastat", { x: 63, y: 36, "font-size": 37, "font-weight": 500, fill: "#14202b" });
  return group;
}

export async function svgPng(svg, width, height) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG"))), "image/png"));
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function showImageActions(button, blob, { title, filename, lang, url }) {
  const ru = lang === "ru";
  const src = URL.createObjectURL(blob);
  const file = new File([blob], filename, { type: "image/png" });
  const dlg = document.createElement("dialog");
  dlg.className = "summary-dialog";
  dlg.setAttribute("aria-label", title);
  const img = new Image();
  img.src = src;
  img.alt = title;
  dlg.append(img);
  const actions = document.createElement("div");
  dlg.append(actions);
  function action(label, handler) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.textContent = label;
    b.onclick = handler;
    actions.append(b);
    return b;
  }
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const fileData = { files: [file] };
  const linkData = { url: url.href };
  const hasShare = typeof navigator.share === "function";
  const shareFile = hasShare && navigator.canShare?.(fileData);
  const shareLink = hasShare && (navigator.canShare?.(linkData) ?? true);
  let directShare;
  if (shareFile || shareLink) {
    const label = shareFile ? (ru ? "Отправить PNG" : "Share PNG") : ru ? "Отправить ссылку" : "Share link";
    const send = async () => {
      try {
        await navigator.share(shareFile ? fileData : linkData);
      } catch (error) {
        if (error.name !== "AbortError") {
          shareButton.remove();
          copyButton?.remove();
          status.textContent = "";
          download.focus();
        }
      }
    };
    const shareButton = action(label, send);
    // A slow render can outlive the initial tap. The preview button supplies a fresh gesture.
    if (shareFile && navigator.userActivation?.isActive) directShare = send;
  }
  const download = document.createElement("a");
  download.className = "tab";
  download.href = src;
  download.download = file.name;
  download.textContent = ru ? "Скачать PNG" : "Download PNG";
  actions.append(download);
  const copyButton =
    (shareFile || shareLink) &&
    action(ru ? "Скопировать ссылку" : "Copy link", async () => {
      try {
        await navigator.clipboard.writeText(url.href);
        status.textContent = ru ? "Ссылка скопирована" : "Link copied";
      } catch {
        status.textContent = url.href;
      }
    });
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    action(ru ? "Скопировать PNG" : "Copy PNG", async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        status.textContent = ru ? "PNG скопирован" : "PNG copied";
      } catch {
        status.textContent = ru ? "Сохраните файл кнопкой «Скачать PNG»." : "Use Download PNG to save the file.";
      }
    });
  }
  action(ru ? "Закрыть" : "Close", () => dlg.close());
  dlg.append(status);
  dlg.addEventListener(
    "close",
    () => {
      dlg.remove();
      URL.revokeObjectURL(src);
      button.focus();
    },
    { once: true },
  );
  document.body.append(dlg);
  dlg.showModal();
  if (directShare) await directShare();
}

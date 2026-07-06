export function bold(text: string): string {
  return `<b>${text}</b>`;
}

export function italic(text: string): string {
  return `<i>${text}</i>`;
}

export function code(text: string): string {
  return `<code>${text}</code>`;
}

export function pre(text: string): string {
  return `<pre>${text}</pre>`;
}

export function link(text: string, url: string): string {
  return `<a href="${url}">${text}</a>`;
}

export function mention(userId: number, name: string): string {
  return link(name, `tg://user?id=${userId}`);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

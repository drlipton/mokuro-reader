export function getItems(html: string, baseUrl: string) {
  const parser = new DOMParser();
  
  // Inject a <base> tag to correctly resolve relative URLs against the source server
  const htmlWithBase = `<base href="${baseUrl}">` + html;
  
  const htmlDoc = parser.parseFromString(htmlWithBase, 'text/html');

  const items = htmlDoc.getElementsByTagName('a');
  return [...items]
}
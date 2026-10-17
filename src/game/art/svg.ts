/** Helpers for SVG artwork used both as <img> sources and as Phaser textures. */

export function svgDocument(viewBox: string, body: string, width?: number, height?: number): string {
  const size = width && height ? ` width="${width}" height="${height}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size}>${body}</svg>`
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

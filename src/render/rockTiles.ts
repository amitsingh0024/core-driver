const cache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/**
 * The sheet's tile with its edge rim cropped off and its low-frequency shading removed
 * (each row and column rescaled to the tile's mean brightness), so tiles laid side by side
 * read as one continuous rock face instead of a grid.
 */
export function flatRockTile(src: HTMLCanvasElement): HTMLCanvasElement {
  let tile = cache.get(src);
  if (tile) return tile;
  const n = 96;
  const inset = src.width * 0.12;
  tile = document.createElement('canvas');
  tile.width = n;
  tile.height = n;
  const c = tile.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(src, inset, inset, src.width - inset * 2, src.height - inset * 2, 0, 0, n, n);
  try {
    const img = c.getImageData(0, 0, n, n);
    const d = img.data;
    const lum = (i: number) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const rows = new Float32Array(n);
    const cols = new Float32Array(n);
    let total = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const l = lum((y * n + x) * 4);
        rows[y] += l / n;
        cols[x] += l / n;
        total += l;
      }
    }
    const mean = total / (n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        const k = Math.min(1.6, Math.max(0.6, (mean / Math.max(1, rows[y])) * (mean / Math.max(1, cols[x]))));
        d[i] = Math.min(255, d[i] * k);
        d[i + 1] = Math.min(255, d[i + 1] * k);
        d[i + 2] = Math.min(255, d[i + 2] * k);
      }
    }
    c.putImageData(img, 0, 0);
  } catch {
    // Tainted canvas (file:// without CORS): fall back to the cropped tile
  }
  cache.set(src, tile);
  return tile;
}


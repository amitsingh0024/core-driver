from PIL import Image
from collections import deque
import os

SPRITES_DIR = "public/sprites"

def remove_white_bg_floodfill(cell_img):
    """
    Removes white background connected to the outer border via BFS floodfill,
    then decontaminates a 2px boundary ring to eliminate JPG white halos.
    """
    rgba = cell_img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    visited = [[False] * w for _ in range(h)]
    q = deque()

    def is_bg(r, g, b):
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        return min_c >= 210 and (max_c - min_c) <= 38

    def try_push(x, y):
        if 0 <= x < w and 0 <= y < h and not visited[y][x]:
            r, g, b, a = px[x, y]
            if is_bg(r, g, b):
                visited[y][x] = True
                q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        cx, cy = q.popleft()
        try_push(cx - 1, cy)
        try_push(cx + 1, cy)
        try_push(cx, cy - 1)
        try_push(cx, cy + 1)

    # Clear background alpha
    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                px[x, y] = (0, 0, 0, 0)

    # 2-pass halo decontamination on pixels adjacent to transparent background
    for _ in range(2):
        updates = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                touches_transparent = False
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= w or ny < 0 or ny >= h or px[nx, ny][3] == 0:
                        touches_transparent = True
                        break
                if touches_transparent:
                    lum = (r + g + b) / 3.0
                    max_c = max(r, g, b)
                    min_c = min(r, g, b)
                    # If bright neutral fringe pixel, strip it or darken to outline tone
                    if lum > 165 and (max_c - min_c) < 42:
                        if lum > 205:
                            updates.append((x, y, (0, 0, 0, 0)))
                        else:
                            alpha_scale = max(0.0, (205.0 - lum) / 40.0)
                            updates.append((
                                x,
                                y,
                                (int(r * 0.35), int(g * 0.35), int(b * 0.35), int(a * alpha_scale))
                            ))
        for x, y, val in updates:
            px[x, y] = val

    # Compute tight non-transparent bounding box
    bbox = rgba.getbbox()
    if bbox:
        return rgba.crop(bbox)
    return rgba

def process_pods():
    src_path = os.path.join(SPRITES_DIR, "drill_pods_hd.jpg")
    if not os.path.exists(src_path):
        return
    img = Image.open(src_path)
    w, h = img.size
    col_w = w // 3

    # Master size per doc: 192 x 256 per pod -> 576 x 256 sheet
    out_w, out_h = 192, 256
    sheet = Image.new("RGBA", (out_w * 3, out_h), (0, 0, 0, 0))

    for i in range(3):
        cell = img.crop((i * col_w, 0, (i + 1) * col_w, h))
        trimmed = remove_white_bg_floodfill(cell)
        tw, th = trimmed.size
        scale = min((out_w - 16) / tw, (out_h - 12) / th)
        nw = max(1, int(tw * scale))
        nh = max(1, int(th * scale))
        resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
        # Pivot at bottom center (drill tip)
        dx = i * out_w + (out_w - nw) // 2
        dy = out_h - nh - 4
        sheet.paste(resized, (dx, dy), resized)

    sheet.save(os.path.join(SPRITES_DIR, "drill_pods_hd.png"), "PNG")
    print("Saved transparent public/sprites/drill_pods_hd.png (576x256)")

def process_ores():
    src_path = os.path.join(SPRITES_DIR, "ores_gems_hd.jpg")
    if not os.path.exists(src_path):
        return
    img = Image.open(src_path)
    w, h = img.size
    cw, ch = w // 4, h // 4

    # Master size per doc: 128 x 128 per ore with 12px clear margin -> 512 x 512 sheet
    tile_sz = 128
    margin = 14
    sheet = Image.new("RGBA", (tile_sz * 4, tile_sz * 4), (0, 0, 0, 0))

    for idx in range(16):
        col = idx % 4
        row = idx // 4
        cell = img.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        trimmed = remove_white_bg_floodfill(cell)
        tw, th = trimmed.size
        target_box = tile_sz - margin * 2
        scale = min(target_box / tw, target_box / th)
        nw = max(1, int(tw * scale))
        nh = max(1, int(th * scale))
        resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
        dx = col * tile_sz + (tile_sz - nw) // 2
        dy = row * tile_sz + (tile_sz - nh) // 2
        sheet.paste(resized, (dx, dy), resized)

    sheet.save(os.path.join(SPRITES_DIR, "ores_gems_hd.png"), "PNG")
    print("Saved transparent public/sprites/ores_gems_hd.png (512x512)")

def process_rocks():
    src_path = os.path.join(SPRITES_DIR, "strata_rocks_hd.jpg")
    if not os.path.exists(src_path):
        return
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    cw, ch = w // 5, h // 3

    tile_sz = 128
    sheet = Image.new("RGBA", (tile_sz * 5, tile_sz * 3), (0, 0, 0, 0))

    for r_idx in range(3):
        for c_idx in range(5):
            cell = img.crop((c_idx * cw, r_idx * ch, (c_idx + 1) * cw, (r_idx + 1) * ch))
            px = cell.load()
            min_x, min_y, max_x, max_y = cw, ch, 0, 0
            for y in range(4, ch - 4):
                for x in range(4, cw - 4):
                    r, g, b, _ = px[x, y]
                    if r < 230 or g < 230 or b < 230:
                        if x < min_x: min_x = x
                        if x > max_x: max_x = x
                        if y < min_y: min_y = y
                        if y > max_y: max_y = y
            bw = max_x - min_x
            bh = max_y - min_y
            inset_x = int(bw * 0.08)
            inset_y = int(bh * 0.08)
            cropped = cell.crop((min_x + inset_x, min_y + inset_y, max_x - inset_x, max_y - inset_y))
            resized = cropped.resize((tile_sz, tile_sz), Image.Resampling.LANCZOS)
            sheet.paste(resized, (c_idx * tile_sz, r_idx * tile_sz))

    sheet.save(os.path.join(SPRITES_DIR, "strata_rocks_hd.png"), "PNG")
    print("Saved transparent public/sprites/strata_rocks_hd.png (640x384)")

if __name__ == "__main__":
    process_pods()
    process_ores()
    process_rocks()
    for jpg in ("drill_pods_hd.jpg", "ores_gems_hd.jpg", "strata_rocks_hd.jpg"):
        p = os.path.join(SPRITES_DIR, jpg)
        if os.path.exists(p):
            os.remove(p)
            print("Removed legacy JPG:", p)

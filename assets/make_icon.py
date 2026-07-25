from PIL import Image, ImageDraw
import math
import os

OUT = os.path.dirname(os.path.abspath(__file__))
SS = 4
SIZE = 256 * SS

INK = (18, 24, 32)
ACCENT_TOP = (14, 124, 134)      # #0E7C86
ACCENT_BOTTOM = (10, 95, 103)    # #0A5F67
CURVE = (23, 184, 196)           # #17B8C4 bright accent
CURVE_HILIGHT = (255, 255, 255)

def rounded_gradient_bg(size, corner_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        r = int(ACCENT_TOP[0] + (ACCENT_BOTTOM[0] - ACCENT_TOP[0]) * t)
        g = int(ACCENT_TOP[1] + (ACCENT_BOTTOM[1] - ACCENT_TOP[1]) * t)
        b = int(ACCENT_TOP[2] + (ACCENT_BOTTOM[2] - ACCENT_TOP[2]) * t)
        grad.putpixel((0, y), (r, g, b))
    grad = grad.resize((size, size))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    radius = int(size * corner_ratio)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)
    return img

def sigmoid_points(size, n=200):
    margin = size * 0.20
    x0, x1 = margin, size - margin
    y_top, y_bottom = size * 0.24, size * 0.72
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + t * (x1 - x0)
        k = 11.0
        s = 1 / (1 + math.exp(-k * (t - 0.55)))
        y = y_bottom - s * (y_bottom - y_top)
        pts.append((x, y))
    return pts

def draw_curve(img, size):
    d = ImageDraw.Draw(img)
    pts = sigmoid_points(size)
    width = max(2, int(size * 0.055))
    # soft glow pass
    for w, col in [(width + int(size * 0.03), (*CURVE, 70)), (width, (*CURVE_HILIGHT, 255))]:
        d.line(pts, fill=col, width=w, joint="curve")
        r = w / 2
        d.ellipse([pts[0][0]-r, pts[0][1]-r, pts[0][0]+r, pts[0][1]+r], fill=col)
        d.ellipse([pts[-1][0]-r, pts[-1][1]-r, pts[-1][0]+r, pts[-1][1]+r], fill=col)
    return img

def build(size_px, corner_ratio=0.22):
    ss_size = size_px * SS
    img = rounded_gradient_bg(ss_size, corner_ratio)
    img = draw_curve(img, ss_size)
    img = img.resize((size_px, size_px), Image.LANCZOS)
    return img

if __name__ == "__main__":
    master = build(1024, corner_ratio=0.22)
    master.save(os.path.join(OUT, "icon_master.png"))

    # Windows .ico (multi-resolution in one file)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [build(s) for s in ico_sizes]
    ico_images[-1].save(
        os.path.join(OUT, "icon.ico"),
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[:-1],
    )

    # Linux / general PNGs
    for s in [16, 32, 48, 64, 128, 256, 512]:
        build(s).save(os.path.join(OUT, f"icon_{s}.png"))

    print("Icon assets written to", OUT)
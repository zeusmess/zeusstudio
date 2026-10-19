"""Draws the Starbucks Career launcher icons and splash screens (original art:
a white takeaway cup with a gold sleeve on green) into the Android project.

    python3 scripts/build_icons.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"
GREEN = (0, 112, 74, 255)
DARK = (11, 25, 21, 255)
GOLD = (203, 162, 88, 255)
WHITE = (255, 255, 255, 255)
SS = 1024  # drawing size before downscaling

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def cup(size: int) -> Image.Image:
    """The cup on a transparent square, sized for the adaptive-icon safe zone."""
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = SS / 108  # 1dp of the 108dp adaptive-icon canvas
    cx = SS / 2
    # Body: a trapezoid narrowing towards the base.
    top, bottom = 38 * s, 80 * s
    d.polygon([(cx - 15 * s, top), (cx + 15 * s, top), (cx + 11 * s, bottom), (cx - 11 * s, bottom)], fill=WHITE)
    # Lid and its rim.
    d.rounded_rectangle([cx - 17 * s, 31 * s, cx + 17 * s, 38 * s], radius=2.5 * s, fill=WHITE)
    d.rounded_rectangle([cx - 11 * s, 27 * s, cx + 11 * s, 32 * s], radius=2 * s, fill=WHITE)
    # Gold sleeve.
    y1, y2 = 50 * s, 66 * s
    w = lambda y: 15 - 4 * (y - top) / (bottom - top)  # half-width at height y, in dp
    d.polygon([(cx - w(y1) * s, y1), (cx + w(y1) * s, y1), (cx + w(y2) * s, y2), (cx - w(y2) * s, y2)], fill=GOLD)
    # Green star on the sleeve.
    r_out, r_in, cy = 5.5 * s, 2.3 * s, 58 * s
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=GREEN)
    return img.resize((size, size), Image.LANCZOS)


def full_icon(size: int, round_: bool) -> Image.Image:
    img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_:
        d.ellipse([0, 0, SS - 1, SS - 1], fill=GREEN)
        d.ellipse([SS * 0.06, SS * 0.06, SS * 0.94, SS * 0.94], outline=GOLD, width=int(SS * 0.025))
    else:
        d.rounded_rectangle([0, 0, SS - 1, SS - 1], radius=SS * 0.18, fill=GREEN)
    # The cup scaled from the 108dp canvas so it fills the legacy icon.
    art = cup(int(SS * 1.35))
    off = (SS - art.width) // 2
    img.alpha_composite(art, (off, off))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    for name, k in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        full_icon(round(48 * k), round_=False).save(folder / "ic_launcher.png")
        full_icon(round(48 * k), round_=True).save(folder / "ic_launcher_round.png")
        cup(round(108 * k)).save(folder / "ic_launcher_foreground.png")

    (RES / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#00704A</color>\n</resources>\n'
    )

    for path in RES.glob("drawable*/splash.png"):
        w, h = Image.open(path).size
        splash = Image.new("RGBA", (w, h), DARK)
        mark = full_icon(int(min(w, h) * 0.32), round_=True)
        splash.alpha_composite(mark, ((w - mark.width) // 2, (h - mark.height) // 2))
        splash.convert("RGB").save(path)


if __name__ == "__main__":
    main()

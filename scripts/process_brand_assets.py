#!/usr/bin/env python3
"""Turn the supplied drink photos into game-ready sprites.

Usage:
    python3 scripts/process_brand_assets.py [SOURCE_DIR]

SOURCE_DIR (default: assets-src/brand) must contain the original files named
as listed in SPRITES / IMAGES below. The originals are not committed; the
processed WebP files in public/assets/brand/ are what the game ships.

Every sprite is trimmed to its visible (alpha) bounds, padded slightly and
scaled to a fixed height so all cups render consistently in the playfield.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "brand"

SPRITE_HEIGHT = 320
ALPHA_THRESHOLD = 10
PADDING_RATIO = 0.03

# source file -> output name (without extension)
SPRITES: dict[str, str] = {
    "drink-pumpkin-spice-latte.png": "drink-pumpkin-spice-latte",
    "drink-pumpkin-cream-cold-brew.png": "drink-pumpkin-cream-cold-brew",
    "drink-spice-frappuccino.png": "drink-spice-frappuccino",
    "drink-iced-caramel-layered.png": "drink-iced-caramel-layered",
    "drink-iced-matcha-pumpkin-foam.png": "drink-iced-matcha-pumpkin-foam",
    "drink-dragonfruit-refresher.png": "drink-dragonfruit-refresher",
    "drink-strawberry-matcha.png": "drink-strawberry-matcha",
    "drink-caramel-cold-foam.png": "drink-caramel-cold-foam",
    "cup-ramadan.png": "cup-ramadan",
    "tumbler-bear.png": "tumbler-bear",
}


def trim_to_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
    box = alpha.getbbox()
    if box is None:
        raise ValueError("image is fully transparent")
    left, top, right, bottom = box
    pad = round(max(right - left, bottom - top) * PADDING_RATIO)
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def save_sprite(source: Path, name: str) -> dict[str, int | str]:
    image = trim_to_alpha(Image.open(source).convert("RGBA"))
    width = round(image.width * SPRITE_HEIGHT / image.height)
    image = image.resize((width, SPRITE_HEIGHT), Image.Resampling.LANCZOS)
    target = OUT_DIR / f"{name}.webp"
    image.save(target, "WEBP", quality=88, method=6)
    return {"file": target.name, "width": width, "height": SPRITE_HEIGHT}


def save_logo(source: Path) -> dict[str, int | str]:
    image = Image.open(source).convert("RGBA")
    target = OUT_DIR / "logo-siren.webp"
    image.save(target, "WEBP", lossless=True, method=6)
    return {"file": target.name, "width": image.width, "height": image.height}


def save_backdrops(source: Path) -> list[dict[str, int | str]]:
    photo = Image.open(source).convert("RGB")
    sharp_w = 1600
    sharp = photo.resize((sharp_w, round(photo.height * sharp_w / photo.width)), Image.Resampling.LANCZOS)
    sharp.save(OUT_DIR / "bg-cafe.webp", "WEBP", quality=74, method=6)

    blur_w = 960
    blurred = photo.resize((blur_w, round(photo.height * blur_w / photo.width)), Image.Resampling.LANCZOS)
    blurred = blurred.filter(ImageFilter.GaussianBlur(radius=10))
    blurred.save(OUT_DIR / "bg-cafe-blur.webp", "WEBP", quality=62, method=6)
    return [
        {"file": "bg-cafe.webp", "width": sharp.width, "height": sharp.height},
        {"file": "bg-cafe-blur.webp", "width": blurred.width, "height": blurred.height},
    ]


def main() -> int:
    source_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets-src" / "brand"
    if not source_dir.is_dir():
        print(f"Source directory not found: {source_dir}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    report: dict[str, object] = {"sprites": {}}
    for file_name, name in SPRITES.items():
        report["sprites"][name] = save_sprite(source_dir / file_name, name)  # type: ignore[index]
    report["logo"] = save_logo(source_dir / "logo-siren.png")
    report["backdrops"] = save_backdrops(source_dir / "photo-cafe-nitro.jpg")

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

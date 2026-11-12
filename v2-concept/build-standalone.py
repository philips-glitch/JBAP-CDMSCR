#!/usr/bin/env python3
"""Build one self-contained HTML of the V2 concept (CSS and images inlined) to share without the repo.

Usage: python3 v2-concept/build-standalone.py <output.html>
"""
import base64
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent


def data_uri(path: pathlib.Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: build-standalone.py <output.html>")
    html = (HERE / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")

    link = '<link rel="stylesheet" href="../styles.css">'
    if link not in html:
        sys.exit("stylesheet link not found")
    html = html.replace(link, "<style>\n" + css + "\n</style>")

    assets = {p.stem: data_uri(p) for p in sorted((ROOT / "assets").glob("*.png"))}
    for name in ("logo", "user"):
        html = html.replace(f"../assets/{name}.png", assets[name])
    dyn = "../assets/ic-${ic}.png"
    if dyn not in html:
        sys.exit("dynamic icon path not found")
    html = html.replace(dyn, '${ASSETS["ic-"+ic]}')
    table = "const ASSETS=" + repr({k: v for k, v in assets.items() if k.startswith("ic-")}).replace("'", '"') + ";\n"
    html = html.replace("<script>\n", "<script>\n" + table, 1)
    if "../assets/" in html or "../styles.css" in html:
        sys.exit("a relative asset path is left")

    out = pathlib.Path(sys.argv[1])
    out.write_text(html, encoding="utf-8")
    print(f"{out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

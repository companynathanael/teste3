#!/usr/bin/env python3
"""Gera horacio.html: um arquivo único com CSS, JS e imagens embutidos.
Uso: python3 tools/build-single.py [saida.html]"""
import base64, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "dist" / "horacio.html"
uri = lambda p: "data:image/svg+xml;base64," + base64.b64encode((root / p).read_bytes()).decode()
imgs = {p: uri(p) for p in ("assets/logo.svg", "assets/mark.svg")}
fix = lambda t: re.sub("|".join(map(re.escape, imgs)), lambda m: imgs[m.group(0)], t)
h = (root / "index.html").read_text()
h = h.replace('<link rel="stylesheet" href="styles.css" />', "<style>\n" + (root / "styles.css").read_text() + "\n</style>")
for js in re.findall(r'<script src="([^"]+\.js)"></script>', h):
    h = h.replace(f'<script src="{js}"></script>', "<script>\n" + fix((root / js).read_text()) + "\n</script>")
h = fix(h)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(h)
print(f"{out} ({len(h)//1024} KB)")

import os
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
APP_DIR = os.path.join(BASE_DIR, 'src', 'app')
ICONS_DIR = os.path.join(PUBLIC_DIR, 'icons')

src_png = os.path.join(ICONS_DIR, 'icon-512x512.png')
im = Image.open(src_png)

sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
im_resized = []
for s in sizes:
    im_resized.append(im.resize(s, Image.Resampling.LANCZOS))

ico_app = os.path.join(APP_DIR, 'favicon.ico')
ico_public = os.path.join(PUBLIC_DIR, 'favicon.ico')

im_resized[0].save(ico_app, format='ICO', sizes=sizes, append_images=im_resized[1:])
im_resized[0].save(ico_public, format='ICO', sizes=sizes, append_images=im_resized[1:])
print("Successfully generated multi-resolution favicon.ico in src/app and public!")

# PBM panel frames (800x480 landscape) -> upright portrait PNGs, the way the X4 is held.
import sys, glob, os
from PIL import Image
for p in sorted(glob.glob(sys.argv[1] + '/**/*.pbm', recursive=True)):
    im = Image.open(p).convert('L')
    # canvas maps logical (x, y) -> panel (y, 479 - x); undo it
    im = im.transpose(Image.Transpose.ROTATE_270)
    im.save(p[:-4] + '.png'); os.remove(p)
print('ok')

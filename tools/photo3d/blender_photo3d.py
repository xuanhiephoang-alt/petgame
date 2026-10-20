"""
Run photo3d with Blender's own Python (no pip install needed):

    blender --background --python tools/photo3d/blender_photo3d.py -- PHOTOS_FOLDER [options]

Same options as `python -m photo3d`. Inside a running Blender (for example
from Blender MCP), import the result straight into the scene:

    import sys; sys.path.insert(0, r"C:\\path\\to\\petgame\\tools\\photo3d")
    import photo3d.blender as pb
    pb.run(r"C:\\photos\\my_toy")
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from photo3d.__main__ import main  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
main(argv)

"""
photo3d: build a textured 3D model from photos of an object's four sides
(front, right, back, left; a top photo is optional).

Pipeline: load photos -> cut out the object -> align the views -> carve the
shape from the silhouettes (visual hull, with rounded cross-sections) ->
extract and smooth a mesh -> texture it with the photos -> export GLB/OBJ.

The core needs only numpy, so it also runs inside Blender's Python.
"""

__version__ = "0.1.0"

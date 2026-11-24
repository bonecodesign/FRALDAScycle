"""Synthetic-only decoder regressions. No filesystem inputs or real photos."""
import io
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch
from PIL import Image, JpegImagePlugin, UnidentifiedImageError

decode = runpy.run_path(str(Path(__file__).resolve().parents[1] /
                            "tools" / "media-local-lab.py"))["decode_and_reencode"]


def encode(fmt, size=(32, 32), animated=False):
    out = io.BytesIO()
    image = Image.new("RGB", size, "white")
    kwargs = {}
    if animated:
        kwargs = {"save_all": True, "append_images": [Image.new("RGB", size, "black")],
                  "duration": 100, "loop": 0}
    image.save(out, format=fmt, **kwargs)
    return out.getvalue()


class DecodePreflight(unittest.TestCase):
    def test_rejects_byte_count_before_open(self):
        for data in (b"", b"x" * 10_000_001, "not bytes"):
            with self.subTest(kind=type(data).__name__), patch.object(Image, "open") as opener:
                with self.assertRaises(ValueError):
                    decode(data)
                opener.assert_not_called()

    def test_rejects_oversized_jpeg_before_pixel_decode(self):
        for size in ((1601, 2), (2, 1601)):
            blob = encode("JPEG", size)
            with self.subTest(size=size), patch.object(JpegImagePlugin.JpegImageFile, "load",
                                                      side_effect=AssertionError("pixel decode called")):
                with self.assertRaisesRegex(ValueError, "dimensions"):
                    decode(blob)

    def test_rejects_nonallowlisted_and_corrupt_formats(self):
        for blob in (encode("GIF"), encode("BMP"), b"invalid"):
            with self.assertRaises((UnidentifiedImageError, ValueError)):
                decode(blob)

    def test_rejects_actual_animated_png_and_webp(self):
        for fmt in ("PNG", "WEBP"):
            with self.subTest(format=fmt):
                blob = encode(fmt, animated=True)
                with Image.open(io.BytesIO(blob)) as source:
                    self.assertEqual(source.n_frames, 2)
                with self.assertRaisesRegex(ValueError, "multiple frames"):
                    decode(blob)

    def test_static_supported_formats_still_convert(self):
        for fmt in ("JPEG", "PNG", "WEBP"):
            with self.subTest(format=fmt):
                output, metadata = decode(encode(fmt))
                self.assertEqual(metadata["type"], "WEBP")
                self.assertTrue(metadata["outputNoExif"])
                self.assertTrue(metadata["outputNoGps"])
                with Image.open(io.BytesIO(output)) as result:
                    self.assertEqual(result.size, (32, 32))
                    self.assertEqual(result.n_frames, 1)


if __name__ == "__main__":
    unittest.main()

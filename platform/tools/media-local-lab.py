#!/usr/bin/env python3
"""Isolated, offline, synthetic image exerciser. NOT a production media pipeline.

Requires preinstalled Pillow, OpenCV, qrcode, Tesseract; does not pip install.
Raw OCR is emitted only over a local stdout pipe to the Node orchestrator and
is never written to a report or fixture file. No real images are loaded.
"""
import hashlib
import io
import json
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError
from PIL.TiffImagePlugin import IFDRational
import cv2
import numpy as np
import pytesseract
import qrcode


def text_fixture(label):
    image = Image.new('RGB', (1350, 510), 'white')
    draw = ImageDraw.Draw(image)
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
        'C:/Windows/Fonts/arial.ttf',
    ]
    font = None
    for path in font_paths:
        try:
            font = ImageFont.truetype(path, 57)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default(size=57)
    draw.text((50, 100), label, fill='black', font=font)
    draw.rectangle((20, 20, 1330, 490), outline='#b0b0b0', width=3)
    return image


def qr_fixture():
    image = Image.new('RGB', (800, 800), 'white')
    qr = qrcode.QRCode(version=3, box_size=16, border=4, error_correction=qrcode.constants.ERROR_CORRECT_H)
    qr.add_data('https://example.invalid/synthetic-qr-no-real-person')
    qr.make(fit=True)
    code = qr.make_image(fill_color='black', back_color='white').convert('RGB')
    code.thumbnail((690, 690), Image.Resampling.NEAREST)
    image.paste(code, ((image.width - code.width) // 2, (image.height - code.height) // 2))
    return image


def incoming_jpeg(image):
    original = io.BytesIO()
    exif = Image.Exif()
    exif[0x010E] = 'Synthetic EXIF description: not real personal data'
    exif[0x0131] = 'Artificial camera firmware'
    exif[0x8825] = {
        1: 'S', 2: (IFDRational(1, 1), IFDRational(2, 1), IFDRational(3, 1)),
        3: 'W', 4: (IFDRational(3, 1), IFDRational(4, 1), IFDRational(5, 1)),
    }  # invented coordinates on test image, never a real person's location
    image.save(original, format='JPEG', quality=95, exif=exif)
    return original.getvalue()


def decode_and_reencode(data):
    with Image.open(io.BytesIO(data)) as img:
        img.load()
        if img.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError('invalid image type')
        if img.width < 1 or img.height < 1 or img.width > 1600 or img.height > 1600:
            raise ValueError('invalid image dimensions')
        input_had_exif = bool(img.getexif())
        input_had_gps = bool(img.getexif().get_ifd(0x8825))
        converted = img.convert('RGB')
        out = io.BytesIO()
        converted.save(out, format='WEBP', quality=90, method=4)
    encoded = out.getvalue()
    with Image.open(io.BytesIO(encoded)) as check:
        check.load()
        no_exif = not bool(check.getexif()) and 'exif' not in check.info
        no_gps = not bool(check.getexif().get_ifd(0x8825))
        output_type = check.format
        width, height = check.size
    if len(encoded) > 10_000_000:
        raise ValueError('output too large')
    return encoded, {'inputHadExif': input_had_exif, 'inputHadGps': input_had_gps, 'outputNoExif': no_exif,
                     'outputNoGps': no_gps, 'type': output_type,
                     'width': width, 'height': height, 'bytes': len(encoded)}


def inspect_image(name, image):
    raw = incoming_jpeg(image)
    converted, meta = decode_and_reencode(raw)
    readable = Image.open(io.BytesIO(converted)).convert('RGB')
    ocr = pytesseract.image_to_string(readable, lang='eng', config='--psm 6')
    rgb_array = cv2.cvtColor(np.array(readable), cv2.COLOR_RGB2BGR)
    qr_value, corners, _ = cv2.QRCodeDetector().detectAndDecode(rgb_array)
    return {'case': name, 'inputSha256': hashlib.sha256(raw).hexdigest(),
            'outputSha256': hashlib.sha256(converted).hexdigest(),
            'metadata': meta, 'ocr': ocr, 'qrDetected': bool(qr_value and corners is not None)}


def main():
    if not shutil.which('tesseract'):
        raise RuntimeError('Tesseract is unavailable: no implicit installation')
    cases = [
        inspect_image('clean-packaged-product', text_fixture('Pacote lacrado com 50 unidades')),
        inspect_image('synthetic-contact', text_fixture('Contato: (31) 99999-0000')),
        inspect_image('synthetic-qr', qr_fixture()),
    ]
    corrupted_rejected = False
    oversized_rejected = False
    for blob, label in [(b'not-an-image', 'corrupted'),
                        (incoming_jpeg(Image.new('RGB', (1601, 2), 'white')), 'oversized')]:
        try:
            decode_and_reencode(blob)
        except (UnidentifiedImageError, ValueError):
            if label == 'corrupted': corrupted_rejected = True
            else: oversized_rejected = True
    clamscan_present = bool(shutil.which('clamscan'))
    info = {'schemaVersion': 1,
            'runtime': {'pillow': Image.__version__, 'opencv': cv2.__version__,
                        'tesseract': subprocess.check_output(['tesseract', '--version'], stderr=subprocess.STDOUT, text=True).splitlines()[0]},
            'cases': cases, 'negativeInputs': {
                'corruptedRejected': corrupted_rejected,
                'oversizedRejected': oversized_rejected,
            },
            'antivirus': {'clamscanAvailable': clamscan_present, 'scanPerformed': False}}
    sys.stdout.write(json.dumps(info, separators=(',', ':')))


if __name__ == '__main__':
    main()

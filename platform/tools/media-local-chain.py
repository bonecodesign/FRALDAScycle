#!/usr/bin/env python3
"""FC-365: disposable, offline *synthetic-only* image-chain laboratory.

Uses media-local-lab.py's generators and re-encoder. Requires a real clamscan
with fresh definitions validated separately by the Node parent. Scans original
and re-encoded images BEFORE OCR/QR. Does not read any user-supplied image or
write persistent files. stdout sends raw synthetic OCR ONLY to the Node parent,
which must discard it before publishing redacted evidence.

NOT a production media processor, antimalware service, or provider attestation.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile

lab = runpy.run_path(str(Path(__file__).with_name("media-local-lab.py")))
Image = lab["Image"]
UnidentifiedImageError = lab["UnidentifiedImageError"]
cv2 = lab["cv2"]
np = lab["np"]
pytesseract = lab["pytesseract"]


def scan_blob(blob, label):
    """Scan exact bytes in a restrictive disposable directory; never log raw scanner output."""
    if not isinstance(blob, bytes) or len(blob) < 1 or len(blob) > 10_000_000:
        return "scan-error"
    with tempfile.TemporaryDirectory(prefix="fraldacycle-fc365-") as directory:
        path = Path(directory) / (label + ".jpg")
        fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(blob)
        try:
            result = subprocess.run(
                ["clamscan", "--no-summary", "--database=/var/lib/clamav", str(path)],
                check=False, capture_output=True, text=True, timeout=35,
            )
        except (OSError, subprocess.TimeoutExpired):
            return "scan-error"
        if result.stderr.strip() or len(result.stdout) > 4096 or result.stdout.count("\n") != 1:
            return "scan-error"
        line = result.stdout.strip()
        if result.returncode == 0 and line == str(path) + ": OK":
            return "clean"
        # Only used for EICAR. Do not echo its signature or an unknown scanner finding.
        if result.returncode == 1 and line == str(path) + ": Eicar-Test-Signature FOUND":
            return "eicar-detected"
        return "scan-error"


def inspect(name, blob):
    """One deterministic pipeline: INPUT AV -> decode -> WebP -> OUTPUT AV -> OCR -> QR."""
    result = {
        "case": name, "inputSha256": hashlib.sha256(blob).hexdigest(),
        "inputAntivirus": scan_blob(blob, name + "-original"),
        "converted": False, "decoded": False, "outputAntivirus": "not-attempted",
        "ocr": None, "qrDetected": None, "metadata": None, "outputSha256": None,
    }
    if result["inputAntivirus"] != "clean":
        return result
    try:
        output, meta = lab["decode_and_reencode"](blob)
    except (ValueError, UnidentifiedImageError):
        return result
    result["decoded"] = True
    result["converted"] = True
    result["metadata"] = meta
    result["outputSha256"] = hashlib.sha256(output).hexdigest()
    result["outputAntivirus"] = scan_blob(output, name + "-webp")
    if result["outputAntivirus"] != "clean":
        return result
    with Image.open(io.BytesIO(output)) as picture:
        picture.load()
        readable = picture.convert("RGB")
        result["ocr"] = pytesseract.image_to_string(readable, lang="eng", config="--psm 6")
        bgr = cv2.cvtColor(np.array(readable), cv2.COLOR_RGB2BGR)
        value, corners, _ = cv2.QRCodeDetector().detectAndDecode(bgr)
        result["qrDetected"] = bool(value and corners is not None)
    return result


def main():
    test = [
        ("synthetic-clean", lab["incoming_jpeg"](lab["text_fixture"]("Pacote lacrado com 50 unidades"))),
        ("synthetic-phone", lab["incoming_jpeg"](lab["text_fixture"]("Contato: (31) 99999-0000"))),
        ("synthetic-qr", lab["incoming_jpeg"](lab["qr_fixture"]())),
        # Test-only *non-malicious* EICAR pattern pretending to be an image.
        # AV must reject it BEFORE the decoder can reject a malformed image.
        ("synthetic-eicar", b"X5O!P%@AP[4" + bytes([92]) +
         b"PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"),
        ("synthetic-corrupted", b"synthetic-not-a-real-image"),
    ]
    # FC-366: the bounded Node laboratory can run one artificial case per
    # child process. It uses a fixed allowlist, never a user-selected file.
    if len(sys.argv) == 3 and sys.argv[1] == "--case":
        selected = sys.argv[2]
        if selected not in {name for name, _ in test}:
            raise ValueError("Unknown synthetic case")
        test = [(name, blob) for name, blob in test if name == selected]
    elif len(sys.argv) != 1:
        raise ValueError("Only built-in synthetic cases are allowed")
    data = {
        "schemaVersion": 1,
        "pipelineOrder": ["input-av", "image-decoder", "webp-no-exif", "output-av", "ocr", "qr", "content-policy"],
        "cases": [inspect(name, blob) for name, blob in test],
    }
    sys.stdout.write(json.dumps(data, separators=(",", ":")))


if __name__ == "__main__":
    main()

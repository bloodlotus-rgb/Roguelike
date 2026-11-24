"""Publish the measured windows and events as ordinary CSV/JSON files in a reproducible ZIP."""
import gzip
import sys
import zipfile
from pathlib import Path

tables, target = map(Path, sys.argv[1:])
with zipfile.ZipFile(target, 'w') as archive:
    for path in sorted(tables.iterdir()):
        if path.name.endswith('.csv.gz'):
            data = gzip.decompress(path.read_bytes())
            name = path.stem
        elif path.name.endswith('-annual.json'):
            data = path.read_bytes()
            name = path.name
        else:
            continue
        archive.writestr(zipfile.ZipInfo(name), data, compress_type=zipfile.ZIP_DEFLATED)

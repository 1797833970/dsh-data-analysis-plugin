"""Robust tabular-file readers handling common formats, delimiters, and encodings."""

from __future__ import annotations

import csv
import io

import pandas as pd

# Ordered by likelihood; gb18030 is a superset of GBK/GB2312.
_ENCODINGS = ('utf-8-sig', 'utf-8', 'gb18030', 'big5', 'utf-16', 'latin-1')
_DELIMITERS = ',;\t| '


def _decode(raw: bytes) -> str:
    for encoding in _ENCODINGS:
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return raw.decode('utf-8', errors='replace')


def _read_delimited(path: str, **kwargs) -> pd.DataFrame:
    with open(path, 'rb') as handle:
        raw = handle.read()
    text = _decode(raw)
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=_DELIMITERS)
        separator = dialect.delimiter
    except csv.Error:
        separator = ','
    return pd.read_csv(io.StringIO(text), sep=separator, **kwargs)


def read_table(path: str, **kwargs) -> pd.DataFrame:
    """Read a tabular file, auto-handling format, delimiter, and encoding.

    Supports CSV / TSV / TXT / XLSX / XLS / XLSM / JSON / Parquet / Pickle. For
    text formats the encoding is detected (UTF-8, GB18030, Big5, UTF-16, Latin-1)
    and the delimiter is sniffed, so a Chinese Windows CSV loads without a
    UnicodeDecodeError.
    """
    lower = path.lower()
    if lower.endswith(('.xlsx', '.xls', '.xlsm')):
        return pd.read_excel(path, **kwargs)
    if lower.endswith('.json'):
        return pd.read_json(path, **kwargs)
    if lower.endswith(('.parquet', '.pq')):
        return pd.read_parquet(path, **kwargs)
    if lower.endswith(('.pkl', '.pickle')):
        return pd.read_pickle(path, **kwargs)
    return _read_delimited(path, **kwargs)

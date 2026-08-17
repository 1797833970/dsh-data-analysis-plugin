"""Data-cleaning helpers built on pandas. All functions are vectorized."""

from __future__ import annotations

import pandas as pd


def drop_duplicates_and_fill(
    df: pd.DataFrame,
    numeric_strategy: str = "median",
    categorical_strategy: str = "mode",
) -> pd.DataFrame:
    """Drop exact duplicates and fill missing values with simple strategies."""
    cleaned = df.drop_duplicates(keep="first").copy()
    numeric = cleaned.select_dtypes(include="number").columns
    for col in numeric:
        if cleaned[col].isna().any():
            cleaned[col] = cleaned[col].fillna(cleaned[col].agg(numeric_strategy))
    categorical = cleaned.select_dtypes(exclude="number").columns
    for col in categorical:
        if cleaned[col].isna().any() and categorical_strategy == "mode":
            cleaned[col] = cleaned[col].fillna(cleaned[col].mode().iloc[0])
    return cleaned


def convert_dtypes(df: pd.DataFrame, numeric_columns: list[str]) -> pd.DataFrame:
    """Coerce the given columns to numeric, replacing failures with NaN."""
    out = df.copy()
    for col in numeric_columns:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def remove_outliers_iqr(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Drop rows whose value lies outside 1.5 * IQR for any given column."""
    out = df.copy()
    for col in columns:
        q1, q3 = out[col].quantile([0.25, 0.75])
        iqr = q3 - q1
        out = out[(out[col] >= q1 - 1.5 * iqr) & (out[col] <= q3 + 1.5 * iqr)]
    return out

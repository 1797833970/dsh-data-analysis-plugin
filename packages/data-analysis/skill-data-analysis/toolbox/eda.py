"""Exploratory-analysis helpers."""

from __future__ import annotations

import pandas as pd


def summarize(df: pd.DataFrame) -> pd.DataFrame:
    """Return a combined profile: dtype, non-null count, and missing ratio."""
    profile = pd.DataFrame({
        "dtype": df.dtypes.astype(str),
        "non_null": df.notna().sum(),
        "missing_ratio": df.isna().mean().round(4),
    })
    return profile


def correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Return rounded correlations of numeric columns."""
    return df.select_dtypes(include="number").corr().round(2)


def top_groups(
    df: pd.DataFrame,
    by: str,
    target: str,
    agg: str = "sum",
    limit: int = 10,
) -> pd.DataFrame:
    """Aggregate `target` grouped by `by` and return the top rows."""
    return (
        df.groupby(by)[target]
        .agg(agg)
        .sort_values(ascending=False)
        .head(limit)
        .reset_index()
    )

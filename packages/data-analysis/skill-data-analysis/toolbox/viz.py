"""Small helpers that build ECharts option dictionaries."""

from __future__ import annotations

from typing import Any


def bar_option(title: str, categories: list[str], values: list[float]) -> dict[str, Any]:
    """Build a bar chart option."""
    return {
        "title": {"text": title},
        "xAxis": {"type": "category", "data": categories},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": values}],
    }


def line_option(title: str, categories: list[str], values: list[float]) -> dict[str, Any]:
    """Build a line chart option."""
    return {
        "title": {"text": title},
        "xAxis": {"type": "category", "data": categories},
        "yAxis": {"type": "value"},
        "series": [{"type": "line", "data": values}],
    }


def pie_option(title: str, names: list[str], values: list[float]) -> dict[str, Any]:
    """Build a pie chart option."""
    data = [{"name": name, "value": value} for name, value in zip(names, values)]
    return {
        "title": {"text": title},
        "series": [{"type": "pie", "data": data}],
    }

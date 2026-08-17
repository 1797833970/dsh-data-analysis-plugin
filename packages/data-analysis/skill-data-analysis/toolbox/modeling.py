"""Machine-learning helpers for classification and regression."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score, roc_auc_score
from sklearn.model_selection import cross_val_score, train_test_split


CLASSIFIERS = {
    "logistic": LogisticRegression(max_iter=1000),
    "random-forest": RandomForestClassifier(n_estimators=100, random_state=0),
    "gradient-boosting": GradientBoostingClassifier(random_state=0),
}

REGRESSORS = {
    "random-forest": RandomForestRegressor(n_estimators=100, random_state=0),
    "gradient-boosting": GradientBoostingRegressor(random_state=0),
}


def train_classifier(
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str = "random-forest",
    test_size: float = 0.2,
    random_state: int = 0,
) -> dict[str, float]:
    """Train one classifier and return hold-out metrics."""
    model = CLASSIFIERS[model_name]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    metrics: dict[str, float] = {
        "accuracy": accuracy_score(y_test, pred),
        "f1": f1_score(y_test, pred, average="weighted"),
    }
    try:
        proba = model.predict_proba(X_test)
        metrics["roc_auc"] = roc_auc_score(y_test, proba, multi_class="ovr", average="weighted")
    except Exception:
        pass
    metrics["cv_accuracy"] = float(np.mean(cross_val_score(model, X, y, cv=5)))
    return metrics


def train_regressor(
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str = "random-forest",
    test_size: float = 0.2,
    random_state: int = 0,
) -> dict[str, float]:
    """Train one regressor and return hold-out metrics."""
    model = REGRESSORS[model_name]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    return {
        "rmse": float(np.sqrt(mean_squared_error(y_test, pred))),
        "mae": float(mean_absolute_error(y_test, pred)),
        "r2": float(r2_score(y_test, pred)),
    }

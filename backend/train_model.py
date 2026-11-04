"""
Train and export the house-price models using the same preprocessing
and candidate algorithms used in the supplied project1.ipynb.

Put dataset_2.xlsx in this backend/ folder, then run:
    python train_model.py
"""
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "dataset_2.xlsx"
MODEL_PATH = BASE_DIR / "best_model.pkl"
FEATURES_PATH = BASE_DIR / "feature_names.pkl"

NUMERIC_FILL = {
    "Area_SqFt": "mean",
    "Rooms": "median",
    "Build_Year": "median",
}
CATEGORICAL_COLUMNS = ["Location", "Street_Type", "Furnishing", "Property_Type"]
REQUIRED_COLUMNS = [
    "Area_SqFt", "Rooms", "Build_Year", "Has_Pool", "Location",
    "Street_Type", "Furnishing", "Property_Type", "Price"
]


def prepare_data(df: pd.DataFrame):
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")

    df = df.copy()
    for col, strategy in NUMERIC_FILL.items():
        value = df[col].mean() if strategy == "mean" else df[col].median()
        df[col] = df[col].fillna(value)

    df["Furnishing"] = df["Furnishing"].fillna(df["Furnishing"].mode().iloc[0])
    df = df.dropna(subset=["Price"]).copy()
    df["Has_Pool"] = df["Has_Pool"].map({"Yes": 1, "No": 0})
    df["Has_Pool"] = df["Has_Pool"].fillna(0).astype(int)

    # Match the notebook's one-hot encoding convention.
    encoded = pd.get_dummies(df, columns=CATEGORICAL_COLUMNS, drop_first=True)
    X = encoded.drop(columns=["Price"])
    y = encoded["Price"]
    return X, y, df


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Could not find {DATA_PATH.name}. Copy your original dataset_2.xlsx "
            "into the backend/ folder and run this script again."
        )

    raw = pd.read_excel(DATA_PATH)
    X, y, cleaned = prepare_data(raw)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    models = {
        "Linear Regression": LinearRegression(),
        "Decision Tree Regression": DecisionTreeRegressor(random_state=42),
        "Random Forest Regression": RandomForestRegressor(
            n_estimators=100, random_state=42
        ),
        "XGBoost Regression": XGBRegressor(
            n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42
        ),
    }

    rows = []
    fitted = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        mse = mean_squared_error(y_test, pred)
        rows.append({
            "model": name,
            "mae": float(mean_absolute_error(y_test, pred)),
            "mse": float(mse),
            "rmse": float(np.sqrt(mse)),
            "r2": float(r2_score(y_test, pred)),
        })
        fitted[name] = model

    rows.sort(key=lambda row: row["r2"], reverse=True)
    best_name = rows[0]["model"]
    best_model = fitted[best_name]
    
    # Generate diagnostics for the selected best model
    best_predictions = best_model.predict(X_test)

    prediction_diagnostics = [
        {
            "actual": float(actual),
            "predicted": float(predicted),
            "residual": float(actual - predicted)
        }
        for actual, predicted in zip(y_test, best_predictions)
    ]

    (BASE_DIR / "test_predictions.json").write_text(
        json.dumps(prediction_diagnostics, indent=2)
    )

    # Match the supplied notebook: its feature-importance plot uses the
    # Random Forest model, even when another algorithm wins on R².
    # Permutation importance for the selected best model
    perm_result = permutation_importance(
        best_model,
        X_test,
        y_test,
        n_repeats=30,
        random_state=42,
        scoring="r2",
        n_jobs=-1
    )

    importance = [
        {
            "feature": str(feature),
            "importance": max(0.0, float(value)),
            "raw_permutation_score_drop": float(value)
        }
        for feature, value in zip(
            X_test.columns,
            perm_result.importances_mean
        )
    ]

    importance.sort(
        key=lambda item: item["importance"],
        reverse=True
    )

    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(X.columns.tolist(), FEATURES_PATH)

    categories = {}
    for col in CATEGORICAL_COLUMNS:
        categories[col] = sorted(cleaned[col].dropna().astype(str).unique().tolist())

    metadata = {
        "best_model": best_name,
        "rows_used": int(len(cleaned)),
        "feature_count": int(len(X.columns)),
        "categories": categories,
        "numeric_defaults": {
            "Area_SqFt": float(cleaned["Area_SqFt"].median()),
            "Rooms": int(round(cleaned["Rooms"].median())),
            "Build_Year": int(round(cleaned["Build_Year"].median())),
        },
    }

    (BASE_DIR / "metrics.json").write_text(json.dumps(rows, indent=2))
    (BASE_DIR / "feature_importance.json").write_text(json.dumps(importance[:12], indent=2))
    (BASE_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2))

    print(f"Best model: {best_name}")
    print(f"Rows used: {len(cleaned)} | Features: {len(X.columns)}")
    print("Saved best_model.pkl, feature_names.pkl, metrics.json,")
    print("feature_importance.json and model_metadata.json")


if __name__ == "__main__":
    main()

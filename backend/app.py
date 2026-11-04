from pathlib import Path
import json
import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

model = None
expected_features = []
metadata = {}
metrics = []
feature_importance = []


def load_artifacts():
    global model, expected_features, metadata, metrics, feature_importance
    required = [BASE_DIR / "best_model.pkl", BASE_DIR / "feature_names.pkl"]
    missing = [p.name for p in required if not p.exists()]
    if missing:
        raise RuntimeError(
            "Model artifacts are missing: " + ", ".join(missing) +
            ". Add dataset_2.xlsx to backend/ and run python train_model.py."
        )
    model = joblib.load(required[0])
    expected_features = joblib.load(required[1])
    for filename, target in [
        ("model_metadata.json", "metadata"),
        ("metrics.json", "metrics"),
        ("feature_importance.json", "importance"),
    ]:
        path = BASE_DIR / filename
        value = json.loads(path.read_text()) if path.exists() else {}
        if target == "metadata":
            metadata = value
        elif target == "metrics":
            metrics = value
        else:
            feature_importance = value


def build_input(payload):
    required = ["Area_SqFt", "Rooms", "Build_Year", "Has_Pool",
                "Location", "Street_Type", "Furnishing", "Property_Type"]
    missing = [key for key in required if key not in payload or payload[key] in (None, "")]
    if missing:
        raise ValueError("Please complete all property fields: " + ", ".join(missing))

    area = float(payload["Area_SqFt"])
    rooms = int(payload["Rooms"])
    year = int(payload["Build_Year"])
    if area <= 0 or rooms <= 0:
        raise ValueError("Area and room count must be greater than zero.")
    if year < 1800 or year > 2100:
        raise ValueError("Please enter a valid construction year.")

    row = {feature: 0 for feature in expected_features}
    numeric_values = {
        "Area_SqFt": area,
        "Rooms": rooms,
        "Build_Year": year,
        "Has_Pool": 1 if str(payload["Has_Pool"]).lower() in ("yes", "true", "1") else 0,
    }
    for key, value in numeric_values.items():
        if key in row:
            row[key] = value

    for column in ["Location", "Street_Type", "Furnishing", "Property_Type"]:
        selected = str(payload[column])
        allowed = metadata.get("categories", {}).get(column, [])
        if allowed and selected not in allowed:
            raise ValueError(f"Unsupported {column}: {selected}")
        dummy = f"{column}_{selected}"
        if dummy in row:
            row[dummy] = 1

    return pd.DataFrame([row], columns=expected_features)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})


@app.get("/api/dashboard")
def dashboard():
    return jsonify({
        "best_model": metadata.get("best_model", "Model not trained"),
        "rows_used": metadata.get("rows_used", 0),
        "feature_count": metadata.get("feature_count", len(expected_features)),
        "metrics": metrics,
        "feature_importance": feature_importance,
        "categories": metadata.get("categories", {}),
        "numeric_defaults": metadata.get("numeric_defaults", {}),
    })
@app.get("/api/diagnostics")
def diagnostics():
    diagnostics_path = BASE_DIR / "test_predictions.json"

    if not diagnostics_path.exists():
        return jsonify({
            "error": "Prediction diagnostics not found"
        }), 404

    with open(diagnostics_path, "r") as file:
        predictions = json.load(file)

    return jsonify({
        "predictions": predictions,
        "total_records": len(predictions)
    })


@app.post("/api/predict")
def predict():
    try:
        if model is None:
            return jsonify({"error": "Model is not loaded. Train it first."}), 503
        payload = request.get_json(silent=True) or {}
        input_df = build_input(payload)
        prediction = float(model.predict(input_df)[0])
        return jsonify({
            "predicted_price": prediction,
            "currency": "INR",
            "model": metadata.get("best_model", "Trained model"),
        })
    except (TypeError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Prediction failed")
        return jsonify({"error": "Prediction failed. Check the backend logs."}), 500


if __name__ == "__main__":
    try:
        load_artifacts()
        print("Model artifacts loaded.")
    except Exception as exc:
        print(f"Startup warning: {exc}")
    app.run(host="0.0.0.0", port=5000, debug=False)

# EstateVision — House Price Prediction Web App

A premium dark real-estate valuation dashboard built around the model workflow in `project1.ipynb`.

## Stack
- Frontend: React + Vite + Tailwind CSS + Recharts + Lucide
- Backend: Flask REST API
- ML: scikit-learn + XGBoost + pandas

## 1. Add the dataset
Copy your original `dataset_2.xlsx` into `backend/`.

The notebook supplied for this project references these columns:
`Area_SqFt`, `Rooms`, `Build_Year`, `Has_Pool`, `Location`, `Street_Type`, `Furnishing`, `Property_Type`, `Price`.

## 2. Train the models
Open a terminal in `backend/`:

```bash
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python train_model.py
```

This creates:
- `best_model.pkl`
- `feature_names.pkl`
- `metrics.json`
- `feature_importance.json`
- `model_metadata.json`

The training script uses the same four candidate algorithms, 80/20 split, `random_state=42`, and `drop_first=True` one-hot encoding as the notebook. It selects the model with the highest held-out R² score.

## 3. Run the Flask API
Still inside `backend/`:

```bash
python app.py
```

API runs at `http://127.0.0.1:5000`.

## 4. Run the website
Open a second terminal in `frontend/`:

```bash
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Notes
- The original `dataset_2.xlsx` was not included with the notebook upload. You must add it before training.
- The dashboard's model metrics and feature importance are read from the training outputs; they are not fabricated demo numbers.
- Prediction history is kept in frontend memory for the current browser session only.
- Estimates are model outputs, not formal property appraisals.

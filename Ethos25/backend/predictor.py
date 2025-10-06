import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta
import os
# --- Configuration ---
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_PATH, 'data', 'models', 'best_xgb_model.joblib')
PREPROCESSOR_PATH = os.path.join(BASE_PATH, 'data', 'models', 'preprocessor.joblib')
ENCODER_PATH = os.path.join(BASE_PATH, 'data', 'models', 'label_encoder.joblib')
DATA_PATH = os.path.join(BASE_PATH, 'data', 'models', 'df_ml_ready_final.csv')
OUTPUT_CSV_PATH = os.path.join(BASE_PATH, f"predictions_with_alerts_{datetime.now().strftime('%Y-%m-%d_%H-%M')}.csv")
BACKEND_UPLOAD_URL = 'http://localhost:5000/api/upload' # Example URL for your backend
# --- Alert Logic Function ---import pandas as pd
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta


# --- NEW: Function to Generate Custom Alert Reasons ---
def generate_alert_reason(row):
    """Generates a human-readable comment based on the prediction rules."""
    
    # Rule 1: High-Interest Location
    if row['Predicted_Location_After_12hr'] in ['ADMIN_AREA']:
        return "ALERT: Predicted entry to sensitive area."
        
    # Rule 2: Unusual Time/Location Combination (your suggestion)
    # Check if the alert time is after 6 PM (18:00)
    is_night = row['Alert_Timestamp'].hour >= 18
    if row['Predicted_Location_After_12hr'] == 'AUDITORIUM_ZONE' and is_night:
        return "Unusual: Auditorium prediction after-hours."
        
    # Rule 3: Low-Confidence Prediction
    if row['Prediction_Confidence'] < 0.40: # 40% confidence threshold
        return "Notice: Low confidence in this prediction."
        
    # Default comment
    return "Standard prediction."

# --- Main Simulation and Prediction Function ---
def simulate_all_alerts_with_reasons():
    print("--- Starting Full Historical Alert Simulation Job ---")
    
    model = joblib.load(MODEL_PATH)
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    df_historical = pd.read_csv(DATA_PATH, parse_dates=['Timestamp'])
    
    print(f"Preparing to simulate a 12-hour alert for all {len(df_historical)} historical events...")
    df_to_predict = df_historical.copy()

    # Create hypothetical features for the future event for EVERY row
    df_to_predict['Alert_Timestamp'] = df_to_predict['Timestamp'] + timedelta(hours=12)
    df_to_predict['Time_Since_Last_Event'] = 12 * 3600
    df_to_predict['Last_Location'] = df_to_predict['Location_Code']
    df_to_predict['Last_Zone'] = df_to_predict['Zone_Code']
    df_to_predict['Second_Last_Location'] = df_historical['Last_Location']
    df_to_predict['Second_Last_Zone'] = df_historical['Last_Zone']
    df_to_predict['Hour'] = df_to_predict['Alert_Timestamp'].dt.hour
    df_to_predict['DayOfWeek'] = df_to_predict['Alert_Timestamp'].dt.weekday
    df_to_predict['is_after_hours'] = ((df_to_predict['Hour'] >= 18) | (df_to_predict['DayOfWeek'] >= 5)).astype(int)
    df_to_predict['Hour_sin'] = np.sin(2 * np.pi * df_to_predict['Hour'] / 24)
    df_to_predict['Hour_cos'] = np.cos(2 * np.pi * df_to_predict['Hour'] / 24)
    df_to_predict['Time_Spent_at_Current_Loc'] = 0

    feature_columns = [
        'Last_Zone', 'Second_Last_Zone', 'Event_Type_Grouped', 'Time_Since_Last_Event',
        'Time_Spent_at_Current_Loc', 'Hour_sin', 'Hour_cos', 'DayOfWeek', 'role',
        'User_Top_Zone', 'User_Unique_Locations', 'User_Typical_Hour', 'User_Event_Count',
        'is_transition', 'is_after_hours', 'Community_ID'
    ]
    top_10_events = df_historical['Event_Type'].value_counts().nlargest(10).index.tolist()
    def group_rare_events(event_type):
        if event_type in top_10_events: return event_type
        if str(event_type).startswith('Library_Checkout_Book_'): return 'Library_Checkout_Other'
        if str(event_type).startswith('Note_'): return 'Note_Other'
        return 'Other_Event'
    df_to_predict['Event_Type_Grouped'] = df_to_predict['Event_Type'].apply(group_rare_events)
    X_predict = df_to_predict[feature_columns]
    X_processed = preprocessor.transform(X_predict)
    
    # Make predictions and get probabilities
    print(f"Making simulated predictions for {len(X_predict)} events...")
    predictions_encoded = model.predict(X_processed)
    predictions_proba = model.predict_proba(X_processed) # Get probabilities
    
    # Format the new alert entries
    df_alerts = pd.DataFrame({
        'Alert_Timestamp': df_to_predict['Alert_Timestamp'].values,
        'Entity_ID': df_to_predict['Entity_ID'].values,
        'name': df_to_predict['name'].values,
        'Last_Known_Timestamp': df_to_predict['Timestamp'].values,
        'Last_Known_Location': df_to_predict['Location_Code'].values,
        'Predicted_Location_After_12hr': label_encoder.inverse_transform(predictions_encoded),
        'Prediction_Confidence': np.max(predictions_proba, axis=1) # Add confidence column
    })
    
    # Apply the new function to create the Alert_Reason column
    df_alerts['Alert_Reason'] = df_alerts.apply(generate_alert_reason, axis=1)
    
    # Save the final CSV
    df_alerts.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"✅ Successfully created and saved {len(df_alerts)} simulated alerts to {OUTPUT_CSV_PATH}")
    
    return df_alerts

# --- Run the main function ---
if __name__ == "__main__":
    simulated_alerts = simulate_all_alerts_with_reasons()
    if simulated_alerts is not None:
        print("\n--- Sample of Final Simulated Alerts ---")
        print(simulated_alerts.head())
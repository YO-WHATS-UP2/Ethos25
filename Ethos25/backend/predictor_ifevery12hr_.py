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
OUTPUT_CSV_PATH = os.path.join(BASE_PATH, f"inactivity_gap_alerts_{datetime.now().strftime('%Y-%m-%d_%H-%M')}.csv")

# --- Main Alert Generation Function ---
def generate_inactivity_gap_alerts():
    print("--- Starting Inactivity Gap Alert Generation Job ---")
    
    # 1. Load all necessary files
    model = joblib.load(MODEL_PATH)
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    df_historical = pd.read_csv(DATA_PATH, parse_dates=['Timestamp'])
    
    all_gap_alerts = []
    total_users = df_historical['Entity_ID'].nunique()
    user_count = 0


    # 2. --- CRITICAL: Process each user's timeline individually ---
    for entity_id, user_history in df_historical.groupby('Entity_ID'):
        user_count += 1
        print(f"Processing user {user_count}/{total_users}: {entity_id}")
        user_history = user_history.sort_values('Timestamp').reset_index(drop=True)
        
        if len(user_history) < 2:
            continue

        first_event_time = user_history['Timestamp'].iloc[0]
        last_event_time = user_history['Timestamp'].iloc[-1]
        
        # 3. --- Inner Loop: "Tick" forward in 12-hour intervals ---
        current_time = first_event_time
        while current_time < last_event_time:
            window_start = current_time
            window_end = current_time + timedelta(hours=12)
            
            # Find any actual events within this 12-hour window
            activity_in_window = user_history[
                (user_history['Timestamp'] >= window_start) & 
                (user_history['Timestamp'] < window_end)
            ]
            
            # If the user was active, move to the next window
            if not activity_in_window.empty:
                current_time = window_end
                continue
            
            # --- If we are here, we have found an INACTIVITY GAP ---
            
            # a) Find the last real event before this gap
            last_real_event_before_gap = user_history[user_history['Timestamp'] < window_start].iloc[-1]
            
            # b) Create a hypothetical feature set for the end of the gap
            df_to_predict = pd.DataFrame([last_real_event_before_gap])
            
            # c) Update features for the simulated time
            df_to_predict['Alert_Timestamp'] = window_end
            df_to_predict['Time_Since_Last_Event'] = (window_end - df_to_predict['Timestamp']).dt.total_seconds()
            df_to_predict['Last_Location'] = df_to_predict['Location_Code']
            df_to_predict['Last_Zone'] = df_to_predict['Zone_Code']
            df_to_predict['Hour'] = df_to_predict['Alert_Timestamp'].dt.hour
            df_to_predict['DayOfWeek'] = df_to_predict['Alert_Timestamp'].dt.weekday
            df_to_predict['is_after_hours'] = ((df_to_predict['Hour'] >= 18) | (df_to_predict['DayOfWeek'] >= 5)).astype(int)
            df_to_predict['Hour_sin'] = np.sin(2 * np.pi * df_to_predict['Hour'] / 24)
            df_to_predict['Hour_cos'] = np.cos(2 * np.pi * df_to_predict['Hour'] / 24)
            df_to_predict['Time_Spent_at_Current_Loc'] = 0

            # d) Prepare features for the model
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
            
            # e) Make prediction
            prediction_encoded = model.predict(X_processed)[0]
            predicted_zone = label_encoder.inverse_transform([prediction_encoded])[0]
            
            # f) Create and store the alert record
            alert_record = {
                'Alert_Timestamp': window_end,
                'Entity_ID': last_real_event_before_gap['Entity_ID'],
                'name': last_real_event_before_gap['name'],
                'Last_Known_Timestamp': last_real_event_before_gap['Timestamp'],
                'Last_Known_Location': last_real_event_before_gap['Location_Code'],
                'Predicted_Location_After_Gap': predicted_zone
            }
            all_gap_alerts.append(alert_record)
            
            # Move the ticker to the end of the current window
            current_time = window_end

    # 4. Create and save the final DataFrame
    if not all_gap_alerts:
        print("✅ Analysis complete. No inactivity gaps of 12 hours were found in the dataset.")
        return None
        
    final_alerts_df = pd.DataFrame(all_gap_alerts)
    final_alerts_df.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"\n✅ Successfully created and saved {len(final_alerts_df)} inactivity gap alerts to {OUTPUT_CSV_PATH}")
    
    return final_alerts_df

# --- Run the main function ---
if __name__ == "__main__":
    gap_alerts = generate_inactivity_gap_alerts()
    if gap_alerts is not None:
        print("\n--- Sample of Inactivity Gap Alerts ---")
        print(gap_alerts.head())
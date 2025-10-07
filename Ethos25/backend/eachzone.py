import pandas as pd
import numpy as np
import os

# --- Configuration ---
BASE_PATH = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_PATH, 'data', 'models', 'df_ml_ready_final.csv')

# --- ADD THIS LINE ---
# Load the DataFrame from the CSV file
df_ml_ready = pd.read_csv(DATA_PATH)

# --- The rest of your script is correct ---

def map_location_to_zone_merged(location):
    """
    Reduces granularity by merging zones that are frequently confused.
    """
    loc = str(location)
    if loc in ['LIB_ENT', 'LIBRARY_BUILDING'] or loc.startswith('AP_LIB'):
        return 'LIBRARY_ZONE'
    if loc in ['AUD_AREA', 'AUDITORIUM'] or loc.startswith('AP_AUD'):
        return 'AUDITORIUM_ZONE'
    if loc.startswith('AP_ADMIN'): return 'ADMIN_AREA'
    if loc.startswith('AP_CAF'): return 'CAFETERIA_AREA'
    if loc.startswith('AP_ENG'): return 'ENGINEERING_AREA'
    if loc.startswith('AP_HOSTEL'): return 'HOSTEL_AREA'
    if loc in ['CAF_01', 'GYM', 'HOSTEL_GATE', 'START_SESSION', 'END_SESSION', 'NO_HISTORY']:
        return loc
    return 'MISC_BUILDING'

# 1. Get a list of all unique original location codes
all_locations = df_ml_ready['Location_Code'].unique()

# 2. Create a DataFrame to hold the mapping
df_mapping = pd.DataFrame({'Location_Code': all_locations})

# 3. Apply the function to find the corresponding zone for each location
df_mapping['Zone'] = df_mapping['Location_Code'].apply(map_location_to_zone_merged)

# 4. Group by Zone to see the composition of each
zone_composition = df_mapping.groupby('Zone')['Location_Code'].apply(list).sort_index()

# 5. Print the results in a readable format
print("--- Zone Composition ---")
for zone, locations in zone_composition.items():
    print(f"\n{zone}:")
    # Print up to 5 example locations per zone for clarity
    for loc in sorted(locations)[:5]:
        print(f"  - {loc}")
    if len(locations) > 5:
        print(f"  - ... and {len(locations) - 5} more")
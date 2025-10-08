## .env file -> https://drive.google.com/file/d/18TdBv1lujMQ18JJ_hfsOZUy_JHbCzumU/view?usp=drive_link

## Ethos25 - Predictive Campus Security Dashboard
Ethos25 is a full-stack application that provides a comprehensive security dashboard for monitoring campus activity. It unifies disparate data sources to build a complete profile for any entity (student or staff) and uses a machine learning model to predict their next location based on historical patterns and simulated inactivity alerts.

## ✨ Features
 - Entity Profile Resolution: Search for any Entity_ID to instantly retrieve a complete, unified profile, including personal details and all associated identifiers.

 - Unified Activity Timeline: View a single, chronological timeline that combines all of a user's activities, including card swipes, Wi-Fi connections, lab bookings, CCTV detections, and library checkouts.

 - Predictive Alerts: The timeline is enriched with simulated alerts, which predict a user's next location after a 12-hour period of inactivity, complete with a confidence score and a contextual reason.

 - Full-Stack Application: Includes a Python ML backend for model training and prediction, a Node.js server to handle data, and a vanilla JavaScript frontend for the user interface.

## 🛠️ Tech Stack
 - Machine Learning: Python, Pandas, Scikit-learn, XGBoost, NetworkX

 - Backend: Node.js, Express, MongoDB

 - Frontend: HTML5, CSS3, Vanilla JavaScript

## 📂 Project Structure

- **`Ethos25/`**
  - **`backend/`**
    - `data/`
      - `models/`
      - `alerts.csv`
    - `.env`
    - `package.json`
    - `server.js`
  - **`frontend/`**
    - `index.html`
    - `script.js`
    - `styles.css`
  - **`ml_notebook/`**
    - `Ethos25_Training.ipynb`
    - `predictor.py`

##  🚀 Getting Started
  Follow these steps to set up and run the project locally.

  1. Backend Setup
        The backend serves the data from MongoDB and the generated alerts to the frontend.
    
      Navigate to the backend directory:

          cd backend
      Install dependencies:
    
          npm install
      Set up Environment Variables:
        Create a file named .env in the backend directory and add your MongoDB connection string:

          
          MONGO_URI=(https://drive.google.com/file/d/18TdBv1lujMQ18JJ_hfsOZUy_JHbCzumU/view?usp=drive_link)
      Run the server:

          node server.js
      The server will start on http://localhost:3000.

  3. Machine Learning Pipeline
        The ML pipeline is responsible for training the model and generating the alerts CSV.
      
        Training (if needed): Open the ml_notebook/Ethos25_Training.ipynb notebook in a Jupyter or Colab environment. Run all the cells to perform data processing, feature engineering, and model training. This will generate the necessary model files (.joblib) and the df_ml_ready_final.csv.
      
        Generate Alerts: Run the predictor.py script. This script loads the trained model and the feature-engineered data to produce the final alerts.csv file.

          python ml_notebook/predictor.py
        Move the Alerts File: After the script runs, move the generated alerts.csv file to the backend/data/ directory so the server can load it.

  4. Frontend Setup
        Open the frontend/index.html file directly in your web browser.
        
        Use the search bar to enter an Entity_ID (e.g., E100000) and view the results.

## 🤖 Machine Learning Model
  The core of this project is the predictive model.

 - Goal: To predict a user's next location zone based on their recent activity, personal habits, and social context.

   - Features: The model was trained on a rich set of engineered features, including:

   - Sequential: Last two locations, time since last event.

   - Behavioral: A user's most frequent location, number of unique locations visited.

   - Social: A Community_ID generated from a social network analysis of user co-locations.

   - Contextual: Time of day, day of week, and whether an event is a "transition" between zones.

 - Final Model: An XGBoost Classifier, tuned with RandomizedSearchCV.

 - Performance: The final model achieved ~44% accuracy after strategically merging location zones to simplify the prediction task, demonstrating a strong grasp of the accuracy vs. granularity trade-off.

## A sample of the website:
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/6343bb7b-5c01-4e70-9114-5e924d9ed823" />

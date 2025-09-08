from openai import OpenAI
from flask import Flask, request, jsonify
import PyPDF2
import os
from dotenv import load_dotenv
from flask_cors import CORS
import logging
import json
import re
import requests
import firebase_admin
from argon2.exceptions import VerifyMismatchError
from firebase_admin import credentials, firestore
from argon2 import PasswordHasher
from google.cloud import firestore

# ----------- New code --------------------------
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
# -----------------------------------------------

# Load environment variables ( OpenAI API key from .env file)
load_dotenv()

# Initialize OpenAI client (auto-detects key from env)
client = OpenAI()

# Initialize Flask application
application = Flask(__name__)

# Enable CORS for frontend running on localhost:3575
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://job-match-frontend-gj83.onrender.com"
]

CORS(
    application,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,          # note the exact name
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)
# Debugging: print partial API key (first 8 characters only)
print("OpenAI Key (partial):", os.getenv("OPENAI_API_KEY")[:8])

# Configure Google Firestore with service account credentials
# os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "jobmatchstudent-firebase-adminsdk-fbsvc-b89d7054b1.json"
db = firestore.Client()

# Initialize password hasher for secure password storage (Argon2)
ph = PasswordHasher()

# Set up logging (logs both to file and console)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ----------- New code --------------------------
# Global variable for course data caching
COURSES_DF = None
# ----------- New code --------------------------

# -------------------- HELPER FUNCTIONS --------------------

# ----------- New code --------------------------
def load_course_data():
    """Load course data from JSON or Excel file with updated column names"""
    global COURSES_DF
    if COURSES_DF is not None:
        return COURSES_DF
    
    try:
        # Option 1: Load from JSON
        courses_df = pd.read_json('data/courses.json')
        
        # Option 2: Load from Excel (uncomment if using Excel)
        # courses_df = pd.read_excel('data/courses.xlsx')
        
        COURSES_DF = courses_df
        logger.info(f"Loaded {len(courses_df)} courses from database")
        return courses_df
    except Exception as e:
        logger.error(f"Error loading course data: {e}")
        return pd.DataFrame()  # Return empty DataFrame if loading fails

def find_similar_courses(missing_skills, threshold=0.1):
    """
    Find most similar courses for each missing skill using cosine similarity
    Updated to use: Course No, Course Title, Instructor-in-charge, Description and Scope
    
    Args:
        missing_skills: List of missing skills from GPT analysis
        threshold: Minimum similarity score to consider (default 0.1)
    
    Returns:
        Dictionary with skill as key and recommended course info as value
    """
    courses_df = load_course_data()
    if courses_df.empty:
        return {}
    
    # Combine Course Title with Description and Scope for better matching
    courses_df['Combined'] = (
        courses_df['Course Title'] + ' ' + 
        courses_df['Description and Scope']
    )
    
    # Create corpus of course descriptions
    corpus = courses_df['Combined'].tolist()
    
    # Initialize TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        stop_words='english',
        max_features=1000,
        ngram_range=(1, 2)  # Include both single words and bigrams
    )
    
    # Fit vectorizer on course corpus
    course_vectors = vectorizer.fit_transform(corpus)
    
    results = {}
    
    for skill in missing_skills:
        try:
            # Transform the missing skill
            skill_vector = vectorizer.transform([skill])
            
            # Calculate cosine similarities
            similarities = cosine_similarity(skill_vector, course_vectors).flatten()
            
            # Find the best match
            max_idx = np.argmax(similarities)
            max_similarity = similarities[max_idx]
            
            # Only include if similarity is above threshold
            if max_similarity >= threshold:
                results[skill] = {
                    "Course No": courses_df.iloc[max_idx]['Course No'],
                    "Course Title": courses_df.iloc[max_idx]['Course Title'],
                    "Instructor-in-charge": courses_df.iloc[max_idx]['Instructor-in-charge'],
                    "Similarity": float(max_similarity),
                    "Description and Scope": courses_df.iloc[max_idx]['Description and Scope'][:100] + "..."  # Truncate description
                }
            else:
                # No good match found
                results[skill] = {
                    "Course No": "N/A",
                    "Course Title": "No suitable course found",
                    "Instructor-in-charge": "N/A",
                    "Similarity": 0.0,
                    "Description and Scope": "Consider external courses for this skill"
                }
                
        except Exception as e:
            logger.error(f"Error processing skill '{skill}': {e}")
            results[skill] = {
                "Course No": "ERROR",
                "Course Title": "Error processing skill",
                "Instructor-in-charge": "N/A", 
                "Similarity": 0.0,
                "Description and Scope": "Error occurred during processing"
            }
    
    return results
# ----------- New code --------------------------

def is_valid_url(url):
    """Check if a given URL is valid and reachable within 5 seconds."""
    try:
        response = requests.head(url, timeout=5, allow_redirects=True)
        return response.status_code == 200
    except requests.RequestException:
        return False


def extract_text_from_pdf(pdf_file):
    """Extract raw text from an uploaded PDF file."""
    try:
        reader = PyPDF2.PdfReader(pdf_file)
        text = ''
        for page in reader.pages:
            text += page.extract_text()
        logger.info('PDF text extraction successful')
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        raise


def compare_with_gpt_for_non_immediate_interview(job_description, cv_text):
    """
    Send job description + CV to GPT for analysis.
    GPT returns a JSON object containing:
    - match percentage
    - similarities  
    - missing skills
    - recommended courses with links
    + BITS course recommendations based on missing skills
    """
    try:
        prompt = f"""
        Job Description: {job_description}
        CV Content: {cv_text}

        Analyze the match between the job description and the CV. Return a JSON object with:
        - "match_percentage" (as a number)
        - "similarities" (as an array of strings)
        - "missing" (as an array of strings - specific skills/technologies missing)
        - "course_recommendations" (with 'name' and 'url' - external courses)
        
        For missing skills, be specific (e.g., "Python programming", "Machine Learning", "React.js") rather than vague.
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that analyzes job matches."},
                {"role": "user", "content": prompt}
            ]
        )

        feedback_raw = response.choices[0].message.content.strip()
        match = re.search(r"\{.*\}", feedback_raw, re.DOTALL)
        
        if not match:
            logger.error("No JSON object found in GPT response.")
            raise ValueError("Invalid response format from GPT")

        feedback = json.loads(match.group(0))

        # Keep only valid course URLs for external recommendations
        feedback['course_recommendations'] = [
            course for course in feedback.get('course_recommendations', [])
            if is_valid_url(course['url'])
        ]

        # NEW: Add BITS course recommendations based on missing skills
        missing_skills = feedback.get('missing', [])
        if missing_skills:
            logger.info(f"Finding BITS courses for missing skills: {missing_skills}")
            bits_recommendations = find_similar_courses(missing_skills)
            feedback['bits_recommendations'] = bits_recommendations
        else:
            feedback['bits_recommendations'] = {}

        return feedback

    except Exception as e:
        logger.error(f"Error in GPT API request: {e}")
        raise


# -------------------- ROUTES --------------------

# @application.before_request
# def handle_preflight():
#     if request.method == "OPTIONS":
#         response = jsonify()
#         response.headers.add("Access-Control-Allow-Origin", "*")
#         response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
#         response.headers.add('Access-Control-Allow-Methods', "GET,POST,PUT,DELETE,OPTIONS")
#         response.headers.add('Access-Control-Max-Age', "86400")
#         return response
    
# @application.after_request
# def after_request(response):
#     origin = request.headers.get('Origin')
#     if origin in ['http://localhost:3000', 'http://127.0.0.1:3000','http://127.0.0.1:5000']:
#         response.headers.add('Access-Control-Allow-Origin', origin)
#     response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
#     response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
#     response.headers.add('Access-Control-Allow-Credentials', 'true')
#     return response

@application.route('/')
def index():
    """Health check route — confirms backend is running."""
    return "Backend is running"


@application.route('/signUp', methods=['POST'])
def add_student():
    """
    Register a new student.
    - Expects JSON with name, email, and password.
    - Password is hashed using Argon2 before saving.
    - Student data is stored in Firestore.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        required_fields = ["name", "email", "password"]
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "message": f"Missing field: {field}"}), 400

        hashed_password = ph.hash(data["password"])
        data["password"] = hashed_password  

        db.collection("students").add(data)

        return jsonify({"success": True, "message": "Student added!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@application.route('/login', methods=['POST'])
def login_student():
    """
    Authenticate a student.
    - Checks Firestore for email match.
    - Verifies password against Argon2 hash.
    - Returns student ID, name, and email if successful.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password required"}), 400

        students_ref = db.collection("students").where("email", "==", email).limit(1).get()
        if not students_ref:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401

        student_doc = students_ref[0]
        student_data = student_doc.to_dict()

        try:
            ph.verify(student_data["password"], password)
        except VerifyMismatchError:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401

        return jsonify({
            "success": True,
            "message": "Login successful",
            "student": {
                "id": student_doc.id,
                "name": student_data.get("name"),
                "email": student_data.get("email")
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@application.route('/get-questions', methods=['POST'])
def generate_questions():
    """
    Generate interview questions from a job description (PDF).
    - Extracts text from uploaded PDF.
    - Sends text to GPT model.
    - Parses Q/A pairs and returns them as JSON.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    pdf_file = request.files['file']

    try:
        job_description = extract_text_from_pdf(pdf_file)
    except Exception as e:
        return jsonify({'error': f'Failed to extract text from PDF: {str(e)}'}), 500

    if not job_description.strip():
        return jsonify({'error': 'PDF contains no extractable text'}), 400

    prompt = f"Based on the following job description, generate 10 common interview questions and their answers in the format Q: ... A: ...\n\n{job_description}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # ✅ upgraded model
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    answer_text = response.choices[0].message.content

    # Parse GPT output into structured Q/A pairs
    qa_pairs = []
    lines = answer_text.split('\n')
    current_q, current_a = '', ''
    for line in lines:
        if line.strip().startswith("Q:"):
            if current_q and current_a:
                qa_pairs.append({'question': current_q, 'answer': current_a})
            current_q = line.strip()[2:].strip()
            current_a = ''
        elif line.strip().startswith("A:"):
            current_a = line.strip()[2:].strip()
        else:
            current_a += ' ' + line.strip()

    if current_q and current_a:
        qa_pairs.append({'question': current_q, 'answer': current_a})

    return jsonify({'questions': qa_pairs})


@application.route('/Ask', methods=['POST'])
def Ask():
    """
    General Q&A route.
    - Takes a user question as input.
    - Returns GPT-generated response.
    """
    try:
        data = request.get_json()
        question = data.get('question')

        if not question:
            return jsonify({"error": "No question provided"}), 400

        response = client.chat.completions.create(
            model="gpt-4o-mini",  # ✅ upgraded model
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": question}
            ]
        )

        answer = response.choices[0].message.content.strip()
        logger.debug(f"Received question: {question}")
        logger.debug(f"OpenAI response: {answer}")

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@application.route('/analyze', methods=['POST'])
def analyze():
    """
    Compare CV against job description.
    - Accepts two uploaded PDFs (JD + CV).
    - Extracts text from both.
    - Sends them to GPT for analysis.
    - Returns JSON with match %, similarities, missing skills, and course recommendations.
    """
    jd_file = request.files.get('job_description')
    cv_file = request.files.get('cv')

    if not jd_file or not cv_file:
        logger.error('Missing data: Job description file or CV not provided')
        return jsonify({'error': 'Missing data'}), 400

    try:
        job_description = extract_text_from_pdf(jd_file)   # extract JD text
        cv_text = extract_text_from_pdf(cv_file)
    except Exception as e:
        logger.error(f"Error processing files: {e}")
        return jsonify({'error': f"Error processing files: {str(e)}"}), 500

    try:
        feedback = compare_with_gpt_for_non_immediate_interview(job_description, cv_text)
        return jsonify({'feedback': feedback}), 200
    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        return jsonify({'error': f"Error during analysis: {str(e)}"}), 500


# Run app
if __name__ == '__main__':
    application.run(debug=True)

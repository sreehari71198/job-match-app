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
from argon2.exceptions import VerifyMismatchError
from argon2 import PasswordHasher
from google.cloud import firestore
from google.oauth2 import service_account
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import json

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI()

# Initialize Flask application
application = Flask(__name__)

# CORS configuration - FIXED
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000", 
    "https://job-match-frontend-gj83.onrender.com"
]

CORS(
    application,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

@application.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@application.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

# Debugging: print partial API key
print("OpenAI Key (partial):", os.getenv("OPENAI_API_KEY", "")[:8] if os.getenv("OPENAI_API_KEY") else "Not found")

# Enhanced Firestore initialization
def initialize_firestore():
    try:
        # Try local service account file
        # local_creds = "jobmatchstudent-firebase-adminsdk-fbsvc-b89d7054b1.json"
        local_creds=""
        if os.path.exists(local_creds):
            print(f"✅ Using local service account: {local_creds}")
            credentials = service_account.Credentials.from_service_account_file(local_creds)
            return firestore.Client(credentials=credentials)
        
        # Fallback to environment variable
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            print(f"✅ Using environment credential: {creds_path}")
            credentials = service_account.Credentials.from_service_account_file(creds_path)
            return firestore.Client(credentials=credentials)
            
        # Last resort: Application Default Credentials
        print("⚠️ Attempting Application Default Credentials...")
        return firestore.Client()
        
    except Exception as e:
        print(f"❌ Firestore initialization error: {e}")
        return None

# Initialize Firestore
db = initialize_firestore()

# Initialize password hasher
ph = PasswordHasher()

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Global variable for course data caching
COURSES_DF = None

def load_course_data():
    """Load course data from JSON file"""
    global COURSES_DF
    if COURSES_DF is not None:
        return COURSES_DF
    try:
        courses_df = pd.read_json('data/courses.json')
        COURSES_DF = courses_df
        logger.info(f"Loaded {len(courses_df)} courses from database")
        return courses_df
    except Exception as e:
        logger.error(f"Error loading course data: {e}")
        return pd.DataFrame()

def find_similar_courses(missing_skills, threshold=0.1):
    """Find most similar courses for each missing skill using cosine similarity"""
    courses_df = load_course_data()
    if courses_df.empty:
        return {}

    # Combine Course Title with Description and Scope for better matching
    courses_df['Combined'] = (
        courses_df['Course Title'] + ' ' +
        courses_df['Description']
    )

    # Create corpus of course descriptions
    corpus = courses_df['Combined'].tolist()
    
    # Initialize TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        stop_words='english',
        max_features=1000,
        ngram_range=(1, 2)
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
                    "Similarity": float(max_similarity),
                    "Description and Scope": courses_df.iloc[max_idx]['Description'][:100] + "..."
                }
            else:
                results[skill] = {
                    "Course No": "N/A",
                    "Course Title": "No suitable course found",
                    "Similarity": 0.0,
                    "Description and Scope": "Consider external courses for this skill"
                }
        except Exception as e:
            logger.error(f"Error processing skill '{skill}': {e}")
            results[skill] = {
                "Course No": "ERROR",
                "Course Title": "Error processing skill",
                "Similarity": 0.0,
                "Description and Scope": "Error occurred during processing"
            }
    
    return results

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
    """Send job description + CV to GPT for analysis."""
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
        
        # Add BITS course recommendations based on missing skills
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

@application.route('/')
def index():
    """Health check route — confirms backend is running."""
    return jsonify({"status": "Backend is running", "db_connected": db is not None})

@application.route('/signUp', methods=['POST'])
def add_student():
    """Register a new student."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        required_fields = ["name", "email", "password"]
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "message": f"Missing field: {field}"}), 400

        # Check if student already exists
        existing_student = db.collection("students").where("email", "==", data["email"]).limit(1).get()
        if existing_student:
            return jsonify({"success": False, "message": "Student with this email already exists"}), 409

        # Hash password and save student
        hashed_password = ph.hash(data["password"])
        data["password"] = hashed_password
        
        db.collection("students").add(data)
        logger.info(f"New student registered: {data['email']}")
        
        return jsonify({"success": True, "message": "Student added!"}), 201

    except Exception as e:
        logger.error(f"Error in student registration: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@application.route('/login', methods=['POST'])
def login_student():
    """Authenticate a student."""
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

        logger.info(f"Student login successful: {email}")
        
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
        logger.error(f"Error in student login: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# application.py — replace only this endpoint

@application.route('/generate-questions', methods=['POST'])
def generate_questions():
    try:
        data = request.get_json(force=True) or {}
        job_description = (data.get('jobDescription') or '').strip()
        cv_text = (data.get('cvText') or '').strip()

        # Optional scaffolding from your analysis to bias specificity
        jd_skills_found = data.get('skillsFound') or []
        jd_skills_missing = data.get('skillsMissing') or []
        top_courses = data.get('topCourses') or []  # optional

        if not job_description and not cv_text:
            return jsonify({"success": False, "message": "Provide jobDescription and/or cvText"}), 400

        # Craft explicit, grounded prompt
        prompt = f"""
You are an expert interviewer. Create 10 interview questions that are SPECIFIC to the following inputs.

JOB DESCRIPTION (JD):
{job_description if job_description else "[none provided]"}

CANDIDATE CV (CV):
{cv_text if cv_text else "[none provided]"}

CONSTRAINTS:
- Every question MUST explicitly reference either:
  A) a concrete JD requirement (technology, tool, domain, KPI, methodology, responsibility), or
  B) a concrete CV experience/achievement (project, metric, stack, responsibility).
- Avoid generic questions (e.g., "Tell me about yourself").
- Prefer questions that verify ability to DO the JD responsibilities using the candidate’s documented CV skills.
- Mix: 6 technical/task/architecture/process questions, 4 behavioral/situational questions tied to JD responsibilities.
- Where possible, weave at least one of these JD-derived or analysis-derived cues:
  - JD skills/keywords: {", ".join(jd_skills_found[:10]) if jd_skills_found else "[none]"}
  - Missing skills to probe: {", ".join(jd_skills_missing[:10]) if jd_skills_missing else "[none]"}

FORMAT:
- Return a numbered list (1-10) of concise questions only.
- For each question, append a source tag in brackets indicating [JD] or [CV], or [JD+CV] if combined.

EXAMPLES OF SPECIFICITY:
- If JD says "build pipelines in Airflow" and CV shows "ETL with Airflow & BigQuery":
  "Walk through an Airflow DAG you built that orchestrates BigQuery loads; how would you adapt it for the JD’s SLA/KPI of X?" [JD+CV]
- If JD asks for "A/B testing" and CV shows "experimentation @ company":
  "Describe an A/B test you ran; how would you adapt your experiment design to match the JD’s funnel metrics?" [JD+CV]
"""

        # Use a strong model with focused decoding
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You produce strictly grounded, role-specific interview questions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1200
        )

        raw = completion.choices[0].message.content.strip()

        # Parse questions and enforce grounding
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        questions = []
        for line in lines:
            # remove numbering/bullets
            import re
            q = re.sub(r'^\s*(\d+[\).\s-]|[-*•])\s*', '', line)
            if len(q) > 15 and '?' in q:
                questions.append(q)

        # Final safety pass: ensure each has a [JD]/[CV] tag; if missing, add heuristic tag
        tagged = []
        for q in questions:
            tag = ''
            lower_q = q.lower()
            # Heuristics using JD/CV cues
            jd_cues = (jd_skills_found or []) + (jd_skills_missing or [])
            hits_jd = any(k.lower() in lower_q for k in jd_cues) or ("according to the jd" in lower_q)
            hits_cv = any(word in lower_q for word in ["your project", "on your resume", "in your cv", "in your experience"])
            if '[JD' in q or '[CV' in q:
                tagged.append(q)
            else:
                if hits_jd and hits_cv:
                    tagged.append(f"{q} [JD+CV]")
                elif hits_cv:
                    tagged.append(f"{q} [CV]")
                else:
                    tagged.append(f"{q} [JD]")

        # Limit to 10 best
        tagged = tagged[:10]

        return jsonify({
            "success": True,
            "questions": tagged
        })

    except Exception as e:
        application.logger.exception("Error in generate_questions")
        return jsonify({"success": False, "message": str(e)}), 500


@application.route('/chat', methods=['POST'])
def chat():
    """Handle chat conversations for interview prep."""
    try:
        data = request.get_json()
        message = data.get('message', '')
        context = data.get('context', '')
        
        if not message:
            return jsonify({"success": False, "message": "Message required"}), 400
        
        # Create conversation prompt
        system_prompt = """You are an expert career coach and interview preparation assistant. Help users prepare for job interviews by:
1. Providing thoughtful answers to interview questions
2. Giving feedback on responses
3. Offering tips and best practices
4. Role-playing as an interviewer when needed

Be encouraging, professional, and provide actionable advice."""

        user_prompt = f"{context}Question/Message: {message}"
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=800,
            temperature=0.8
        )
        
        return jsonify({
            "success": True,
            "response": response.choices[0].message.content.strip()
        })
        
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@application.route('/analyze', methods=['POST'])
def analyze():
    """Compare CV against job description."""
    jd_file = request.files.get('job_description')
    cv_file = request.files.get('cv')

    if not jd_file or not cv_file:
        logger.error('Missing data: Job description file or CV not provided')
        return jsonify({'error': 'Missing data'}), 400

    try:
        job_description = extract_text_from_pdf(jd_file)
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

@application.route('/google-auth', methods=['POST'])
def google_auth():
    """Handle Google OAuth authentication."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        credential = data.get('credential')
        email = data.get('email')
        name = data.get('name')
        google_id = data.get('googleId')

        if not credential or not email:
            return jsonify({"success": False, "message": "Invalid Google authentication data"}), 400

        # Verify the domain
        if not email.lower().endswith('@pilani.bits-pilani.ac.in'):
            return jsonify({
                "success": False, 
                "message": "Access restricted to BITS Pilani students only"
            }), 403

        # Verify the Google token (optional but recommended for security)
        try:
            # Replace with your Google Client ID
            CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
            idinfo = id_token.verify_oauth2_token(
                credential, google_requests.Request(), CLIENT_ID)
            
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
                
        except ValueError as e:
            logger.error(f"Google token verification failed: {e}")
            return jsonify({
                "success": False, 
                "message": "Invalid Google token"
            }), 401

        # Check if user exists
        existing_student = db.collection("students").where("email", "==", email).limit(1).get()
        
        if existing_student:
            # User exists, update Google ID if not set
            student_doc = existing_student[0]
            student_data = student_doc.to_dict()
            
            if not student_data.get('googleId'):
                db.collection("students").document(student_doc.id).update({
                    'googleId': google_id
                })
            
            logger.info(f"Google login successful: {email}")
            return jsonify({
                "success": True,
                "message": "Login successful",
                "student": {
                    "id": student_doc.id,
                    "name": student_data.get("name"),
                    "email": student_data.get("email")
                }
            }), 200
        else:
            # Create new user
            new_student = {
                "name": name,
                "email": email,
                "googleId": google_id,
                "password": None,  # No password for Google OAuth users
                "createdAt": firestore.SERVER_TIMESTAMP
            }
            
            doc_ref = db.collection("students").add(new_student)
            
            logger.info(f"New Google user registered: {email}")
            return jsonify({
                "success": True,
                "message": "Account created and login successful",
                "student": {
                    "id": doc_ref[1].id,
                    "name": name,
                    "email": email
                }
            }), 201

    except Exception as e:
        logger.error(f"Error in Google authentication: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# Run app
if __name__ == '__main__':
    print(f"🚀 Starting BITS Pilani Job Matching System...")
    print(f"🔥 Firestore status: {'✅ Connected' if db else '❌ Failed'}")
    print(f"🌐 CORS enabled for: {ALLOWED_ORIGINS}")
    application.run(debug=True, host='127.0.0.1', port=5000)

from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
import os
import json
import uuid
import sys
from datetime import datetime
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from text_parser import parse_text_to_structured, parse_meeting_text, map_to_requirements_format
import tempfile

# Force stdout to be unbuffered so prints show immediately
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'mp3', 'mp4', 'wav', 'm4a', 'flac', 'webm', 'ogg'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize AWS Transcribe client
transcribe_client = boto3.client(
    'transcribe',
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

# S3 client for storing audio files (if needed)
s3_client = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

@app.route('/health', methods=['GET'])
def health():
    print("Health check endpoint called", flush=True)
    sys.stdout.flush()
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/test', methods=['GET', 'POST'])
def test():
    """Test endpoint to verify server is running and logging works"""
    print("=" * 50, flush=True)
    print("TEST ENDPOINT CALLED", flush=True)
    print(f"Method: {request.method}", flush=True)
    print(f"Headers: {dict(request.headers)}", flush=True)
    if request.is_json:
        print(f"JSON data: {request.json}", flush=True)
    print("=" * 50, flush=True)
    sys.stdout.flush()
    return jsonify({
        'status': 'success',
        'message': 'Server is running and logging works!',
        'method': request.method
    }), 200

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file or process text input
    """
    try:
        data = request.json
        
        # If text is provided directly, skip transcription
        if 'text' in data and data['text']:
            text = data['text']
            structured_output = parse_text_to_structured(text)
            
            return jsonify({
                'success': True,
                'original_text': text,
                'transcribed_text': text,
                'structured_output': structured_output
            }), 200
        
        # If audio file is provided
        if 'audio_url' in data or 'file_path' in data:
            # Check if it's a local file path (needs S3 upload) or S3 URI
            audio_url = data.get('audio_url') or data.get('file_path', '')
            
            # If it's a local file path, upload to S3 first
            if not audio_url.startswith('s3://'):
                bucket_name = os.getenv('S3_BUCKET_NAME')
                if not bucket_name:
                    return jsonify({
                        'error': 'S3_BUCKET_NAME not configured. AWS Transcribe requires files to be in S3. Please configure S3_BUCKET_NAME environment variable.'
                    }), 400
                
                # Upload local file to S3
                if os.path.exists(audio_url):
                    s3_key = f"meetings/{uuid.uuid4()}_{os.path.basename(audio_url)}"
                    s3_client.upload_file(audio_url, bucket_name, s3_key)
                    audio_url = f"s3://{bucket_name}/{s3_key}"
                else:
                    return jsonify({'error': 'File not found'}), 404
            
            job_name = f"transcribe-{uuid.uuid4()}"
            
            # Determine media format from URL or provided format
            media_format = data.get('media_format')
            if not media_format:
                # Try to infer from file extension
                ext = audio_url.split('.')[-1].lower()
                format_map = {
                    'mp3': 'mp3', 'wav': 'wav', 'm4a': 'mp4', 
                    'mp4': 'mp4', 'flac': 'flac', 'ogg': 'ogg', 'webm': 'webm'
                }
                media_format = format_map.get(ext, 'mp3')
            
            # Start transcription job
            response = transcribe_client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={'MediaFileUri': audio_url},
                MediaFormat=media_format,
                LanguageCode=data.get('language_code', 'en-US')
            )
            
            return jsonify({
                'success': True,
                'job_name': job_name,
                'status': response['TranscriptionJob']['TranscriptionJobStatus']
            }), 200
        
        return jsonify({'error': 'Either text or audio_url/file_path must be provided'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe/status/<job_name>', methods=['GET'])
def get_transcription_status(job_name):
    """
    Get transcription job status and results
    """
    try:
        response = transcribe_client.get_transcription_job(
            TranscriptionJobName=job_name
        )
        
        job = response['TranscriptionJob']
        status = job['TranscriptionJobStatus']
        
        result = {
            'success': True,
            'job_name': job_name,
            'status': status
        }
        
        if status == 'COMPLETED':
            # Get transcription results
            transcript_uri = job['Transcript']['TranscriptFileUri']
            import urllib.request
            with urllib.request.urlopen(transcript_uri) as response:
                transcript_data = json.loads(response.read().decode())
                transcribed_text = transcript_data['results']['transcripts'][0]['transcript']
                
                # Parse to structured output
                structured_output = parse_text_to_structured(transcribed_text)
                
                result['transcribed_text'] = transcribed_text
                result['structured_output'] = structured_output
                result['original_text'] = transcribed_text
        
        elif status == 'FAILED':
            result['error'] = job.get('FailureReason', 'Transcription failed')
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/parse', methods=['POST'])
def parse_text():
    """
    Parse text to structured output
    """
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        structured_output = parse_text_to_structured(text)
        
        return jsonify({
            'success': True,
            'original_text': text,
            'structured_output': structured_output
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Upload audio/video file for transcription
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
        file.save(filepath)
        
        # Upload to S3 (required for AWS Transcribe)
        bucket_name = os.getenv('S3_BUCKET_NAME')
        s3_key = f"meetings/{uuid.uuid4()}_{filename}"
        
        if bucket_name:
            try:
                s3_client.upload_file(filepath, bucket_name, s3_key)
                media_uri = f"s3://{bucket_name}/{s3_key}"
            except Exception as e:
                return jsonify({
                    'error': f'Failed to upload to S3: {str(e)}. Please check your S3 configuration and permissions.'
                }), 500
        else:
            # AWS Transcribe requires files to be in S3
            return jsonify({
                'error': 'S3_BUCKET_NAME not configured. AWS Transcribe requires files to be in S3. Please set S3_BUCKET_NAME environment variable in your .env file.',
                'hint': 'Add S3_BUCKET_NAME=your-bucket-name to your .env file'
            }), 400
        
        return jsonify({
            'success': True,
            'file_path': filepath,
            'media_uri': media_uri,
            'filename': filename,
            'message': 'File uploaded successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meeting/process', methods=['POST'])
def process_meeting():
    """
    Process meeting transcription and generate summary + requirements
    """
    print("=" * 50, flush=True)
    print("MEETING PROCESS ENDPOINT CALLED", flush=True)
    print("=" * 50, flush=True)
    sys.stdout.flush()
    try:
        data = request.json
        print(f"Received data keys: {list(data.keys()) if data else 'None'}", flush=True)
        text = data.get('text', '')
        print(f"Text length: {len(text)} characters", flush=True)
        sys.stdout.flush()
        
        # Check which extraction method to use (Bedrock or Regex)
        # Priority: 1) Request parameter, 2) Environment variable, 3) Check if API key exists
        use_bedrock_request = data.get('use_bedrock')
        use_bedrock_env = os.getenv('USE_BEDROCK', 'false').lower() == 'true'
        bedrock_api_key = os.getenv('AWS_BEDROCK_API_KEY')
        
        # Check if default IAM credentials are available (AWS CLI, IAM role, etc.)
        try:
            import boto3
            session = boto3.Session()
            has_iam_creds = session.get_credentials() is not None
        except:
            has_iam_creds = False
        
        # Auto-detect: if API key exists, prefer Bedrock
        if use_bedrock_request is not None:
            use_bedrock = use_bedrock_request
        elif use_bedrock_env:
            use_bedrock = True
        elif bedrock_api_key:
            # Auto-enable Bedrock if API key is available
            use_bedrock = True
            print("Auto-enabling Bedrock: API key detected", flush=True)
        else:
            use_bedrock = False
        
        print(f"USE_BEDROCK env var: {os.getenv('USE_BEDROCK')}", flush=True)
        print(f"USE_BEDROCK from request: {use_bedrock_request}", flush=True)
        print(f"Bedrock API key present: {bool(bedrock_api_key)}", flush=True)
        print(f"IAM credentials from default chain: {has_iam_creds}", flush=True)
        print(f"Final decision - Using Bedrock: {use_bedrock}", flush=True)
        sys.stdout.flush()
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        # Parse meeting-specific content
        meeting_data, bedrock_used, bedrock_error = parse_meeting_text(text, use_bedrock=use_bedrock)
        
        # Map to requirements format
        requirements = map_to_requirements_format(meeting_data)
        
        extraction_method = 'bedrock' if bedrock_used else 'regex'
        
        print(f"Extraction completed using: {extraction_method}", flush=True)
        if bedrock_error:
            print(f"Bedrock error: {bedrock_error}", flush=True)
        print(f"Meeting summary keys: {list(meeting_data.keys()) if meeting_data else 'None'}", flush=True)
        print(f"Number of action items: {len(meeting_data.get('action_items', []))}", flush=True)
        print(f"Number of requirements: {len(requirements)}", flush=True)
        print("=" * 50, flush=True)
        sys.stdout.flush()
        
        response_data = {
            'success': True,
            'original_text': text,
            'meeting_summary': meeting_data,
            'requirements': requirements,
            'extraction_method': extraction_method,
            'bedrock_used': bedrock_used,
        }
        
        # Include Bedrock error if it occurred
        if bedrock_error:
            response_data['bedrock_error'] = bedrock_error
            response_data['bedrock_warning'] = f"Bedrock extraction failed. Using fallback method. Error: {bedrock_error}"
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        print(f"ERROR in process_meeting: {str(e)}", flush=True)
        print(f"Traceback: {traceback.format_exc()}", flush=True)
        print("=" * 50, flush=True)
        sys.stdout.flush()
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/<path:filename>', methods=['GET'])
def get_file(filename):
    """
    Serve uploaded files for playback
    """
    try:
        # Security: ensure filename doesn't contain path traversal
        safe_filename = os.path.basename(filename)
        filepath = os.path.join(UPLOAD_FOLDER, safe_filename)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            from flask import send_file
            return send_file(filepath)
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 50, flush=True)
    print("Starting Flask server on port 5000", flush=True)
    print("=" * 50, flush=True)
    print(f"USE_BEDROCK env: {os.getenv('USE_BEDROCK')}", flush=True)
    print(f"AWS_BEDROCK_API_KEY present: {bool(os.getenv('AWS_BEDROCK_API_KEY'))}", flush=True)
    print(f"AWS_ACCESS_KEY_ID present: {bool(os.getenv('AWS_ACCESS_KEY_ID'))}", flush=True)
    print("=" * 50, flush=True)
    sys.stdout.flush()
    app.run(debug=True, port=5000)


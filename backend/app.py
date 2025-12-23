from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
import os
import json
import uuid
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from text_parser import parse_text_to_structured, parse_meeting_text, map_to_requirements_format
from s3_storage import (
    store_meeting_data, 
    retrieve_meeting_data, 
    list_meetings, 
    generate_meeting_id,
    get_presigned_url,
    delete_meeting_data
)
import tempfile

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

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
    logger.info("Health check endpoint called")
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/test', methods=['GET', 'POST'])
def test():
    """Test endpoint to verify server is running and logging works"""
    logger.info("=" * 50)
    logger.info("TEST ENDPOINT CALLED")
    logger.info(f"Method: {request.method}")
    logger.debug(f"Headers: {dict(request.headers)}")
    if request.is_json:
        logger.debug(f"JSON data: {request.json}")
    logger.info("=" * 50)
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
            s3_key = data.get('s3_key')  # S3 key if already uploaded
            
            # If it's a local file path, upload to S3 first
            if not audio_url.startswith('s3://'):
                bucket_name = os.getenv('S3_BUCKET_NAME')
                if not bucket_name:
                    return jsonify({
                        'error': 'S3_BUCKET_NAME not configured. AWS Transcribe requires files to be in S3. Please configure S3_BUCKET_NAME environment variable.'
                    }), 400
                
                # Upload local file to S3
                if os.path.exists(audio_url):
                    if not s3_key:
                        s3_key = f"meetings/{uuid.uuid4()}_{os.path.basename(audio_url)}"
                    s3_client.upload_file(audio_url, bucket_name, s3_key)
                    audio_url = f"s3://{bucket_name}/{s3_key}"
                else:
                    return jsonify({'error': 'File not found'}), 404
            elif not s3_key:
                # Extract S3 key from S3 URI
                if audio_url.startswith('s3://'):
                    parts = audio_url.replace('s3://', '').split('/', 1)
                    if len(parts) == 2:
                        s3_key = parts[1]
            
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
            
            result = {
                'success': True,
                'job_name': job_name,
                'status': response['TranscriptionJob']['TranscriptionJobStatus']
            }
            
            # Include S3 key for later storage
            if s3_key:
                result['s3_key'] = s3_key
            
            return jsonify(result), 200
        
        return jsonify({'error': 'Either text or audio_url/file_path must be provided'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe/status/<job_name>', methods=['GET'])
def get_transcription_status(job_name):
    """
    Get transcription job status and results
    """
    try:
        # Get S3 key from query parameter if provided
        s3_key = request.args.get('s3_key')
        
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
                
                # Include S3 key if provided
                if s3_key:
                    result['s3_key'] = s3_key
        
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
    Optionally stores directly to S3 (skip local storage)
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        bucket_name = os.getenv('S3_BUCKET_NAME')
        if not bucket_name:
            return jsonify({
                'error': 'S3_BUCKET_NAME not configured. AWS Transcribe requires files to be in S3. Please set S3_BUCKET_NAME environment variable in your .env file.',
                'hint': 'Add S3_BUCKET_NAME=your-bucket-name to your .env file'
            }), 400
        
        filename = secure_filename(file.filename)
        s3_key = f"meetings/{uuid.uuid4()}_{filename}"
        
        # Check if we should skip local storage (default: True for production)
        skip_local = os.getenv('SKIP_LOCAL_STORAGE', 'true').lower() == 'true'
        
        if skip_local:
            # Upload directly to S3 without saving locally
            try:
                # Use upload_fileobj for streaming upload (more memory efficient)
                s3_client.upload_fileobj(
                    file,
                    bucket_name,
                    s3_key,
                    ExtraArgs={'ContentType': file.content_type or 'audio/mpeg'}
                )
                media_uri = f"s3://{bucket_name}/{s3_key}"
                filepath = None  # No local file
            except Exception as e:
                return jsonify({
                    'error': f'Failed to upload to S3: {str(e)}. Please check your S3 configuration and permissions.'
                }), 500
        else:
            # Save file locally first (for development/testing)
            filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
            file.save(filepath)
            
            # Upload to S3 (required for AWS Transcribe)
            try:
                s3_client.upload_file(filepath, bucket_name, s3_key)
                media_uri = f"s3://{bucket_name}/{s3_key}"
            except Exception as e:
                return jsonify({
                    'error': f'Failed to upload to S3: {str(e)}. Please check your S3 configuration and permissions.'
                }), 500
        
        return jsonify({
            'success': True,
            'file_path': filepath,  # None if skip_local=True
            'media_uri': media_uri,
            's3_key': s3_key,
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
    logger.info("=" * 50)
    logger.info("MEETING PROCESS ENDPOINT CALLED")
    logger.info("=" * 50)
    try:
        data = request.json
        logger.debug(f"Received data keys: {list(data.keys()) if data else 'None'}")
        text = data.get('text', '')
        logger.info(f"Text length: {len(text)} characters")
        
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
            logger.info("Auto-enabling Bedrock: API key detected")
        else:
            use_bedrock = False
        
        logger.debug(f"USE_BEDROCK env var: {os.getenv('USE_BEDROCK')}")
        logger.debug(f"USE_BEDROCK from request: {use_bedrock_request}")
        logger.debug(f"Bedrock API key present: {bool(bedrock_api_key)}")
        logger.debug(f"IAM credentials from default chain: {has_iam_creds}")
        logger.info(f"Final decision - Using Bedrock: {use_bedrock}")
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        # Parse meeting-specific content
        meeting_data, bedrock_used, bedrock_error = parse_meeting_text(text, use_bedrock=use_bedrock)
        
        # Map to requirements format
        requirements = map_to_requirements_format(meeting_data)
        
        extraction_method = 'bedrock' if bedrock_used else 'regex'
        
        logger.info(f"Extraction completed using: {extraction_method}")
        if bedrock_error:
            logger.warning(f"Bedrock error: {bedrock_error}")
        logger.debug(f"Meeting summary keys: {list(meeting_data.keys()) if meeting_data else 'None'}")
        logger.info(f"Number of action items: {len(meeting_data.get('action_items', []))}")
        logger.info(f"Number of requirements: {len(requirements)}")
        logger.info("=" * 50)
        
        # Store in S3 if audio S3 key is provided
        meeting_id = None
        store_in_s3 = os.getenv('STORE_IN_S3', 'true').lower() == 'true'
        audio_s3_key = data.get('audio_s3_key') or data.get('s3_key')
        
        if store_in_s3 and audio_s3_key:
            try:
                meeting_id = generate_meeting_id()
                metadata = {
                    'filename': data.get('filename', 'unknown'),
                    'extraction_method': extraction_method,
                    'bedrock_used': bedrock_used
                }
                
                stored_keys = store_meeting_data(
                    meeting_id=meeting_id,
                    audio_s3_key=audio_s3_key,
                    transcription_text=text,
                    meeting_summary=meeting_data,
                    requirements=requirements,
                    metadata=metadata
                )
                logger.info(f"Meeting data stored in S3 with ID: {meeting_id}")
            except Exception as e:
                logger.warning(f"Failed to store in S3: {e}")
                # Continue even if S3 storage fails
        
        response_data = {
            'success': True,
            'original_text': text,
            'meeting_summary': meeting_data,
            'requirements': requirements,
            'extraction_method': extraction_method,
            'bedrock_used': bedrock_used,
        }
        
        # Include meeting ID if stored in S3
        if meeting_id:
            response_data['meeting_id'] = meeting_id
        
        # Include Bedrock error if it occurred
        if bedrock_error:
            response_data['bedrock_error'] = bedrock_error
            response_data['bedrock_warning'] = f"Bedrock extraction failed. Using fallback method. Error: {bedrock_error}"
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        logger.error(f"ERROR in process_meeting: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        logger.error("=" * 50)
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/<path:filename>', methods=['GET'])
def get_file(filename):
    """
    Serve uploaded files for playback
    Falls back to S3 if file not found locally
    """
    try:
        # Security: ensure filename doesn't contain path traversal
        safe_filename = os.path.basename(filename)
        filepath = os.path.join(UPLOAD_FOLDER, safe_filename)
        
        if os.path.exists(filepath) and os.path.isfile(filepath):
            from flask import send_file
            return send_file(filepath)
        
        # Try to get from S3
        bucket_name = os.getenv('S3_BUCKET_NAME')
        if bucket_name:
            # Look for file in meetings/ prefix
            s3_key = f"meetings/{safe_filename}"
            try:
                # Generate presigned URL for secure access
                url = get_presigned_url(s3_key, expiration=3600)
                return jsonify({'url': url}), 200
            except:
                pass
        
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/s3', methods=['GET'])
def get_s3_presigned_url():
    """
    Get presigned URL for S3 file
    """
    try:
        s3_key = request.args.get('key')
        if not s3_key:
            return jsonify({'error': 'S3 key parameter required'}), 400
        
        url = get_presigned_url(s3_key, expiration=3600)
        return jsonify({'url': url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings', methods=['GET'])
def list_all_meetings():
    """
    List all stored meetings
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        meetings = list_meetings(limit=limit)
        return jsonify({
            'success': True,
            'meetings': meetings,
            'count': len(meetings)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings/<meeting_id>', methods=['GET'])
def get_meeting(meeting_id):
    """
    Retrieve a specific meeting by ID
    """
    try:
        meeting_data = retrieve_meeting_data(meeting_id)
        
        # Generate presigned URL for audio if available
        if meeting_data.get('audio_s3_key'):
            try:
                audio_url = get_presigned_url(meeting_data['audio_s3_key'], expiration=3600)
                meeting_data['audio_url'] = audio_url
            except:
                pass
        
        return jsonify({
            'success': True,
            'meeting': meeting_data
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings/<meeting_id>', methods=['DELETE'])
def delete_meeting(meeting_id):
    """
    Delete a meeting and all its associated data
    """
    try:
        delete_meeting_data(meeting_id)
        return jsonify({
            'success': True,
            'message': f'Meeting {meeting_id} deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("Starting Flask server on port 5000")
    logger.info("=" * 50)
    logger.info(f"USE_BEDROCK env: {os.getenv('USE_BEDROCK')}")
    logger.info(f"AWS_BEDROCK_API_KEY present: {bool(os.getenv('AWS_BEDROCK_API_KEY'))}")
    logger.info(f"AWS_ACCESS_KEY_ID present: {bool(os.getenv('AWS_ACCESS_KEY_ID'))}")
    logger.info("=" * 50)
    app.run(debug=True, port=5000)


"""
AWS Bedrock-based extraction for action items and structured data
Uses Claude or other foundation models via Bedrock
"""
import boto3
import json
import os
import subprocess
from typing import Dict, List, Any, Optional, Tuple

def get_bedrock_client():
    """Get Bedrock client using default IAM credential chain (AWS CLI, IAM roles, etc.)"""
    region = os.getenv('AWS_REGION', 'us-east-1')
    
    # Use default credential chain (AWS CLI ~/.aws/credentials, IAM roles, etc.)
    # Check for AWS_PROFILE env var to use specific profile
    profile = os.getenv('AWS_PROFILE')
    
    if profile:
        # Use specific profile
        session = boto3.Session(profile_name=profile)
    else:
        # Use default credential chain - create fresh session to avoid cached credentials
        session = boto3.Session()
    
    # Force credential refresh by creating a new client each time
    # This ensures we get fresh credentials (important for temporary credentials)
    return session.client('bedrock-runtime', region_name=region)

def get_bedrock_api_key():
    """Get Bedrock API key from environment"""
    return os.getenv('AWS_BEDROCK_API_KEY')

def extract_with_bedrock(text: str, model_id: str = 'anthropic.claude-3-sonnet-20240229-v1:0') -> Dict[str, Any]:
    """
    Extract structured information using AWS Bedrock
    
    Args:
        text: Input text to analyze
        model_id: Bedrock model ID (default: Claude 3 Sonnet)
    
    Returns:
        Structured data with action items, summary, etc.
    """
    print(f"Bedrock extract_with_bedrock called with model: {model_id}")
    prompt = f"""Analyze the following meeting transcript and extract structured information in JSON format.

Transcript:
{text}

Please extract and return a JSON object with the following structure:
{{
  "summary": "A concise summary of the meeting (2-3 sentences)",
  "action_items": [
    {{
      "text": "Description of the action item",
      "assignee": "Person responsible (if mentioned, else null)",
      "due_date": "Due date or deadline (if mentioned, else null)",
      "priority": "high|medium|low"
    }}
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "participants": ["Name1", "Name2"],
  "topics": ["Topic1", "Topic2"],
  "next_steps": ["Step1", "Step2"]
}}

Guidelines:
- Extract ALL action items mentioned, even if implicit
- For assignees, look for patterns like "John will...", "Sarah needs to...", "assigned to X"
- For due dates, extract any time references (dates, "by Friday", "next week", etc.)
- Set priority based on urgency keywords (urgent, ASAP, critical = high; soon, important = medium; else = low)
- List all participants mentioned in the conversation
- Extract main discussion topics
- Identify key decisions made

Return ONLY valid JSON, no additional text."""

    try:
        # Get fresh client in case credentials changed
        client = get_bedrock_client()
        bedrock_api_key = get_bedrock_api_key()
        
        print(f"Bedrock API key present: {bool(bedrock_api_key)}")
        print(f"Using API key authentication: {bool(bedrock_api_key)}")
        
        # Prepare the request body for Claude via Bedrock
        # Claude 3 uses a specific message format
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })

        # Prepare request parameters
        request_params = {
            'modelId': model_id,
            'body': body,
            'contentType': 'application/json',
            'accept': 'application/json'
        }
        
        # Add API key to headers if using API key authentication
        if bedrock_api_key:
            # Bedrock API keys still require AWS Signature V4 signing
            # The API key is used for authorization, but we still need IAM credentials for signing
            # If no IAM credentials, we can't sign the request properly
            # Let's use boto3 which handles signing automatically, and the API key will be handled by AWS
            print(f"Using Bedrock API key - boto3 will handle authentication")
            print(f"Note: Bedrock API keys may still require IAM credentials for request signing")
            
            # Try using boto3 - it should handle the API key if configured in the session
            # However, boto3 doesn't directly support API keys in the way we're trying
            # The API key might need to be used differently
            
            # Use IAM credentials from default chain (AWS CLI, IAM role, etc.)
            # The API key is added as a header for Bedrock authorization
            print("Using IAM auth from default credential chain + Bedrock API key")
            
            # Get credentials from default chain for signing
            # Check for AWS_PROFILE env var first
            profile = os.getenv('AWS_PROFILE')
            if profile:
                print(f"Using AWS profile: {profile}")
                session = boto3.Session(profile_name=profile)
            else:
                # Use default credential chain (same as AWS CLI)
                # For SSO, we need to ensure credentials are fresh
                session = boto3.Session()
            
            # Get credentials - for SSO, boto3 should auto-refresh, but let's force it
            credentials = session.get_credentials()
            
            if not credentials:
                raise ValueError("No AWS credentials found. Please configure AWS CLI (aws configure) or use IAM role")
            
            profile_name = getattr(session, 'profile_name', None) or 'default'
            print(f"Credentials found from profile: {profile_name}")
            
            # Check if credentials have a session token (SSO/temporary credentials)
            creds_frozen = credentials.get_frozen_credentials()
            if creds_frozen.token:
                print(f"Detected SSO/temporary credentials (session token present)")
                print(f"Access key: {creds_frozen.access_key[:15]}...")
                print("Note: SSO credentials can expire. If you see 'invalid token' errors:")
                print("  1. Run 'aws sso login' to refresh SSO session")
                print("  2. Or run 'aws sts get-caller-identity' to refresh credentials")
                
                # Try to force refresh by creating a new session
                # This helps with SSO credential caching issues
                try:
                    if profile:
                        refresh_session = boto3.Session(profile_name=profile)
                    else:
                        refresh_session = boto3.Session()
                    # Access credentials to trigger refresh if needed
                    refresh_creds = refresh_session.get_credentials()
                    if refresh_creds:
                        refresh_frozen = refresh_creds.get_frozen_credentials()
                        # If access keys are different, credentials were refreshed
                        if refresh_frozen.access_key != creds_frozen.access_key:
                            print("Credentials refreshed - using new credentials")
                            credentials = refresh_creds
                            creds_frozen = refresh_frozen
                except Exception as refresh_err:
                    print(f"Could not refresh credentials: {refresh_err}")
            else:
                print(f"Using permanent credentials")
                print(f"Access key: {creds_frozen.access_key[:15]}...")
            
            # Note: We skip STS validation because sometimes it fails even when credentials work
            # AWS CLI might use different credential resolution than boto3
            # We'll try the Bedrock request directly - if credentials are invalid, it will fail there
            print("Skipping credential validation - will validate during Bedrock request")
            
            # Use requests with AWS SigV4 signing + Bedrock API key header
            import requests
            try:
                from requests_aws4auth import AWS4Auth
                
                region = os.getenv('AWS_REGION', 'us-east-1')
                url = f"https://bedrock-runtime.{region}.amazonaws.com/model/{model_id}/invoke"
                
                # Get credentials for signing - use frozen credentials from session
                creds = credentials.get_frozen_credentials()
                print(f"Using credentials for signing (access key: {creds.access_key[:15]}...)")
                print(f"Session token present: {bool(creds.token)}")
                
                # Create auth with credentials (include session token if present)
                auth = AWS4Auth(
                    creds.access_key, 
                    creds.secret_key, 
                    region, 
                    'bedrock', 
                    session_token=creds.token if creds.token else None
                )
                
                # Headers with Bedrock API key
                headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-api-key': bedrock_api_key  # Bedrock-specific API key
                }
                
                print(f"Making signed request to Bedrock with API key header...")
                response = requests.post(url, auth=auth, headers=headers, data=body, timeout=60)
                
                print(f"Response status: {response.status_code}")
                
                if response.status_code == 200:
                    response_body = response.json()
                    print(f"Bedrock response received successfully with API key")
                else:
                    print(f"Error response: {response.text}")
                    # Fall back to boto3 (without API key) - might work if credentials are valid
                    print("Falling back to boto3 without API key...")
                    response = client.invoke_model(**request_params)
                    response_body = json.loads(response['body'].read())
            except ImportError:
                print("requests-aws4auth not installed, using boto3...")
                print("Note: API key may not be used with boto3 directly")
                # Try boto3 - it should use the same credentials as AWS CLI
                response = client.invoke_model(**request_params)
                response_body = json.loads(response['body'].read())
            except Exception as e:
                print(f"Requests approach failed: {e}, trying boto3 with default credentials...")
                # Last resort: use boto3 which should pick up AWS CLI credentials
                response = client.invoke_model(**request_params)
                response_body = json.loads(response['body'].read())
        else:
            # Use boto3 for IAM authentication
            response = client.invoke_model(**request_params)
            response_body = json.loads(response['body'].read())

        # Extract the content (Claude returns content in a specific format)
        content = None
        if 'content' in response_body and len(response_body['content']) > 0:
            # Claude 3 format
            content = response_body['content'][0].get('text', '')
        elif 'completion' in response_body:
            # Older Claude format
            content = response_body['completion']
        elif 'body' in response_body:
            # Alternative format
            body_data = json.loads(response_body['body']) if isinstance(response_body['body'], str) else response_body['body']
            if 'content' in body_data:
                content = body_data['content'][0].get('text', '')
        
        if not content:
            raise ValueError("Could not extract content from Bedrock response")
        
        # Try to extract JSON from the response
        # Sometimes models wrap JSON in markdown code blocks
        content = content.strip()
        if content.startswith('```'):
            # Remove markdown code blocks
            lines = content.split('\n')
            if len(lines) > 2:
                content = '\n'.join(lines[1:-1])
        elif content.startswith('```json'):
            lines = content.split('\n')
            if len(lines) > 2:
                content = '\n'.join(lines[1:-1])
        
        # Parse JSON
        try:
            structured_data = json.loads(content)
            return structured_data
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract JSON object
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                structured_data = json.loads(json_match.group())
                return structured_data
            else:
                raise ValueError(f"Could not parse JSON from Bedrock response. Content: {content[:200]}")
            
    except Exception as e:
        import traceback
        error_message = str(e)
        print(f"Error calling Bedrock: {error_message}")
        print(f"Full traceback: {traceback.format_exc()}")
        # Raise exception to let caller know Bedrock failed
        # The caller will handle fallback
        raise RuntimeError(f"Bedrock extraction failed: {error_message}") from e

def extract_action_items_with_bedrock(text: str) -> List[Dict[str, Any]]:
    """
    Extract action items specifically using Bedrock
    """
    result = extract_with_bedrock(text)
    return result.get('action_items', [])

def extract_meeting_data_with_bedrock(text: str) -> Tuple[Dict[str, Any], bool, Optional[str]]:
    """
    Extract comprehensive meeting data using Bedrock
    
    Returns:
        tuple: (result_dict, bedrock_success, error_message)
        - result_dict: The extracted meeting data
        - bedrock_success: True if Bedrock was used successfully, False otherwise
        - error_message: Error message if Bedrock failed, None otherwise
    """
    try:
        result = extract_with_bedrock(text)
        bedrock_success = True
        error_message = None
        
        # Ensure all expected fields are present
        meeting_data = {
            'summary': result.get('summary', ''),
            'action_items': result.get('action_items', []),
            'key_decisions': result.get('key_decisions', []),
            'participants': result.get('participants', []),
            'topics': result.get('topics', []),
            'next_steps': result.get('next_steps', []),
            'duration_estimate': estimate_meeting_duration(text),
            'entities': [],  # Could be enhanced
            'dates': []  # Could be enhanced
        }
        return (meeting_data, bedrock_success, error_message)
    except Exception as e:
        # Bedrock failed - return failure status
        bedrock_success = False
        error_message = str(e)
        return ({}, bedrock_success, error_message)

def estimate_meeting_duration(text: str) -> str:
    """Estimate meeting duration based on word count"""
    word_count = len(text.split())
    estimated_minutes = max(5, word_count // 150)
    
    if estimated_minutes < 60:
        return f"~{estimated_minutes} minutes"
    else:
        hours = estimated_minutes // 60
        minutes = estimated_minutes % 60
        return f"~{hours}h {minutes}m"


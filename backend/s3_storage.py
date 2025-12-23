"""
S3 storage utilities for meeting transcriptions and action items
Provides functions to store and retrieve meeting data from S3
"""
import boto3
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from botocore.exceptions import ClientError

# Initialize S3 client
s3_client = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

# Initialize DynamoDB client (optional - for metadata tracking)
try:
    dynamodb = boto3.resource(
        'dynamodb',
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
    DYNAMODB_TABLE_NAME = os.getenv('DYNAMODB_TABLE_NAME', 'meeting-metadata')
    USE_DYNAMODB = os.getenv('USE_DYNAMODB', 'false').lower() == 'true'
except Exception as e:
    print(f"DynamoDB not available: {e}")
    USE_DYNAMODB = False

def get_bucket_name() -> str:
    """Get S3 bucket name from environment"""
    bucket = os.getenv('S3_BUCKET_NAME')
    if not bucket:
        raise ValueError("S3_BUCKET_NAME environment variable not set")
    return bucket

def generate_meeting_id() -> str:
    """Generate a unique meeting ID"""
    return f"meeting-{uuid.uuid4()}"

def store_meeting_data(
    meeting_id: str,
    audio_s3_key: str,
    transcription_text: str,
    meeting_summary: Dict[str, Any],
    requirements: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, str]:
    """
    Store meeting transcription and structured data in S3
    
    Args:
        meeting_id: Unique meeting identifier
        audio_s3_key: S3 key of the original audio file
        transcription_text: Full transcription text
        meeting_summary: Structured meeting summary (action items, decisions, etc.)
        requirements: List of requirements extracted from meeting
        metadata: Additional metadata (filename, date, etc.)
    
    Returns:
        Dictionary with S3 keys for stored files
    """
    bucket_name = get_bucket_name()
    timestamp = datetime.utcnow().isoformat()
    
    # Prepare metadata
    if metadata is None:
        metadata = {}
    
    metadata.update({
        'meeting_id': meeting_id,
        'audio_s3_key': audio_s3_key,
        'timestamp': timestamp,
        'transcription_length': len(transcription_text),
        'action_items_count': len(meeting_summary.get('action_items', [])),
        'requirements_count': len(requirements)
    })
    
    # Store transcription text
    transcription_key = f"transcriptions/{meeting_id}/transcription.txt"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=transcription_key,
        Body=transcription_text.encode('utf-8'),
        ContentType='text/plain',
        Metadata={
            'meeting-id': meeting_id,
            'timestamp': timestamp
        }
    )
    
    # Store structured meeting summary (JSON)
    summary_key = f"transcriptions/{meeting_id}/summary.json"
    summary_data = {
        'meeting_id': meeting_id,
        'timestamp': timestamp,
        'audio_s3_key': audio_s3_key,
        'summary': meeting_summary
    }
    s3_client.put_object(
        Bucket=bucket_name,
        Key=summary_key,
        Body=json.dumps(summary_data, indent=2).encode('utf-8'),
        ContentType='application/json',
        Metadata={
            'meeting-id': meeting_id,
            'timestamp': timestamp
        }
    )
    
    # Store requirements (JSON)
    requirements_key = f"transcriptions/{meeting_id}/requirements.json"
    requirements_data = {
        'meeting_id': meeting_id,
        'timestamp': timestamp,
        'audio_s3_key': audio_s3_key,
        'requirements': requirements
    }
    s3_client.put_object(
        Bucket=bucket_name,
        Key=requirements_key,
        Body=json.dumps(requirements_data, indent=2).encode('utf-8'),
        ContentType='application/json',
        Metadata={
            'meeting-id': meeting_id,
            'timestamp': timestamp
        }
    )
    
    # Store metadata index (for easy lookup without DynamoDB)
    metadata_key = f"transcriptions/{meeting_id}/metadata.json"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=metadata_key,
        Body=json.dumps(metadata, indent=2).encode('utf-8'),
        ContentType='application/json',
        Metadata={
            'meeting-id': meeting_id,
            'timestamp': timestamp
        }
    )
    
    # Store in DynamoDB if enabled (for fast queries)
    if USE_DYNAMODB:
        try:
            store_meeting_metadata_dynamodb(meeting_id, metadata, audio_s3_key)
        except Exception as e:
            print(f"Warning: Failed to store in DynamoDB: {e}")
    
    return {
        'meeting_id': meeting_id,
        'transcription_key': transcription_key,
        'summary_key': summary_key,
        'requirements_key': requirements_key,
        'metadata_key': metadata_key,
        'audio_key': audio_s3_key
    }

def retrieve_meeting_data(meeting_id: str) -> Dict[str, Any]:
    """
    Retrieve all meeting data from S3
    
    Args:
        meeting_id: Unique meeting identifier
    
    Returns:
        Dictionary with transcription, summary, requirements, and metadata
    """
    bucket_name = get_bucket_name()
    
    try:
        # Retrieve transcription
        transcription_key = f"transcriptions/{meeting_id}/transcription.txt"
        transcription_obj = s3_client.get_object(Bucket=bucket_name, Key=transcription_key)
        transcription_text = transcription_obj['Body'].read().decode('utf-8')
        
        # Retrieve summary
        summary_key = f"transcriptions/{meeting_id}/summary.json"
        summary_obj = s3_client.get_object(Bucket=bucket_name, Key=summary_key)
        summary_data = json.loads(summary_obj['Body'].read().decode('utf-8'))
        
        # Retrieve requirements
        requirements_key = f"transcriptions/{meeting_id}/requirements.json"
        requirements_obj = s3_client.get_object(Bucket=bucket_name, Key=requirements_key)
        requirements_data = json.loads(requirements_obj['Body'].read().decode('utf-8'))
        
        # Retrieve metadata
        metadata_key = f"transcriptions/{meeting_id}/metadata.json"
        metadata_obj = s3_client.get_object(Bucket=bucket_name, Key=metadata_key)
        metadata = json.loads(metadata_obj['Body'].read().decode('utf-8'))
        
        return {
            'meeting_id': meeting_id,
            'transcription': transcription_text,
            'summary': summary_data['summary'],
            'requirements': requirements_data['requirements'],
            'metadata': metadata,
            'audio_s3_key': summary_data.get('audio_s3_key')
        }
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            raise ValueError(f"Meeting {meeting_id} not found")
        raise

def list_meetings(limit: int = 50) -> List[Dict[str, Any]]:
    """
    List all meetings stored in S3
    
    Args:
        limit: Maximum number of meetings to return
    
    Returns:
        List of meeting metadata dictionaries
    """
    bucket_name = get_bucket_name()
    meetings = []
    
    # If DynamoDB is enabled, use it for faster listing
    if USE_DYNAMODB:
        try:
            table = dynamodb.Table(DYNAMODB_TABLE_NAME)
            response = table.scan(Limit=limit)
            return response.get('Items', [])
        except Exception as e:
            print(f"Warning: DynamoDB query failed, falling back to S3: {e}")
    
    # Fallback: List from S3 (slower but works without DynamoDB)
    prefix = "transcriptions/"
    paginator = s3_client.get_paginator('list_objects_v2')
    
    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix, Delimiter='/'):
        if 'CommonPrefixes' in page:
            for prefix_info in page['CommonPrefixes']:
                meeting_id = prefix_info['Prefix'].replace('transcriptions/', '').rstrip('/')
                
                # Try to get metadata
                try:
                    metadata_key = f"transcriptions/{meeting_id}/metadata.json"
                    metadata_obj = s3_client.get_object(Bucket=bucket_name, Key=metadata_key)
                    metadata = json.loads(metadata_obj['Body'].read().decode('utf-8'))
                    meetings.append(metadata)
                except:
                    # If metadata doesn't exist, create minimal entry
                    meetings.append({
                        'meeting_id': meeting_id,
                        'timestamp': 'unknown'
                    })
    
    # Sort by timestamp (newest first)
    meetings.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return meetings[:limit]

def get_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    """
    Generate a presigned URL for secure S3 access
    
    Args:
        s3_key: S3 object key
        expiration: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        Presigned URL string
    """
    bucket_name = get_bucket_name()
    
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': s3_key},
            ExpiresIn=expiration
        )
        return url
    except ClientError as e:
        raise ValueError(f"Failed to generate presigned URL: {e}")

def store_meeting_metadata_dynamodb(
    meeting_id: str,
    metadata: Dict[str, Any],
    audio_s3_key: str
):
    """
    Store meeting metadata in DynamoDB for fast queries
    
    This creates a table if it doesn't exist (requires appropriate IAM permissions)
    """
    if not USE_DYNAMODB:
        return
    
    try:
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        
        # Prepare item
        item = {
            'meeting_id': meeting_id,
            'audio_s3_key': audio_s3_key,
            'timestamp': metadata.get('timestamp', datetime.utcnow().isoformat()),
            **metadata
        }
        
        # Store in DynamoDB
        table.put_item(Item=item)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"DynamoDB table {DYNAMODB_TABLE_NAME} does not exist. Create it manually or grant table creation permissions.")
        else:
            raise

def delete_meeting_data(meeting_id: str):
    """
    Delete all meeting data from S3
    
    Args:
        meeting_id: Unique meeting identifier
    """
    bucket_name = get_bucket_name()
    
    # List all objects for this meeting
    prefix = f"transcriptions/{meeting_id}/"
    paginator = s3_client.get_paginator('list_objects_v2')
    
    objects_to_delete = []
    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
        if 'Contents' in page:
            for obj in page['Contents']:
                objects_to_delete.append({'Key': obj['Key']})
    
    # Delete all objects
    if objects_to_delete:
        s3_client.delete_objects(
            Bucket=bucket_name,
            Delete={'Objects': objects_to_delete}
        )
    
    # Also delete from DynamoDB if enabled
    if USE_DYNAMODB:
        try:
            table = dynamodb.Table(DYNAMODB_TABLE_NAME)
            table.delete_item(Key={'meeting_id': meeting_id})
        except Exception as e:
            print(f"Warning: Failed to delete from DynamoDB: {e}")


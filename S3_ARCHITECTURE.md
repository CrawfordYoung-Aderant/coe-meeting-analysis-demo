# S3 Storage Architecture for Meeting Analysis

## Overview

This document explains the S3-based storage architecture for meeting transcriptions, action items, and requirements. The system stores all meeting data in S3 buckets with proper organization and metadata tracking.

## Why S3?

### ✅ Benefits

1. **Scalability**: No local disk space limitations
2. **Durability**: 99.999999999% (11 9's) durability
3. **Cost-Effective**: Pay only for what you use (~$0.023/GB/month)
4. **Integration**: Works seamlessly with AWS Transcribe and Bedrock
5. **Lifecycle Management**: Easy to set up automatic archival/deletion
6. **Security**: IAM-based access control and encryption at rest

### 📊 Storage Structure

```
s3://your-bucket/
├── meetings/                          # Original audio/video files
│   ├── {uuid}_{filename}.m4a
│   ├── {uuid}_{filename}.wav
│   └── ...
└── transcriptions/                    # Processed meeting data
    ├── {meeting-id}/
    │   ├── transcription.txt         # Full transcription text
    │   ├── summary.json              # Structured meeting summary
    │   ├── requirements.json         # Extracted requirements
    │   └── metadata.json             # Meeting metadata & index
    └── ...
```

## Tracking Relationships

### Option 1: S3 Metadata + JSON Index (Current Implementation)

**How it works:**
- Each meeting gets a unique `meeting_id` (e.g., `meeting-abc123`)
- All related files are stored under `transcriptions/{meeting_id}/`
- Metadata JSON file contains all relationships:
  ```json
  {
    "meeting_id": "meeting-abc123",
    "audio_s3_key": "meetings/uuid_filename.m4a",
    "timestamp": "2024-01-15T10:30:00",
    "filename": "Meeting_Recording.m4a",
    "action_items_count": 5,
    "requirements_count": 3
  }
  ```

**Pros:**
- Simple, no additional services needed
- Works with just S3
- Easy to understand

**Cons:**
- Listing all meetings requires scanning S3 (slower)
- No complex queries

### Option 2: DynamoDB for Metadata (Recommended for Production)

**How it works:**
- Store meeting metadata in DynamoDB table
- S3 stores the actual files
- Fast queries and listing

**Setup:**
```bash
# Enable DynamoDB in .env
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=meeting-metadata
```

**DynamoDB Table Schema:**
- Primary Key: `meeting_id` (String)
- Attributes:
  - `audio_s3_key` (String)
  - `timestamp` (String)
  - `filename` (String)
  - `action_items_count` (Number)
  - `requirements_count` (Number)
  - `extraction_method` (String)
  - `bedrock_used` (Boolean)

**Pros:**
- Fast queries and listing
- Can add indexes for date, filename, etc.
- Scales automatically

**Cons:**
- Requires DynamoDB setup
- Additional cost (~$0.25/million reads)

### Option 3: RDS/PostgreSQL (For Complex Queries)

Use if you need:
- Complex SQL queries
- Joins with other data
- Full-text search
- Transaction support

## Direct S3 Access vs Local Storage

### Current Implementation: Hybrid Approach

The system supports both modes:

**Direct S3 Upload (Recommended):**
```bash
# In .env
SKIP_LOCAL_STORAGE=true
```

- Files uploaded directly to S3 via `upload_fileobj()`
- No local disk usage
- Better for production
- More memory efficient (streaming)

**Local + S3 (Development):**
```bash
# In .env
SKIP_LOCAL_STORAGE=false
```

- Files saved locally first (for debugging)
- Then uploaded to S3
- Useful for development/testing

### Presigned URLs for Secure Access

Audio files are accessed via presigned URLs (expire after 1 hour):

```python
# Backend generates presigned URL
url = get_presigned_url(s3_key, expiration=3600)
# Returns: https://bucket.s3.amazonaws.com/key?X-Amz-Signature=...
```

**Benefits:**
- No public bucket needed
- Time-limited access
- No credentials exposed to frontend

## API Endpoints

### Store Meeting Data
Automatically stores when processing meetings if `STORE_IN_S3=true` (default).

**Request:**
```json
POST /api/meeting/process
{
  "text": "...",
  "audio_s3_key": "meetings/uuid_file.m4a",
  "filename": "Meeting.m4a"
}
```

**Response:**
```json
{
  "success": true,
  "meeting_id": "meeting-abc123",
  "meeting_summary": {...},
  "requirements": [...]
}
```

### List All Meetings
```bash
GET /api/meetings?limit=50
```

**Response:**
```json
{
  "success": true,
  "meetings": [
    {
      "meeting_id": "meeting-abc123",
      "timestamp": "2024-01-15T10:30:00",
      "filename": "Meeting.m4a",
      "action_items_count": 5
    }
  ],
  "count": 1
}
```

### Retrieve Specific Meeting
```bash
GET /api/meetings/{meeting_id}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "meeting_id": "meeting-abc123",
    "transcription": "...",
    "summary": {...},
    "requirements": [...],
    "metadata": {...},
    "audio_url": "https://...presigned-url..."
  }
}
```

### Delete Meeting
```bash
DELETE /api/meetings/{meeting_id}
```

Deletes all files associated with the meeting.

## Environment Variables

```bash
# Required
S3_BUCKET_NAME=your-meeting-bucket
AWS_REGION=us-east-1

# Optional - Storage behavior
STORE_IN_S3=true              # Store transcriptions in S3 (default: true)
SKIP_LOCAL_STORAGE=true       # Skip local uploads folder (default: true)

# Optional - DynamoDB for metadata
USE_DYNAMODB=false            # Use DynamoDB for fast queries (default: false)
DYNAMODB_TABLE_NAME=meeting-metadata
```

## IAM Permissions Required

Your AWS credentials need these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-meeting-bucket",
        "arn:aws:s3:::your-meeting-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    }
  ]
}
```

If using DynamoDB:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:DeleteItem",
    "dynamodb:Scan",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:*:*:table/meeting-metadata"
}
```

## Cost Estimation

**S3 Storage:**
- Standard storage: $0.023/GB/month
- Example: 100 meetings × 50MB audio + 1MB transcription = ~5GB = **$0.12/month**

**S3 Requests:**
- PUT requests: $0.005 per 1,000
- GET requests: $0.0004 per 1,000
- Example: 100 meetings/month = **~$0.001/month**

**DynamoDB (if enabled):**
- On-demand: $1.25 per million reads, $1.25 per million writes
- Example: 100 meetings/month = **~$0.0003/month**

**Total: ~$0.12-0.15/month for 100 meetings**

## Lifecycle Policies (Optional)

Set up S3 lifecycle policies to automatically:
- Archive old meetings to Glacier after 90 days
- Delete meetings older than 1 year

```json
{
  "Rules": [
    {
      "Id": "ArchiveOldMeetings",
      "Status": "Enabled",
      "Prefix": "transcriptions/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

## Migration from Local Storage

If you have existing meetings in the `uploads/` folder:

1. Keep `SKIP_LOCAL_STORAGE=false` temporarily
2. Process existing files - they'll be uploaded to S3 automatically
3. Once migrated, set `SKIP_LOCAL_STORAGE=true`
4. Optionally delete old files from `uploads/` folder

## Best Practices

1. **Always use presigned URLs** for frontend access (never expose S3 keys)
2. **Enable versioning** on S3 bucket for accidental deletions
3. **Use lifecycle policies** to manage costs
4. **Enable encryption** at rest (SSE-S3 or SSE-KMS)
5. **Use DynamoDB** if you need to list/search meetings frequently
6. **Monitor costs** with AWS Cost Explorer

## Troubleshooting

**Error: "S3_BUCKET_NAME not configured"**
- Set `S3_BUCKET_NAME` in `.env` file

**Error: "Access Denied"**
- Check IAM permissions
- Verify bucket policy allows your role/user

**Error: "DynamoDB table not found"**
- Create table manually or grant table creation permissions
- Or set `USE_DYNAMODB=false` to use S3-only mode

**Files not appearing in list**
- Check bucket region matches `AWS_REGION`
- Verify files were actually stored (check S3 console)


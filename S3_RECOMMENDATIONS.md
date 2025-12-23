# S3 Storage Recommendations - Quick Answers

## 1. Should we store transcriptions and action items in S3?

**✅ YES - Highly Recommended**

### Why S3 is Better:

1. **Scalability**: Your `uploads/` folder will fill up quickly. S3 scales infinitely.
2. **Durability**: 99.999999999% durability vs. risk of local disk failure
3. **Cost**: ~$0.12/month for 100 meetings vs. managing local storage
4. **Integration**: Already using S3 for AWS Transcribe - keep everything in one place
5. **Backup**: S3 is your backup - no need for separate backup strategy
6. **Multi-user**: Multiple servers can access the same data

### Current Implementation:

✅ **Already implemented!** The system now:
- Stores transcriptions in `s3://bucket/transcriptions/{meeting-id}/transcription.txt`
- Stores action items in `s3://bucket/transcriptions/{meeting-id}/summary.json`
- Stores requirements in `s3://bucket/transcriptions/{meeting-id}/requirements.json`
- Stores metadata for tracking relationships

## 2. How do we track what goes with what?

**Three Options (all implemented):**

### Option A: S3 Metadata + JSON Index (Default - No Setup Required)

**How it works:**
- Each meeting gets unique ID: `meeting-abc123`
- All related files stored together:
  ```
  transcriptions/meeting-abc123/
    ├── transcription.txt
    ├── summary.json
    ├── requirements.json
    └── metadata.json  ← Contains all relationships
  ```

**Metadata JSON contains:**
```json
{
  "meeting_id": "meeting-abc123",
  "audio_s3_key": "meetings/uuid_file.m4a",  ← Links to audio
  "timestamp": "2024-01-15T10:30:00",
  "filename": "Meeting.m4a",
  "action_items_count": 5,
  "requirements_count": 3
}
```

**Pros:** Simple, works immediately, no extra services
**Cons:** Listing all meetings requires scanning S3 (slower for 1000+ meetings)

### Option B: DynamoDB for Fast Queries (Recommended for Production)

**How it works:**
- Store metadata in DynamoDB table
- S3 stores actual files
- Fast queries and listing

**Enable it:**
```bash
# In .env file
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=meeting-metadata
```

**Pros:** Fast queries, scales automatically, can add indexes
**Cons:** Requires DynamoDB setup, small additional cost

### Option C: Both (Best of Both Worlds)

Use DynamoDB for fast listing/queries, S3 for actual file storage.

## 3. Should we call directly from S3 instead of storing in uploads folder?

**✅ YES - Recommended for Production**

### Current Implementation (Hybrid):

The system now supports **both modes**:

**Direct S3 Upload (Production Mode):**
```bash
# In .env
SKIP_LOCAL_STORAGE=true  # Default
```

- Files uploaded **directly to S3** (no local storage)
- More memory efficient (streaming)
- No disk space issues
- Better for production

**Local + S3 (Development Mode):**
```bash
# In .env
SKIP_LOCAL_STORAGE=false
```

- Files saved locally first (for debugging)
- Then uploaded to S3
- Useful for development/testing

### Benefits of Direct S3:

1. **No Disk Space Issues**: Never run out of local storage
2. **Faster**: No disk I/O bottleneck
3. **Scalable**: Multiple servers can handle uploads
4. **Secure**: Use presigned URLs (time-limited access)
5. **Cost-Effective**: S3 is cheaper than local SSD storage at scale

### How Audio Access Works:

Instead of serving from local files:
```python
# OLD: Local file serving
return send_file('/uploads/file.m4a')
```

Now uses presigned URLs:
```python
# NEW: S3 presigned URL (expires in 1 hour)
url = get_presigned_url('meetings/file.m4a')
return jsonify({'url': url})
```

## Summary

| Question | Answer | Status |
|----------|--------|--------|
| Store in S3? | ✅ Yes | ✅ Implemented |
| Track relationships? | ✅ Metadata + JSON (or DynamoDB) | ✅ Implemented |
| Direct S3 access? | ✅ Yes (skip local) | ✅ Implemented |

## Quick Start

1. **Set environment variables:**
   ```bash
   S3_BUCKET_NAME=your-meeting-bucket
   SKIP_LOCAL_STORAGE=true
   STORE_IN_S3=true
   ```

2. **That's it!** The system will:
   - Upload files directly to S3
   - Store transcriptions and action items in S3
   - Track relationships via metadata
   - Generate presigned URLs for secure access

3. **Optional - Enable DynamoDB for faster queries:**
   ```bash
   USE_DYNAMODB=true
   DYNAMODB_TABLE_NAME=meeting-metadata
   ```

## Cost Comparison

**Local Storage:**
- Server disk: $0.10/GB/month (EBS)
- Backup: Additional cost
- Scaling: Need larger servers

**S3 Storage:**
- Storage: $0.023/GB/month
- Requests: ~$0.001/month
- **Total: ~$0.12/month for 100 meetings**

**S3 is 4x cheaper and more reliable!**

## Next Steps

1. ✅ S3 storage is already implemented
2. Set `SKIP_LOCAL_STORAGE=true` in production
3. Optionally enable DynamoDB for faster queries
4. Set up S3 lifecycle policies for cost optimization

See `S3_ARCHITECTURE.md` for detailed documentation.


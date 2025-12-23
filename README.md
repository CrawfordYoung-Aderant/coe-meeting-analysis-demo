# Speech-to-Text Demo with AWS Transcribe

A demo application that uses AWS Transcribe to convert speech to text and then parses it into structured output.

## Features

- 🎤 AWS Transcribe integration with IAM authentication
- 📝 Text-to-structured parsing logic
- 🔄 Before/after comparison view
- 🎨 Modern, responsive UI
- 📁 **Meeting upload & playback** - Upload audio/video files and play them back
- 📋 **Meeting summary generation** - Automatic extraction of summaries, action items, decisions, and participants
- 📊 **Structured requirements mapping** - Convert meeting content into structured requirement format
- 🎯 **Enhanced action item extraction** - Extract action items with assignees and due dates

## Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- AWS account with Transcribe access
- AWS IAM credentials configured

### Installation

1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
pip install -r requirements.txt
```

3. Configure AWS credentials (choose one method):
   
   **Method 1: AWS CLI (Recommended)**
   ```bash
   aws configure
   ```
   Enter your AWS Access Key ID, Secret Access Key, and region.
   This will store credentials in `~/.aws/credentials` and `~/.aws/config`
   
   **Method 2: IAM Role** (if running on EC2/ECS/Lambda)
   - Attach an IAM role with necessary permissions
   - Credentials are automatically available
   
   **Method 3: Environment Variables** (not recommended, but supported)
   ```bash
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   export AWS_DEFAULT_REGION=us-east-1
   ```
   
   **IAM Permissions Required:**
   Your IAM user/role needs the following permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "transcribe:StartTranscriptionJob",
           "transcribe:GetTranscriptionJob",
           "transcribe:ListTranscriptionJobs"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel"
         ],
         "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
       }
     ]
   }
   ```
   
   **Note**: The Bedrock permission is only needed if you set `USE_BEDROCK=true`
   
   **Bedrock Model Access**: Before using Bedrock, you must:
   1. Go to AWS Console → Bedrock → Model access
   2. Request access to "Anthropic Claude 3 Sonnet" (or update model ID in code)
   3. Wait for approval (usually instant)
   4. Uses IAM authentication (no API key needed - same credentials as Transcribe/S3)
   
   **For AWS SSO users**: If you see "invalid security token" errors, refresh your SSO session:
   ```bash
   aws sso login
   ```
   Or run `aws sts get-caller-identity` to refresh credentials

4. Create `.env` file in the backend directory:
```
# Required
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Optional - Bedrock Configuration
USE_BEDROCK=true  # Use AWS Bedrock for better action item extraction (default: false)
AWS_BEDROCK_API_KEY=your-bedrock-api-key-here  # Optional - only for Bedrock, IAM auth used for signing

# Optional - Storage Configuration
STORE_IN_S3=true              # Store transcriptions in S3 (default: true)
SKIP_LOCAL_STORAGE=true       # Skip local uploads folder (default: true)

# Optional - DynamoDB Configuration (for fast metadata queries)
USE_DYNAMODB=false            # Use DynamoDB for fast queries (default: false)
DYNAMODB_TABLE_NAME=meeting-metadata  # DynamoDB table name (created automatically if permissions allow)

# Optional - AWS Profile
AWS_PROFILE=default           # Use specific AWS profile (default: uses default credential chain)
```

**Important**: AWS Transcribe requires audio/video files to be stored in S3. You must:
- Create an S3 bucket (or use an existing one)
- Set the `S3_BUCKET_NAME` environment variable
- Ensure your IAM user/role has `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions for the bucket

**Optional - AWS Bedrock for Better Extraction**:
- Set `USE_BEDROCK=true` to use AWS Bedrock (Claude) for action item extraction
- More accurate than regex-based extraction
- **Authentication**:
  - **IAM Auth**: Uses default AWS credential chain (AWS CLI `aws configure`, IAM roles, SSO, etc.)
    - No environment variables needed for IAM
    - Configure using `aws configure` or IAM role
  - **Bedrock API Key**: Set `AWS_BEDROCK_API_KEY` in `.env` (optional)
    - Get your API key from AWS Bedrock console → API keys
    - The API key is used specifically for Bedrock authorization
    - IAM credentials (from default chain) are still needed for request signing
    - If API key is not set, Bedrock will use IAM-only authentication
- Uses Claude 3 Sonnet by default (can be changed in code)
- **Important**: You must request access to Claude models in AWS Bedrock console first:
  1. Go to AWS Bedrock console → Model access
  2. Request access to "Anthropic Claude 3 Sonnet" (or other Claude models)
  3. Wait for approval (usually instant for most accounts)

**Storage Architecture**: For detailed information about the S3 storage structure and architecture, see [S3_ARCHITECTURE.md](./S3_ARCHITECTURE.md) and [S3_RECOMMENDATIONS.md](./S3_RECOMMENDATIONS.md).

### Running the Application

1. Start the backend server:
```bash
cd backend
python app.py
```
   Or use the provided script:
   ```bash
   cd backend
   ./run.sh
   ```
   The backend will run on `http://localhost:5000`

2. Start the frontend (in a new terminal):
```bash
npm install  # First time only
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Meeting Analysis Workflow

1. **Upload Audio/Video File** (Option A)
   - Drag and drop or click to upload a meeting recording (MP3, WAV, M4A, MP4, etc.)
   - The file will be uploaded to S3 and transcription will start automatically
   - Use the audio player to listen to the recording
   - Wait for transcription to complete (status indicator will show progress)
   
2. **Paste Transcript** (Option B)
   - Paste a meeting transcript directly into the text area
   - Skip the transcription step
   
3. **Process Meeting**
   - Click **"Process Meeting & Generate Requirements"** button
   - The system will extract structured information using Bedrock (if enabled) or regex-based extraction
   
4. **View Results**
   - **Meeting Summary**: Overview, participants, topics, decisions, action items
   - **Structured Requirements**: Automatically mapped requirements with IDs, priorities, acceptance criteria
   - **Transcribed Text**: Full transcription of the meeting

### API Endpoints

The backend provides the following REST API endpoints:

- `POST /api/upload` - Upload audio/video file to S3
- `POST /api/transcribe` - Start transcription job or process text directly
- `GET /api/transcribe/status/<job_name>` - Get transcription job status
- `POST /api/meeting/process` - Process meeting text and generate summary/requirements
- `GET /api/files/<filename>` - Get local file or S3 presigned URL
- `GET /api/files/s3?key=<s3_key>` - Get presigned URL for S3 file
- `GET /api/meetings` - List all stored meetings
- `GET /api/meetings/<meeting_id>` - Retrieve specific meeting data
- `DELETE /api/meetings/<meeting_id>` - Delete meeting and all associated data
- `GET /health` - Health check endpoint

For detailed API documentation, see [S3_ARCHITECTURE.md](./S3_ARCHITECTURE.md).

## Features Explained

### Structured Output Includes:
- **Entities**: Emails, phone numbers, URLs, currency, names/places
- **Key Phrases**: Most frequently used meaningful words
- **Action Items**: Tasks and action items extracted from text
- **Dates**: All date references found in the text
- **Numbers**: Numeric values extracted
- **Summary**: Concise summary of the content
- **Statistics**: Word and sentence counts

### Meeting-Specific Features:
- **Meeting Summary**: Comprehensive overview with duration estimate
- **Participants**: Automatically extracted participant names
- **Topics**: Main discussion topics identified
- **Key Decisions**: Important decisions made during the meeting
- **Action Items**: Enhanced extraction with:
  - Assignee detection
  - Due date extraction
  - Priority classification (high/medium/low)
  - Status tracking
- **Next Steps**: Follow-up actions identified
- **Structured Requirements**: 
  - Unique requirement IDs (REQ-001, REQ-002, etc.)
  - Title and description
  - Type (functional/non-functional)
  - Priority and status
  - Assignee and due dates
  - Acceptance criteria
  - Related decisions
  - Export to JSON or CSV

### Comparison View:
- **Side-by-Side**: View original and transcribed text simultaneously
- **Before/After**: Sequential view with visual separator
- Word count comparison
- Highlight differences between original and processed text


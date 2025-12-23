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

3. Configure AWS credentials:
   
   **Option A: Using AWS CLI (Recommended)**
   ```bash
   aws configure
   ```
   Enter your:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., `us-east-1`)
   - Default output format (e.g., `json`)
   
   **Option B: Using Environment Variables**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
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
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
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

4. Configure AWS credentials (choose one method):
   
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

5. Create `.env` file in the backend directory:
```
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
USE_BEDROCK=true  # Optional: Use AWS Bedrock for better action item extraction

# Bedrock API Key (optional - only for Bedrock, IAM auth used for signing)
AWS_BEDROCK_API_KEY=your-bedrock-api-key-here
```

**Important**: AWS Transcribe requires audio/video files to be stored in S3. You must:
- Create an S3 bucket (or use an existing one)
- Set the `S3_BUCKET_NAME` environment variable
- Ensure your IAM user/role has `s3:PutObject` and `s3:GetObject` permissions for the bucket

**Optional - AWS Bedrock for Better Extraction**:
- Set `USE_BEDROCK=true` to use AWS Bedrock (Claude) for action item extraction
- More accurate than regex-based extraction
- **Authentication**:
  - **IAM Auth**: Uses default AWS credential chain (AWS CLI `aws configure`, IAM roles, SSO, etc.)
    - No environment variables needed for IAM
    - Configure using `aws configure` or IAM role
    - **For AWS SSO users**: If you see "invalid security token" errors, refresh your SSO session:
      ```bash
      aws sso login
      ```
      Or run `aws sts get-caller-identity` to refresh credentials
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

### Running the Application

1. Start the backend server:
```bash
cd backend
python app.py
```
   The backend will run on `http://localhost:5000`

2. Start the frontend (in a new terminal):
```bash
npm install  # First time only
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Text Input Mode
1. Select **"Text Input Mode"** tab
2. Paste or type text into the input field
3. Click **"Parse Text"** to extract structured information
4. View the structured output and before/after comparison

### Meeting Mode
1. Select **"Meeting Mode"** tab
2. **Option A: Upload Audio/Video File**
   - Drag and drop or click to upload a meeting recording (MP3, WAV, M4A, MP4, etc.)
   - The file will be uploaded and transcription will start automatically
   - Use the audio player to listen to the recording
   
3. **Option B: Paste Transcript**
   - Paste a meeting transcript directly into the text area
   
4. Click **"Process Meeting & Generate Requirements"**
5. View:
   - **Meeting Summary**: Overview, participants, topics, decisions, action items
   - **Structured Requirements**: Automatically mapped requirements with IDs, priorities, acceptance criteria
   - **Before/After Comparison**: Original vs processed text

### Audio Transcription Mode (Text Input Mode)
1. For audio files, upload to S3 first or use the file upload in Meeting Mode
2. Provide the S3 URI in the `audio_url` field
3. Click **"Transcribe & Parse"** to process
4. The system will poll for transcription completion and display results

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


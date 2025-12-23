"""
Text-to-structured parsing logic
Extracts structured information from transcribed text
"""
import re
import json
from typing import Dict, List, Any

def parse_text_to_structured(text: str) -> Dict[str, Any]:
    """
    Parse unstructured text into structured format
    
    Extracts:
    - Entities (names, dates, locations, etc.)
    - Key phrases
    - Sentiment
    - Action items
    - Summary
    """
    structured = {
        'entities': extract_entities(text),
        'key_phrases': extract_key_phrases(text),
        'action_items': extract_action_items(text),
        'dates': extract_dates(text),
        'numbers': extract_numbers(text),
        'summary': generate_summary(text),
        'word_count': len(text.split()),
        'sentence_count': len(re.split(r'[.!?]+', text))
    }
    
    return structured

def extract_entities(text: str) -> List[Dict[str, str]]:
    """Extract named entities from text"""
    entities = []
    
    # Email patterns
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    for email in emails:
        entities.append({'type': 'EMAIL', 'value': email})
    
    # Phone numbers
    phones = re.findall(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', text)
    for phone in phones:
        entities.append({'type': 'PHONE', 'value': phone})
    
    # URLs
    urls = re.findall(r'https?://[^\s]+', text)
    for url in urls:
        entities.append({'type': 'URL', 'value': url})
    
    # Currency amounts
    currency = re.findall(r'\$\d+(?:,\d{3})*(?:\.\d{2})?', text)
    for amount in currency:
        entities.append({'type': 'CURRENCY', 'value': amount})
    
    # Capitalized words (potential names/places)
    capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    for cap in capitalized[:10]:  # Limit to first 10
        if len(cap) > 2 and cap not in ['The', 'This', 'That', 'There', 'They']:
            entities.append({'type': 'PERSON_OR_PLACE', 'value': cap})
    
    return entities

def extract_key_phrases(text: str) -> List[str]:
    """Extract key phrases from text"""
    # Remove common stop words and extract meaningful phrases
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'}
    
    words = re.findall(r'\b\w+\b', text.lower())
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 3]
    
    # Count frequency
    word_freq = {}
    for word in meaningful_words:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    # Get top phrases
    sorted_phrases = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [phrase for phrase, freq in sorted_phrases[:10] if freq > 1]

def extract_action_items(text: str) -> List[Dict[str, str]]:
    """Extract action items from text"""
    action_items = []
    
    # Patterns for action items
    action_patterns = [
        r'(?:need to|must|should|will|going to)\s+([^.!?]+)',
        r'(?:todo|task|action item)[:\s]+([^.!?]+)',
        r'([A-Z][^.!?]*(?:do|complete|finish|start|create|build|implement)[^.!?]*)',
    ]
    
    for pattern in action_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            action_text = match.group(1).strip()
            if len(action_text) > 10:  # Filter out very short matches
                action_items.append({
                    'text': action_text,
                    'priority': 'medium'  # Could be enhanced with priority detection
                })
    
    # Remove duplicates
    seen = set()
    unique_items = []
    for item in action_items:
        if item['text'] not in seen:
            seen.add(item['text'])
            unique_items.append(item)
    
    return unique_items[:5]  # Return top 5

def extract_dates(text: str) -> List[str]:
    """Extract dates from text"""
    dates = []
    
    # Common date patterns
    date_patterns = [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',  # MM/DD/YYYY
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
        r'\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b',
        r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b',
    ]
    
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates.extend(matches)
    
    return list(set(dates))  # Remove duplicates

def extract_numbers(text: str) -> List[Dict[str, Any]]:
    """Extract numbers from text"""
    numbers = []
    
    # Integer numbers
    integers = re.findall(r'\b\d+\b', text)
    for num in integers[:10]:  # Limit to first 10
        numbers.append({'type': 'integer', 'value': int(num)})
    
    # Decimal numbers
    decimals = re.findall(r'\b\d+\.\d+\b', text)
    for num in decimals[:10]:
        numbers.append({'type': 'decimal', 'value': float(num)})
    
    return numbers

def generate_summary(text: str) -> str:
    """Generate a simple summary of the text"""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        return ""
    
    # Simple summary: first sentence + last sentence (if multiple sentences)
    if len(sentences) == 1:
        summary = sentences[0]
    elif len(sentences) <= 3:
        summary = ' '.join(sentences)
    else:
        summary = f"{sentences[0]} ... {sentences[-1]}"
    
    # Limit summary length
    if len(summary) > 200:
        summary = summary[:197] + "..."
    
    return summary

def parse_meeting_text(text: str, use_bedrock: bool = False) -> Dict[str, Any]:
    """
    Parse meeting transcription with enhanced meeting-specific extraction
    
    Extracts:
    - Meeting summary
    - Action items with assignees and due dates
    - Key decisions
    - Participants
    - Topics discussed
    
    Args:
        text: Meeting transcript text
        use_bedrock: If True, use AWS Bedrock for extraction (more accurate)
    """
    # Use Bedrock if enabled and available
    if use_bedrock:
        try:
            print(f"Attempting to use Bedrock for extraction...")
            from bedrock_extractor import extract_meeting_data_with_bedrock
            result = extract_meeting_data_with_bedrock(text)
            print(f"Bedrock extraction successful!")
            return result
        except ImportError as e:
            print(f"Bedrock extractor import failed: {e}, falling back to regex")
        except Exception as e:
            import traceback
            print(f"Bedrock extraction failed: {e}")
            print(f"Traceback: {traceback.format_exc()}")
            print("Falling back to regex extraction")
    
    # Fallback to regex-based extraction
    meeting_data = {
        'summary': generate_meeting_summary(text),
        'action_items': extract_meeting_action_items(text),
        'key_decisions': extract_decisions(text),
        'participants': extract_participants(text),
        'topics': extract_topics(text),
        'next_steps': extract_next_steps(text),
        'duration_estimate': estimate_meeting_duration(text),
        'entities': extract_entities(text),
        'dates': extract_dates(text)
    }
    
    return meeting_data

def generate_meeting_summary(text: str) -> str:
    """Generate a comprehensive meeting summary"""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        return ""
    
    # Look for summary indicators
    summary_keywords = ['summary', 'conclusion', 'main point', 'key takeaway', 'overall']
    
    # Find sentences with summary keywords
    summary_sentences = []
    for sentence in sentences:
        if any(keyword in sentence.lower() for keyword in summary_keywords):
            summary_sentences.append(sentence)
    
    if summary_sentences:
        return ' '.join(summary_sentences[:3])
    
    # Fallback: first and last sentences
    if len(sentences) <= 3:
        return ' '.join(sentences)
    else:
        return f"{sentences[0]} ... {sentences[-1]}"

def extract_meeting_action_items(text: str) -> List[Dict[str, Any]]:
    """Extract action items with assignees and due dates"""
    action_items = []
    
    # Enhanced patterns for meeting action items
    patterns = [
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|needs? to|must)\s+([^.!?]+?)(?:by|before|on|due)\s+([^.!?]+)',
        r'action item[:\s]+([^.!?]+?)(?:assignee|owner)[:\s]+([A-Z][a-z]+)',
        r'([A-Z][a-z]+)\s+to\s+([^.!?]+?)(?:by|before|on)\s+([^.!?]+)',
        r'(?:need to|must|should|will|going to)\s+([^.!?]+?)(?:by|before|on)\s+([^.!?]+)',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            groups = match.groups()
            if len(groups) >= 2:
                assignee = groups[0] if len(groups) >= 3 and groups[0][0].isupper() else None
                action_text = groups[1] if len(groups) >= 3 else groups[0]
                due_date = groups[-1] if len(groups) >= 2 else None
                
                if len(action_text) > 10:
                    action_items.append({
                        'text': action_text.strip(),
                        'assignee': assignee,
                        'due_date': due_date.strip() if due_date else None,
                        'priority': detect_priority(action_text),
                        'status': 'open'
                    })
    
    # Also extract simple action items
    simple_actions = extract_action_items(text)
    for action in simple_actions:
        if not any(a['text'] == action['text'] for a in action_items):
            action_items.append({
                'text': action['text'],
                'assignee': None,
                'due_date': None,
                'priority': action['priority'],
                'status': 'open'
            })
    
    # Remove duplicates
    seen = set()
    unique_items = []
    for item in action_items:
        key = item['text'].lower()
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
    
    return unique_items[:10]

def detect_priority(text: str) -> str:
    """Detect priority level from action item text"""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['urgent', 'asap', 'immediately', 'critical', 'important']):
        return 'high'
    elif any(word in text_lower for word in ['soon', 'priority', 'important']):
        return 'medium'
    else:
        return 'low'

def extract_decisions(text: str) -> List[str]:
    """Extract key decisions made in the meeting"""
    decisions = []
    
    decision_patterns = [
        r'decided to\s+([^.!?]+)',
        r'decision[:\s]+([^.!?]+)',
        r'agreed to\s+([^.!?]+)',
        r'concluded that\s+([^.!?]+)',
        r'will\s+([^.!?]+?)(?:going forward|from now on)',
    ]
    
    for pattern in decision_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            decision = match.group(1).strip()
            if len(decision) > 10:
                decisions.append(decision)
    
    return list(set(decisions))[:10]

def extract_participants(text: str) -> List[str]:
    """Extract meeting participants"""
    participants = []
    
    # Look for patterns like "John said", "Sarah mentioned", etc.
    participant_patterns = [
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|noted|asked|suggested|proposed|agreed)',
        r'attendees?[:\s]+([^.!?]+)',
        r'participants?[:\s]+([^.!?]+)',
    ]
    
    for pattern in participant_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            participant = match.group(1).strip()
            # Filter out common false positives
            if participant not in ['The', 'This', 'That', 'There', 'They', 'We', 'I']:
                if len(participant.split()) <= 3:  # Likely a name
                    participants.append(participant)
    
    return list(set(participants))[:15]

def extract_topics(text: str) -> List[str]:
    """Extract main topics discussed"""
    topics = []
    
    topic_patterns = [
        r'topic[:\s]+([^.!?]+)',
        r'discussed\s+([^.!?]+)',
        r'regarding\s+([^.!?]+)',
        r'about\s+([^.!?]+?)(?:\.|,|and)',
    ]
    
    for pattern in topic_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            topic = match.group(1).strip()
            if len(topic) > 5 and len(topic) < 50:
                topics.append(topic)
    
    # Also use key phrases as topics
    key_phrases = extract_key_phrases(text)
    topics.extend(key_phrases[:5])
    
    return list(set(topics))[:10]

def extract_next_steps(text: str) -> List[str]:
    """Extract next steps mentioned"""
    next_steps = []
    
    next_step_patterns = [
        r'next step[:\s]+([^.!?]+)',
        r'going forward[,\s]+([^.!?]+)',
        r'next[,\s]+([^.!?]+)',
        r'follow up[:\s]+([^.!?]+)',
    ]
    
    for pattern in next_step_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            step = match.group(1).strip()
            if len(step) > 10:
                next_steps.append(step)
    
    return list(set(next_steps))[:5]

def estimate_meeting_duration(text: str) -> str:
    """Estimate meeting duration based on word count"""
    word_count = len(text.split())
    # Average speaking rate: ~150 words per minute
    estimated_minutes = max(5, word_count // 150)
    
    if estimated_minutes < 60:
        return f"~{estimated_minutes} minutes"
    else:
        hours = estimated_minutes // 60
        minutes = estimated_minutes % 60
        return f"~{hours}h {minutes}m"

def map_to_requirements_format(meeting_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Map meeting data to structured requirements format
    
    Requirements format:
    - ID
    - Title
    - Description
    - Type (functional/non-functional)
    - Priority
    - Status
    - Assignee
    - Due Date
    - Acceptance Criteria
    """
    requirements = []
    
    # Map action items to requirements
    for idx, action in enumerate(meeting_data.get('action_items', []), 1):
        req_id = f"REQ-{idx:03d}"
        
        requirement = {
            'id': req_id,
            'title': action['text'][:100] + ('...' if len(action['text']) > 100 else ''),
            'description': action['text'],
            'type': 'functional',  # Could be enhanced with classification
            'priority': action.get('priority', 'medium'),
            'status': 'draft',
            'assignee': action.get('assignee'),
            'due_date': action.get('due_date'),
            'acceptance_criteria': generate_acceptance_criteria(action['text']),
            'source': 'meeting_action_item',
            'related_decisions': []
        }
        
        # Link to related decisions
        for decision in meeting_data.get('key_decisions', []):
            if any(word in action['text'].lower() for word in decision.lower().split()[:3]):
                requirement['related_decisions'].append(decision)
        
        requirements.append(requirement)
    
    # Map decisions to requirements if they represent requirements
    for idx, decision in enumerate(meeting_data.get('key_decisions', []), len(requirements) + 1):
        if len(decision) > 20:  # Only substantial decisions
            req_id = f"REQ-{idx:03d}"
            requirements.append({
                'id': req_id,
                'title': f"Decision: {decision[:80]}",
                'description': decision,
                'type': 'non-functional',
                'priority': 'medium',
                'status': 'draft',
                'assignee': None,
                'due_date': None,
                'acceptance_criteria': [f"Decision documented and communicated"],
                'source': 'meeting_decision',
                'related_decisions': [decision]
            })
    
    return requirements

def generate_acceptance_criteria(action_text: str) -> List[str]:
    """Generate acceptance criteria for an action item"""
    criteria = []
    
    # Extract key verbs and objects
    if 'complete' in action_text.lower():
        criteria.append("Task is completed and verified")
    if 'review' in action_text.lower():
        criteria.append("Review is completed and feedback provided")
    if 'implement' in action_text.lower() or 'build' in action_text.lower():
        criteria.append("Implementation is complete and tested")
    if 'create' in action_text.lower():
        criteria.append("Deliverable is created and approved")
    
    # Default criteria
    if not criteria:
        criteria.append("Action item is completed as specified")
        criteria.append("Completion is verified and documented")
    
    return criteria


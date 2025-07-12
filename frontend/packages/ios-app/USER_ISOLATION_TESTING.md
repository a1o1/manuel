# User Isolation Testing Guide

## Overview

The Manuel iOS frontend now implements **complete user-scoped mock services** that simulate the intended production behavior with AWS Bedrock Knowledge Base metadata filtering.

## Test Users

### User 1: John Doe (john.doe@example.com)
- **Manuals**: WiFi Router Setup Guide, Smart TV User Manual
- **Usage**: 5 daily queries, moderate usage
- **Query Responses**: Router and TV-specific answers
- **Profile**: Technical user with networking equipment

### User 2: Jane Smith (jane.smith@example.com)  
- **Manuals**: Coffee Machine Guide
- **Usage**: 12 daily queries, higher usage
- **Query Responses**: Coffee machine-specific answers
- **Profile**: Coffee enthusiast with brewing equipment

### User 3: Mike Johnson (mike.johnson@example.com)
- **Manuals**: None (empty state)
- **Usage**: 3 daily queries, low usage
- **Query Responses**: "No manuals uploaded" messages
- **Profile**: New user who hasn't uploaded any manuals

## How to Test User Isolation

### Method 1: Using the Development Environment Switcher

1. **Open the app** in web mode (`npx expo start --web`)
2. **Click the orange "🔧 MOCK" button** in the top-right corner
3. **Switch between users** using the Mock User section
4. **Navigate between tabs** to see user-specific data

### Method 2: Using Email-based Login

1. **Go to Login screen**
2. **Enter one of the test emails**:
   - `john.doe@example.com` (Router + TV manuals)
   - `jane.smith@example.com` (Coffee machine manual)
   - `mike.johnson@example.com` (No manuals)
3. **Use any password** (mock service accepts anything)
4. **Navigate through the app** to see user-specific content

## What Should Change Between Users

### ✅ Manuals Screen
- **John**: Shows 2 manuals (Router, TV)
- **Jane**: Shows 1 manual (Coffee Machine)
- **Mike**: Shows empty state with upload prompt

### ✅ Query Responses
- **John**: Gets router/TV-specific answers and sources
- **Jane**: Gets coffee machine-specific answers and sources
- **Mike**: Gets "no manuals uploaded" responses

### ✅ Usage Statistics
- **John**: 5 queries, $0.75 daily cost, 875 monthly remaining
- **Jane**: 12 queries, $1.85 daily cost, 933 monthly remaining
- **Mike**: 3 queries, $0.45 daily cost, 411 monthly remaining

### ✅ Voice Queries
- **John**: Transcribes WiFi/device questions, router/TV answers
- **Jane**: Transcribes coffee/brewing questions, machine answers
- **Mike**: Gets "no manuals uploaded" responses

### ✅ Profile Information
- **John**: Shows "John Doe" name and email
- **Jane**: Shows "Jane Smith" name and email  
- **Mike**: Shows "Mike Johnson" name and email

## Verification Steps

1. **Start with User 1 (John)**
   - Verify 2 manuals appear
   - Ask a question, get router/TV response
   - Check usage shows 5 daily queries

2. **Switch to User 2 (Jane)**
   - Verify only 1 coffee manual appears
   - Ask same question, get coffee-related response
   - Check usage shows 12 daily queries

3. **Switch to User 3 (Mike)**
   - Verify empty state on manuals screen
   - Ask any question, get "no manuals" response
   - Check usage shows 3 daily queries

## Technical Implementation

### User Context Management
- `mockUserContext` singleton manages current user ID
- All mock services query this context for user-scoped data
- User switching updates context and data immediately

### Data Isolation
- **Manuals**: `Map<userId, UserManual[]>` stores per-user manual lists
- **Usage**: `Map<userId, UserUsage>` stores per-user quota/cost data  
- **Queries**: `Map<userId, UserQueryData>` stores per-user content and responses

### Authentication Integration
- Mock auth service maps specific emails to user IDs
- Login/signup automatically sets the user context
- Logout resets to default user (user1)

## Production Equivalent

This mock implementation exactly simulates how the production system will work with:

- **AWS Cognito**: User authentication and user IDs
- **Bedrock Knowledge Base**: Metadata filtering by `user_id`
- **S3**: User-specific document storage with metadata
- **DynamoDB**: User-scoped quota and usage tracking

The mock services provide a perfect testing environment for the intended production user isolation behavior.

## Troubleshooting

### Data Not Changing?
- Check that you switched users in the dev tools
- Navigate away and back to refresh screen data
- Verify the orange dev button shows "MOCK" mode

### Still Seeing Shared Data?
- Ensure you're testing in mock mode (not production)
- Check that the environment switcher shows the correct user
- Try logging out and back in with different emails

### Issues with Development Tools?
- The orange dev button only appears in development mode
- Ensure `ENV_CONFIG.DEV.SHOW_DEV_INDICATORS` is true
- Check console for any JavaScript errors
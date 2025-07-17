"""
Lambda function to create OpenSearch index for Bedrock Knowledge Base
Version: 3.0 - Using boto3 with OpenSearch API
"""

import json
import os
import boto3
import traceback
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    """Create OpenSearch index using boto3 OpenSearch client"""
    
    try:
        # Get parameters from event
        collection_endpoint = event['ResourceProperties']['CollectionEndpoint']
        index_name = event['ResourceProperties'].get('IndexName', 'bedrock-kb-default-index')
        
        # Extract collection ID from endpoint
        # Format: https://[collection-id].eu-west-1.aoss.amazonaws.com
        collection_id = collection_endpoint.split('//')[1].split('.')[0]
        
        print(f"Collection ID: {collection_id}")
        print(f"Index name: {index_name}")
        
        # Create OpenSearch client
        opensearch_client = boto3.client('opensearch', region_name=os.environ['AWS_REGION'])
        
        # Index configuration for Bedrock Knowledge Base
        index_body = {
            "settings": {
                "index": {
                    "knn": True
                }
            },
            "mappings": {
                "properties": {
                    "bedrock-knowledge-base-default-vector": {
                        "type": "knn_vector",
                        "dimension": 1024
                    },
                    "bedrock-knowledge-base-text-field": {
                        "type": "text"
                    },
                    "bedrock-knowledge-base-metadata-field": {
                        "type": "text"
                    }
                }
            }
        }
        
        print(f"Index body: {json.dumps(index_body, indent=2)}")
        
        # Try to create index using direct HTTP request with proper auth
        import urllib.request
        import urllib.parse
        from botocore.auth import SigV4Auth
        from botocore.awsrequest import AWSRequest
        
        # Get credentials
        session = boto3.Session()
        credentials = session.get_credentials()
        
        # Create signed request
        url = f"{collection_endpoint}/{index_name}"
        data = json.dumps(index_body)
        
        # Create AWS request for signing
        request = AWSRequest(
            method='PUT',
            url=url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Content-Length': str(len(data))
            }
        )
        
        # Sign the request
        SigV4Auth(credentials, 'aoss', os.environ['AWS_REGION']).add_auth(request)
        
        print(f"Request URL: {url}")
        print(f"Request headers: {dict(request.headers)}")
        
        # Convert to urllib request
        urllib_request = urllib.request.Request(
            url,
            data=data.encode('utf-8'),
            headers=dict(request.headers),
            method='PUT'
        )
        
        try:
            # Send request
            with urllib.request.urlopen(urllib_request) as response:
                response_data = response.read().decode('utf-8')
                response_json = json.loads(response_data)
                
                print(f"Index '{index_name}' created successfully: {response_json}")
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': f"Index '{index_name}' created successfully",
                        'response': response_json,
                        'exists': False
                    })
                }
                
        except urllib.error.HTTPError as e:
            error_response = e.read().decode('utf-8')
            print(f"HTTP Error {e.code}: {error_response}")
            
            if e.code == 400 and 'already exists' in error_response.lower():
                print(f"Index '{index_name}' already exists")
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': f"Index '{index_name}' already exists",
                        'exists': True
                    })
                }
            else:
                raise Exception(f"HTTP Error {e.code}: {error_response}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'traceback': traceback.format_exc()
            })
        }
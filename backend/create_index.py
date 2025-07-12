#!/usr/bin/env python3
"""
Create OpenSearch Serverless index for Manuel Knowledge Base
"""

import boto3
import json
from opensearchpy import OpenSearch, RequestsHttpConnection
from aws_requests_auth.aws_auth import AWSRequestsAuth

def create_opensearch_index():
    """Create the manuel-index in OpenSearch Serverless"""
    
    # OpenSearch Serverless endpoint
    endpoint = "https://pcaug4ywf9lyun7w8hn9.eu-west-1.aoss.amazonaws.com"
    region = "eu-west-1"
    service = "aoss"
    
    # Get AWS credentials
    session = boto3.Session()
    credentials = session.get_credentials()
    
    # Create the auth object
    auth = AWSRequestsAuth(
        aws_access_key=credentials.access_key,
        aws_secret_access_key=credentials.secret_key,
        aws_token=credentials.token,
        aws_host=endpoint.replace("https://", ""),
        aws_region=region,
        aws_service=service
    )
    
    # Create OpenSearch client
    client = OpenSearch(
        hosts=[endpoint],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30
    )
    
    # Index configuration for Bedrock Knowledge Base
    index_config = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 512
            }
        },
        "mappings": {
            "properties": {
                "vector": {
                    "type": "knn_vector",
                    "dimension": 1024,  # Amazon Titan Text Embeddings V2 dimension
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "faiss",
                        "parameters": {
                            "ef_construction": 512,
                            "m": 16
                        }
                    }
                },
                "text": {
                    "type": "text",
                    "analyzer": "standard"
                },
                "metadata": {
                    "type": "text"
                }
            }
        }
    }
    
    index_name = "manuel-index"
    
    try:
        # Check if index already exists and delete it
        if client.indices.exists(index=index_name):
            print(f"Index '{index_name}' already exists, deleting it...")
            client.indices.delete(index=index_name)
            print(f"Index '{index_name}' deleted")
            
        # Create the index
        response = client.indices.create(
            index=index_name,
            body=index_config
        )
        
        print(f"Successfully created index '{index_name}'")
        print(f"Response: {json.dumps(response, indent=2)}")
        return True
        
    except Exception as e:
        print(f"Error creating index: {str(e)}")
        return False

if __name__ == "__main__":
    create_opensearch_index()
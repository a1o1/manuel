#!/usr/bin/env python3
"""
Create OpenSearch index for Bedrock Knowledge Base
"""

import boto3
import json
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from urllib.parse import urlparse
import sys

def create_opensearch_index():
    # OpenSearch configuration
    endpoint = "https://9zirlxsg545v92cnfucg.eu-west-1.aoss.amazonaws.com"
    index_name = "bedrock-knowledge-base-default-index"
    region = "eu-west-1"
    
    # Create index configuration
    index_config = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 512,
                "knn.algo_param.ef_construction": 512,
                "knn.algo_param.m": 16,
                "knn.space_type": "cosinesimil"
            }
        },
        "mappings": {
            "properties": {
                "bedrock-knowledge-base-default-vector": {
                    "type": "knn_vector",
                    "dimension": 1024,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "nmslib",
                        "parameters": {
                            "ef_construction": 512,
                            "m": 16
                        }
                    }
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
    
    # Create boto3 session and sign the request
    session = boto3.Session()
    credentials = session.get_credentials()
    
    url = f"{endpoint}/{index_name}"
    
    # Create AWS request
    request = AWSRequest(
        method='PUT',
        url=url,
        data=json.dumps(index_config),
        headers={'Content-Type': 'application/json'}
    )
    
    # Sign the request
    SigV4Auth(credentials, 'aoss', region).add_auth(request)
    
    # Send the request
    response = requests.put(
        url,
        data=json.dumps(index_config),
        headers=dict(request.headers)
    )
    
    if response.status_code == 200:
        print(f"✅ Index '{index_name}' created successfully!")
        print(f"Response: {response.json()}")
    else:
        print(f"❌ Failed to create index '{index_name}'")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    return True

if __name__ == "__main__":
    success = create_opensearch_index()
    sys.exit(0 if success else 1)
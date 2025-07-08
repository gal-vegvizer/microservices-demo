# Remote State Management Setup

## Overview
This document outlines the complete setup for S3-based remote state management for our microservices demo infrastructure.

## Architecture

### Remote State Components
1. **S3 Bucket**: `microdemo-terraform-state-bucket`
   - Stores Terraform state files with versioning enabled
   - Server-side encryption (AES256)
   - Secure access controls

2. **DynamoDB Table**: `microdemo-terraform-locks`
   - Provides state locking mechanism
   - Prevents concurrent modifications
   - Pay-per-request billing

### Directory Structure
```
.
├── terraform-backend/          # Backend infrastructure
│   ├── main.tf                # S3 bucket and DynamoDB table
│   ├── variables.tf           # Backend configuration variables
│   └── outputs.tf             # Backend resource outputs
├── infra/                     # Main infrastructure
│   ├── main.tf               # Updated with S3 backend config
│   └── ...
└── .github/workflows/        # CI/CD pipeline
    └── deploy-infrastructure.yml
```

## Backend Configuration

### S3 Backend Settings
```hcl
backend "s3" {
  bucket         = "microdemo-terraform-state-bucket"
  key            = "microservices-demo/terraform.tfstate"
  region         = "us-east-2"
  dynamodb_table = "microdemo-terraform-locks"
  encrypt        = true
}
```

## Setup Process

### 1. Backend Infrastructure Deployment
```bash
cd terraform-backend/
terraform init
terraform apply
```

### 2. Main Infrastructure Backend Migration
```bash
cd infra/
terraform init  # Migrates local state to S3
```

### 3. State Verification
- Local state files are now empty (using remote state)
- DynamoDB provides locking during operations
- S3 versioning maintains state history

## Benefits

### For Local Development
- ✅ Consistent state across team members
- ✅ State locking prevents conflicts
- ✅ Automatic state backup and versioning
- ✅ Secure state storage

### For CI/CD Pipeline
- ✅ Pipeline uses same state as local development
- ✅ No state management issues between environments
- ✅ Automatic state locking during pipeline runs
- ✅ State persistence across pipeline executions

## Usage

### Local Development
```bash
cd infra/
terraform plan   # Uses remote state from S3
terraform apply  # Acquires lock, updates remote state
```

### Pipeline Deployment
- GitHub Actions automatically uses remote state
- No additional configuration needed
- State is shared between local and pipeline

## Security Features

1. **Encryption**: State files encrypted at rest in S3
2. **Versioning**: Full history of state changes
3. **Locking**: Prevents concurrent modifications
4. **Access Control**: IAM-based permissions

## Monitoring

### State Lock Status
- DynamoDB table shows active locks
- Terraform displays lock acquisition messages

### State File Versions
- S3 bucket versioning tracks all state changes
- Easy rollback to previous state versions if needed

## Troubleshooting

### State Lock Issues
```bash
# Force unlock if needed (use carefully)
terraform force-unlock <LOCK_ID>
```

### State Corruption
- Use S3 versioning to restore previous state
- DynamoDB ensures atomic operations

## Next Steps

1. **Pipeline Testing**: Monitor GitHub Actions for successful deployment
2. **Team Onboarding**: Share backend configuration with team members
3. **State Policies**: Implement backup and retention policies
4. **Monitoring**: Set up CloudWatch alerts for state operations

## Files Modified

- `infra/main.tf`: Added S3 backend configuration
- `terraform-backend/`: New directory with backend infrastructure
- Pipeline: Already configured to work with remote state

This setup ensures robust, scalable state management for both local development and automated deployments.

## State Lock Management

### Understanding State Locks

When Terraform operations run, they acquire a lock in DynamoDB to prevent concurrent modifications:

```bash
# Check current locks
aws dynamodb scan --table-name microdemo-terraform-locks --region us-east-2
```

### Lock States Explained

**During Operation (2 items in DynamoDB):**
```json
{
    "Items": [
        {
            "LockID": {"S": "microdemo-terraform-state-bucket/microservices-demo/terraform.tfstate-md5"},
            "Digest": {"S": "641701b9dbaca8ba4eda2166d58b8931"}
        },
        {
            "LockID": {"S": "microdemo-terraform-state-bucket/microservices-demo/terraform.tfstate"},
            "Info": {"S": "{\"ID\":\"04f9a323-4d09-a7ba-a62b-9702cb86dff9\",\"Operation\":\"OperationTypeApply\",\"Who\":\"runner@pkrvmbietmlfzoi\"...}"}
        }
    ]
}
```

**After Operation (1 item remaining):**
```json
{
    "Items": [
        {
            "LockID": {"S": "microdemo-terraform-state-bucket/microservices-demo/terraform.tfstate-md5"},
            "Digest": {"S": "387c2044edd580c45b3e5cfae5ae32ee"}
        }
    ]
}
```

### Handling Lock Conflicts

#### Option 1: Wait for Operation to Complete (Recommended)
```bash
# Monitor lock status
watch "aws dynamodb scan --table-name microdemo-terraform-locks --region us-east-2"

# When only MD5 digest remains, lock is released
```

#### Option 2: Use Lock Timeout
```bash
cd infra/
terraform plan -lock-timeout=300s  # Wait up to 5 minutes for lock
```

#### Option 3: Force Unlock (Use with Caution)
```bash
# Get the Lock ID from DynamoDB scan
terraform force-unlock <LOCK_ID>

# Example (using the ID from above):
terraform force-unlock 04f9a323-4d09-a7ba-a62b-9702cb86dff9
```

### Common Scenarios

#### 1. Pipeline Running + Local Development
- **Situation**: GitHub Actions has the lock
- **Solution**: Wait for pipeline to complete (usually 2-5 minutes)
- **Check**: DynamoDB scan shows only MD5 digest

#### 2. Crashed Local Operation
- **Situation**: Local Terraform crashed, lock stuck
- **Solution**: Force unlock with the specific Lock ID
- **Prevention**: Use `-lock-timeout` parameter

#### 3. Multiple Team Members
- **Situation**: Colleague has lock from their local machine
- **Solution**: Coordinate via team chat, or force unlock if necessary
- **Best Practice**: Use short-lived operations, communicate before major changes

### Best Practices

1. **Always check lock status** before forcing unlock
2. **Coordinate with team** when force unlocking
3. **Use timeouts** for automated scripts
4. **Monitor pipeline status** before local operations
5. **Keep operations short** to minimize lock time

### Lock Monitoring Commands

```bash
# Check current locks
aws dynamodb scan --table-name microdemo-terraform-locks --region us-east-2 | jq '.Items'

# Check GitHub Actions status
gh run list --repo <your-repo> --limit 5

# Watch for lock release
watch -n 10 "aws dynamodb scan --table-name microdemo-terraform-locks --region us-east-2 | jq '.Count'"
```

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source             = "./modules/vpc"
  project_name       = var.project_name
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
}

module "s3" {
  source         = "./modules/s3"
  project_name   = var.project_name
  s3_bucket_name = var.s3_bucket_name
}

module "sqs" {
  source         = "./modules/sqs"
  project_name   = var.project_name
  sqs_queue_name = var.sqs_queue_name
}

module "iam" {
  source         = "./modules/iam"
  project_name   = var.project_name
  s3_bucket_arn  = module.s3.bucket_name
  sqs_queue_arn  = module.sqs.queue_url
  ssm_param_arn  = aws_ssm_parameter.token.arn
}

# ...other infrastructure modules will be added here...

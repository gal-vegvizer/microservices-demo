terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
  
  backend "s3" {
    bucket         = "microdemo-terraform-state-bucket"
    key            = "microservices-demo/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "microdemo-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source              = "./modules/vpc"
  project_name        = var.project_name
  aws_region          = var.aws_region
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
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

module "ssm_parameter" {
  source       = "./modules/ssm_parameter"
  name         = var.ssm_token_name
  value        = var.ssm_token_value
  project_name = var.project_name
}

module "iam" {
  source        = "./modules/iam"
  project_name  = var.project_name
  s3_bucket_arn = module.s3.bucket_name
  sqs_queue_arn = module.sqs.queue_url
  ssm_param_arn = module.ssm_parameter.arn
}

module "ecs_api_receiver" {
  source            = "./modules/ecs"
  project_name      = var.project_name
  subnet_id         = module.vpc.public_subnet_ids[0]
  ecs_task_role_arn = module.iam.ecs_task_role_arn
  container_image   = var.api_receiver_image
  container_port    = var.api_receiver_port
  security_group_id = module.ecs_api_receiver_sg.ecs_sg_id
  target_group_arn  = module.alb.target_group_arn
}

module "ecs_sqs_worker" {
  source            = "./modules/ecs"
  project_name      = "${var.project_name}-worker"
  subnet_id         = module.vpc.public_subnet_ids[1]
  ecs_task_role_arn = module.iam.ecs_task_role_arn
  container_image   = var.sqs_worker_image
  container_port    = var.sqs_worker_port
  security_group_id = module.ecs_sqs_worker_sg.ecs_sg_id
}

module "alb" {
  source       = "./modules/alb"
  project_name = var.project_name
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.public_subnet_ids
  target_port  = var.api_receiver_port
}

module "ecs_api_receiver_sg" {
  source       = "./modules/security_group"
  project_name = var.project_name
  vpc_id       = module.vpc.vpc_id
  ingress_port = var.api_receiver_port
}

module "ecs_sqs_worker_sg" {
  source       = "./modules/security_group"
  project_name = "${var.project_name}-worker"
  vpc_id       = module.vpc.vpc_id
  ingress_port = var.sqs_worker_port
}

# ...other infrastructure modules will be added here...

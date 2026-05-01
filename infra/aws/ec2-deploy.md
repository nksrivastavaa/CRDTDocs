# AWS EC2 Deployment Guide

This setup is intentionally free-tier friendly. A single `t2.micro` or `t3.micro` EC2 instance can run the full stack for evaluation. For production traffic, move PostgreSQL to RDS and Redis to ElastiCache.

## 1. Create AWS Resources

1. Launch an Ubuntu 22.04 or 24.04 EC2 instance.
2. Open inbound security group ports:
   - `22` for SSH from your IP
   - `80` for HTTP
   - `443` for HTTPS
3. Create an S3 bucket for uploads.
4. Create an IAM user or role with least-privilege S3 permissions for the upload bucket.

Suggested S3 policy scope:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

## 2. Install Docker

SSH into the instance:

```bash
ssh ubuntu@YOUR_EC2_PUBLIC_IP
```

Install Docker and Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and back in so the Docker group takes effect.

## 3. Configure The App

Clone or copy the repository to the EC2 instance:

```bash
git clone YOUR_REPO_URL collab-system
cd collab-system
cp .env.example .env
```

Edit `.env`:

```bash
nano .env
```

Production values to change:

```env
JWT_SECRET=use-a-long-random-secret
POSTGRES_PASSWORD=use-a-strong-db-password
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-real-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_ENDPOINT=
AWS_S3_PUBLIC_URL=https://your-real-bucket.s3.amazonaws.com
AWS_S3_FORCE_PATH_STYLE=false
```

For a real production deployment, remove the MinIO services from Compose and point document-service at AWS S3.

## 4. Start Services

```bash
docker compose up -d --build
docker compose ps
```

Check logs:

```bash
docker compose logs -f api-gateway document-service collaboration-service
```

## 5. Nginx And HTTPS

The local Compose file already includes Nginx. For a public EC2 deployment, point your domain DNS `A` record to the EC2 public IP.

Install Certbot on the host:

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d yourdomain.com
```

Copy `infra/nginx/prod.conf` into your Nginx configuration and replace `example.com` with your domain. If Nginx runs inside Docker, mount:

```yaml
volumes:
  - ./infra/nginx/prod.conf:/etc/nginx/conf.d/default.conf:ro
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/www/certbot:/var/www/certbot
```

Reload:

```bash
docker compose restart nginx
```

Renew certificates:

```bash
sudo certbot renew --dry-run
```

Add a cron or systemd timer for `certbot renew`, then restart Nginx after renewal.

## 6. Scaling Notes

- API gateway and REST services are stateless and can be replicated behind a load balancer.
- Collaboration service uses the Socket.IO Redis adapter for horizontal WebSocket fan-out.
- Redis tracks active document presence.
- PostgreSQL stores canonical users, permissions, structured document JSON, comments, notifications, files, and persisted Yjs state.
- For managed production infrastructure, use RDS PostgreSQL, ElastiCache Redis, S3, ACM certificates, and an ALB.


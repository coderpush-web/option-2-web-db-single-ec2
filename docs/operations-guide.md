# Operations & Usage Guide - Option 2: Web Application + Local DB on Single EC2

This guide covers local development, database management, remote administration, and troubleshooting for **Option 2: Web Application + Local SQLite Database on Single EC2**.

---

## 1. Local Application Development

### Development Environment Setup:
```bash
cd app

# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

Open `http://localhost:3000` to interact with the dashboard.

### Core Application Endpoints:
- `/`: Dashboard homepage displaying overview cards, revenue chart, and latest invoices.
- `/dashboard/invoices`: CRUD operations on customer invoices.
- `/dashboard/customers`: Customer directory.
- `/api/health`: Health check endpoint polled by ALB. Returns HTTP 200 `{"status":"ok"}`.

### Running Automated Tests:
```bash
node test/test_api.js
```

---

## 2. Managing the Local SQLite Database & EBS Persistence

In Option 2, the application runs on a single EC2 instance where data is saved locally to an encrypted EBS volume.

### Storage Architecture on EC2:
- Host mount directory: `/var/data/sqlite`
- Container volume binding: `-v /var/data/sqlite:/app/data`
- When the container is restarted or updated, the database file remains intact on the EBS volume.

### Creating Manual Database Backups:
Connect to the instance via SSM and run:
```bash
# 1. Create a timestamped copy of the SQLite database
sudo cp /var/data/sqlite/app.db /var/data/sqlite/app.db.bak.$(date +%F_%T)

# 2. Verify file integrity
ls -lh /var/data/sqlite/
```

### Creating Automated Amazon EBS Snapshots:
You can snapshot the EBS volume directly via AWS CLI before performing major application updates:
```bash
VOLUME_ID=$(aws ec2 describe-volumes \
  --filters "Name=attachment.instance-id,Values=<INSTANCE_ID>" \
  --query "Volumes[0].VolumeId" --output text)

aws ec2 create-snapshot \
  --volume-id "$VOLUME_ID" \
  --description "Pre-deployment backup for option-2 $(date +%F)"
```

---

## 3. Remote Administration via AWS Systems Manager (SSM)

Since the EC2 instance resides in a **Private Subnet** with no public IP and no SSH port 22 open, all management tasks are performed using **AWS SSM Session Manager**:

### Connect to the EC2 Instance:
```bash
# 1. Look up the EC2 instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=dev-web-sqlite-server" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

# 2. Open an interactive shell
aws ssm start-session --target "$INSTANCE_ID"
```

### Essential Host Commands:
```bash
# Check status of the systemd service
sudo systemctl status react-webapp

# View container output logs
sudo docker ps
sudo docker logs -f $(sudo docker ps -q)

# Restart application container
sudo systemctl restart react-webapp

# Monitor CPU, Memory, and Disk usage
df -h /var/data/sqlite
docker stats --no-stream
```

---

## 4. Monitoring & Observability

### A. CloudWatch Logs
- **Log Group:** `/aws/ec2/dev-opt2` (or `/aws/ec2/prod-opt2`)
- **Retention Period:** 14 days (Dev) / 30 days (Prod)

Stream logs in your terminal:
```bash
aws logs tail /aws/ec2/dev-opt2 --follow --format short
```

### B. CloudWatch Alarms
- **ALB 5XX Errors Alarm:** Alerts if 5XX errors exceed 10 in a 1-minute window.
- **EC2 High CPU Alarm:** Alerts if CPU utilization exceeds 85% for 5 consecutive minutes.
- **Alert Notifications:** Sent via Amazon SNS Topic (`${EnvironmentName}-ops-alerts`) to operations email subscribers.

---

## 5. Troubleshooting & Frequently Encountered Issues

### Issue 1: ALB Returns `502 Bad Gateway`
- **Cause:** Docker container crashed or is not responding on port 80.
- **Remediation:**
  1. Start an SSM session into the server.
  2. Inspect container status: `sudo docker ps -a`.
  3. Check systemd service status: `sudo systemctl status react-webapp`.
  4. Test local response: `curl -I http://localhost:80/api/health`.

### Issue 2: Disk Space Depletion on `/var/data/sqlite`
- **Cause:** Accumulated backup files or oversized database file.
- **Remediation:**
  1. Inspect disk usage: `df -h /var/data/sqlite`.
  2. Remove obsolete `.bak` files if necessary.
  3. If persistent storage expansion is needed, modify `WebVolumeSize` in `environments/prod.json` and redeploy CloudFormation.

### Issue 3: SSM Session Manager Fails to Connect
- **Cause:** EC2 IAM role lacks SSM permissions or instance is stopped.
- **Remediation:**
  1. Check instance state: `aws ec2 describe-instances --instance-ids <ID>`.
  2. Ensure the `${ENV}-iam` stack was deployed with `AmazonSSMManagedInstanceCore`.
  3. Verify SSM agent status on reboot via `/var/log/cloud-init-output.log`.

# Easy!Appointments Docker Setup

**Feature 221**: Self-hosted appointment scheduling system with MySQL backend.

## Quick Start

```bash
# Start Easy!Appointments + MySQL
cd docker/easyappointments
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove all data (WARNING: destructive!)
docker-compose down -v
```

## First-Time Setup

### 1. Access the Application

Open your browser to: **http://localhost:8080**

### 2. Complete Installation Wizard

1. **Database Setup** (auto-configured via docker-compose):
   - Host: `mysql`
   - Database: `easyappointments`
   - Username: `easyappointments`
   - Password: `easyappointments_password_change_me`

2. **Admin Account**:
   - Email: Your admin email
   - Password: Choose a strong password
   - **IMPORTANT**: Change the default password immediately after first login

3. **Company Info**:
   - Company Name
   - Email
   - Address (optional)

### 3. Enable API Access

After installation:

1. Log in as admin
2. Go to **Settings** → **API** (in the top menu)
3. Enable **API** toggle
4. Click **Generate API Key**
5. **Copy and save the API key** — you'll need it for integration

### 4. Configure Environment Variables

Add to your `.env`:

```bash
# Easy!Appointments Configuration
SCHEDULING_PROVIDER=easyappointments
EASYAPPOINTMENTS_API_URL=http://localhost:8080
EASYAPPOINTMENTS_API_KEY=your_api_key_here
EASYAPPOINTMENTS_SERVICE_ID=1  # Get from Settings → Services
```

## Configuration

### Add a Service

1. Go to **Settings** → **Services**
2. Click **Add Service**
3. Configure:
   - **Name**: e.g., "30-Minute Consultation"
   - **Duration**: 30 minutes
   - **Price**: (optional)
   - **Description**: Brief description
4. Click **Save**
5. Note the **Service ID** (visible in the URL or API response)

### Add a Provider (Staff)

1. Go to **Settings** → **Users** → **Providers**
2. Click **Add Provider**
3. Configure:
   - **First Name / Last Name**
   - **Email**
   - **Phone**
   - **Services**: Assign the services this provider offers
   - **Working Hours**: Set availability schedule
4. Click **Save**

### Working Hours

Set provider availability:

1. Edit a provider
2. Go to **Working Plan** tab
3. Configure hours for each day:
   - **Start**: 09:00
   - **End**: 17:00
   - **Breaks**: Add lunch breaks or time off
4. Click **Save**

## API Integration

### Test API Connection

```bash
# Health check
curl -X GET \
  "http://localhost:8080/index.php/api/v1/appointments" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Common API Endpoints

```bash
# List Services
GET /index.php/api/v1/services
Authorization: Bearer YOUR_API_KEY

# List Providers
GET /index.php/api/v1/providers
Authorization: Bearer YOUR_API_KEY

# Check Availability
GET /index.php/api/v1/availabilities?provider_id=1&service_id=1&date=2026-04-10
Authorization: Bearer YOUR_API_KEY

# Create Appointment
POST /index.php/api/v1/appointments
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "start": "2026-04-10 10:00:00",
  "end": "2026-04-10 10:30:00",
  "service_id": 1,
  "provider_id": 1,
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL hostname | `mysql` |
| `DB_NAME` | Database name | `easyappointments` |
| `DB_USERNAME` | Database user | `easyappointments` |
| `DB_PASSWORD` | Database password | `easyappointments_password_change_me` |
| `BASE_URL` | Application URL | `http://localhost:8080` |
| `LANGUAGE` | UI language | `english` |
| `DEBUG_MODE` | Enable debug logs | `FALSE` |
| `SMTP_HOST` | SMTP server (optional) | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_CRYPTO` | Encryption (tls/ssl) | `tls` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |

## Email Notifications (Optional)

To enable appointment confirmation emails:

1. Edit `docker-compose.yml`
2. Uncomment SMTP environment variables
3. Configure with your email provider:
   - **Gmail**: Use App Password (not your regular password)
   - **SendGrid**: Use API key as password
   - **AWS SES**: Configure SMTP credentials
4. Restart: `docker-compose restart`

### Gmail Example

```yaml
SMTP_HOST: smtp.gmail.com
SMTP_PORT: 587
SMTP_CRYPTO: tls
SMTP_USER: your-email@gmail.com
SMTP_PASS: your-app-password
```

**Enable Gmail App Passwords**: https://support.google.com/accounts/answer/185833

## Backup & Restore

### Backup Database

```bash
docker exec easyappointments-mysql mysqldump \
  -u easyappointments \
  -peasyappointments_password_change_me \
  easyappointments > backup.sql
```

### Restore Database

```bash
docker exec -i easyappointments-mysql mysql \
  -u easyappointments \
  -peasyappointments_password_change_me \
  easyappointments < backup.sql
```

## Troubleshooting

### Port Already in Use

If port 8080 is taken, edit `docker-compose.yml`:

```yaml
ports:
  - "8081:80"  # Use 8081 instead
```

Update `BASE_URL` to match:

```yaml
BASE_URL: http://localhost:8081
```

### Can't Connect to Database

Check MySQL is healthy:

```bash
docker-compose logs mysql
docker exec easyappointments-mysql mysql -uroot -proot_password_change_me -e "SHOW DATABASES;"
```

### API Returns 401 Unauthorized

1. Verify API is enabled in Settings → API
2. Check API key is correct
3. Ensure `Authorization: Bearer YOUR_KEY` header is present

### Reset Admin Password

```bash
# Connect to MySQL
docker exec -it easyappointments-mysql mysql -uroot -proot_password_change_me easyappointments

# Update admin password (hashed as 'newpassword')
UPDATE ea_users
SET password = '$2y$10$K7O/MV6CneZ6.V1FuT3Q1.m1r2L/H8YJ0h8qTxO3F4kF7wXYlLF2K'
WHERE id_roles = 1;
```

Then log in with password: `newpassword`

## Production Deployment

### Security Checklist

- [ ] Change default MySQL passwords in `docker-compose.yml`
- [ ] Change admin password after installation
- [ ] Enable HTTPS (use Nginx reverse proxy)
- [ ] Restrict API access (IP whitelist or additional auth layer)
- [ ] Set `DEBUG_MODE=FALSE`
- [ ] Configure automated database backups
- [ ] Use strong API keys (regenerate if compromised)

### HTTPS with Nginx

Example Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name appointments.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Update `BASE_URL` in `docker-compose.yml`:

```yaml
BASE_URL: https://appointments.yourdomain.com
```

## Resources

- **Official Docs**: https://docs.easyappointments.org/
- **API Reference**: https://easyappointments.org/docs/api/
- **Docker Hub**: https://hub.docker.com/r/easyappointments/easyappointments
- **GitHub**: https://github.com/alextselegidis/easyappointments

## Support

For issues with:
- **Docker setup**: Check logs and troubleshooting section above
- **Easy!Appointments**: Visit https://github.com/alextselegidis/easyappointments/issues
- **Voice AI Agent integration**: See main project README

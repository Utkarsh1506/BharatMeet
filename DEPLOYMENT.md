# Socket.IO Production Deployment Guide

## 🚨 Critical: Vercel Incompatibility

**Socket.IO requires a persistent Node.js server and will NOT work on Vercel's serverless platform.**

Vercel's serverless functions cannot maintain the long-lived connections required for WebSocket/Socket.IO communication. The current implementation will fail in production if deployed to Vercel.

## Deployment Options

### Option 1: Split Architecture (Recommended)

Deploy the Next.js app on Vercel and Socket.IO on a separate persistent server.

#### Architecture:
```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Vercel    │────▶│   Railway    │────▶│   PostgreSQL    │
│  (Next.js)  │     │  (Socket.IO) │     │   (Database)    │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    ▲
       │                    │
       └────────────────────┘
         WebSocket connections
```

#### Steps:

1. **Deploy Next.js to Vercel:**
   - Remove `pages/api/socket/` directory
   - Update `NEXT_PUBLIC_SITE_URL` to point to your Socket.IO server
   - Deploy as normal

2. **Deploy Socket.IO to Railway/Render/Fly.io:**
   
   Create a standalone Node.js server:

   ```javascript
   // server.js
   const { createServer } = require('http');
   const { Server } = require('socket.io');
   const { PrismaClient } = require('@prisma/client');
   
   const httpServer = createServer();
   const io = new Server(httpServer, {
     cors: {
       origin: process.env.ALLOWED_ORIGINS.split(','),
       credentials: true,
     },
   });
   
   const prisma = new PrismaClient();
   
   // Copy Socket.IO handler logic from pages/api/socket/io.ts
   
   const PORT = process.env.PORT || 3001;
   httpServer.listen(PORT, () => {
     console.log(`Socket.IO server running on port ${PORT}`);
   });
   ```

3. **Update Client Configuration:**
   ```typescript
   // components/providers/socket-provider.tsx
   const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
   socketInstance = ClientIO(socketUrl, {
     // ... configuration
   });
   ```

#### Recommended Platforms for Socket.IO:
- **Railway** - Easy deployment, automatic HTTPS
- **Render** - Free tier available, good for testing
- **Fly.io** - Global edge deployment
- **DigitalOcean App Platform** - Reliable, scalable

### Option 2: Migrate to Managed Real-time Service

Replace Socket.IO with a managed service that works with serverless.

#### Recommended Services:

**1. Pusher** (Most similar to Socket.IO)
```bash
npm install pusher pusher-js
```

**2. Ably** (Most feature-rich)
```bash
npm install ably
```

**3. Supabase Realtime** (If using Supabase)
```bash
npm install @supabase/supabase-js
```

**4. Socket.io with Redis Adapter** (On serverless-compatible platform)
- Use Upstash Redis for state management
- Deploy to AWS Lambda/Fargate

### Option 3: Self-host Everything

Deploy the entire stack to a VPS or container platform.

#### Platforms:
- **DigitalOcean Droplet**
- **AWS EC2 / ECS**
- **Google Cloud Run** (with persistent connections)
- **Azure Container Instances**

#### Docker Setup:
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
    restart: unless-stopped
```

## Current Implementation Issues

### 1. Rate Limiting in Serverless
- Upstash Redis works with serverless
- In-memory fallback only works for single instance
- **Solution:** Always use Redis in production

### 2. Database Connection Pooling
- Current configuration works for persistent servers
- Serverless needs connection pooling proxy
- **Solution:** Use PgBouncer or Supabase Pooler

### 3. Environment Variables
```env
# Required for split architecture
NEXT_PUBLIC_SOCKET_URL=https://socket.your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Required for production
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## Migration Checklist

### Before Deploying to Production:

- [ ] Choose deployment architecture (split, managed service, or self-host)
- [ ] Set up Redis (Upstash) for rate limiting
- [ ] Configure database connection pooling
- [ ] Update CORS origins for production domain
- [ ] Set all environment variables
- [ ] Test WebSocket connections from production domain
- [ ] Set up monitoring and logging
- [ ] Configure SSL/TLS certificates
- [ ] Test reconnection logic
- [ ] Load test Socket.IO connections
- [ ] Set up backup strategy
- [ ] Document deployment process

### If Using Split Architecture:

- [ ] Deploy Socket.IO server separately
- [ ] Update `NEXT_PUBLIC_SOCKET_URL` environment variable
- [ ] Configure CORS for both services
- [ ] Test cross-origin WebSocket connections
- [ ] Set up health checks for Socket.IO server
- [ ] Configure load balancing if needed
- [ ] Set up SSL for both services

### If Migrating to Managed Service:

- [ ] Choose managed service (Pusher/Ably/Supabase)
- [ ] Create account and get API keys
- [ ] Refactor Socket.IO code to use new service API
- [ ] Update client-side connection logic
- [ ] Test all real-time features
- [ ] Update rate limiting configuration
- [ ] Monitor usage and costs

## Performance Considerations

### Connection Limits:
- **Railway Free:** ~100 concurrent connections
- **Render Free:** ~100 concurrent connections
- **Fly.io:** Scale based on instance size
- **Managed Services:** Check plan limits

### Scaling Strategy:
1. Start with single instance
2. Add Redis adapter for multi-instance
3. Use sticky sessions or Redis pub/sub
4. Consider regional deployment

## Monitoring

### Key Metrics to Track:
- Active WebSocket connections
- Connection duration
- Message throughput
- Error rates
- Server CPU/memory usage
- Database connection pool usage

### Recommended Tools:
- **Sentry** - Error tracking
- **Datadog/New Relic** - APM
- **Grafana** - Metrics visualization
- **Better Stack** - Log management

## Cost Estimates (Monthly)

### Split Architecture:
- Vercel (Next.js): $0-20 (Pro plan)
- Railway (Socket.IO): $5-20 (shared CPU)
- PostgreSQL: Included or $5-15
- **Total: $10-55/month**

### Managed Service:
- Vercel (Next.js): $0-20
- Pusher: $0-49 (depends on connections)
- PostgreSQL: $5-15
- **Total: $5-84/month**

### Self-hosted:
- DigitalOcean Droplet: $6-40/month
- PostgreSQL: Included
- **Total: $6-40/month**

## Support

For deployment issues, check:
1. Vercel deployment logs
2. Socket.IO server logs (if split)
3. Browser console for connection errors
4. Network tab for WebSocket handshake

## References

- [Socket.IO Production Guide](https://socket.io/docs/v4/performance-tuning/)
- [Vercel Limitations](https://vercel.com/docs/concepts/limits/overview)
- [Railway Deployment](https://docs.railway.app/)
- [Pusher Migration Guide](https://pusher.com/docs/channels/getting_started/javascript)

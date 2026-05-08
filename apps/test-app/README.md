# Public
curl http://localhost:3000/health

# Register — handled by AuthModule
curl -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'

# Me — 401 without token, user object with token
curl http://localhost:3000/me \
  -H 'authorization: Bearer <token>'

# Projects — 401 without token, 403 without permission, 200 with both
curl http://localhost:3000/projects \
  -H 'authorization: Bearer <token>'

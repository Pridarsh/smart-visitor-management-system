# ---- Build stage ----
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  
  # ---- Run stage (nginx) ----
  FROM nginx:alpine
  
  # Your backend app host (no scheme)
  ENV BACKEND_HOST=svm-backend-app-gycabreyg3g7c7aj.eastus-01.azurewebsites.net
  
  # Nginx: proxy ALL /api* to backend; do NOT override Host
  RUN printf "server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
  \n\
    # Proxy any /api or /api/... to backend, preserve URI\n\
    location /api {\n\
      proxy_http_version 1.1;\n\
      proxy_set_header Connection \"\";\n\
      # DO NOT set Host $host; let nginx send backend host from proxy_pass\n\
      # proxy_set_header Host \$host;  # <-- removed\n\
      proxy_set_header X-Real-IP \$remote_addr;\n\
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
      proxy_set_header X-Forwarded-Proto \$scheme;\n\
      proxy_ssl_server_name on;\n\
      proxy_pass https://$BACKEND_HOST;\n\
    }\n\
  \n\
    # SPA fallback for client routes\n\
    location / {\n\
      try_files \$uri /index.html;\n\
    }\n\
  }\n" > /etc/nginx/conf.d/default.conf
  
  # If your build output is Vite (dist):
  COPY --from=build /app/dist /usr/share/nginx/html
  # If Create React App (build), use this instead:
  # COPY --from=build /app/build /usr/share/nginx/html
  
  EXPOSE 80
  
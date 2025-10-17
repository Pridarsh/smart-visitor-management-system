# ---- Build stage ----
    FROM node:20-alpine AS build
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    # Build your app (Vite/CRA/etc.)
    RUN npm run build
    
    # ---- Run stage (nginx) ----
    FROM nginx:alpine
    
    # Minimal SPA config: serve index.html for client-side routes
    RUN printf "server {\n\
      listen 80;\n\
      server_name _;\n\
      root /usr/share/nginx/html;\n\
      index index.html;\n\
      location / {\n\
        try_files \$uri /index.html;\n\
      }\n\
    }\n" > /etc/nginx/conf.d/default.conf
    
    # Copy the build output (use the one you actually produce)
    # If Vite: dist ; If Create React App: build
    COPY --from=build /app/dist /usr/share/nginx/html
    # COPY --from=build /app/build /usr/share/nginx/html
    
    EXPOSE 80
    
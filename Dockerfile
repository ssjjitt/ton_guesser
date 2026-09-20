FROM node:20-slim

WORKDIR /app

# Копируем package.json и устанавливаем зависимости бекенда
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Копируем package.json и устанавливаем зависимости фронтенда
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Копируем исходники
COPY backend ./backend
COPY frontend ./frontend

# Собираем фронтенд (Vite)
RUN cd frontend && npm run build

# Собираем бекенд (NestJS)
RUN cd backend && npm run build

# Создаем папку для загрузок
RUN mkdir -p /app/backend/uploads

# Открываем порт 3000
EXPOSE 3000

# Запускаем бекенд
WORKDIR /app/backend
CMD ["node", "dist/main.js"]

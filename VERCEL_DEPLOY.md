# 🚀 Инструкция: Деплой на Vercel + Render + Vercel Postgres + Vercel Blob

Поскольку Vercel не имеет постоянного файлового хранилища, мы разбиваем приложение на микросервисы. Я уже подготовила код для работы в такой архитектуре!

## Шаг 1: Подготовка БД (Vercel Postgres)
1. Зайдите на [Vercel](https://vercel.com/dashboard) и перейдите во вкладку **Storage**.
2. Создайте базу данных **Postgres** (бесплатно).
3. В настройках базы (вкладка `.env.local` или `Credentials`) найдите переменную `POSTGRES_URL` и скопируйте её значение.

## Шаг 2: Подготовка Файлового Хранилища (Vercel Blob)
1. В той же вкладке **Storage** на Vercel создайте хранилище **Blob** (бесплатно).
2. Скопируйте переменную `BLOB_READ_WRITE_TOKEN`.

## Шаг 3: Деплой Бекенда (на Render.com)
Мы будем запускать бекенд на бесплатном сервере Render, так как он отлично держит NestJS-приложения.
1. Зарегистрируйтесь на [Render.com](https://render.com).
2. Нажмите **New** -> **Web Service** и подключите ваш репозиторий GitHub с проектом.
3. Укажите следующие настройки:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/main.js`
4. В разделе **Environment Variables** добавьте 3 переменные:
   - `PORT`: `10000`
   - `POSTGRES_URL`: *(вставьте ссылку из Шага 1)*
   - `BLOB_READ_WRITE_TOKEN`: *(вставьте токен из Шага 2)*
5. Нажмите **Create Web Service**. Дождитесь успешной сборки и скопируйте публичный URL бекенда (например, `https://ton-guesser-backend.onrender.com`).

*(Благодаря переменным окружения, наш бекенд автоматически отключит локальную SQLite-базу и папки `uploads/`, начав сохранять всё прямо в облако Vercel!)*

## Шаг 4: Деплой Фронтенда (на Vercel)
1. Зайдите на [Vercel](https://vercel.com/dashboard) и нажмите **Add New -> Project**.
2. Подключите ваш GitHub репозиторий.
3. Укажите настройки:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (определится автоматически)
4. В разделе **Environment Variables** добавьте:
   - `VITE_API_URL`: *(вставьте URL вашего бекенда из Шага 3, без слэша на конце!)*
5. Нажмите **Deploy**.

**Всё готово! 🎉** 
Теперь ваш фронтенд работает на молниеносных CDN от Vercel, бекенд крутится на Render, картинки безопасно лежат в Vercel Blob, а данные — в Vercel Postgres. И всё это абсолютно бесплатно!

ARG APP_VERSION=dev
ARG APP_COMMIT=unknown

FROM python:3.12-slim
WORKDIR /app

ARG APP_VERSION
ARG APP_COMMIT
ENV APP_VERSION=${APP_VERSION}
ENV APP_COMMIT=${APP_COMMIT}

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

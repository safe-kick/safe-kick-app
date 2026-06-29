FROM ubuntu:22.04

# 기본 패키지 설치
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# nvm 설치 및 Node.js v20.20.2 고정
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install 20.20.2 \
    && nvm use 20.20.2 \
    && nvm alias default 20.20.2

# PATH에 node 추가
ENV PATH="$NVM_DIR/versions/node/v20.20.2/bin:$PATH"

WORKDIR /app

EXPOSE 8081

CMD ["sh", "-c", "npm install && npx expo start --host lan"]

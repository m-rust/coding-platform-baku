FROM alpine:3.19

RUN apk add --no-cache \
    g++ \
    libc-dev \
    coreutils

RUN adduser -D -u 1000 coderunner

WORKDIR /app
USER coderunner

CMD ["sh"]

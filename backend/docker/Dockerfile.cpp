FROM alpine:3.19

RUN apk add --no-cache \
    g++ \
    gcc \
    make \
    coreutils \
    libc-dev

RUN adduser -D -u 1000 coderunner

WORKDIR /app

USER coderunner

CMD ["sh"]
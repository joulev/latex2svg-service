FROM oven/bun:debian
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN apt-get update && apt-get install -y pdf2svg
RUN bun install
CMD bun start

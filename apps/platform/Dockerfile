FROM node:18-alpine AS builder

ENV NODE_ENV development

RUN apk add --no-cache libc6-compat
RUN yarn global add turbo
RUN apk update

# Set working directory
WORKDIR /app
COPY . .

#RUN turbo prune --scope=docs --docker

# # Add lockfile and package.json's of isolated subworkspace
# FROM node:18-alpine AS installer

# RUN apk add --no-cache libc6-compat
# RUN apk update
# WORKDIR /app

# COPY .gitignore .gitignore
# COPY --from=builder /app/out/json/ .

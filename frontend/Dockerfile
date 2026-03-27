FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:3000/api/v1
ARG VITE_RAZORPAY_KEY_ID=

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_RAZORPAY_KEY_ID=${VITE_RAZORPAY_KEY_ID}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

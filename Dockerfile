FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Clear npm cache and install dependencies
RUN npm cache clean --force && \
    npm install

# Copy the rest of the application code
COPY . .

# Install netcat and postgresql-client for database operations
RUN apt-get update && \
    apt-get install -y netcat-traditional postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Create a script to wait for the database
RUN echo '#!/bin/sh\n\
echo "Waiting for database to be ready..."\n\
while ! nc -z db 5432; do\n\
  sleep 0.1\n\
done\n\
echo "Database is ready!"\n\
\n\
echo "Starting application..."\n\
npm run dev' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["/usr/src/app/start.sh"]
# News Article Saver

## Overview
The News Article Saver is a web application that allows users to save URLs of news articles for later reading. Users can manage their saved articles by adding new URLs, updating notes associated with each article, and deleting articles they no longer wish to keep. The articles are displayed in a list ordered by the date they were added.

## Features
- Save URLs of news articles
- Update notes for each article
- Delete articles from the list
- Articles displayed in order of creation date
- Responsive design using Bootstrap
- Category management for articles
- Admin account for system management
- Discord bot integration for article sharing
- Secure session management

## Technologies Used
- Node.js with Express framework
- PostgreSQL for the database
- EJS for templating
- Bootstrap for styling
- Docker for containerization
- Discord.js for bot integration
- Winston for logging

## Project Structure
```
news-article-saver
├── src
│   ├── app.js
│   ├── logger.js
│   ├── controllers
│   │   ├── articleController.js
│   │   ├── categoryController.js
│   │   └── index.js
│   ├── models
│   │   └── article.js
│   ├── routes
│   │   ├── index.js
│   │   └── categoryRoutes.js
│   ├── views
│   │   └── index.ejs
│   └── public
│       ├── css
│       │   └── styles.css
│       └── js
│           └── scripts.js
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
├── .env
├── .env.sample
└── .gitignore
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd news-article-saver
   ```

2. Copy the `.env.sample` file to `.env` and configure your environment variables:
   ```
   cp .env.sample .env
   ```
   Make sure to set up:
   - Database configuration
   - Admin account credentials
   - Discord bot token and permissions
   - Session secret
   - Invite code

3. Build and run the application using Docker:
   ```
   docker-compose up --build
   ```

4. Access the application at `http://localhost:3000`.

## Usage
- To add a new article, enter the URL and notes in the provided form and submit
- The list of articles will display the URLs along with their associated notes and the date they were added
- You can update notes or delete articles directly from the list
- Use categories to organize your articles
- The Discord bot can be used to share articles directly from Discord

## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License.
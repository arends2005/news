# News Article Saver

## Overview
The News Article Saver is a web application that allows users to save URLs of news articles for later reading. Users can manage their saved articles by adding new URLs, updating notes associated with each article, and deleting articles they no longer wish to keep. The articles are displayed in a list ordered by the date they were added.

## Features
- Save URLs of news articles
- Update notes for each article
- Delete articles from the list
- Articles displayed in order of creation date
- Responsive design using Bootstrap

## Technologies Used
- Node.js with Express framework
- PostgreSQL for the database
- EJS for templating
- Bootstrap for styling
- Docker for containerization

## Project Structure
```
news-article-saver
├── src
│   ├── app.js
│   ├── controllers
│   │   └── index.js
│   ├── models
│   │   └── article.js
│   ├── routes
│   │   └── index.js
│   ├── views
│   │   ├── index.ejs
│   │   └── layout.ejs
│   └── public
│       ├── css
│       │   └── styles.css
│       └── js
│           └── scripts.js
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
└── .env
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd news-article-saver
   ```

2. Create a `.env` file in the root directory and add your database connection details:
   ```
   DATABASE_URL=postgres://username:password@db:5432/news_article_saver
   ```

3. Build and run the application using Docker:
   ```
   docker-compose up --build
   ```

4. Access the application at `http://localhost:3000`.

## Usage
- To add a new article, enter the URL and notes in the provided form and submit.
- The list of articles will display the URLs along with their associated notes and the date they were added.
- You can update notes or delete articles directly from the list.

## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License.
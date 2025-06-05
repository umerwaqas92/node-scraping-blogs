# Blog Scraper API

A powerful Node.js API for scraping blog posts with detailed content extraction, section analysis, and image detection.

## Features

- 🔍 **Smart Content Extraction**: Automatically detects and extracts blog sections with headings
- 🖼️ **Image Analysis**: Finds main/banner images and associates images with content sections
- 📝 **Structured Data**: Returns well-organized JSON with titles, descriptions, sections, and metadata
- 🚀 **RESTful API**: Easy-to-use HTTP endpoints for integration
- 💾 **Auto-Save**: Optionally saves scraping results to JSON files
- 🛡️ **Error Handling**: Comprehensive error handling and validation

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd blog-scraper-api
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Health Check

```
GET /
```

Returns API status and available endpoints.

**Response:**

```json
{
  "message": "Blog Scraper API is running!",
  "version": "1.0.0",
  "endpoints": {
    "GET /": "API health check",
    "POST /scrape": "Scrape a blog post by URL",
    "GET /scrape/:encodedUrl": "Scrape a blog post by URL (GET method)"
  }
}
```

### Scrape Blog Post (POST)

```
POST /scrape
Content-Type: application/json

{
  "url": "https://example.com/blog-post"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/blog-post",
    "title": "Blog Post Title",
    "metaDescription": "Meta description of the blog post",
    "mainImage": {
      "src": "https://example.com/main-image.jpg",
      "alt": "Main Image Alt Text",
      "caption": "Image caption if available",
      "type": "featured-image"
    },
    "sections": [
      {
        "title": "Section Title",
        "content": "Section content...",
        "images": [
          {
            "src": "https://example.com/section-image.jpg",
            "alt": "Image alt text",
            "caption": "Image caption"
          }
        ],
        "headingLevel": "h2"
      }
    ],
    "allImages": [...],
    "fullContent": "Full blog post content...",
    "totalSections": 5,
    "totalImages": 8
  },
  "savedTo": "scrape-result-2024-01-01T12-00-00-000Z.json",
  "scrapedAt": "2024-01-01T12:00:00.000Z"
}
```

### Scrape Blog Post (GET)

```
GET /scrape/:encodedUrl
```

Where `:encodedUrl` is the URL-encoded blog post URL.

**Example:**

```bash
# URL: https://example.com/blog-post
# Encoded: https%3A%2F%2Fexample.com%2Fblog-post
GET /scrape/https%3A%2F%2Fexample.com%2Fblog-post
```

## Usage Examples

### Using cURL

**POST Request:**

```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://theaestheticloft.blog/vintage-bedroom-cabinet-3k5zj8xq2a/"}'
```

**GET Request:**

```bash
curl "http://localhost:3000/scrape/https%3A%2F%2Ftheaestheticloft.blog%2Fvintage-bedroom-cabinet-3k5zj8xq2a%2F"
```

### Using JavaScript/Fetch

```javascript
// POST request
const response = await fetch("http://localhost:3000/scrape", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://example.com/blog-post",
  }),
});

const data = await response.json();
console.log(data);

// GET request
const encodedUrl = encodeURIComponent("https://example.com/blog-post");
const response2 = await fetch(`http://localhost:3000/scrape/${encodedUrl}`);
const data2 = await response2.json();
```

### Using Python

```python
import requests

# POST request
response = requests.post('http://localhost:3000/scrape',
                        json={'url': 'https://example.com/blog-post'})
data = response.json()
print(data)

# GET request
import urllib.parse
encoded_url = urllib.parse.quote('https://example.com/blog-post', safe='')
response2 = requests.get(f'http://localhost:3000/scrape/{encoded_url}')
data2 = response2.json()
```

## Response Structure

The API returns detailed information about scraped blog posts:

- **url**: The original URL that was scraped
- **title**: Blog post title (from `<title>` tag or main `<h1>`)
- **metaDescription**: Meta description from page metadata
- **mainImage**: The main/featured/banner image of the blog post
- **sections**: Array of content sections with their associated images
- **allImages**: All images found on the page
- **fullContent**: Full text content of the blog post (truncated to 3000 chars)
- **totalSections**: Number of sections extracted
- **totalImages**: Total number of images found

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Invalid or missing URL
- **500 Internal Server Error**: Scraping failed or server error
- **404 Not Found**: Endpoint not found

**Error Response Format:**

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## File Storage

Scraped results are automatically saved to the `results/` directory with timestamped filenames:

- Format: `scrape-result-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- Only applies to POST requests

## Environment Variables

- `PORT`: Server port (default: 3000)

## Dependencies

- **express**: Web framework
- **puppeteer**: Headless browser for web scraping
- **cors**: Cross-origin resource sharing
- **nodemon**: Development auto-reload (dev dependency)

## License

MIT License

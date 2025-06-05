const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function scrapeBlogPost(url) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Extract blog data
    const blogData = await page.evaluate((url) => {
      // Get title
      const title = document.querySelector('title')?.textContent?.trim() || 
                   document.querySelector('h1')?.textContent?.trim() || '';
      
      // Get meta description
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                             document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      
      // Get main/banner/cover image
      const mainImage = (() => {
        // Try different selectors for main/featured/banner images
        const selectors = [
          'meta[property="og:image"]', // Open Graph image
          'meta[name="twitter:image"]', // Twitter card image
          '.featured-image img',
          '.post-thumbnail img',
          '.entry-thumbnail img',
          '.hero-image img',
          '.banner-image img',
          '.cover-image img',
          'article img:first-of-type',
          '.post-content img:first-of-type',
          '.entry-content img:first-of-type'
        ];
        
        for (const selector of selectors) {
          if (selector.startsWith('meta')) {
            const metaTag = document.querySelector(selector);
            if (metaTag && metaTag.getAttribute('content')) {
              return {
                src: metaTag.getAttribute('content'),
                alt: 'Main/Featured Image',
                caption: '',
                type: 'meta-tag'
              };
            }
          } else {
            const img = document.querySelector(selector);
            if (img && img.src && !img.src.includes('data:image')) {
              return {
                src: img.src,
                alt: img.alt || 'Main/Featured Image',
                caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
                type: 'featured-image'
              };
            }
          }
        }
        
        // Fallback: get the largest image in the article
        const allArticleImages = Array.from(document.querySelectorAll('article img, .post-content img, .entry-content img'));
        if (allArticleImages.length > 0) {
          // Sort by image size (width * height) if dimensions are available
          const largestImage = allArticleImages.reduce((largest, current) => {
            const currentSize = (current.naturalWidth || current.width || 0) * (current.naturalHeight || current.height || 0);
            const largestSize = (largest.naturalWidth || largest.width || 0) * (largest.naturalHeight || largest.height || 0);
            return currentSize > largestSize ? current : largest;
          });
          
          if (largestImage.src && !largestImage.src.includes('data:image')) {
            return {
              src: largestImage.src,
              alt: largestImage.alt || 'Main/Featured Image',
              caption: largestImage.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
              type: 'largest-image'
            };
          }
        }
        
        return null;
      })();
      
      // Get all images with their captions/alt text
      const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt || '',
        caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
        element: img
      })).filter(img => img.src && !img.src.includes('data:image'));
      
      // Extract sections with their content and associated images
      const sections = [];
      
      // Try to find headings (h1, h2, h3, h4, h5, h6)
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      
      headings.forEach((heading, index) => {
        const sectionTitle = heading.textContent?.trim();
        if (!sectionTitle) return;
        
        // Get content between this heading and the next heading
        let content = '';
        let sectionImages = [];
        let currentElement = heading.nextElementSibling;
        const nextHeading = headings[index + 1];
        
        while (currentElement && currentElement !== nextHeading) {
          // Extract text content
          if (currentElement.textContent?.trim()) {
            content += currentElement.textContent.trim() + '\n';
          }
          
          // Find images in this section
          const imagesInSection = currentElement.querySelectorAll('img');
          imagesInSection.forEach(img => {
            if (img.src && !img.src.includes('data:image')) {
              sectionImages.push({
                src: img.src,
                alt: img.alt || '',
                caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
              });
            }
          });
          
          currentElement = currentElement.nextElementSibling;
        }
        
        sections.push({
          title: sectionTitle,
          content: content.trim(),
          images: sectionImages,
          headingLevel: heading.tagName.toLowerCase()
        });
      });
      
      // If no sections found with headings, try to extract paragraphs as sections
      if (sections.length === 0) {
        const paragraphs = Array.from(document.querySelectorAll('p'));
        paragraphs.forEach((p, index) => {
          const content = p.textContent?.trim();
          if (content && content.length > 50) {
            // Find nearby images
            let sectionImages = [];
            const nextElement = p.nextElementSibling;
            if (nextElement && nextElement.querySelector('img')) {
              const img = nextElement.querySelector('img');
              if (img.src && !img.src.includes('data:image')) {
                sectionImages.push({
                  src: img.src,
                  alt: img.alt || '',
                  caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
                });
              }
            }
            
            sections.push({
              title: `Section ${index + 1}`,
              content: content,
              images: sectionImages,
              headingLevel: 'paragraph'
            });
          }
        });
      }
      
      // Get main content (try different selectors for blog content)
      const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content', 
        '.content',
        'main',
        '.blog-post',
        '[class*="content"]'
      ];
      
      let fullContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          fullContent = element.textContent?.trim() || '';
          if (fullContent.length > 100) break; // Found substantial content
        }
      }
      
      return {
        url,
        title,
        metaDescription,
        sections,
        allImages: allImages.map(img => ({
          src: img.src,
          alt: img.alt,
          caption: img.caption
        })),
        fullContent: fullContent.substring(0, 3000), // Increased limit
        totalSections: sections.length,
        totalImages: allImages.length,
        mainImage
      };
    }, url);
    
    return blogData;
    
  } catch (error) {
    console.error('Error scraping blog post:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// API Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Blog Scraper API is running!',
    version: '1.0.0',
    endpoints: {
      'GET /': 'API health check',
      'POST /scrape': 'Scrape a blog post by URL',
      'GET /scrape/:encodedUrl': 'Scrape a blog post by URL (GET method)'
    }
  });
});

// Scrape blog post endpoint (POST)
app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a URL in the request body'
      });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'Please provide a valid URL'
      });
    }
    
    console.log(`Scraping blog post: ${url}`);
    const result = await scrapeBlogPost(url);
    
    if (result) {
      // Optionally save to file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scrape-result-${timestamp}.json`;
      
      // Create results directory if it doesn't exist
      const resultsDir = path.join(__dirname, 'results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir);
      }
      
      fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify(result, null, 2));
      
      res.json({
        success: true,
        data: result,
        savedTo: filename,
        scrapedAt: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Scraping failed',
        message: 'Unable to scrape the provided URL'
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Scrape blog post endpoint (GET) - URL encoded in path
app.get('/scrape/:encodedUrl', async (req, res) => {
  try {
    const { encodedUrl } = req.params;
    
    if (!encodedUrl) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a URL in the path'
      });
    }
    
    // Decode the URL
    const url = decodeURIComponent(encodedUrl);
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'Please provide a valid URL'
      });
    }
    
    console.log(`Scraping blog post: ${url}`);
    const result = await scrapeBlogPost(url);
    
    if (result) {
      res.json({
        success: true,
        data: result,
        scrapedAt: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Scraping failed',
        message: 'Unable to scrape the provided URL'
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Blog Scraper API is running on port ${PORT}`);
  console.log(`📖 API Documentation:`);
  console.log(`   GET  http://localhost:${PORT}/                    - Health check`);
  console.log(`   POST http://localhost:${PORT}/scrape             - Scrape blog post`);
  console.log(`   GET  http://localhost:${PORT}/scrape/<encoded-url> - Scrape blog post (GET)`);
  console.log(`\n📝 Example usage:`);
  console.log(`   curl -X POST http://localhost:${PORT}/scrape -H "Content-Type: application/json" -d '{"url":"https://example.com/blog-post"}'`);
  console.log(`   curl http://localhost:${PORT}/scrape/https%3A%2F%2Fexample.com%2Fblog-post`);
});

module.exports = app;